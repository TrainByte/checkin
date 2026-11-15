import fs from 'node:fs/promises';
import path from 'node:path';
import {
  dataDirectory,
  hasTodayRecord,
  launchAccount,
  openCheckinPage,
  queryPoints,
  queryStatus,
  sendNotification,
} from './lib.mjs';

const accountIds = [1, 2];
const results = [];
const now = new Date();
const logFile = path.join(dataDirectory, 'logs', now.toISOString().slice(0, 10) + '.log');

function compactError(error) {
  return String(error?.message || error).replace(/\s+/g, ' ').slice(0, 350);
}

async function runAccount(index) {
  let context;
  let page;
  try {
    context = await launchAccount(index);
    page = await openCheckinPage(context);
    // Never submit a check-in if we can independently verify it was completed today.
    const before = await queryPoints(page);
    const recordedBefore = hasTodayRecord(before.history);
    if (recordedBefore === true) {
      const status = await queryStatus(page);
      return {
        index, ok: true, message: '今天已经签到（积分流水已核实）',
        points: before.points, leftDays: status.leftDays,
      };
    }

    await queryStatus(page);

    // Automate only the ordinary website check-in action. Do not touch
    // Cloudflare/Turnstile widgets or emulate a real person's verification.
    const button = page.getByRole('button', { name: /check\s*in|签到/i }).first();
    await button.waitFor({ state: 'visible', timeout: 25000 });
    if (!(await button.isEnabled())) {
      throw new Error('签到按钮不可用；如页面要求真人验证，请本人在 Edge 中完成');
    }

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/user/checkin') &&
      response.request().method() === 'POST', { timeout: 50000 }
    ).catch(() => null);
    await button.click({ timeout: 10000 });

    const response = await responsePromise;
    let responseBody = null;
    if (response) {
      try { responseBody = await response.json(); } catch {}
    }

    const after = await queryPoints(page);
    const recordedAfter = hasTodayRecord(after.history);
    // An API success code alone is not enough to claim a completed check-in.
    const confirmed = recordedAfter === true;

    if (!confirmed) {
      const reason = responseBody?.message || (
        recordedAfter === false ? '今日积分流水没有签到记录' :
        '无法确认签到成功'
      );
      throw new Error('未能确认签到成功：' + reason +
        '。如果 Cloudflare 要求交互，请在本机 Edge 手动完成');
    }

    const status = await queryStatus(page);
    return {
      index, ok: true, message: recordedAfter === true ?
        '签到成功（积分流水已核实）' : '签到接口成功（流水暂无法解析）',
      points: after.points, leftDays: status.leftDays,
    };
  } catch (error) {
    const message = compactError(error);
    return { index, ok: false, message, points: null, leftDays: null };
  } finally {
    await context?.close().catch(() => {});
  }
}

await fs.mkdir(path.dirname(logFile), { recursive: true });
for (const index of accountIds) {
  const result = await runAccount(index);
  results.push(result);
  console.log('Account ' + index + ': ' + result.message);
}
let notificationError = null;
try {
  await sendNotification(results);
} catch (error) {
  notificationError = compactError(error);
  console.error('Notification failed: ' + notificationError);
}
const status = results.every((r) => r.ok) && !notificationError ? 0 : 1;
const lines = [
  new Date().toISOString(),
  ...results.map((r) => 'Account ' + r.index + ' => ' + (r.ok ? 'OK' : 'FAIL') +
    '; ' + r.message + '; points=' + (r.points ?? '?') +
    '; leftDays=' + (r.leftDays ?? '?')),
  ...(notificationError ? ['NOTIFY ERROR: ' + notificationError] : []),
  'Exit code: ' + status,
  '',
];
await fs.appendFile(logFile, lines.join('\r\n'), 'utf8');
process.exitCode = status;
