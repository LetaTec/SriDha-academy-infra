import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The browser tests' API uses the console mailer, which also appends each
// email to this file (MAIL_CONSOLE_FILE). Ignored by git (*.log).
export const MAILBOX_FILE = fileURLToPath(
  new URL('../e2e-mail.log', import.meta.url),
);

// The newest 6-digit code emailed to `email` for `template`, waiting up to
// 10 seconds for it (the API sends without waiting)
export const readEmailedCode = async (
  email: string,
  template: 'sign_up_code' | 'password_reset_code',
) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const text = await readFile(MAILBOX_FILE, 'utf8').catch(() => '');
    const code = text
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as Record<string, string>)
      .filter(entry => entry.template === template && entry.email === email)
      .at(-1)?.code;
    if (code) return code;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`No ${template} email reached ${email}`);
};
