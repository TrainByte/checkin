import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
export const dataDirectory = path.join(localAppData, 'GLaDOSCheckin');
const origin = 'https://glados.cloud';

export function profileDirectory(index) {
  if (index !== 1 && index !== 2) throw new Error('Only account 1 and 2 are supported');
  return path.join(dataDirectory, 'profiles', 'account-' + index);
}

export async function launchAccount(index) {
  const userDataDir = profileDirectory(index);
  await fs.mkdir(userDataDir, { recursive: true });
  // This is a dedicated, persistent local Edge profile, never the real daily-use profile.
  // No automation-identity spoofing or interaction with the Turnstile challenge.
  return await chromium.launchPersistentContext(userDataDir, {
    channel: 'msedge',
    headless: false,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1200, height: 850 },
  });
}

export async function openCheckinPage(context) {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(origin + '/console/checkin', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  return page;
}

async function getJSON(page, pathName) {
  return await page.evaluate(async (p) => {
    const response = await fetch(p, {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error('Response is not JSON (HTTP ' + response.status + ')');
    }
    if (!response.ok) throw new Error('HTTP ' + response.status + ' from ' + p);
    return body;
  }, pathName);
}

export async function queryStatus(page) {
  const body = await getJSON(page, '/api/user/status');
  if (body?.code !== 0) {
    throw new Error('Login/session validation failed: ' + (body?.message || 'code=' + body?.code));
  }
  const days = Number(body?.data?.leftDays);
  return { leftDays: Number.isFinite(days) ? days : null };
}

export async function queryPoints(page) {
  const body = await getJSON(page, '/api/user/points');
  if (body?.code !== 0) throw new Error('Points API: ' + (body?.message || 'code=' + body?.code));
  const points = Number(body?.points);
  const streak = Number(body?.streak);
  return {
    points: Number.isFinite(points) ? points : null,
    streak: Number.isFinite(streak) ? streak : null,
    history: body?.history || body?.list || [],
  };
}

const beijingDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number'
    ? new Date(value < 1e12 ? value * 1000 : value)
    : new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(parsed.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
};

export function hasTodayRecord(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const today = beijingDate(Date.now());
  const dates = history.slice(0, 15).map((entry) => {
    return beijingDate(entry?.time ?? entry?.createdAt ?? entry?.created_at ?? entry?.date);
  }).filter(Boolean);
  return dates.length > 0 ? dates.includes(today) : null;
}

export const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function sendNotification(results) {
  const token = (process.env.PUSHPLUS_TOKEN || '').trim();
  if (!token) {
    console.log('PushPlus token is not configured; only local logs were produced.');
    return;
  }
  const succeeded = results.filter((r) => r.ok).length;
  const title = succeeded === 2 ? 'GLaDOS 双账号签到成功' : 'GLaDOS 签到异常 (' + succeeded + '/2)';
  const content = results.map((r) => {
    const state = r.ok ? '✅' : '❌';
    const info = [
      state + ' 账号 ' + r.index + ': ' + r.message,
      r.points === null || r.points === undefined ? '' : '积分: ' + r.points,
      r.leftDays === null || r.leftDays === undefined ? '' : '剩余天数: ' + r.leftDays,
    ].filter(Boolean).join('；');
    return info;
  }).join('\n\n');
  const response = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, title, content, template: 'markdown' }),
  });
  const body = await response.json();
  if (!response.ok || body?.code !== 200) {
    throw new Error('PushPlus returned a failure: ' + (body?.msg || response.status));
  }
  console.log('PushPlus notification delivered.');
}
