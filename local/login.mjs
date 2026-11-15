import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { launchAccount, openCheckinPage, queryStatus, profileDirectory } from './lib.mjs';

const index = Number(process.argv[2]);
if (index !== 1 && index !== 2) throw new Error('Usage: node login.mjs 1|2');
const prompt = createInterface({ input: stdin, output: stdout });
let browser;
try {
  browser = await launchAccount(index);
  await openCheckinPage(browser);
  console.log('Account ' + index + ': please sign in normally in the newly opened Edge window.');
  console.log('Do any required human verification yourself. Do not use a personal Edge profile.');
  await prompt.question('When the site shows you as logged in, press Enter here to verify the session...');
  const page = await openCheckinPage(browser);
  const status = await queryStatus(page);
  console.log('Account ' + index + ' login verified; remaining days: ' + (status.leftDays ?? 'unknown'));
  console.log('Encrypted local browser session is stored by Edge at: ' + profileDirectory(index));
} catch (error) {
  console.error('Account ' + index + ' setup failed: ' + error.message);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  prompt.close();
}
