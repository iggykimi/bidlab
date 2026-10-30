// «Pregúntale al pliego»: pregunta por voz o por escrito. La respuesta la
// redacta Muse Spark, pero cada cifra sale de una herramienta de BidLab
// (motor de precios, requisitos revisados, citas del pliego).

import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  answerQuestion,
  getCapabilities,
  getCompany,
  isAbort,
  newIdempotencyKey,
  transcribeQuestion,
  type Workspace,
} from "../../api/client";
import { Alert, Badge, Button } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import { loadSession } from "../../lib/session";
import { buildEvaluationRequest } from "../pricing/evaluationRequest";
import { useWorkspaceDrafts } from "../workspace/WorkspaceDrafts";
import { INITIAL, NOT_HEARD, askReducer, isBusy } from "./askMachine";
import { figureSourceEs, figureValueEs } from "./figures";
import { recordingToWav } from "./wav";

const MAX_QUESTION = 300;
// The server refuses clips over 60 s; stop a little earlier to stay inside.
const MAX_RECORDING_S = 58;
const CONSENT_KEY = "bidlab.ask.consent.v1";
export const ASK_PANEL_ID = "pregunta";

const ASK_ERROR_ES: Record<string, string> = {
  provider_not_configured: "La conexión con Meta no está activada aquí. Escribe tu pregunta o mira las pestañas.",
  remote_processing_not_allowed: "Marca la casilla de permiso para enviar tu pregunta.",
  audio_too_long: "Tu mensaje dura más de un minuto. Graba una pregunta más corta.",
  upload_too_large: "Tu mensaje dura más de un minuto. Graba una pregunta más corta.",
  audio_empty: NOT_HEARD,
  unsupported_media: "No pudimos leer la grabación. Prueba otra vez o escribe tu pregunta.",
  invalid_model_output:
    "La respuesta no pasó nuestras comprobaciones y no te la enseñamos. Prueba a preguntar de otra forma.",
  provider_failure: "Meta no respondió. Espera un momento y vuelve a preguntar.",
  rate_limited: "Meta está ocupado. Espera un momento y vuelve a preguntar.",
  provider_refusal: "Meta no quiso responder a esa pregunta. Prueba a preguntarla de otra forma.",
  budget_exhausted: "Se agotó el presupuesto para preguntas. No hemos enviado nada.",
};

const MIC_DENIED = "No tengo permiso para usar el micrófono. Escribe tu pregunta en el cuadro de texto.";
const NO_MIC = "Este navegador no puede grabar tu voz. Escribe tu pregunta en el cuadro de texto.";
const NEED_CONSENT = "Antes de preguntar, marca la casilla de permiso.";

function askErrorEs(error: unknown, fallback: string): string {
  if (error instanceof ApiError && ASK_ERROR_ES[error.code]) return ASK_ERROR_ES[error.code] ?? fallback;
  return errorEs(error, fallback);
}

function readConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

function writeConsent(value: boolean) {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, "yes");
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Consent then lasts for this visit only.
  }
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MicIcon({ size = 32 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function AskPanel({ workspace }: { workspace: Workspace }) {
  const tenderId = workspace.tender.id;
  const [state, dispatch] = useReducer(askReducer, INITIAL);
  const [consent, setConsent] = useState(readConsent);
  const [elapsed, setElapsed] = useState(0);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLHeadingElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // A recording stopped by leaving the page must never be sent (and paid for).
  const aliveRef = useRef(true);

  const queryClient = useQueryClient();
  const capsQuery = useQuery({ queryKey: ["capabilities"], queryFn: ({ signal }) => getCapabilities(signal) });
  const available = capsQuery.data?.meta_configured === true;

  // Same context as the Precio step: the engine answers in the user's current draft.
  const session = loadSession();
  const scope = workspace.tender.scopes[0] ?? null;
  const rule = workspace.pricing_rules[0] ?? null;
  const companyId = session?.company_id ?? null;
  const { drafts } = useWorkspaceDrafts({
    tenderId,
    scopeId: scope?.id ?? "none",
    companyId: companyId ?? "none",
  });
  // The company revision is read when the user asks, never observed: a live
  // observer here (mounted on every step) would keep a cached revision that
  // the cost editor then sends back, turning a fresh save into a 409.
  const canPrice = scope !== null && rule !== null && companyId !== null;
  async function currentPricingContext() {
    if (!canPrice) return null;
    const company = await queryClient.fetchQuery({
      queryKey: ["company", companyId],
      queryFn: ({ signal }) => getCompany(companyId ?? "", signal),
      staleTime: 0,
    });
    return buildEvaluationRequest({ scope, rule, companyId, companyRevision: company.revision, h: drafts.pricing.h });
  }

  function stopTracks() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    // Set on mount too: StrictMode runs this cleanup once before the real mount.
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopTracks();
    };
  }, []);

  useEffect(() => {
    if (state.kind === "review") textRef.current?.focus();
    if (state.kind === "answered") answerRef.current?.focus();
  }, [state.kind]);

  function freshSignal(): AbortSignal {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }

  function needConsent(): boolean {
    if (consent) return false;
    dispatch({ type: "notice", message: NEED_CONSENT });
    consentRef.current?.focus();
    return true;
  }

  async function transcribe(recording: Blob) {
    try {
      const wav = await recordingToWav(recording);
      const result = await transcribeQuestion(tenderId, wav, {
        allowRemoteProcessing: true,
        idempotencyKey: newIdempotencyKey(),
        signal: freshSignal(),
      });
      dispatch({ type: "transcribed", text: result.text });
    } catch (err) {
      if (isAbort(err)) return;
      dispatch({
        type: "fail",
        message: askErrorEs(err, "No pudimos pasar tu voz a texto. Prueba otra vez o escribe tu pregunta."),
        code: errorCode(err),
      });
    }
  }

  async function startRecording() {
    if (startingRef.current || needConsent()) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      dispatch({ type: "notice", message: NO_MIC });
      textRef.current?.focus();
      return;
    }
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stopTracks();
        if (aliveRef.current) void transcribe(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorderRef.current = recorder;
      recorder.start();
      dispatch({ type: "record" });
      const started = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - started) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_RECORDING_S) stopRecording();
      }, 250);
    } catch (err) {
      stopTracks();
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      dispatch({ type: "notice", message: denied ? MIC_DENIED : NO_MIC });
      textRef.current?.focus();
    } finally {
      startingRef.current = false;
    }
  }

  function stopRecording() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    dispatch({ type: "stop" });
  }

  async function ask() {
    if (needConsent()) return;
    const question = state.draft.trim();
    if (!question) {
      textRef.current?.focus();
      return;
    }
    dispatch({ type: "ask", question });
    try {
      const pricingContext = await currentPricingContext();
      const answer = await answerQuestion(
        tenderId,
        {
          question,
          scope_id: scope?.id ?? "",
          pricing_context: pricingContext,
          allow_remote_processing: true,
        },
        { idempotencyKey: newIdempotencyKey(), signal: freshSignal() }
      );
      dispatch({ type: "answered", answer });
    } catch (err) {
      if (isAbort(err)) return;
      dispatch({
        type: "fail",
        message: askErrorEs(err, "No pudimos responder. Vuelve a preguntar en unos segundos."),
        code: errorCode(err),
      });
    }
  }

  const recording = state.kind === "recording";
  const busy = isBusy(state);
  const disabled = !available || !scope;
  const reviewing = state.kind === "review";

  return (
    <section
      id={ASK_PANEL_ID}
      aria-labelledby="ask-title"
      data-testid="ask-panel"
      className="mt-8 scroll-mt-4 rounded-xl border-2 border-primary bg-white p-4 sm:p-6">
      <h2 id="ask-title" className="mt-0" tabIndex={-1}>
        Pregúntale al pliego
      </h2>
      {capsQuery.isSuccess && !available ? (
        <p className="text-base" data-testid="ask-unavailable">
          Esta función necesita la conexión con Meta, y no está activada aquí. Mira los requisitos y los precios en sus pestañas.
        </p>
      ) : (
        <p className="text-base text-muted">
          Pregunta con tu voz o por escrito. BidLab responde con sus propios cálculos y con citas del pliego.
        </p>
      )}

      {available && (
        <label className="mt-3 flex items-start gap-3 text-base">
          <input
            ref={consentRef}
            type="checkbox"
            data-testid="ask-consent"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              writeConsent(e.target.checked);
            }}
            className="mt-1 h-6 w-6 shrink-0"
          />
          <span>
            Acepto que BidLab envíe a Meta mi voz o mi pregunta escrita, y los textos de los requisitos que hagan falta. El PDF no sale de tu equipo.
          </span>
        </label>
      )}

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4 sm:w-56 sm:shrink-0">
          <button
            type="button"
            data-testid="ask-mic"
            data-recording={recording ? "true" : undefined}
            onClick={() => (recording ? stopRecording() : void startRecording())}
            disabled={disabled || busy}
            aria-label={recording ? "Parar la grabación" : "Hablar: pulsa para grabar tu pregunta"}
            className={`ask-mic pressable relative inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60 ${
              recording ? "bg-error" : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>
          <div className="text-base">
            {recording ? (
              <>
                <p className="m-0 text-lg font-bold">Parar</p>
                <p className="m-0 tnum" aria-hidden="true">
                  {clock(elapsed)} de 1:00
                </p>
                <p className="m-0 text-muted">Te escucho. Pulsa para parar.</p>
              </>
            ) : (
              <>
                <p className="m-0 text-lg font-bold">Hablar</p>
                <p className="m-0 text-muted">Pulsa, habla y vuelve a pulsar.</p>
              </>
            )}
          </div>
        </div>

        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label htmlFor="ask-question" className="block text-base font-bold">
            {reviewing ? "¿Es esto lo que has dicho? Corrígelo si hace falta." : "O escribe tu pregunta"}
          </label>
          <textarea
            id="ask-question"
            ref={textRef}
            data-testid="ask-question"
            rows={2}
            maxLength={MAX_QUESTION}
            value={state.kind === "answering" ? state.question : state.draft}
            onChange={(e) => dispatch({ type: "edit", draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
            readOnly={busy || recording}
            disabled={disabled}
            placeholder="Por ejemplo: ¿Y si bajo un 12 %?"
            aria-describedby="ask-question-help"
            className="mt-2 block min-h-[56px] w-full rounded-lg border-2 border-control bg-white px-3 py-2 text-base"
          />
          <p id="ask-question-help" className="m-0 mt-1 text-sm text-muted">
            {state.kind === "answering" ? state.question.length : state.draft.length} de {MAX_QUESTION} caracteres. Pulsa Intro para preguntar.
          </p>
          <Button type="submit" className="mt-3" disabled={disabled || busy || recording} data-testid="ask-submit">
            Preguntar
          </Button>
        </form>
      </div>

      {available && !canPrice && (
        <p className="mt-3 text-base text-muted">
          Para preguntar por precios, BidLab necesita tu empresa y la fórmula de puntos en la pestaña Precio.
        </p>
      )}

      <p aria-live="polite" className="m-0 mt-3 text-base font-bold empty:hidden" data-testid="ask-status">
        {state.kind === "recording" ? "Grabando…" : ""}
        {state.kind === "transcribing" ? "Pasando tu voz a texto…" : ""}
        {state.kind === "answering" ? "Buscando la respuesta en tus datos…" : ""}
      </p>

      {state.kind === "idle" && state.notice && (
        <Alert tone="warn" className="mt-3" role="status">
          {state.notice}
        </Alert>
      )}
      {state.kind === "failed" && (
        <Alert className="mt-3" title={state.code ?? undefined}>
          {state.message}
        </Alert>
      )}

      {state.kind === "answered" && (
        <div className="mt-4 border-t border-border pt-4" data-testid="ask-answer">
          <h3 ref={answerRef} tabIndex={-1} className="mt-0">
            Respuesta
          </h3>
          <p className="m-0 text-sm text-muted">Tu pregunta: «{state.question}»</p>
          <p className="mt-2 text-lg">{state.answer.answer}</p>
          {state.answer.figures.length > 0 && (
            <ul className="m-0 mt-3 list-none p-0">
              {state.answer.figures.map((figure, index) => (
                <li
                  key={`${figure.label}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border py-3 text-base"
                >
                  <span>{figure.label}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <strong className="tnum">{figureValueEs(figure)}</strong>
                    <Badge tone={figure.source === "engine" ? "neutral" : "live"}>{figureSourceEs(figure)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted">
            Texto redactado por Muse Spark, de Meta. Las cifras las calcula BidLab o salen del pliego.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: "reset" });
              textRef.current?.focus();
            }}
          >
            Hacer otra pregunta
          </Button>
        </div>
      )}
    </section>
  );
}
