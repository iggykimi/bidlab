// One table drives the whole cut: scene order and length. The voice-over
// script in this folder's README is timed against these same numbers, so
// change both together.
export const FPS = 30;

export const SCENES = [
  { id: "hook", seconds: 11 },
  { id: "problem", seconds: 15 },
  { id: "read", seconds: 26 },
  { id: "price", seconds: 24 },
  { id: "compare", seconds: 16 },
  { id: "report", seconds: 10 },
  { id: "ask", seconds: 24 },
  { id: "proof", seconds: 22 },
  { id: "access", seconds: 14 },
  { id: "close", seconds: 10 },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

/** Frames shared by two neighbouring scenes during a transition. */
export const OVERLAP = 15;

export const TOTAL_FRAMES =
  SCENES.reduce((sum, s) => sum + s.seconds * FPS, 0) - OVERLAP * (SCENES.length - 1);
