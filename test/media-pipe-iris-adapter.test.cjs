const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { frame } = require('./fixtures/media-pipe-face.cjs');
const modules = {};
for (const name of ['irisObservationGate', 'irisGeometry', 'mediaPipeIrisAdapter']) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(`services/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: path => {
    assert.ok(modules[path], `unexpected import ${path}`);
    return modules[path];
  } });
  modules[`./${name}`] = exports;
}
const adapt = modules['./mediaPipeIrisAdapter'].adaptMediaPipeIrisObservation;
const reject = (input, reason, now = 1000) => {
  const result = adapt(input, now);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, reason);
  assert.equal(result.observation, undefined);
};

test('uses anatomical centers in normalized image space, unaffected by head transform', () => {
  const input = frame();
  input.result.facialTransformationMatrixes[0].data[12] = 50;
  const result = adapt(input, 1050);
  assert.equal(result.accepted, true);
  assert.equal(result.observation.left.x, 0.7);
  assert.equal(result.observation.left.y, 0.45);
  assert.equal(result.observation.right.x, 0.3);
  assert.equal(result.observation.right.y, 0.4);
  assert.equal(result.observation.left.confidence, 0.95);
});
test('standard MediaPipe output alone fails closed, with no invented eye quality', () => {
  const input = frame();
  delete input.quality;
  input.result.faceBlendshapes = [{ categories: [{ categoryName: 'eyeBlinkLeft', score: 0 }] }];
  reject(input, 'missing-eye-quality');
});
test('requires a complete single refined face and finite bounded image coordinates', () => {
  for (const count of [0, 2]) {
    const input = frame();
    input.result.faceLandmarks = Array.from({ length: count }, () => input.result.faceLandmarks[0]);
    reject(input, 'ambiguous-face');
  }
  for (const length of [468, 477, 479]) {
    const input = frame(); input.result.faceLandmarks[0].length = length;
    reject(input, 'invalid-mediapipe-result');
  }
  for (const [key, value] of [['x', NaN], ['y', 1.1], ['x', -0.1], ['z', Infinity]]) {
    const input = frame(); input.result.faceLandmarks[0][100][key] = value;
    reject(input, 'invalid-mediapipe-result');
  }
  const input = frame(); delete input.result.faceLandmarks[0][20];
  reject(input, 'invalid-mediapipe-result');
});
test('rejects degenerate iris geometry and malformed head data', () => {
  for (const index of [468, 473]) {
    const input = frame(); input.result.faceLandmarks[0][index + 1] = input.result.faceLandmarks[0][index + 2];
    reject(input, 'invalid-eye');
  }
  for (const matrices of [null, [], [{}], [{ rows: 4, columns: 4, data: Array(16).fill(NaN) }]]) {
    const input = frame(); input.result.facialTransformationMatrixes = matrices;
    reject(input, 'invalid-head-data');
  }
});
test('gate enforces freshness and independent binocular quality', () => {
  reject(frame(), 'stale-observation', 1101);
  reject(frame(), 'future-observation', 999);
  reject(frame(), 'invalid-time', NaN);
  assert.equal(adapt(frame(), 1100).accepted, true);
  for (const side of ['left', 'right']) {
    for (const [key, value, reason] of [['confidence', 0.89, 'low-confidence'], ['openness', 0.19, 'closed-eye'],
      ['confidence', undefined, 'invalid-eye'], ['openness', NaN, 'invalid-eye']]) {
      const input = frame(); input.quality[side][key] = value; reject(input, reason);
    }
  }
});
test('pure deterministic detached snapshots, without retained fallback', () => {
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const input = freeze(frame());
  assert.deepEqual(adapt(input, 1000), adapt(input, 1000));
  reject(null, 'invalid-mediapipe-result');
  const mutable = frame(); const result = adapt(mutable, 1000);
  mutable.quality.left.confidence = 0; mutable.result.faceLandmarks[0][473].x = 0;
  assert.equal(result.observation.left.x, 0.7);
  assert.equal(result.observation.left.confidence, 0.95);
});
