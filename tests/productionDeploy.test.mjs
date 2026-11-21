import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {
  prepareProductionLink,
  verifyProductionTarget,
  stageProductionSource
} from '../scripts/prod-clasp.mjs';

const productionId = '1PRODxxxxxxxxxxxxxxxxxxxxxxxxxx123456';
const devId = '1DEVxxxxxxxxxxxxxxxxxxxxxxxxxxxABCDEF';
const devProject = {scriptId: devId, rootDir: './src'};
const devMarker = {
  role: 'development',
  createdBy: 'spotify-dev-clasp-setup-v1',
  scriptId: devId
};

test('production link is a separate local profile, never a DEV clasp link', () => {
  const profile = prepareProductionLink(productionId, null, devProject, devMarker);
  assert.deepEqual(profile, {
    role: 'production',
    createdBy: 'spotify-production-clasp-setup-v1',
    scriptId: productionId
  });
  assert.equal(verifyProductionTarget(profile, devProject, devMarker), productionId);
});

test('cannot link production to the same Script ID as DEV', () => {
  assert.throws(
    () => prepareProductionLink(devId, null, devProject, devMarker),
    /identical/
  );
});

test('cannot overwrite a previously linked production project', () => {
  const existing = prepareProductionLink(productionId);
  assert.throws(() => prepareProductionLink(
    '1ANOTHERXXXXXXXXXXXXXXXXXXXXXXXXX', existing
  ), /already linked/);
});

test('production ID must be valid, and profiles must carry the correct role and marker', () => {
  for (const id of ['', 'short', 'Script ID', 'https://script.google.com/foo']) {
    assert.throws(() => prepareProductionLink(id), /Invalid or missing/);
  }
  const profile = prepareProductionLink(productionId);
  for (const wrong of [
    {...profile, role: 'development'},
    {...profile, createdBy: 'unknown'},
    {...profile, scriptId: ''},
    null
  ]) {
    assert.throws(() => verifyProductionTarget(wrong), /Invalid or missing/);
  }
});

test('unverified or inconsistent DEV configurations block production uploads', () => {
  const profile = prepareProductionLink(productionId);
  assert.throws(() => verifyProductionTarget(profile, devProject), /Unverified/);
  assert.throws(() => verifyProductionTarget(profile, null, devMarker), /Unverified/);
  assert.throws(() => verifyProductionTarget(profile, devProject,
    {...devMarker, scriptId: 'other'}), /DEV marker/);
  assert.throws(() => verifyProductionTarget(profile,
    {...devProject, rootDir: '../src'}, devMarker), /rootDir/);
});

test('production staging copies only src and points clasp at production', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spotify-prod-test-'));
  let stage;
  try {
    const src = path.join(dir, 'src');
    mkdirSync(src);
    writeFileSync(path.join(src, 'appsscript.json'), '{"runtimeVersion":"V8"}');
    writeFileSync(path.join(src, 'Code.js'), 'function hello() {}');
    writeFileSync(path.join(dir, '.clasp.json'),
      JSON.stringify({scriptId: devId, rootDir: './src'}));
    writeFileSync(path.join(dir, '.clasp-dev.json'), JSON.stringify(devMarker));
    writeFileSync(path.join(dir, 'secret-local-file.txt'), 'DO NOT COPY');

    const profile = prepareProductionLink(productionId);
    stage = stageProductionSource(profile, src);
    assert.deepEqual(JSON.parse(readFileSync(path.join(stage, '.clasp.json'), 'utf8')), {
      scriptId: productionId, rootDir: './src'
    });
    assert.equal(readFileSync(path.join(stage, 'src', 'Code.js'), 'utf8'),
      'function hello() {}');
    assert.equal(existsSync(path.join(stage, '.clasp-dev.json')), false);
    assert.equal(existsSync(path.join(stage, 'secret-local-file.txt')), false);
    assert.equal(readFileSync(path.join(dir, '.clasp.json'), 'utf8'),
      JSON.stringify({scriptId: devId, rootDir: './src'}));
  } finally {
    if (stage) rmSync(stage, {recursive: true, force: true});
    rmSync(dir, {recursive: true, force: true});
  }
});

test('staging rejects missing Apps Script manifest before creating a target', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spotify-prod-test-'));
  try {
    assert.throws(() => stageProductionSource(
      prepareProductionLink(productionId), dir
    ), /Missing src\/appsscript.json/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
