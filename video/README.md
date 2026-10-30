# BidLab demo video (2:47)

The video is code. [Playwright](capture/) drives the real app and saves 1920×1080 frames plus the
boxes of the elements the camera should move to; [Remotion](src/) composes them with camera moves,
highlights, captions and transitions. Nothing on screen is mocked: if a live capture is missing,
its scene falls back to the offline capture and the caption says what BidLab does, not what a run
returned.

Remotion is free for individuals and teams of up to three people
([license](https://www.remotion.dev/license)); larger companies need a company license.

```
video/
  capture/capture.config.ts   boots the real API + built web app (ports 8000 / 5173)
  capture/capture.spec.ts     offline scenes: the reviewed Tías example, phone, font toggle
  capture/live.spec.ts        live Meta scenes (skipped without a key)
  public/shots/               captured frames + boxes.json
  src/timeline.ts             scene order and lengths; the script below uses the same times
  src/Video.tsx               the scenes
```

## Record it

From the repo root (once): `uv sync --all-packages && npm install`, then `cd video && npm install`.

**1. Offline scenes** (no key, no network):

```powershell
cd video
npx playwright test -c capture/capture.config.ts capture.spec.ts
```

**2. Live scenes** on the machine that has the Meta key. Each run spends real budget: one
extraction job, one clarification draft, one transcription and one answer (cents in total; the
ceiling below stops anything above it).

```powershell
$env:BIDLAB_MODE = "live"
$env:MODEL_API_KEY = "<your Meta Model API key>"
$env:META_API_URL = "https://api.meta.ai/v1/chat/completions"
$env:BIDLAB_META_BUDGET_USD = "2.00"
# optional: any tender on contrataciondelestado.es (default: Munilla, expediente 5/2026)
$env:BIDLAB_PLACSP_URL = "https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=..."
# optional: your own spoken question, played to Chromium as the microphone
$env:BIDLAB_VOICE_WAV = "C:\ruta\pregunta.wav"
$env:BIDLAB_VOICE_SECONDS = "6"
npx playwright test -c capture/capture.config.ts live.spec.ts
```

For the voice scene, record yourself saying, for example, *«¿Y si bajo un doce por ciento?
¿Cuántos puntos y cuánto beneficio me quedan?»* and save it as WAV (any recorder; Audacity:
mono, 16 kHz, 16-bit). Set `BIDLAB_VOICE_SECONDS` to its length plus one second. Without a WAV
the same question is typed instead, which is still a live answer.

Check the frames in `public/shots/live-*.png` before rendering. If the import of the default
tender is slow (the Plataforma serves ~100 KB/s), the step allows four minutes.

**3. Preview and render**

```powershell
npm run studio        # scrub the timeline in the browser
npm run render        # out/bidlab-180s.mp4, H.264 1080p30
```

Add the voice-over in your editor on top of `out/bidlab-180s.mp4`, or drop a `public/voiceover.mp3`
and wire it with Remotion's `<Audio>` in `src/Video.tsx`.

## Voice-over script (English, ~370 words, about 140 words per minute)

Times are when each scene is fully on screen; transitions overlap by half a second.

| Time | Scene | Narration |
|---|---|---|
| 0:00–0:11 | Hook | Would you give up almost six thousand euros for exactly the same score? On a real Spanish public tender, that is the choice a small firm faces. |
| 0:11–0:25 | Problem → import | Public tenders are written for lawyers. Often one person decides, and many are over sixty. With BidLab, you paste the link from Spain's procurement platform, and it brings in the official record and the tender PDF. |
| 0:25–0:51 | Muse Spark reads | You decide what goes to Meta: one checkbox, a budget, and a receipt for every call. Muse Spark reads each page as text and as an image, and proposes the requirements with their exact page. Nothing counts until you confirm it. What is unknown stays unknown, and one click opens the original quote. |
| 0:51–1:14 | Price | Then the maths, and the model never does it. A Python engine applies the tender's own formula. Ten percent off: forty-nine out of forty-nine points. Fifteen percent: the same forty-nine points, and less profit. The curve shows where more discount stops paying. |
| 1:14–1:30 | Compare | Side by side, the ten percent bid keeps five thousand nine hundred euros more, for the same score. No win prediction and no invented rivals: every assumption is labelled. |
| 1:30–1:39 | Report | The decision becomes a record you can hand to your accountant, with every figure sourced. |
| 1:39–2:03 | Ask | If a requirement is unclear, Muse Spark drafts the formal question for the contracting body, citing the page. Or simply ask out loud. Meta's speech-to-text writes down your question, and Muse Spark answers by calling BidLab's own engine as a tool. Every number is checked before you see it. |
| 2:03–2:24 | Proof | We tested it against traps, not happy paths: scans, tables, contradictions, even a prompt injection. Twelve out of twelve documents extracted, eighteen of eighteen figures verified by hand, zero critical errors, for about one cent. The model proposes. Python decides. You approve. |
| 2:24–2:38 | Accessibility | And it is built for the people who really do this job: large type, high contrast, big buttons, one tap for bigger letters, and a typeface designed for low vision. |
| 2:38–2:47 | Close | BidLab. From a tender PDF to a bid you can defend. Built with Muse Spark and Muse Code. |

If you narrate the live run with a different tender or a different spoken question, change only
the import and voice lines; the rest of the figures come from the curated Tías example and stay
true.
