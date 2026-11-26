#!/usr/bin/env node
/**
 * Opt-in local Git pre-commit privacy guard. Does not overwrite existing hooks.
 * GitHub Actions and repository push protection are still required.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const result = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], {
  cwd: root, encoding: 'utf8'
});
if (result.error || result.status !== 0 || !result.stdout.trim()) {
  console.error('Could not locate Git hooks; run inside your Git checkout.');
  process.exitCode = 1;
} else {
  const hooksDirectory = path.resolve(root, result.stdout.trim());
  const hook = path.join(hooksDirectory, 'pre-commit');
  const contents = [
    '#!/bin/sh',
    '# Installed by Spotify Premium Autohandler; scans the Git index, not unstaged files.',
    'node scripts/check-public-safety.mjs --staged',
    ''
  ].join('\n');

  if (existsSync(hook)) {
    if (readFileSync(hook, 'utf8') !== contents) {
      console.error('An existing pre-commit hook was found; refusing to overwrite it.');
      console.error('Add "node scripts/check-public-safety.mjs --staged" to it manually.');
      process.exitCode = 1;
    } else {
      console.log('Privacy pre-commit hook is already installed.');
    }
  } else {
    mkdirSync(hooksDirectory, {recursive: true});
    writeFileSync(hook, contents, {flag: 'wx', mode: 0o755});
    chmodSync(hook, 0o755);
    console.log('Privacy pre-commit hook installed on this computer.');
  }
}
