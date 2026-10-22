/** Normalized image coordinates, not screen gaze coordinates. */
export interface IrisEyeObservation {
  x: number;
  y: number;
  confidence: number;
  openness: number;
}

export interface IrisObservation {
  timestampMs: number;
  faceCount: number;
  left: IrisEyeObservation;
  right: IrisEyeObservation;
}

export type IrisRejectionReason =
  | 'invalid-time'
  | 'missing-observation'
  | 'invalid-observation'
  | 'ambiguous-face'
  | 'future-observation'
  | 'stale-observation'
  | 'invalid-eye'
  | 'low-confidence'
  | 'closed-eye';

export type IrisGateResult =
  | { accepted: false; reason: IrisRejectionReason }
  | { accepted: true; observation: IrisObservation };

// Conservative initial quality limits, not a claim of gaze accuracy.
export const IRIS_OBSERVATION_LIMITS = Object.freeze({
  maxAgeMs: 100,
  minConfidence: 0.9,
  minOpenness: 0.2,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isUnitNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

function readEye(value: unknown): IrisEyeObservation | null {
  if (!isRecord(value)) return null;
  const { x, y, confidence, openness } = value;
  if (![x, y, confidence, openness].every(isUnitNumber)) return null;
  return { x, y, confidence, openness } as IrisEyeObservation;
}

/**
 * Validate a binocular iris measurement without I/O, clocks, or retained state.
 * Caller supplies `nowMs` in the same monotonic clock domain as timestampMs.
 * Accepting an observation only establishes input quality; it must not authorize
 * dwell, selection, calibration training, or infer screen gaze. No monocular
 * fallback or reuse of a previous observation is performed. Returns a detached
 * snapshot so subsequent input mutation cannot change the validated values.
 */
export function gateIrisObservation(input: unknown, nowMs: number): IrisGateResult {
  const reject = (reason: IrisRejectionReason): IrisGateResult => ({ accepted: false, reason });
  if (!isFiniteNumber(nowMs) || nowMs < 0) return reject('invalid-time');
  if (input == null) return reject('missing-observation');
  if (!isRecord(input)) return reject('invalid-observation');
  const { timestampMs, faceCount } = input;
  if (!isFiniteNumber(timestampMs) || timestampMs < 0) return reject('invalid-observation');
  if (faceCount !== 1) return reject('ambiguous-face');
  const ageMs = nowMs - timestampMs;
  if (ageMs < 0) return reject('future-observation');
  if (ageMs > IRIS_OBSERVATION_LIMITS.maxAgeMs) return reject('stale-observation');
  const left = readEye(input.left);
  const right = readEye(input.right);
  if (!left || !right) return reject('invalid-eye');
  if ([left, right].some(eye => eye.confidence < IRIS_OBSERVATION_LIMITS.minConfidence)) {
    return reject('low-confidence');
  }
  if ([left, right].some(eye => eye.openness < IRIS_OBSERVATION_LIMITS.minOpenness)) {
    return reject('closed-eye');
  }
  return { accepted: true, observation: { timestampMs, faceCount, left, right } };
}

[executed on device: vps-377a113a (b5f97e3f-b6d4-4a37-9614-85905ab97c68)]
