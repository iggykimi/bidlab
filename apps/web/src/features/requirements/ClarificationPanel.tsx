// «Pedir aclaración»: Muse Spark drafts the formal question a bidder sends
// to the contracting body when a requirement cannot be verified yet.
//
// Design decisions:
// - The model only writes wording. Which requirement is open, which page
//   supports it and whether the firm complies stay with the reviewed tree
//   and the Python engine; the backend binds the draft to the same page
//   and quote it was given (services/clarification.py).
// - Consent names exactly what leaves the computer (requirement text and
//   one quote), so an older user is never surprised by an upload.
// - Without a configured provider the panel says so in one sentence and
//   offers nothing to click: no simulated answer, ever.
// - The draft is plain text with a large «Copiar» button: the user pastes
//   it into the contracting portal's question form, BidLab never sends it.

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  draftClarification,
  getCapabilities,
  listClarifications,
  newIdempotencyKey,
  type Citation,
  type ClarificationDraft,
  type RequirementLeaf,
} from "../../api/client";
import { Alert, Button } from "../../components/ui";
import { TechnicalDetails, copyText } from "../../components/TechnicalDetails";
import { errorEs } from "../../lib/errors";

interface Props {
  tenderId: string;
  leaf: RequirementLeaf;
  citation: Citation;
  onClose: () => void;
}

export function ClarificationPanel({ tenderId, leaf, citation, onClose }: Props) {
  const queryClient = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // One key per user intent: a retry after a network error never pays twice.
  const keyRef = useRef(newIdempotencyKey());

  const caps = useQuery({ queryKey: ["capabilities"], queryFn: ({ signal }) => getCapabilities(signal) });
  const drafts = useQuery({
    queryKey: ["clarifications", tenderId],
    queryFn: ({ signal }) => listClarifications(tenderId, signal),
  });
  const latest: ClarificationDraft | undefined = drafts.data?.items.find(
    (d) => d.requirement_id === leaf.id && d.citation_id === citation.id
  );
  const live = caps.data?.meta_configured === true;

  async function draft() {
    setPending(true);
    setError(null);
    try {
      await draftClarification(
        tenderId,
        { requirement_id: leaf.id, citation_id: citation.id, allow_remote_processing: true },
        { idempotencyKey: keyRef.current }
      );
      keyRef.current = newIdempotencyKey();
      await queryClient.invalidateQueries({ queryKey: ["clarifications", tenderId] });
    } catch (e) {
      setError(errorEs(e, "No pudimos redactar la pregunta. Inténtalo de nuevo en unos segundos."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="aclaracion-titulo"
      className="mt-4 rounded-xl border-2 border-primary bg-white p-5"
      data-testid="clarification-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="aclaracion-titulo" tabIndex={-1} className="mb-1">
            Pedir aclaración
          </h3>
          <p className="text-sm text-muted">
            {leaf.label} · pliego, página {citation.page_number}
          </p>
        </div>
        <Button variant="subtle" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {latest ? (
        <div className="mt-4" data-testid="clarification-draft">
          <p className="text-sm font-bold">Pregunta lista para enviar al órgano de contratación:</p>
          <p className="mt-2 whitespace-pre-line rounded-lg bg-primary-soft p-4 text-base leading-relaxed">
            {latest.question}
          </p>
          <p className="mt-3 text-sm">
            <strong>Por qué importa:</strong> {latest.why_it_matters}
          </p>
          <p className="mt-2 text-sm text-muted">
            Basada en la página {latest.cited_page}: «{latest.quote_used}»
          </p>
          <div className="btn-row">
            <Button
              onClick={async () => setCopied(await copyText(latest.question))}
              aria-describedby="aclaracion-copiada"
            >
              Copiar la pregunta
            </Button>
          </div>
          <p id="aclaracion-copiada" role="status" className="mt-2 text-sm">
            {copied ? "Copiada. Pégala en el formulario de preguntas de la Plataforma de Contratación." : ""}
          </p>
          <TechnicalDetails
            className="mt-3"
            items={[
              { label: "Modelo", value: latest.model },
              { label: "Petición al proveedor", value: latest.provider_request_id ?? "sin identificador" },
              { label: "Tokens (entrada / salida / razonamiento)", value: `${latest.prompt_tokens ?? "—"} / ${latest.completion_tokens ?? "—"} / ${latest.reasoning_tokens ?? "—"}` },
              { label: "Coste estimado (USD)", value: latest.estimated_cost_usd ?? "sin dato" },
              { label: "Tiempo de respuesta", value: `${latest.latency_ms} ms` },
            ]}
          />
        </div>
      ) : caps.isPending ? (
        <p className="mt-3 text-sm" role="status">
          Comprobando si la IA de Meta está activada…
        </p>
      ) : !live ? (
        <p className="mt-3 text-sm" data-testid="clarification-unavailable">
          Esta copia no tiene activada la IA de Meta, así que no podemos redactar la pregunta.
          Puedes escribirla tú citando la página {citation.page_number}.
        </p>
      ) : (
        <div className="mt-4">
          <p className="text-sm">
            La IA de Meta (Muse Spark) redactará una pregunta formal sobre este requisito. Solo usará
            la cita de la página {citation.page_number}; no decide si cumples.
          </p>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Acepto enviar a Meta el texto de este requisito y esa cita. El PDF no sale de tu
              ordenador.
            </span>
          </label>
          <div className="btn-row">
            <Button onClick={draft} disabled={!consent || pending} data-testid="clarification-draft-run">
              {pending ? "Redactando la pregunta…" : "Redactar la pregunta"}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <Alert className="mt-3" tone="error">
          {error}
        </Alert>
      )}
    </section>
  );
}
