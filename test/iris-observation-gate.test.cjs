const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const source = fs.readFileSync('services/irisObservationGate.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const gateModule = { exports: {} };
// No browser, camera, timers, storage, network, or imports are available here.
require('node:vm').runInNewContext(compiled, { exports: gateModule.exports });
const { gateIrisObservation: gate, IRIS_OBSERVATION_LIMITS: limits } = gateModule.exports;
const eye = () => ({ x: 0.4, y: 0.6, confidence: 0.95, openness: 0.5 });
const observation = () => ({ timestampMs: 1000, faceCount: 1, left: eye(), right: eye() });
function rejected(input, now, reason) {
  const result = gate(input, now);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.observation, undefined);
}

test('accepts fresh binocular observations and exact inclusive limits', () => {
  const input = observation();
  for (const side of ['left', 'right']) {
    Object.assign(input[side], { x: 0, y: 1, confidence: limits.minConfidence, openness: limits.minOpenness });
  }
  assert.equal(gate(input, 1000).accepted, true);
  assert.equal(gate(input, 1000 + limits.maxAgeMs).accepted, true);
  rejected(input, 1000 + limits.maxAgeMs + 0.001, 'stale-observation');
  rejected(input, 999.999, 'future-observation');
});

test('fails closed for missing, malformed, or ambiguous observations', () => {
  for (const value of [undefined, null]) rejected(value, 1000, 'missing-observation');
  for (const value of [false, 1, 'iris', [], {}]) rejected(value, 1000, 'invalid-observation');
  for (const timestampMs of [NaN, Infinity, -Infinity, -1, '1000', null, undefined]) {
    rejected({ ...observation(), timestampMs }, 1000, 'invalid-observation');
  }
  for (const faceCount of [0, 2, -1, 1.5, '1', NaN, undefined]) {
    rejected({ ...observation(), faceCount }, 1000, 'ambiguous-face');
  }
  for (const now of [NaN, Infinity, -Infinity, -1, '1000', null, undefined]) {
    rejected(observation(), now, 'invalid-time');
  }
});

test('requires both eyes and finite normalized numeric fields', () => {
  for (const side of ['left', 'right']) {
    for (const value of [null, undefined, [], {}]) {
      rejected({ ...observation(), [side]: value }, 1000, 'invalid-eye');
    }
    for (const field of ['x', 'y', 'confidence', 'openness']) {
      for (const value of [NaN, Infinity, -Infinity, -0.001, 1.001, '0.5', null, undefined]) {
        const input = observation();
        input[side][field] = value;
        rejected(input, 1000, 'invalid-eye');
      }
    }
  }
});

test('either eye can block acceptance for low confidence or closure', () => {
  for (const side of ['left', 'right']) {
    const input = observation();
    input[side].confidence = limits.minConfidence - 0.001;
    rejected(input, 1000, 'low-confidence');
    input[side].confidence = 1;
    input[side].openness = limits.minOpenness - 0.001;
    rejected(input, 1000, 'closed-eye');
  }
});

test('is deterministic, does not mutate frozen inputs, and retains no last good sample', () => {
  const input = observation();
  Object.freeze(input.left);
  Object.freeze(input.right);
  Object.freeze(input);
  assert.deepEqual(gate(input, 1050), gate(input, 1050));
  assert.equal(gate(input, 1050).accepted, true);
  rejected(null, 1050, 'missing-observation');
  rejected(input, 1200, 'stale-observation');
  assert.equal(gate(input, 1050).accepted, true);
});

test('accepted snapshot shares no mutable objects with the input', () => {
  const input = observation();
  const result = gate(input, 1000);
  assert.equal(result.accepted, true);
  assert.notEqual(result.observation, input);
  assert.notEqual(result.observation.left, input.left);
  assert.notEqual(result.observation.right, input.right);
  input.left.x = NaN;
  input.right.openness = 0;
  assert.equal(result.observation.left.x, 0.4);
  assert.equal(result.observation.right.openness, 0.5);
});

[executed on device: vps-377a113a (b5f97e3f-b6d4-4a37-9614-85905ab97c68)]
