#!/usr/bin/env node
/**
 * Explicit, separate production uploader. Never modifies or relies on the
 * repository's DEV .clasp.json; it stages a disposable copy of src/ instead.
 * Keeping production target IDs in git-ignored files avoids accidental leaks.
 */
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {buildWindowsCommand, verifyDevelopmentTarget} from './dev-clasp.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const productionPath = path.join(root, '.clasp-prod.json');
const devProjectPath = path.join(root, '.clasp.json');
const devMarkerPath = path.join(root, '.clasp-dev.json');
const createdBy = 'spotify-production-clasp-setup-v1';

/**
 * Read and parse a local JSON file.
 * @param {string} file - File path.
 * @returns {*} Parsed value.
 * @throws {Error} File or parse failure.
 */
function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Read paired local DEV configuration, or report both absent.
 * @returns {Object} Project and marker, both null if absent.
 * @throws {Error} Incomplete pair or read failure.
 */
function localDevelopment() {
  const hasProject = existsSync(devProjectPath);
  const hasMarker = existsSync(devMarkerPath);
  if (hasProject !== hasMarker) {
    throw new Error(
      'Local .clasp.json is not a verified DEV link. Use a clean checkout ' +
      'or restore the matching DEV marker before configuring production.'
    );
  }
  if (!hasProject) return {project: null, marker: null};
  return {project: readJson(devProjectPath), marker: readJson(devMarkerPath)};
}

/** Validate the saved production target, including separation from DEV. */
/**
 * Validate production profile and reject matching DEV ID.
 * @param {Object} profile - Production profile.
 * @param {Object
 * null} [devProject] - DEV configuration.
 * @param {Object
 * null} [devMarker] - DEV marker.
 * @returns {string} Verified production ID.
 * @throws {Error} Invalid profile, incomplete DEV configuration or identical target.
 */
export function verifyProductionTarget(profile, devProject = null, devMarker = null) {
  if (!profile || profile.role !== 'production' ||
      profile.createdBy !== createdBy ||
      typeof profile.scriptId !== 'string' ||
      !/^[A-Za-z0-9_-]{20,}$/.test(profile.scriptId)) {
    throw new Error('Invalid or missing production Script ID/link marker.');
  }
  if (Boolean(devProject) !== Boolean(devMarker)) {
    throw new Error('Unverified local DEV configuration; refusing production upload.');
  }
  if (devProject) {
    verifyDevelopmentTarget(devProject, devMarker);
    if (devProject.scriptId === profile.scriptId) {
      throw new Error('PRODUCTION and DEV Script IDs are identical; refusing upload.');
    }
  }
  return profile.scriptId;
}

/** Only called for an explicit first-time production link. */
/**
 * Build a new production profile without overwriting an existing one.
 * @param {string} scriptId - User-verified production ID.
 * @param {Object
 * null} [existingProfile] - Existing profile.
 * @param {Object
 * null} [devProject] - DEV configuration.
 * @param {Object
 * null} [devMarker] - DEV marker.
 * @returns {Object} Validated profile; no writes.
 * @throws {Error} Existing profile or invalid target.
 */
export function prepareProductionLink(scriptId, existingProfile = null,
                                      devProject = null, devMarker = null) {
  if (existingProfile) {
    throw new Error('Production is already linked. Refusing to overwrite the Script ID.');
  }
  const profile = {
    role: 'production',
    createdBy,
    scriptId: typeof scriptId === 'string' ? scriptId.trim() : ''
  };
  verifyProductionTarget(profile, devProject, devMarker);
  return profile;
}

/**
 * Make a throwaway standalone clasp directory, containing only src/ and the
 * production Script ID. The DEV .clasp.json and DEV marker stay untouched.
 */
/**
 * Copy src into an isolated temporary clasp directory.
 * @param {Object} profile - Valid production profile.
 * @param {string} sourceDir - Source directory.
 * @param {string} [tempRoot] - Parent temp directory.
 * @returns {string} Staging path; caller cleans it.
 * @effects Writes staged source and target configuration; DEV link unchanged.
 * @throws {Error} Missing manifest, invalid target or IO failure; removes failed stage.
 */
export function stageProductionSource(profile, sourceDir, tempRoot = tmpdir()) {
  verifyProductionTarget(profile);
  if (!existsSync(path.join(sourceDir, 'appsscript.json'))) {
    throw new Error('Missing src/appsscript.json; refusing to upload.');
  }
  const stage = mkdtempSync(path.join(tempRoot, 'spotify-prod-upload-'));
  try {
    cpSync(sourceDir, path.join(stage, 'src'), {recursive: true});
    writeFileSync(path.join(stage, '.clasp.json'), JSON.stringify({
      scriptId: profile.scriptId,
      rootDir: './src'
    }, null, 2) + '\n', {flag: 'wx'});
    return stage;
  } catch (error) {
    rmSync(stage, {recursive: true, force: true});
    throw error;
  }
}

/**
 * Run a subprocess synchronously with inherited terminal IO.
 * @param {string} program - Executable.
 * @param {string[]} args - Arguments.
 * @param {string} [cwd] - Working directory.
 * @effects Launches child process; Windows clasp uses a validated shell command.
 * @throws {Error} Launch failure or nonzero exit.
 */
function run(program, args, cwd = root) {
  const options = {cwd, stdio: 'inherit'};
  const result = process.platform === 'win32' && program === 'clasp'
    ? spawnSync(buildWindowsCommand(program, args), {...options, shell: true})
    : spawnSync(program, args, options);
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) {
    throw new Error(program + ' exited with status ' + result.status);
  }
}

/**
 * Read saved production profile and verify separation from DEV.
 * @returns {Object} Verified profile.
 * @throws {Error} Missing or invalid profile.
 */
function productionTarget() {
  if (!existsSync(productionPath)) {
    throw new Error('Production not linked. Run npm run deploy:prod:link first.');
  }
  const profile = readJson(productionPath);
  const {project, marker} = localDevelopment();
  verifyProductionTarget(profile, project, marker);
  return profile;
}

/**
 * Interactively confirm and save a new production target.
 * @returns {Promise<void>} Completion of link.
 * @effects Writes private local profile after confirmation; does not upload.
 * @throws {Error} Existing link, invalid target or cancelled confirmation.
 */
async function linkProduction() {
  if (existsSync(productionPath)) {
    throw new Error('Production already linked; refusing to replace it.');
  }
  const {project, marker} = localDevelopment();
  const prompt = createInterface({input: process.stdin, output: process.stdout});
  try {
    console.log('Link the existing REAL Apps Script project. No upload happens now.');
    console.log('Find its Script ID in the REAL Apps Script Project Settings.');
    console.log('Confirm the real project is backed up and differs from DEV.');
    const answer = await prompt.question('Paste the REAL production Script ID: ');
    const profile = prepareProductionLink(answer, null, project, marker);
    console.log('Production Script ID: ' + profile.scriptId);
    const confirm = await prompt.question(
      'I verified that this is the REAL, backed-up project. Type LINK PRODUCTION: '
    );
    if (confirm.trim() !== 'LINK PRODUCTION') {
      throw new Error('Link cancelled. No configuration was saved.');
    }
    writeFileSync(productionPath, JSON.stringify(profile, null, 2) + '\n', {flag: 'wx'});
    console.log('Production target saved locally; DEV link remains unchanged.');
  } finally {
    prompt.close();
  }
}

/**
 * Run an action against a disposable production stage.
 * @param {Function} action - Callback receiving stage and profile.
 * @returns {Promise<void>} Completion after callback and cleanup.
 * @effects Creates then removes staged files; callback may perform external actions.
 */
async function withProductionStage(action) {
  const profile = productionTarget();
  const stage = stageProductionSource(profile, path.join(root, 'src'));
  try {
    await action(stage, profile);
  } finally {
    rmSync(stage, {recursive: true, force: true});
  }
}

/**
 * Test, inspect, confirm and upload staged production source.
 * @requires Interactive terminal and verified production profile.
 * @returns {Promise<void>} Completion of upload.
 * @effects May replace live source; does not change properties or triggers.
 * @throws {Error} Invalid target, cancellation or command failure.
 */
async function pushProduction() {
  const profile = productionTarget();
  if (!process.stdin.isTTY) {
    throw new Error('Production upload requires an interactive terminal.');
  }
  console.log('Running tests before any production upload...');
  run(process.execPath, ['--test']);
  await withProductionStage(async (stage) => {
    console.log('Inspecting REAL target: ' + profile.scriptId);
    run('clasp', ['status'], stage);
    const prompt = createInterface({input: process.stdin, output: process.stdout});
    try {
      console.log('WARNING: clasp push REPLACES live Apps Script source code.');
      console.log('It can affect existing time-based triggers immediately.');
      console.log('Back up the real script and spreadsheet and disable old triggers.');
      console.log('Confirm Script Properties point to the REAL sheet with EMAIL_MODE=DRY_RUN,');
      console.log('ALLOW_PRODUCTION_EMAILS=false, ENABLE_PAYMENT_IMPORT=false.');
      const required = 'DEPLOY PRODUCTION ' + profile.scriptId.slice(-6);
      const answer = await prompt.question('Type ' + required + ' to upload: ');
      if (answer.trim() !== required) {
        throw new Error('Upload cancelled. Production was not changed.');
      }
    } finally {
      prompt.close();
    }
    run('clasp', ['push'], stage);
    console.log('Production code uploaded. Script Properties and triggers were not changed.');
  });
}

/**
 * Dispatch the selected production CLI action.
 * @returns {Promise<void>} Completion of operation.
 * @effects May link, query or upload after confirmation.
 * @throws {Error} Unknown action or operation failure.
 */
async function main() {
  const action = process.argv[2];
  if (action === 'link') await linkProduction();
  else if (action === 'status') {
    await withProductionStage((stage, profile) => {
      console.log('REAL production Script ID: ' + profile.scriptId);
      run('clasp', ['status'], stage);
    });
  } else if (action === 'push') await pushProduction();
  else throw new Error('Use npm run deploy:prod:link, deploy:prod:status, or deploy:prod.');
}

if (process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Production upload stopped safely: ' + error.message);
    process.exitCode = 1;
  });
}
