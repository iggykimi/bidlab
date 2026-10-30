import { describe, expect, it } from "vitest";
import type { AssistantAnswer } from "../../api/client";
import { INITIAL, NOT_HEARD, askReducer, type AskState } from "./askMachine";
import { encodeWav16 } from "./wav";

const ANSWER: AssistantAnswer = {
  answer: "Tu precio sería el de abajo.",
  figures: [],
  tools_used: ["evaluate_discount"],
  mode: "live",
  invocations: [
    {
      invocation_id: "inv-ask-1",
      model: "muse-spark-1.3",
      provider_request_id: null,
      prompt_tokens: null,
      completion_tokens: null,
      estimated_cost_usd: null,
      latency_ms: 0,
    },
  ],
  created_at: "2026-10-30T00:00:00+00:00",
};

function run(state: AskState, ...events: Parameters<typeof askReducer>[1][]): AskState {
  return events.reduce(askReducer, state);
}

describe("askReducer", () => {
  it("goes from voice to an editable transcript to an answer", () => {
    const review = run(INITIAL, { type: "record" }, { type: "stop" }, { type: "transcribed", text: " ¿Y si bajo un 12 %? " });
    expect(review).toEqual({ kind: "review", draft: "¿Y si bajo un 12 %?" });
    const fixed = run(review, { type: "edit", draft: "¿Y si bajo un 15 %?" }, { type: "ask", question: "¿Y si bajo un 15 %?" });
    expect(fixed).toEqual({ kind: "answering", question: "¿Y si bajo un 15 %?", draft: "¿Y si bajo un 15 %?" });
    expect(askReducer(fixed, { type: "answered", answer: ANSWER })).toMatchObject({ kind: "answered" });
  });

  it("returns to typing with a notice when nothing was heard", () => {
    const state = run(INITIAL, { type: "edit", draft: "a medias" }, { type: "record" }, { type: "stop" }, { type: "transcribed", text: "  " });
    expect(state).toEqual({ kind: "idle", draft: "a medias", notice: NOT_HEARD });
  });

  it("ignores late results that belong to an abandoned step", () => {
    const answering = run(INITIAL, { type: "ask", question: "¿Qué experiencia me piden?" });
    // A transcript arriving while answering, or an answer after a reset, changes nothing.
    expect(askReducer(answering, { type: "transcribed", text: "otra cosa" })).toBe(answering);
    expect(askReducer(INITIAL, { type: "answered", answer: ANSWER })).toBe(INITIAL);
    expect(askReducer(answering, { type: "record" })).toBe(answering);
  });

  it("keeps the question after a failure so the user can retry or fix it", () => {
    const failed = run(INITIAL, { type: "ask", question: "¿Y si bajo un 12 %?" }, { type: "fail", message: "Meta no respondió.", code: "provider_failure" });
    expect(failed).toEqual({ kind: "failed", draft: "¿Y si bajo un 12 %?", message: "Meta no respondió.", code: "provider_failure" });
    expect(askReducer(failed, { type: "ask", question: "  " })).toBe(failed);
  });
});

describe("encodeWav16", () => {
  it("writes the 16-bit mono PCM header the transcription endpoint requires", () => {
    const bytes = encodeWav16(new Float32Array([0, 1, -1, 2]), 16_000);
    const view = new DataView(bytes.buffer);
    const text = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4));
    expect([text(0), text(8), text(12), text(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(bytes.length).toBe(52);
    // Out-of-range samples clip instead of wrapping around.
    expect([2, 3, 4, 5].map((i) => view.getInt16(44 + (i - 2) * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
});
