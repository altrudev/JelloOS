import { measureIrisGeometry } from './measuredIrisGeometry';
import { adaptMediaPipeIrisObservation, type MediaPipeIrisResult } from './mediaPipeIrisAdapter';

/** Deliberately accepts raw output, never model thresholds or blendshapes as eye quality. */
export interface VideoLandmarker {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): unknown;
  close(): void;
}

/** Testable boundary: inference start and completion share performance.now's clock.
 * No cached observations and no quality fabrication, including after an accepted frame.
 */
export function observeCameraFrame(
  detector: VideoLandmarker,
  video: HTMLVideoElement,
  clock: () => number,
): { timestampMs: number; completedMs: number; evidence: MediaPipeIrisResult; measurements: ReturnType<typeof measureIrisGeometry> } {
  const timestampMs = clock();
  const result = detector.detectForVideo(video, timestampMs);
  const completedMs = clock();
  return { timestampMs, completedMs,
    evidence: adaptMediaPipeIrisObservation({ timestampMs, result }, completedMs),
    measurements: measureIrisGeometry({ timestampMs, result, width: video.videoWidth, height: video.videoHeight }, completedMs) };
}

/** Owns camera/model lifetime, including resources resolving after Stop. */
export class CameraLabSession {
  private cancelled = false;
  private stream?: MediaStream;
  private detector?: VideoLandmarker;
  async open(
    getCamera: () => Promise<MediaStream>,
    createDetector: () => Promise<VideoLandmarker>,
  ): Promise<{ stream: MediaStream; detector: VideoLandmarker } | null> {
    const stream = await getCamera();
    if (this.cancelled) { stream.getTracks().forEach(track => track.stop()); return null; }
    this.stream = stream;
    try {
      const detector = await createDetector();
      if (this.cancelled) { detector.close(); return null; }
      this.detector = detector;
      return { stream, detector };
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  stop(): void {
    this.cancelled = true;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
    this.detector?.close();
    this.detector = undefined;
  }
}
