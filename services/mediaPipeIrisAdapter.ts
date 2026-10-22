import { gateIrisObservation, type IrisGateResult } from './irisObservationGate';
import { IRIS_INDICES, readIrisCenter, type ImageLandmark } from './irisGeometry';

export interface IndependentEyeQuality {
  confidence: number;
  openness: number;
}
export interface MediaPipeIrisInput {
  timestampMs: number;
  /** Actual FaceLandmarkerResult fields. Exactly one refined 478-point face. */
  result: {
    faceLandmarks: readonly (readonly ImageLandmark[])[];
    facialTransformationMatrixes?: readonly {
      rows: number; columns: number; data: readonly number[];
    }[];
  };
  /** Independently measured for this same frame and anatomical eye. Required:
   * detection thresholds, visibility, head pose, blink blendshapes, iris size,
   * and landmark presence must never be substituted for these measurements.
   */
  quality?: { left: IndependentEyeQuality; right: IndependentEyeQuality };
}
export type MediaPipeIrisResult = IrisGateResult | {
  accepted: false;
  reason: 'invalid-mediapipe-result' | 'invalid-head-data' | 'missing-eye-quality';
};
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const unit = (v: unknown): v is number => finite(v) && v >= 0 && v <= 1;

/** Pure, stateless adapter. Caller provides frame time and now in the same
 * monotonic clock domain. Coordinates are normalized to inference-image width
 * and height, origin top-left, x right, y down, anatomical left/right. A mirrored
 * preview has no effect; callers must supply the original inference landmarks.
 * Head matrices are MediaPipe's canonical-face-to-detected-face transforms;
 * they are validated if supplied, never applied to image-space iris centers.
 * Acceptance has only the quality meaning of gateIrisObservation, never dwell.
 */
export function adaptMediaPipeIrisObservation(input: unknown, nowMs: number): MediaPipeIrisResult {
  if (!finite(nowMs) || nowMs < 0) return { accepted: false, reason: 'invalid-time' };
  if (!record(input) || !record(input.result)) {
    return { accepted: false, reason: 'invalid-mediapipe-result' };
  }
  const { result, timestampMs, quality } = input;
  if (!finite(timestampMs) || timestampMs < 0) return { accepted: false, reason: 'invalid-observation' };
  if (!Array.isArray(result.faceLandmarks)) return { accepted: false, reason: 'invalid-mediapipe-result' };
  if (result.faceLandmarks.length !== 1) return { accepted: false, reason: 'ambiguous-face' };
  const points = result.faceLandmarks[0];
  if (!Array.isArray(points) || points.length !== 478 ||
      Array.from(points).some(p => !record(p) || !unit(p.x) || !unit(p.y) || !finite(p.z))) {
    return { accepted: false, reason: 'invalid-mediapipe-result' };
  }
  const matrices = result.facialTransformationMatrixes;
  if (matrices !== undefined && (!Array.isArray(matrices) || matrices.length !== 1 || matrices.some(m =>
    !record(m) || m.rows !== 4 || m.columns !== 4 || !Array.isArray(m.data) ||
    m.data.length !== 16 || Array.from(m.data).some(v => !finite(v))))) {
    return { accepted: false, reason: 'invalid-head-data' };
  }
  const left = readIrisCenter(points, IRIS_INDICES.left);
  const right = readIrisCenter(points, IRIS_INDICES.right);
  if (!left || !right) return { accepted: false, reason: 'invalid-eye' };
  if (!record(quality) || !record(quality.left) || !record(quality.right)) {
    return { accepted: false, reason: 'missing-eye-quality' };
  }
  return gateIrisObservation({ timestampMs, faceCount: 1,
    left: { ...left, confidence: quality.left.confidence, openness: quality.left.openness },
    right: { ...right, confidence: quality.right.confidence, openness: quality.right.openness },
  }, nowMs);
}
