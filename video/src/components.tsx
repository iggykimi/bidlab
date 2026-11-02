import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import boxesJson from "../public/shots/boxes.json";
import { C, FONT } from "./theme";

const W = 1920;
const H = 1080;

export type Box = { x: number; y: number; w: number; h: number };
const BOXES = boxesJson as Record<string, Record<string, Box>>;

/** True when the capture produced `shot` (live shots exist only after a live run). */
export function has(shot: string): boolean {
  return shot in BOXES;
}

/** Box recorded by the Playwright capture for `shot`/`key`. */
export function box(shot: string, key: string): Box {
  const b = BOXES[shot]?.[key];
  if (!b) throw new Error(`No box ${shot}.${key}: re-run "npm run capture".`);
  return b;
}

type Cam = { z: number; tx: number; ty: number };

/**
 * Layout of every app scene. The app sits in a browser window; captions
 * live in their own band below it. Nothing is ever drawn over the UI the
 * camera is pointing at, so a caption can never hide what it describes.
 */
export const WINDOW = { x: 80, y: 36, w: 1760, h: 824, bar: 40 };
export const BAND_TOP = WINDOW.y + WINDOW.h + 34;

type View = { w: number; h: number };
const ViewContext = createContext<View>({ w: WINDOW.w, h: WINDOW.h - WINDOW.bar });

/** Browser-window frame; children render in its content area. */
export function Window({
  children,
  rect = WINDOW,
  title = "BidLab",
}: {
  children: ReactNode;
  rect?: { x: number; y: number; w: number; h: number; bar: number };
  title?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: 18,
        overflow: "hidden",
        background: C.white,
        boxShadow: "0 24px 60px rgba(24,36,59,0.18), 0 0 0 1px rgba(24,36,59,0.08)",
      }}
    >
      <div
        style={{
          height: rect.bar,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 18px",
          background: "#eef1f6",
          borderBottom: "1px solid #dde3ec",
          fontFamily: FONT,
          fontSize: 18,
          color: C.muted,
        }}
      >
        {["#e5534b", "#e0a43a", "#45a35a"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <span style={{ marginLeft: 14 }}>{title}</span>
      </div>
      <div style={{ position: "relative", width: rect.w, height: rect.h - rect.bar, overflow: "hidden" }}>
        <ViewContext.Provider value={{ w: rect.w, h: rect.h - rect.bar }}>{children}</ViewContext.Provider>
      </div>
    </div>
  );
}

// Camera framing inside the window: fit the target with breathing room,
// never magnify a source pixel more than 1.7x (crisp text, and enough of the
// neighbouring UI stays in frame to show where we are),
// never show past the screenshot's edges.
function frameBox(b: Box | null, view: View): Cam {
  const base = view.w / W;
  if (!b) return { z: base, tx: 0, ty: 0 };
  const pad = 100;
  const z = Math.min(1.7, Math.max(base, Math.min(view.w / (b.w + 2 * pad), view.h / (b.h + 2 * pad))));
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const tx = Math.min(0, Math.max(view.w - W * z, view.w / 2 - cx * z));
  const ty = Math.min(0, Math.max(view.h - H * z, view.h / 2 - cy * z));
  return { z, tx, ty };
}

export type Move = { at: number; to: Box | null };

/**
 * A real app screenshot under a moving camera, inside the current Window.
 * `moves` are keyframes in seconds; each move eases over 0.9 s. `rings`
 * outline boxes in the screenshot's own coordinates and travel with it.
 */
export function Shot({
  src,
  moves = [],
  rings = [],
  drift = true,
}: {
  src: string;
  moves?: Move[];
  rings?: Array<{ at: number; box: Box; until?: number }>;
  drift?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const view = useContext(ViewContext);
  let cam = frameBox(null, view);
  for (const m of moves) {
    const start = m.at * fps;
    const t = interpolate(frame, [start, start + 0.9 * fps], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    });
    if (t <= 0) break;
    const next = frameBox(m.to, view);
    cam = {
      z: cam.z + (next.z - cam.z) * t,
      tx: cam.tx + (next.tx - cam.tx) * t,
      ty: cam.ty + (next.ty - cam.ty) * t,
    };
  }
  // Slow push-in keeps a static frame alive without distracting.
  const push = drift ? interpolate(frame, [0, 30 * fps], [1, 1.03]) : 1;
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: W,
          height: H,
          transformOrigin: "0 0",
          transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z * push})`,
        }}
      >
        <Img src={staticFile(`shots/${src}`)} style={{ width: W, height: H, display: "block" }} />
        {rings.map((r, i) => (
          <Ring key={i} box={r.box} at={r.at} until={r.until} zoom={cam.z} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Highlight: an outline and a soft glow, never a dimmed screen. */
function Ring({ box: b, at, until, zoom }: { box: Box; at: number; until?: number; zoom: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - at * fps, fps, config: { damping: 14 } });
  const exit = until === undefined ? 1 : interpolate(frame, [until * fps, until * fps + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const grow = interpolate(enter, [0, 1], [16, 8]);
  return (
    <div
      style={{
        position: "absolute",
        left: b.x - grow,
        top: b.y - grow,
        width: b.w + 2 * grow,
        height: b.h + 2 * grow,
        border: `${4 / zoom}px solid ${C.blue}`,
        borderRadius: 14,
        boxShadow: `0 0 ${24 / zoom}px rgba(39,72,184,0.35)`,
        opacity: enter * exit,
      }}
    />
  );
}

/** Caption in the band under the window: one claim, one supporting line. */
export function Caption({
  at,
  until,
  title,
  sub,
}: {
  at: number;
  until?: number;
  title: string;
  sub?: string;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const end = (until ?? durationInFrames / fps) * fps;
  const enter = spring({ frame: frame - at * fps, fps, config: { damping: 18 } });
  const exit = interpolate(frame, [end - 10, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < at * fps) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: BAND_TOP,
        left: WINDOW.x,
        width: WINDOW.w,
        paddingLeft: 28,
        borderLeft: `8px solid ${C.blue}`,
        fontFamily: FONT,
        color: C.ink,
        opacity: enter * exit,
        transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
      {sub && <div style={{ fontSize: 29, marginTop: 8, color: C.muted, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

/** Word-by-word headline for title cards. */
export function Headline({ text, at = 0, size = 92, style }: { text: string; at?: number; size?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 800, lineHeight: 1.12, color: C.ink, ...style }}>
      {text.split(" ").map((word, i) => {
        const s = spring({ frame: frame - at * fps - i * 3, fps, config: { damping: 16 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export function FadeIn({ at, children, style }: { at: number; children: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at * fps, fps, config: { damping: 18 } });
  return (
    <div style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)`, ...style }}>
      {children}
    </div>
  );
}

/** Number that counts up to its final value; the label states its source. */
export function Stat({ at, value, decimals = 0, prefix = "", suffix = "", label }: {
  at: number;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [at * fps, at * fps + 1.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <FadeIn at={at}>
      <div style={{ fontFamily: FONT, color: C.ink }}>
        <div style={{ fontSize: 96, fontWeight: 800, color: C.blue, lineHeight: 1 }}>
          {prefix}
          {(value * t).toFixed(decimals)}
          {suffix}
        </div>
        <div style={{ fontSize: 30, marginTop: 12, color: C.muted, maxWidth: 380, lineHeight: 1.3 }}>{label}</div>
      </div>
    </FadeIn>
  );
}
