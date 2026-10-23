// @ts-ignore remote ESM prototype; browser-loaded, no npm package
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm';
import { CameraLabSession, observeCameraFrame } from '../services/mediaPipeCameraObservation';

import { MeasurementValidation, VALIDATION_TARGETS, type Partition } from '../services/measurementValidation';

const start = document.querySelector<HTMLButtonElement>('#start')!;
const stop = document.querySelector<HTMLButtonElement>('#stop')!;
const video = document.querySelector<HTMLVideoElement>('#preview')!;
const status = document.querySelector<HTMLElement>('#status')!;
const evidence = document.querySelector<HTMLElement>('#evidence')!;
let active: CameraLabSession | undefined;
let animation = 0;

let validation = new MeasurementValidation();
const confirmFixation = document.querySelector<HTMLButtonElement>('#confirm-fixation')!;
const partition = document.querySelector<HTMLSelectElement>('#partition')!;
const marker = document.querySelector<HTMLElement>('#fixation-target')!;
const validationReport = document.querySelector<HTMLElement>('#validation-report')!;
const renderValidation = () => { validationReport.textContent = JSON.stringify(validation.report(), null, 2); };
VALIDATION_TARGETS.forEach((target, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `Target ${index + 1} (${target.x}, ${target.y})`;
  button.addEventListener('click', () => {
    if (!active) return;
    validation.selectTarget(target);
    marker.hidden = false;
    marker.style.left = `${target.x * 100}%`;
    marker.style.top = `${target.y * 100}%`;
    confirmFixation.disabled = false;
    renderValidation();
  });
  document.querySelector('#target-controls')!.append(button);
});
confirmFixation.addEventListener('click', () => {
  if (!active) return;
  validation.confirmFixation(partition.value as Partition);
  renderValidation();
});
document.querySelector('#end-fixation')!.addEventListener('click', () => {
  validation.endFixation(); renderValidation();
});
partition.addEventListener('change', () => { validation.endFixation(); renderValidation(); });
window.addEventListener('resize', () => { validation.endFixation(); renderValidation(); });

function finish(message = 'Stopped — camera released.'): void {
  validation.stop();
  marker.hidden = true;
  confirmFixation.disabled = true;
  renderValidation();
  cancelAnimationFrame(animation);
  active?.stop();
  active = undefined;
  video.pause();
  video.srcObject = null;
  start.disabled = false;
  stop.disabled = true;
  status.textContent = message;
  evidence.textContent = 'No current frame evidence.';
}

// The sole entry point for requesting camera access is this explicit click.
start.addEventListener('click', async () => {
  if (active) return;
  validation = new MeasurementValidation();
  renderValidation();
  const session = new CameraLabSession();
  active = session;
  start.disabled = true;
  stop.disabled = false;
  status.textContent = 'Requesting camera; then downloading pinned model assets…';
  evidence.textContent = 'No frame observed.';
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera requires HTTPS or localhost and browser camera support.');
    }
    const resources = await session.open(
      () => navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
      async () => FaceLandmarker.createFromOptions(
        await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'),
        { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
          runningMode: 'VIDEO', numFaces: 2,
          outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false },
      ),
    );
    if (!resources || active !== session) return;
    video.srcObject = resources.stream;
    resources.stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (active === session) finish('Camera track ended — session stopped.');
    }));
    await video.play();
    if (active !== session) return;
    status.textContent = 'Running — local inference; measured geometry only; gaze actions disabled.';
    let lastVideoTime = -1;
    let frames = 0;
    const tick = () => {
      if (active !== session) return;
      try {
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const frame = observeCameraFrame(resources.detector, video, () => performance.now());
          validation.capture(frame.measurements);
          renderValidation();
          frames++;
          evidence.textContent = JSON.stringify({ frame: frames,
            timestampMs: frame.timestampMs,
            inferenceMs: frame.completedMs - frame.timestampMs,
            eyeConfidence: 'unavailable', measurements: frame.measurements,
            ...frame.evidence }, null, 2);
        }
        animation = requestAnimationFrame(tick);
      } catch (error) { finish(`Inference failed — ${error instanceof Error ? error.message : String(error)}`); }
    };
    tick();
  } catch (error) {
    if (active === session) finish(`Start failed — ${error instanceof Error ? error.message : String(error)}. Check camera permissions and network access to pinned MediaPipe assets.`);
  }
});
stop.addEventListener('click', () => finish());
window.addEventListener('pagehide', () => finish());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && active) finish('Page hidden — camera released. Click Start to resume.');
});
