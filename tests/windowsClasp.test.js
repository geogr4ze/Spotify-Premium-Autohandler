import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWindowsCommand} from '../scripts/dev-clasp.mjs';

test('Windows clasp command quotes project titles containing spaces', () => {
  const actual = buildWindowsCommand('clasp', [
    'create-script', '--title', 'Spotify Premium Autohandler DEV',
    '--type', 'standalone'
  ]);
  assert.equal(actual,
    'clasp create-script --title "Spotify Premium Autohandler DEV" --type standalone');
});

test('Windows shell arguments with command separators are rejected', () => {
  assert.throws(
    () => buildWindowsCommand('clasp', ['create-script', '--title', 'DEV & echo unsafe']),
    /Unsafe Windows shell argument/
  );
});

test('Windows clasp upload command remains unchanged', () => {
  assert.equal(buildWindowsCommand('clasp', ['push']), 'clasp push');
});
