// Estados de «Pregúntale al pliego». Un reductor puro: cada evento solo vale
// en su estado, así una respuesta tardía nunca pisa lo que la persona hace ahora.

import type { AssistantAnswer } from "../../api/client";

export type AskState =
  | { kind: "idle"; draft: string; notice: string | null }
  | { kind: "recording"; draft: string }
  | { kind: "transcribing"; draft: string }
  | { kind: "review"; draft: string }
  | { kind: "answering"; question: string; draft: string }
  | { kind: "answered"; question: string; answer: AssistantAnswer; draft: string }
  | { kind: "failed"; draft: string; message: string; code: string | null };

export type AskEvent =
  | { type: "edit"; draft: string }
  | { type: "record" }
  | { type: "stop" }
  | { type: "transcribed"; text: string }
  | { type: "ask"; question: string }
  | { type: "answered"; answer: AssistantAnswer }
  | { type: "fail"; message: string; code: string | null }
  | { type: "notice"; message: string }
  | { type: "reset" };

export const INITIAL: AskState = { kind: "idle", draft: "", notice: null };

export const NOT_HEARD = "No te he oído bien. Prueba otra vez o escribe tu pregunta.";

function draftOf(state: AskState): string {
  return state.kind === "answering" ? state.question : state.draft;
}

export function askReducer(state: AskState, event: AskEvent): AskState {
  switch (event.type) {
    case "edit":
      if (state.kind === "idle" || state.kind === "review" || state.kind === "failed" || state.kind === "answered") {
        return { ...state, draft: event.draft };
      }
      return state;
    case "record":
      if (state.kind === "recording" || state.kind === "transcribing" || state.kind === "answering") {
        return state;
      }
      return { kind: "recording", draft: draftOf(state) };
    case "stop":
      return state.kind === "recording" ? { kind: "transcribing", draft: state.draft } : state;
    case "transcribed": {
      if (state.kind !== "transcribing") return state;
      const text = event.text.trim();
      return text ? { kind: "review", draft: text } : { kind: "idle", draft: state.draft, notice: NOT_HEARD };
    }
    case "ask": {
      const question = event.question.trim();
      if (!question || state.kind === "recording" || state.kind === "transcribing" || state.kind === "answering") {
        return state;
      }
      return { kind: "answering", question, draft: question };
    }
    case "answered":
      return state.kind === "answering"
        ? { kind: "answered", question: state.question, answer: event.answer, draft: "" }
        : state;
    case "fail":
      if (state.kind !== "recording" && state.kind !== "transcribing" && state.kind !== "answering") {
        return state;
      }
      return { kind: "failed", draft: draftOf(state), message: event.message, code: event.code };
    case "notice":
      return { kind: "idle", draft: draftOf(state), notice: event.message };
    case "reset":
      return INITIAL;
  }
}

/** True while a remote call or the microphone is busy: inputs stay read-only. */
export function isBusy(state: AskState): boolean {
  return state.kind === "transcribing" || state.kind === "answering";
}
