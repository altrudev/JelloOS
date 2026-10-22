import type { ImageLandmark } from './irisGeometry';

/** Engineering limits only; neither probabilities nor validated accuracy bounds. */
export const MEASURED_IRIS_LIMITS = Object.freeze({ maxAgeMs: 100,
  minEyeWidthPx: 2, minIrisRadiusPx: 1, maxRelativeResidual: 0.2 });
const topology = {
  right: { corners: [33, 133], lids: [[160, 144], [158, 153]], rim: [469, 470, 471, 472] },
  left: { corners: [362, 263], lids: [[385, 380], [387, 373]], rim: [474, 475, 476, 477] },
};
type Point = { x: number; y: number };

/** Algebraic least squares circle, centered before solving for numerical stability.
 * Uses all four rim samples; the model center is not a fit constraint. */
function fitRim(rim: Point[]) {
  if (new Set(rim.map(p => `${p.x},${p.y}`)).size !== 4) return null;
  const origin = { x: rim.reduce((s, p) => s + p.x / 4, 0), y: rim.reduce((s, p) => s + p.y / 4, 0) };
  const local = rim.map(p => ({ x: p.x - origin.x, y: p.y - origin.y }));
  let xx = 0, xy = 0, yy = 0, xq = 0, yq = 0;
  for (const { x, y } of local) {
    const q = x * x + y * y;
    xx += x * x; xy += x * y; yy += y * y; xq += x * q; yq += y * q;
  }
  const determinant = xx * yy - xy * xy;
  if (!(determinant > 1e-12 * (xx + yy) ** 2)) return null;
  const x = (xq * yy - yq * xy) / (2 * determinant);
  const y = (yq * xx - xq * xy) / (2 * determinant);
  const radii = local.map(p => Math.hypot(p.x - x, p.y - y));
  const radiusPx = radii.reduce((s, r) => s + r / 4, 0);
  const residualPx = Math.sqrt(radii.reduce((s, r) => s + (r - radiusPx) ** 2 / 4, 0));
  const fit = { xPx: origin.x + x, yPx: origin.y + y, radiusPx, residualPx,
    relativeResidual: residualPx / radiusPx };
  return radiusPx > 0 && Object.values(fit).every(Number.isFinite) ? fit : null;
}
function measureEye(points: Point[], spec: typeof topology.left) {
  const [a, b] = spec.corners.map(i => points[i]);
  const dx = b.x - a.x, dy = b.y - a.y;
  const eyeWidthPx = Math.hypot(dx, dy);
  if (!(eyeWidthPx > 0) || !Number.isFinite(eyeWidthPx)) {
    return { accepted: false, reason: 'degenerate-eye-baseline' as const };
  }
  const eyelidGapPx = spec.lids.reduce((sum, [u, l]) => sum + Math.abs(
    (points[l].y - points[u].y) * dx / eyeWidthPx -
    (points[l].x - points[u].x) * dy / eyeWidthPx) / 2, 0);
  const eyelidOpenness = eyelidGapPx / eyeWidthPx;
  const iris = fitRim(spec.rim.map(i => points[i]));
  const reason = !iris || !Number.isFinite(eyelidOpenness) ? 'degenerate-iris-geometry'
    : eyeWidthPx < MEASURED_IRIS_LIMITS.minEyeWidthPx ? 'eye-too-small'
    : iris.radiusPx < MEASURED_IRIS_LIMITS.minIrisRadiusPx ? 'iris-too-small'
    : iris.relativeResidual > MEASURED_IRIS_LIMITS.maxRelativeResidual ? 'poor-iris-fit' : null;
  return { accepted: reason === null, reason, eyeWidthPx, eyelidGapPx, eyelidOpenness, iris };
}

/** Independent per-eye observations in unmirrored camera pixels. Closed lids are
 * measurable (zero gap), not a blink probability. No screen or action authority.
 * Frame time must identify this inference in the caller's monotonic clock domain.
 */
export function measureIrisGeometry(input: unknown, nowMs: number) {
  const safety = { kind: 'measured-geometry' as const, screenGaze: null,
    qualifiedForDwell: false as const, confidence: null };
  const reject = (reason: string) => ({ ...safety, accepted: false, reason });
  if (!input || typeof input !== 'object') return reject('invalid-input');
  const { timestampMs, width, height, result } = input as {
    timestampMs: number; width: number; height: number;
    result?: { faceLandmarks?: ImageLandmark[][] };
  };
  if (![nowMs, timestampMs].every(v => Number.isFinite(v) && v >= 0)) return reject('invalid-time');
  const ageMs = nowMs - timestampMs;
  if (ageMs < 0) return reject('future-observation');
  if (ageMs > MEASURED_IRIS_LIMITS.maxAgeMs) return reject('stale-observation');
  if (![width, height].every(v => Number.isFinite(v) && v > 0)) return reject('invalid-resolution');
  if (!Array.isArray(result?.faceLandmarks) || result.faceLandmarks.length !== 1) return reject('ambiguous-face');
  const landmarks = result.faceLandmarks[0];
  if (!Array.isArray(landmarks) || landmarks.length !== 478 || Array.from(landmarks).some(p =>
    !p || ![p.x, p.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1) || !Number.isFinite(p.z))) {
    return reject('invalid-landmarks');
  }
  const pixels = landmarks.map(p => ({ x: p.x * width, y: p.y * height }));
  const left = measureEye(pixels, topology.left), right = measureEye(pixels, topology.right);
  return { ...safety, accepted: left.accepted && right.accepted,
    reason: left.reason ?? right.reason, ageMs, resolution: { width, height }, left, right };
}
