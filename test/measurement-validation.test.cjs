const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('services/measurementValidation.ts', 'utf8');
const out = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText, { exports: out.exports });
const { MeasurementValidation } = out.exports;
// Scalar fixture tests storage contracts only; it is not evidence of gaze accuracy.
function frame() {
  const eye = { accepted: true, eyeWidthPx: 40, eyelidGapPx: 8, eyelidOpenness: .2,
    iris: { xPx: 100, yPx: 80, radiusPx: 5, residualPx: .1, relativeResidual: .02 } };
  return { accepted: true, left: structuredClone(eye), right: structuredClone(eye),
    image: 'IMAGE_SENTINEL', faceLandmarks: ['LANDMARK_SENTINEL'] };
}
test('target selection never captures until operator confirmation; changes end capture', () => {
  const lab = new MeasurementValidation();
  assert.equal(lab.capture(frame()), false);
  lab.selectTarget({ x: .2, y: .2 });
  assert.equal(lab.capture(frame()), false);
  lab.confirmFixation('calibration');
  assert.equal(lab.capture(frame()), true);
  lab.selectTarget({ x: .8, y: .8 });
  assert.equal(lab.capture(frame()), false);
  lab.confirmFixation('held-out');
  lab.capture(frame());
  assert.equal(lab.report().calibrationFrames, 1);
  assert.equal(lab.report().heldOutFrames, 1);
  lab.endFixation();
  assert.equal(lab.capture(frame()), false);
});
test('invalid targets and partitions fail closed', () => {
  const lab = new MeasurementValidation();
  assert.throws(() => lab.confirmFixation('calibration'));
  for (const target of [null, {}, { x: NaN, y: .5 }, { x: Infinity, y: .5 },
    { x: 0, y: .5 }, { x: 1, y: .5 }, { x: -.1, y: .5 }, { x: .5, y: 2 }]) {
    lab.selectTarget({ x: .5, y: .5 });
    lab.confirmFixation('calibration');
    assert.throws(() => lab.selectTarget(target));
    assert.equal(lab.capture(frame()), false);
  }
  lab.selectTarget({ x: .5, y: .5 });
  assert.throws(() => lab.confirmFixation('unknown'));
});
test('storage copies only numeric features and target coordinates; sessions are isolated and stop clears', () => {
  const a = new MeasurementValidation(), b = new MeasurementValidation();
  const target = { x: .2, y: .3, image: 'TARGET_IMAGE' };
  a.selectTarget(target); a.confirmFixation('held-out');
  const input = frame(); a.capture(input);
  target.x = .9; input.left.iris.xPx = 999;
  assert.equal(a.samples[0].target.x, .2);
  assert.equal(a.samples[0].features[3], 100);
  assert.ok(a.samples[0].features.every(Number.isFinite));
  assert.doesNotMatch(JSON.stringify(a), /IMAGE|LANDMARK|999/);
  assert.equal(b.report().heldOutFrames, 0);
  a.stop();
  assert.equal(a.samples.length, 0);
  assert.equal(a.target, undefined);
  assert.equal(a.capture(frame()), false);
  assert.throws(() => a.selectTarget({ x: .5, y: .5 }));
});
test('rejected and nonfinite measurements are excluded; accuracy remains unavailable with data', () => {
  const lab = new MeasurementValidation();
  lab.selectTarget({ x: .5, y: .5 }); lab.confirmFixation('held-out');
  assert.equal(lab.report().heldOutError, 'UNAVAILABLE');
  assert.equal(lab.capture({ ...frame(), accepted: false }), false);
  const invalid = frame(); invalid.left.iris.xPx = NaN;
  assert.equal(lab.capture(invalid), false);
  lab.capture(frame());
  assert.equal(lab.report().heldOutError, 'UNAVAILABLE');
  assert.match(lab.report().reason, /No actual screen gaze estimator/);
});
