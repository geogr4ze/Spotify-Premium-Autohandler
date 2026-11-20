import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExistingDevLink, verifyDevelopmentTarget} from '../scripts/dev-clasp.mjs';

const devScriptId = '1AbCDeFGhIJklMnOPqrSTuvWXyz0123456789';
const otherScriptId = '1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';

test('links an existing DEV Script ID without requiring a newly created project', () => {
  const link = prepareExistingDevLink(' ' + devScriptId + ' ');
  assert.deepEqual(link.project, {scriptId: devScriptId, rootDir: './src'});
  assert.equal(link.marker.scriptId, devScriptId);
  assert.equal(link.marker.role, 'development');
  assert.equal(link.marker.source, 'linked-existing-project');
  assert.equal(link.reusedExistingProject, false);
  assert.equal(verifyDevelopmentTarget(link.project, link.marker), devScriptId);
});

test('preserves an existing .clasp.json for the same DEV script', () => {
  const current = {scriptId: devScriptId, rootDir: './src'};
  const link = prepareExistingDevLink(devScriptId, current);
  assert.equal(link.project, current);
  assert.equal(link.reusedExistingProject, true);
});

test('rejects relinking if .clasp.json targets a different script', () => {
  assert.throws(() => prepareExistingDevLink(devScriptId, {
    scriptId: otherScriptId, rootDir: './src'
  }), /different Script ID/);
});

test('rejects relinking an already registered project', () => {
  assert.throws(() => prepareExistingDevLink(devScriptId, null, {
    role: 'development', scriptId: devScriptId
  }), /already exists/);
});

test('rejects a script link that points outside src', () => {
  assert.throws(() => prepareExistingDevLink(devScriptId, {
    scriptId: devScriptId, rootDir: '.'
  }), /rootDir must point exactly to src/);
});

test('rejects invalid or missing Script IDs', () => {
  for (const value of ['', '1a', 'Script ID', 'https://script.google.com/home']) {
    assert.throws(() => prepareExistingDevLink(value), /Invalid Script ID/);
  }
});
