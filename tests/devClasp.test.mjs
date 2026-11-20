import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDevelopmentTarget} from '../scripts/dev-clasp.mjs';

const root = '/project';
const project = {scriptId: 'dev-script-123', rootDir: './src'};
const marker = {
  role: 'development',
  createdBy: 'spotify-dev-clasp-setup-v1',
  scriptId: 'dev-script-123'
};

test('accepts a matching DEV script', () => {
  assert.equal(verifyDevelopmentTarget(project, marker, root), 'dev-script-123');
});

test('rejects a changed script ID', () => {
  assert.throws(() => verifyDevelopmentTarget(
    {...project, scriptId: 'different-id'}, marker, root
  ), /DEV marker/);
});

test('rejects a missing marker', () => {
  assert.throws(() => verifyDevelopmentTarget(project, null, root), /DEV marker/);
});

test('rejects a production marker', () => {
  assert.throws(() => verifyDevelopmentTarget(project,
    {...marker, role: 'production'}, root), /DEV marker/);
});

test('rejects pushing files outside src', () => {
  assert.throws(() => verifyDevelopmentTarget(
    {...project, rootDir: '.'}, marker, root
  ), /rootDir/);
});

test('rejects an empty script ID', () => {
  assert.throws(() => verifyDevelopmentTarget(
    {...project, scriptId: ''}, marker, root
  ), /Script ID/);
});
