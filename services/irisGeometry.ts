/** MediaPipe refined face topology: anatomical right center 468, left 473.
 * x grows right and y down in the inference image; no display mirroring.
 * z is relative depth, not image y or a confidence score.
 * https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/iris.md
 */
export interface ImageLandmark { x: number; y: number; z: number }
export const IRIS_INDICES = Object.freeze({ right: 468, left: 473 });

/** Read the model's iris center, checking that its four rim points are distinct
 * and surround it. No averaging, coordinate clamping or screen projection.
 */
export function readIrisCenter(points: readonly ImageLandmark[], centerIndex: number) {
  const center = points[centerIndex];
  const rim = points.slice(centerIndex + 1, centerIndex + 5);
  if (!center || rim.length !== 4) return null;
  const xs = rim.map(p => p.x), ys = rim.map(p => p.y);
  if (new Set(rim.map(p => `${p.x},${p.y}`)).size !== 4 ||
      !(Math.min(...xs) < center.x && center.x < Math.max(...xs)) ||
      !(Math.min(...ys) < center.y && center.y < Math.max(...ys))) return null;
  return { x: center.x, y: center.y };
}
