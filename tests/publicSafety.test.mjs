import test from 'node:test';
import assert from 'node:assert/strict';
import {restrictedPath, scanText, scanFile} from '../scripts/check-public-safety.mjs';

test('allows fictional example email addresses and placeholder configuration', () => {
  const text = [
    'owner@example.com',
    'member@example.org',
    'SPREADSHEET_ID=<YOUR_REAL_SHEET_ID>',
    'OWNER_EMAIL=<your email>',
    '{"scriptId":"YOUR_EXISTING_PRODUCTION_SCRIPT_ID"}'
  ].join('\n');
  assert.deepEqual(scanText('README.md', text), []);
});

test('detects an actual-looking email without embedding one in the test source', () => {
  const privateEmail = ['private-person', 'gmail.com'].join('@');
  const result = scanText('src/Email.html', 'send to ' + privateEmail);
  assert.deepEqual(result, [
    {file: 'src/Email.html', line: 1, type: 'non-example email address'}
  ]);
});

test('detects a hard-coded spreadsheet URL and script ID', () => {
  const sheetLink = 'https://docs.google.com/spreadsheets/d/' + 'A'.repeat(38);
  const scriptIdLiteral = '"scriptId":"' + 'B'.repeat(38) + '"';
  const result = scanText('README.md', sheetLink + '\n' + scriptIdLiteral);
  assert.equal(result.length, 2);
  assert.equal(result[0].type, 'live Google Sheets/Drive/Apps Script link');
  assert.equal(result[1].type, 'hard-coded Apps Script or spreadsheet ID');
});

test('detects potential high-risk credentials without storing one in tests', () => {
  const token = 'ghp_' + 'B'.repeat(32);
  const result = scanText('src/Code.js', token);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'potential credential');
});

test('rejects confidential clasp, credentials and private-data exports', () => {
  for (const name of [
    '.clasp.json', '.clasprc.json', '.clasp-prod.json',
    '.env', '.env.production', 'service-account.json',
    'participant-payments.csv', 'payments.xlsx',
    'Tracker-export.pdf', 'screenshot.png', 'bank-backup.zip',
    'secret.key', 'oauth-token.json'
  ]) {
    assert.ok(restrictedPath(name), name + ' should be restricted');
  }
  assert.equal(restrictedPath('.env.example'), null);
  assert.equal(restrictedPath('src/Code.js'), null);
  assert.equal(restrictedPath('docs/script-properties.example.md'), null);
});

test('rejects binary files and reports only categories and locations', () => {
  const issues = scanFile('data/private.bin', Buffer.from([0, 1, 2]));
  assert.equal(issues[0].type, 'binary file needs privacy review');
  assert.equal(issues[0].line, 0);
  assert.equal(Object.keys(issues[0]).sort().join(','), 'file,line,type');
});

test('does not confuse ordinary code that reads secure Script Properties with a secret', () => {
  const source = [
    "const spreadsheetId = settings.getProperty('SPREADSHEET_ID');",
    'const project = {scriptId: config.scriptId, rootDir: "./src"};',
    'const email = settings.getProperty("OWNER_EMAIL");'
  ].join('\n');
  assert.deepEqual(scanText('src/Globals.gs', source), []);
});
