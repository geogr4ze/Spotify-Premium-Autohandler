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
  // Normalize projectRoot first: on Windows a test root such as '/project'
  // otherwise compares C:\\project\\src against \\project\\src.
  const absoluteProjectRoot = path.resolve(projectRoot);
  if (typeof project.rootDir !== 'string' ||
      path.resolve(absoluteProjectRoot, project.rootDir) !==
        path.join(absoluteProjectRoot, 'src')) {
    throw new Error('clasp rootDir must point exactly to src.');
  }
  return project.scriptId;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Windows .cmd shims need a shell. Quoting each known, fixed CLI argument
 * preserves titles containing spaces and avoids spawn's deprecated combination
 * of shell:true with a separate arguments array.
 */
export function buildWindowsCommand(program, args) {
  return [program, ...args].map((arg) => {
    if (typeof arg !== 'string' || !arg) {
      throw new Error('Invalid Windows command argument.');
    }
    if (/[&|<>^%!\r\n"]/.test(arg)) {
      throw new Error('Unsafe Windows shell argument; command refused.');
    }
    return /\s/.test(arg) ? '"' + arg + '"' : arg;
  }).join(' ');
}

function run(program, args, cwd = root) {
  const options = {cwd, stdio: 'inherit'};
  // Node itself is an executable and does not need a shell on Windows.
  const result = process.platform === 'win32' && program === 'clasp'
    ? spawnSync(buildWindowsCommand(program, args), {...options, shell: true})
    : spawnSync(program, args, options);
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

/**
 * Prepare a local link for an EXISTING Apps Script project. The ID is supplied
 * interactively and must be checked by the user in Google's DEV project.
 * We cannot determine from the ID alone whether a project is production.
 * Existing links are never silently replaced.
 */
export function prepareExistingDevLink(scriptId, existingProject = null, existingMarker = null,
                                       projectRoot = root) {
  const id = typeof scriptId === 'string' ? scriptId.trim() : '';
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error('Invalid Script ID. Copy the Script ID from DEV Apps Script Project Settings.');
  }
  if (existingMarker !== null) {
    throw new Error('A DEV marker already exists. Use npm run dev:status; refusing to relink.');
  }
  const project = existingProject || {scriptId: id, rootDir: './src'};
  if (existingProject && existingProject.scriptId !== id) {
    throw new Error('Existing .clasp.json points to a different Script ID. Refusing to overwrite.');
  }
  const marker = {
    role: 'development',
    createdBy: 'spotify-dev-clasp-setup-v1',
    source: 'linked-existing-project',
    scriptId: id
  };
  verifyDevelopmentTarget(project, marker, projectRoot);
  return {project, marker, reusedExistingProject: Boolean(existingProject)};
}

async function linkDev() {
  requireManifest();
  if (existsSync(markerPath)) {
    throw new Error('Local DEV marker already exists. Use npm run dev:status.');
  }
  const existingProject = existsSync(projectPath) ? readJson(projectPath) : null;
  const {createInterface} = await import('node:readline/promises');
  const prompt = createInterface({input: process.stdin, output: process.stdout});
  try {
    console.log('Linking an EXISTING DEV Apps Script project. Nothing is uploaded.');
    console.log('Open that DEV project in Google Apps Script > Project Settings > Script ID.');
    console.log('Verify its Script ID differs from your live production project.');
    console.log('Verify its SPREADSHEET_ID property points to your separate TEST spreadsheet.');
    const scriptId = await prompt.question('Paste the existing DEV Script ID: ');
    const config = prepareExistingDevLink(scriptId, existingProject);
    const confirm = await prompt.question(
      'I have checked the DEV Script ID and DEV spreadsheet. Type LINK DEV to continue: '
    );
    if (confirm.trim() !== 'LINK DEV') {
      throw new Error('Confirmation was not provided. No configuration was changed.');
    }
    // Preserve an existing matching clasp link; never overwrite it.
    let wroteProject = false;
    if (!config.reusedExistingProject) {
      writeFileSync(projectPath, JSON.stringify(config.project, null, 2) + '\n', {flag: 'wx'});
      wroteProject = true;
    }
    try {
      writeFileSync(markerPath, JSON.stringify(config.marker, null, 2) + '\n', {flag: 'wx'});
    } catch (error) {
      if (wroteProject) rmSync(projectPath, {force: true});
      throw error;
    }
    console.log('Existing DEV Apps Script link registered locally.');
    console.log('Verify Script ID once more in Google; then run npm run dev:status.');
    console.log('Only after review, run npm run dev:push to upload code to this DEV script.');
  } finally {
    prompt.close();
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

async function main() {
  const command = process.argv[2];
  if (command === 'create') createDev();
  else if (command === 'link') await linkDev();
  else if (command === 'push') pushDev();
  else if (command === 'status') {
    requireDev();
    run('clasp', ['status']);
  } else {
    throw new Error('Use npm run dev:create, npm run dev:link, npm run dev:push, or npm run dev:status.');
  }
}

if (process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('DEV setup stopped safely: ' + error.message);
    process.exitCode = 1;
  });
}
