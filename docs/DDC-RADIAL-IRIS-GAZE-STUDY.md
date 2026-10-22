# JelloOS × DDC Radial — iris-center and gaze-ray research audit
**Date:** 2026-10-22  
**Repository inspected:** `altrudev/JelloOS`, main tree `a17ba3aa1bf45027e9ce1d9c589dd612c9055150`.  
**Scope:** code inspection and research, not actual-camera performance certification.

## 1. Immediate findings (source-grounded)

1. JelloOS already implements an AAC keyboard, dwell UI, speech output, 9-zone diagnostics, eye-patch previews and lighting guidance. Reuse these as UI and test infrastructure instead of recreating them in webgazer-aac.
2. **React tracker** `contexts/GazeContext.tsx` calls WebGazer `setTracker('clmtrackr')`, `setRegression('ridge')`, and `saveDataAcrossSessions(true)`. It is not an independent iris/gaze estimator. Confirm that `clmtrackr` even exists in the chosen pinned WebGazer bundle; otherwise this path can fail to start.
3. **Standalone index** loads unpinned `https://unpkg.com/webgazer@2.1.0/dist/webgazer.js`; source `index.html` configures `TFFaceMesh`, ridge and session persistence. The React and standalone apps therefore have materially different tracker contracts. Avoid comparing diagnostic results without reporting the runtime/build.
4. `gaze-diagnostics.html` uses rough central-image skin-color and brightness heuristics for “face detected,” face distance, alignment and head tilt. These **do not establish a face, distance in centimetres, or actual head orientation**. Replace with landmark-based measurements and mark heuristics clearly.
5. `scoreEyePatch` counts near-black pixels as “pupil candidates”; these include lashes, shadows and compression artifacts. It does **not locate the pupil/iris center or optical axis**.
6. Its eye patch polling calls `tracker.getEyePatches()` without required video/canvas arguments and without awaiting a possible Promise; the contemporary `TFFaceMesh.getEyePatches(video,canvas,width,height)` contract is async. Use the actual prediction's timestamped `eyeFeatures` or an explicit supported tracker API.
7. `enableAdaptiveRecalibration()` is invoked before trustworthy holdout verification. Calibration predictions are also used to judge calibration quality—circular evidence. Never use model-produced dwell activations as ground truth.
8. `README.md` publishes unverified “typical error radius” figures and claims no network when Gemini prediction is available. Distinguish estimates from measured user-device results; enumerate WebGazer/MediaPipe model/CDN network requests.
9. README states “GPLv3, or LGPLv3 if organisation valuation < $1m”; the actual LICENSE contains GPL-3.0 text. An informal README cannot relicense upstream GPL code; review provenance/rights and do not promise the LGPL exception until legally established.
10. The browser UI is separate from visual accuracy evidence. Keep emergency phrases and safety-critical AAC activation fail-closed until real-world trials pass.

## 2. The physical problem: four different quantities

**A. Iris center in the *camera image* (2D):** iris contour points around the cornea, center via circle/ellipse fit, `c=(cx,cy)`. An RGB system can estimate this under favorable lighting. MediaPipe Face Landmarker yields 478 landmarks when iris refinement is enabled (468 face + 10 iris); centers conventionally at 468 and 473. Verify the exact model/coordinate frame instead of assuming landmarks are available.

**B. Eye direction relative to its socket (2D/relative):** subtract head-stabilized eye-corner location and normalize by inter-canthus distance. `u = dot(c - innerCorner, outerCorner-innerCorner)/||outerCorner-innerCorner||²`; normalize vertical position against eyelid contour. This is eye-in-head direction *proxy*, not a physical degree angle. A single iris circle center cannot specify the 3D optical axis.

**C. Optical vs visual axes in 3D:** the optical axis is determined by approximate eyeball/cornea geometry, which isn't fully observable from a single uncalibrated RGB image. The **visual axis** (foveal fixation) differs by individual-specific kappa angle. A camera-relative face-pose rotation `R_head` and calibrated eye-in-head gaze direction `d_eye` give `d_camera = R_head d_eye`; personalized correction maps to `d_visual`. Never assume geometric eye center or iris center is the foveal gaze ray.

**D. Where the ray intersects the display:** Given a calibrated 3D eye origin `o`, screen plane anchor `p0`, unit normal `n`, and visual direction `d`, `t = dot(n,p0-o)/dot(n,d)`, `p = o + t d`. Reject `abs(dot(n,d)) ≈ 0`, `t≤0`, or intersections outside the calibration region. Mapping `p` to CSS coordinates requires display dimensions, orientation, camera-to-screen extrinsics, browser scaling and gaze-personalization. Without camera intrinsics/extrinsics and an individual model, screen gaze cannot be recovered accurately by iris tracking alone.

## 3. Implementation choices (ranked for 720p webcam)

| Path | Benefits | Risks | Recommendation |
|---|---|---|---|
| MediaPipe Face Landmarker + iris contours | independent raw iris and head geometry, browser local | iris pixels may be tiny, only eye-in-head proxy | Build as measurement/quality baseline |
| WebEyeTrack/BlazeGaze + personalized calibration | pretrained webcam appearance model, face pose, local few-shot fit | model weights/license/browser performance must be audited | Build as independent gaze candidate |
| Existing WebGazer + AAC appearance | existing integration and UI | mouse-trained regression, stale calibration, inversion, heavy error | Keep as isolated comparison only |
| Corneal-reflection pupil-center tracking (PCCR), controlled IR LED/camera | better controlled gaze precision | needs dedicated IR hardware and safety review | Future optional hardware tier |

Google's MediaPipe Iris documentation explicitly states that iris tracking **does not infer where someone is looking**. See https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/iris.md . WebEyeTrack research: https://arxiv.org/abs/2508.19544 .

## 4. Iris pipeline: testable algorithm

- Acquire frame with monotonically increasing frame_id and timestamp. Report video crop, horizontal mirroring metadata and camera geometry.
- Detect one face and eye contours. Reject missing eyes, multiple unmatched faces, frame-age violations, motion blur, eyelid occlusion and implausible contour radius.
- Crop left/right eye into stable per-eye regions, not arbitrary unaligned pixels. Normalize each crop while maintaining the mapping to original camera pixels.
- Fit iris center to **perimeter landmarks** (not the darkest pixel); use center-landmark agreement, contour residual and blink/occlusion to set *measurement quality*, not fake gaze confidence.
- Compute head pose from robust 3D face mesh + face transformation matrix; record yaw/pitch/roll and translation with clearly documented coordinate conventions and transforms.
- Make left/right iris normalized positions available separately. Check binocular agreement after accounting for convergent gaze, not blindly requiring identical normalized coordinates.
- Derive empirical eye-in-head direction through supervised fixation samples. Add pupil ellipse/iris-depth estimation only as a supplementary cue.
- Compare geometric and neural predictions in *identical* calibrated CSS coordinates. Observe disagreement, head pose, sample age and per-zone error; avoid simple averaging of bad estimates.
- Permit dwell only when fresh, calibrated, stable results meet an independently measured threshold; allow mouse/switch/touch as explicitly labeled separate backup modalities.

## 5. Experiment sequence and hard gates

**G0 Licensing + provenance:** fix contradictory LICENSE/README statements, pin versions, review model weight rights and hosted CDNs.

**G1 Camera-visible proof:** in an isolated, opt-in browser diagnostics page, draw actual eye patch, iris contour and measured center over the video frame. Separate left/right, no automatic uploads; show “iris unavailable” if absent.

**G2 Directional truth:** keep head fixed and move gaze center→right→left→up→down; independently log monotonic changes in normalized iris position. Repeat with *eyes fixed/head moving* to test compensation. Explicitly account for mirrored preview.

**G3 Screen calibration:** 9–16 viewport-wide points, fixed eye features synchronized with fixation timing, reject invalid points, freeze all learning during withheld testing.

**G4 Quantify accuracy:** median/P90 *physical gaze-to-target error*, zone-wise worst-case, angular error if camera/display geometry calibrated, drift, tracking failure/latency, left-right agreement and CPU use. Repeat in varying lighting and head positions.

**G5 Cross-model test:** compare Face Landmarker geometry, WebEyeTrack pretrained model, and WebGazer baseline in the same test session. Fusion only after independent gate performance.

**G6 AAC safety:** never enable emergency speech, keyboard or home-device actions from unqualified gaze/dwell. Provide confirmed accessible alternatives.

## 6. Glossary to standard terminology

- **Iris-centroid detection**: image-space landmark/contour fitting.
- **Eye-in-head angle proxy**: normalized iris-to-canthus coordinates, not degrees.
- **Head pose**: 6-DoF face rotation and translation, with coordinate-frame definition.
- **Optical axis**: anatomical axis through the ocular optical surfaces.
- **Visual axis / kappa**: individually offset fixation axis toward the fovea.
- **Gaze ray**: 3D calibrated origin and direction.
- **Point of regard**: intersection of gaze ray with a calibrated physical display.
- **Holdout**: trials withheld from all training, including adaptive online updates.
- **PCCR**: pupil-center/corneal-reflection method with dedicated active illumination.

## 7. Status

This is a code-and-literature audit; **no JelloOS camera tracking success, visual-axis accuracy, angular error, or production AAC reliability is claimed**. JelloOS's UI/dwell portions are reusable. The existing gaze predictor must be replaced or evaluated independently.
