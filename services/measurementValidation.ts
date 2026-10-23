import type { measureIrisGeometry } from './measuredIrisGeometry';

type Measurements = ReturnType<typeof measureIrisGeometry>;
export type Target = { x: number; y: number };
export type Partition = 'calibration' | 'held-out';
export const VALIDATION_TARGETS: readonly Target[] = Object.freeze([
  { x: .2, y: .2 }, { x: .8, y: .2 }, { x: .5, y: .5 },
  { x: .2, y: .8 }, { x: .8, y: .8 },
].map(target => Object.freeze(target)));
const validTarget = (target: Target) => target && [target.x, target.y].every(
  value => Number.isFinite(value) && value > 0 && value < 1);

/** Memory-only measurement collection. A target selection is never a fixation label.
 * Only the separate operator confirmation opens capture. No screen estimator exists.
 */
export class MeasurementValidation {
  private target?: Target;
  private partition?: Partition;
  private samples: { partition: Partition; target: Target; features: number[] }[] = [];
  private stopped = false;

  selectTarget(target: Target): void {
    this.partition = undefined;
    this.target = undefined;
    if (this.stopped || !validTarget(target)) throw new Error('Invalid target');
    this.target = { x: target.x, y: target.y };
  }
  confirmFixation(partition: Partition): void {
    if (this.stopped || !this.target || !['calibration', 'held-out'].includes(partition)) {
      throw new Error('Select a valid target and partition before confirming fixation');
    }
    this.partition = partition;
  }
  endFixation(): void { this.partition = undefined; }
  capture(measurements: Measurements): boolean {
    if (this.stopped || !this.target || !this.partition || this.samples.length >= 3000 ||
        !measurements.accepted || !('left' in measurements) || !('right' in measurements)) return false;
    // Copy only explicit scalar features. Never retain frames, landmarks, input objects,
    // image handles, model output, or caller-supplied extra properties.
    const features: number[] = [];
    for (const eye of [measurements.left, measurements.right]) {
      if (!eye.accepted || !eye.iris) return false;
      features.push(eye.eyeWidthPx!, eye.eyelidGapPx!, eye.eyelidOpenness!,
        eye.iris.xPx, eye.iris.yPx, eye.iris.radiusPx,
        eye.iris.residualPx, eye.iris.relativeResidual);
    }
    if (!features.every(Number.isFinite)) return false;
    this.samples.push({ partition: this.partition, target: { ...this.target }, features });
    return true;
  }
  report() {
    return { calibrationFrames: this.samples.filter(s => s.partition === 'calibration').length,
      heldOutFrames: this.samples.filter(s => s.partition === 'held-out').length,
      capturing: !!this.partition, heldOutError: 'UNAVAILABLE' as const,
      reason: 'No actual screen gaze estimator is implemented.' };
  }
  stop(): void {
    this.samples.length = 0;
    this.target = undefined;
    this.partition = undefined;
    this.stopped = true;
  }
}
