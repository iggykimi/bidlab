import type { CSSProperties, ReactNode } from "react";
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

// Camera framing: fit the target box with breathing room, never zoom past
// 2.2x (UI text stays crisp from 1080p captures), never show beyond the
// screenshot's edges.
function frameBox(b: Box | null): Cam {
  if (!b) return { z: 1, tx: 0, ty: 0 };
  const pad = 90;
  const z = Math.min(2.2, Math.max(1, Math.min(W / (b.w + 2 * pad), H / (b.h + 2 * pad))));
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const tx = Math.min(0, Math.max(W - W * z, W / 2 - cx * z));
  const ty = Math.min(0, Math.max(H - H * z, H / 2 - cy * z));
  return { z, tx, ty };
}

export type Move = { at: number; to: Box | null };

/**
 * A real app screenshot under a moving camera. `moves` are keyframes in
 * seconds; each move eases over 0.9 s. `rings` outline boxes in the
 * screenshot's own coordinates, so they travel with the camera.
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
  let cam = frameBox(null);
  for (const m of moves) {
    const start = m.at * fps;
    const t = interpolate(frame, [start, start + 0.9 * fps], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    });
    if (t <= 0) break;
    const next = frameBox(m.to);
    cam = {
      z: cam.z + (next.z - cam.z) * t,
      tx: cam.tx + (next.tx - cam.tx) * t,
      ty: cam.ty + (next.ty - cam.ty) * t,
    };
  }
  // Slow push-in keeps static frames alive without distracting.
  const push = drift ? interpolate(frame, [0, 30 * fps], [1, 1.04]) : 1;
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

function Ring({ box: b, at, until, zoom }: { box: Box; at: number; until?: number; zoom: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - at * fps, fps, config: { damping: 14 } });
  const exit = until === undefined ? 1 : interpolate(frame, [until * fps, until * fps + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const grow = interpolate(enter, [0, 1], [18, 8]);
  return (
    <div
      style={{
        position: "absolute",
        left: b.x - grow,
        top: b.y - grow,
        width: b.w + 2 * grow,
        height: b.h + 2 * grow,
        border: `${6 / zoom}px solid ${C.blue}`,
        borderRadius: 16,
        boxShadow: `0 0 0 ${9999}px rgba(24, 36, 59, ${0.28 * enter * exit})`,
        opacity: enter * exit,
      }}
    />
  );
}

/** Lower-third caption: one claim, one supporting line. */
export function Caption({
  at,
  until,
  title,
  sub,
  align = "left",
}: {
  at: number;
  until?: number;
  title: string;
  sub?: string;
  align?: "left" | "right";
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
        bottom: 72,
        [align]: 72,
        maxWidth: 1000,
        background: C.white,
        borderLeft: `10px solid ${C.blue}`,
        borderRadius: 14,
        padding: "26px 34px",
        boxShadow: "0 18px 50px rgba(24,36,59,0.22)",
        fontFamily: FONT,
        color: C.ink,
        // Fully opaque at rest (exit is 1 until fade-out); entrance is slide-only so no ghosting.
        opacity: exit,
        transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
      }}
    >
      <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
      {sub && <div style={{ fontSize: 30, marginTop: 10, color: C.muted, lineHeight: 1.35 }}>{sub}</div>}
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
