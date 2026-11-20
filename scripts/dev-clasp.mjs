#!/usr/bin/env node
/**
 * Safe Google Apps Script DEV setup. No production script ID is accepted from
 * the command line. The .clasp-dev.json marker is stored locally, not in Git.
 */
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectPath = path.join(root, '.clasp.json');
const markerPath = path.join(root, '.clasp-dev.json');

export function verifyDevelopmentTarget(project, marker, projectRoot = root) {
  if (!project || typeof project.scriptId !== 'string' || !project.scriptId.trim()) {
    throw new Error('Missing Apps Script ID in .clasp.json.');
  }
  if (!marker || marker.role !== 'development' ||
      marker.createdBy !== 'spotify-dev-clasp-setup-v1' ||
      marker.scriptId !== project.scriptId) {
    throw new Error('DEV marker is missing or does not match .clasp.json. Refusing to push.');
  }
  if (typeof project.rootDir !== 'string' ||
      path.resolve(projectRoot, project.rootDir) !== path.join(projectRoot, 'src')) {
    throw new Error('clasp rootDir must point exactly to src.');
  }
  return project.scriptId;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function run(program, args, cwd = root) {
  const result = spawnSync(program, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) {
    throw new Error(program + ' exited with status ' + result.status);
  }
}

function requireManifest() {
  if (!existsSync(path.join(root, 'src', 'appsscript.json'))) {
    throw new Error('Missing src/appsscript.json.');
  }
}

function createDev() {
  requireManifest();
  if (existsSync(projectPath) || existsSync(markerPath)) {
    throw new Error('A clasp link already exists; refusing to overwrite it. Use a clean DEV checkout.');
  }

  // Create the Google project from a temporary folder so the starter
  // Code.gs and manifest downloaded by clasp cannot overwrite our sources.
  const temp = mkdtempSync(path.join(tmpdir(), 'spotify-clasp-dev-'));
  try {
    run('clasp', [
      'create-script', '--title', 'Spotify Premium Autohandler DEV',
      '--type', 'standalone'
    ], temp);
    const created = readJson(path.join(temp, '.clasp.json'));
    if (!created || typeof created.scriptId !== 'string' || !created.scriptId.trim()) {
      throw new Error('clasp returned no usable script ID.');
    }
    const project = {scriptId: created.scriptId, rootDir: './src'};
    const marker = {
      role: 'development',
      createdBy: 'spotify-dev-clasp-setup-v1',
      scriptId: created.scriptId
    };
    verifyDevelopmentTarget(project, marker);
    writeFileSync(projectPath, JSON.stringify(project, null, 2) + '\n', {flag: 'wx'});
    writeFileSync(markerPath, JSON.stringify(marker, null, 2) + '\n', {flag: 'wx'});
    console.log('\nNew DEV Apps Script: https://script.google.com/d/' + created.scriptId + '/edit');
    console.log('Next: configure DEV spreadsheet properties, then run npm run dev:push.');
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
}

function requireDev() {
  if (!existsSync(projectPath) || !existsSync(markerPath)) {
    throw new Error('Development clasp setup missing. First run npm run dev:create.');
  }
  requireManifest();
  return verifyDevelopmentTarget(readJson(projectPath), readJson(markerPath));
}

function pushDev() {
  const scriptId = requireDev();
  console.log('Verified local DEV target: ' + scriptId);
  console.log('Running all local tests before uploading...');
  run(process.execPath, ['--test']);
  console.log('Pushing only src/ to the DEV script (not a web deployment).');
  run('clasp', ['push']);
}

function main() {
  const command = process.argv[2];
  if (command === 'create') createDev();
  else if (command === 'push') pushDev();
  else if (command === 'status') {
    requireDev();
    run('clasp', ['status']);
  } else {
    throw new Error('Use npm run dev:create, npm run dev:push, or npm run dev:status.');
  }
}

if (process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error('DEV setup stopped safely: ' + error.message);
    process.exitCode = 1;
  }
}
