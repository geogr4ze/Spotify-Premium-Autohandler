#!/usr/bin/env node
/**
 * Public-source guard: scan tracked files for personal emails, spreadsheet URLs,
 * credentials, and private data exports. Reports locations only, never values.
 * This is a supplement to GitHub secret scanning / Gitleaks, not a guarantee.
 */
import {readFileSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const reservedDomains = new Set([
  'example.com', 'example.org', 'example.net', 'example',
  'invalid', 'test', 'localhost'
]);

export function restrictedPath(fileName) {
  const normalized = fileName.replace(/\\/g, '/');
  const base = path.posix.basename(normalized).toLowerCase();
  if (/^\.env(?:\..+)?$/.test(base) &&
      !['.env.example', '.env.sample', '.env.template'].includes(base)) {
    return 'environment configuration';
  }
  if (/^\.clasp(?:rc|-[\w-]+)?\.json$/.test(base)) {
    return 'Apps Script authentication or deployment configuration';
  }
  if (/(?:credential|service.account|oauth|access.token|refresh.token|secret)[\w.-]*\.json$/i.test(base)) {
    return 'credential-bearing JSON filename';
  }
  if (/\.(?:csv|tsv|xlsx?|ods|sqlite3?|db|pdf|zip|7z|tar|gz|p12|pfx|pem|key)$/i.test(base)) {
    return 'private-data export or credential file type';
  }
  if (/\.(?:png|jpe?g|gif|webp|bmp|tiff?)$/i.test(base)) {
    return 'image/screenshot requiring privacy review';
  }
  return null;
}

const checks = [
  {
    type: 'potential credential',
    regex: /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AIza[0-9A-Za-z_-]{20,}|ya29\.[A-Za-z0-9_-]{15,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g
  },
  {
    type: 'live Google Sheets/Drive/Apps Script link',
    regex: /https?:\/\/(?:docs\.google\.com\/spreadsheets\/d\/|drive\.google\.com\/file\/d\/|script\.google\.com\/(?:d\/|home\/projects\/))[A-Za-z0-9_-]{20,}/gi
  },
  {
    type: 'hard-coded Apps Script or spreadsheet ID',
    regex: /\b(?:SPREADSHEET_ID|spreadsheetId|scriptId)\s*["']?\s*[:=]\s*["'](?!YOUR_|EXAMPLE_|TEST_|DEV_|PROD_)[A-Za-z0-9_-]{28,}["']/gi
  }
];

export function scanText(fileName, source) {
  const failures = [];
  const emailRegex = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,}|(?:example|invalid|test|localhost))\b/gi;
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    emailRegex.lastIndex = 0;
    for (const match of line.matchAll(emailRegex)) {
      if (!reservedDomains.has(match[1].toLowerCase())) {
        failures.push({file: fileName, line: i + 1, type: 'non-example email address'});
      }
    }
    for (const check of checks) {
      check.regex.lastIndex = 0;
      if (check.regex.test(line)) {
        failures.push({file: fileName, line: i + 1, type: check.type});
      }
    }
  }
  return failures;
}

export function scanFile(fileName, bytes) {
  const problems = [];
  const restricted = restrictedPath(fileName);
  if (restricted) problems.push({file: fileName, line: 0, type: restricted});
  if (bytes.length > 1024 * 1024) {
    problems.push({file: fileName, line: 0, type: 'file larger than 1 MiB'});
    return problems;
  }
  if (bytes.includes(0)) {
    problems.push({file: fileName, line: 0, type: 'binary file needs privacy review'});
    return problems;
  }
  const text = bytes.toString('utf8');
  if (text.includes('\uFFFD')) {
    problems.push({file: fileName, line: 0, type: 'non-UTF-8 data'});
    return problems;
  }
  return problems.concat(scanText(fileName, text));
}

function main() {
  const git = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 10 * 1024 * 1024
  });
  if (git.error || git.status !== 0) {
    console.error('Public-source scan failed: git ls-files is unavailable.');
    process.exitCode = 1;
    return;
  }

  const files = git.stdout.toString('utf8').split('\0').filter(Boolean);
  const failures = [];
  for (const file of files) {
    const fullPath = path.join(root, file);
    try {
      if (!statSync(fullPath).isFile()) continue;
      failures.push(...scanFile(file, readFileSync(fullPath)));
    } catch {
      failures.push({file, line: 0, type: 'tracked file could not be scanned'});
    }
  }

  if (failures.length) {
    console.error('Public-source check blocked ' + failures.length + ' possible privacy/security issue(s).');
    for (const result of failures) {
      // Never print the matched email, token, account, or spreadsheet ID.
      const safePath = result.file
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-filename]')
        .replace(/[^\x20-\x7E]/g, '?');
      console.error(' - ' + safePath + ':' + result.line + ' — ' + result.type);
    }
    console.error('Do not post the blocked values in a GitHub issue or PR.');
    process.exitCode = 1;
  } else {
    console.log('Public-source check passed (' + files.length + ' tracked files checked).');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
