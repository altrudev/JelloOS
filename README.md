# JelloOS

**Eye-tracking AAC for people who communicate with their gaze.**

JelloOS is a sovereign, installation-free augmentative and alternative communication (AAC) interface built for individuals with motor impairments. It runs entirely in the browser — no app store, no installation, no data leaving the device. You open it, calibrate, and communicate.

Built by [ALTRU.dev](https://altru.dev) — Code for Humanity · GPLv3

---

## What it does

JelloOS turns a standard webcam into a communication device. The user looks at keys or phrases on screen; after holding their gaze for a moment (a "dwell"), the key activates. Built text is read aloud via the browser's speech synthesis engine.

**Core features:**

- **Gaze keyboard** — full QWERTY layout, dwell-activated, no physical input required
- **Quick phrases** — customisable phrase tiles for common responses (yes, no, help, water, etc.)
- **AI word prediction** — Gemini-powered next-word suggestions update as you type
- **Jello cursor** — soft, spring-physics gaze indicator that gives real-time visual feedback without being distracting
- **Camera-based ambient light theming** — samples the webcam feed every 2.5 seconds and automatically switches between night / dim / dusk / day themes to keep the face well-lit against the screen
- **Speech output** — one-button speak with configurable voice and rate
- **Mouse simulation mode** — full fallback for development and demonstration without a camera
- **Gaze diagnostics tool** — separate `gaze-diagnostics.html` page with face positioning guide, lighting analysis, calibration quality scoring, and live accuracy testing

**webgazer-aac integration:**

JelloOS ships with [webgazer-aac](https://github.com/altru-dev/webgazer-aac) — an accessibility-first patch layer over WebGazer.js that adds:
- Polynomial and RBF regression (replaces WebGazer's linear ridge)
- Kalman filter smoothing (replaces fixed EMA)
- Blink detection — pauses dwell timers mid-blink
- Saccade suppression — holds position during fast eye movements
- Per-user PCA basis — fitted from your own calibration patches
- Ensemble blending — automatically weights the better-performing model
- Adaptive recalibration — every confirmed dwell hit silently improves the model

---

## Quick start (single-file, no build needed)

JelloOS ships as a self-contained `index.html`. Open it in Chrome or Edge on any device with a webcam:

```bash
# Clone the repo
git clone https://github.com/altru-dev/JelloOS.git
cd JelloOS

# Serve locally (required — camera access needs HTTPS or localhost)
npx serve .
# or: python3 -m http.server 8080

# Open in browser
open http://localhost:8080
```

> **Important:** Camera access requires either `localhost` or an HTTPS origin. Opening `index.html` directly as a `file://` URL will not work.

### API key

AI word prediction uses the Gemini API. Create a `.env.local` file:

```
VITE_GEMINI_API_KEY=your_key_here
```

If no key is provided, word prediction is silently disabled — the rest of the app works fine without it.

---

## Development (React + Vite)

The `index.html` is the production build. The React source is in the repo for modification:

```bash
npm install
npm run dev     # hot-reload dev server at localhost:5173
npm run build   # outputs to dist/
```

**Stack:** React 19 · TypeScript · Vite 6 · WebGazer.js · webgazer-aac · Gemini API (`@google/genai`) · Lucide icons

---

## Calibration guide

Good calibration is the single biggest factor in accuracy. Follow these steps:

1. **Position your face** 50–70 cm from the camera, centred in the frame
2. **Lighting** — light should come from in front of you (a lamp near the monitor). Avoid bright windows or lights behind you
3. **Run the diagnostics tool first** — open `gaze-diagnostics.html` and check the face guide, lighting meters, and eye quality scores before calibrating the main app
4. **Use 9 calibration points** — click each point deliberately, holding your gaze steady for a moment before clicking
5. **Call `fitUserBasis()`** — JelloOS does this automatically at calibration end; it fits a per-user PCA model from your collected patches
6. **Test accuracy** — use the diagnostics tool's accuracy test after calibration to see per-quadrant error

**Realistic accuracy expectations** with good setup:

| Setup | Typical error radius |
|---|---|
| Poor lighting / bad position | 200–300px |
| Good conditions, default WebGazer | 150–200px |
| Good conditions + webgazer-aac | 80–130px |
| + adaptive recalibration (10 min session) | 60–100px |

Design targets of 120px+ are recommended. The keyboard keys in JelloOS are sized accordingly.

---

## Settings

Accessible via the ⚙ button or by dwelling on the settings tile:

| Setting | Default | Description |
|---|---|---|
| Dwell time | 1200ms | How long to hold gaze before activation |
| Sensitivity | 0.5 | Gaze target hit radius multiplier |
| Voice | System default | Speech synthesis voice |
| Eye tracking | Off | Toggle between gaze and mouse simulation |
| Auto face light | On | Automatically adjusts screen brightness to assist camera |

---

## File structure

```
JelloOS/
├── index.html              # Self-contained production app (open this)
├── gaze-diagnostics.html   # Standalone gaze diagnostics tool
├── webgazer-aac.js         # Eye tracking enhancement layer
├── App.tsx                 # Root React component
├── index.tsx               # Entry point
├── types.ts                # TypeScript interfaces and enums
├── vite.config.ts
├── tsconfig.json
├── contexts/
│   └── GazeContext.tsx     # Gaze state, dwell logic, ambient light sensing
├── components/
│   ├── GazeCursor.tsx      # Jello spring-physics cursor
│   ├── JelloButton.tsx     # Dwell-aware button primitive
│   └── Keyboard.tsx        # Gaze keyboard layout
└── services/
    └── geminiService.ts    # Gemini word prediction
```

---

## Gaze diagnostics tool

Open `gaze-diagnostics.html` alongside the main app for setup and troubleshooting. It runs independently — no build needed.

**What it shows:**

- **Face positioning guide** — live mirrored camera feed with oval overlay, distance estimate, alignment, and head tilt
- **Lighting meters** — brightness, contrast/texture, and glare scores with plain-language advice
- **Eye patch quality** — per-eye pupil visibility score (0–100%)
- **Calibration quality** — 9-point grid colour-coded by per-point accuracy; "Redo weak points" button
- **Post-calibration accuracy test** — measures actual pixel error per screen quadrant
- **Gaze heatmap** — 5-second rolling heatmap showing fixation distribution
- **Regression switcher** — live swap between polynomial, RBF, and original ridge regression
- **webgazer-aac status panel** — shows installed version, active regression mode, confidence score, and adaptive recalibration status

---

## Accessibility notes

JelloOS is designed for users with:
- ALS / motor neurone disease
- Cerebral palsy
- Locked-in syndrome
- Severe RSI or limb difference
- Any condition preventing reliable physical input

The entire interface is operable with gaze alone. No keyboard, mouse, switch, or touch input is required once the app is running.

**Design decisions for AAC users:**
- Large dwell targets (120px+ minimum)
- High-contrast themes that adapt to ambient light automatically
- Blink detection prevents false activations mid-blink
- Confidence gating holds dwell progress when gaze is unstable
- Calibration can be re-run at any time from within the app
- All phrase content is editable and persists across sessions

---

## Privacy

JelloOS processes all video locally in the browser. No camera frames, gaze coordinates, calibration data, or typed text are transmitted anywhere. The Gemini API receives only the current text buffer for word prediction — no video, no biometric data.

To use JelloOS with no external network requests at all, leave `VITE_GEMINI_API_KEY` unset. Word prediction will be disabled; everything else works offline.

---

## Related

- **[webgazer-aac](https://github.com/altru-dev/webgazer-aac)** — the eye tracking enhancement layer JelloOS is built on
- **[WebGazer.js](https://github.com/brownhci/WebGazer)** — the underlying eye tracking library (upstream, Brown University, 2016–2026)

---

## Contributing

Issues and PRs are welcome, especially:
- Accessibility improvements
- Additional phrase libraries in other languages
- Better calibration UX
- Mobile / tablet optimisations
- Testing on assistive technology hardware

Please open an issue before large PRs.

---

## License

GPLv3 — see [LICENSE](LICENSE).

The webgazer-aac patch layer (`webgazer-aac.js`) is also GPLv3, same as upstream WebGazer.

If your organisation's valuation is under $1,000,000, you may use both under LGPLv3. For other licensing arrangements, open an issue.

---

*Part of [ALTRU.dev](https://altru.dev) — free, privacy-first tools for people who need them.*
