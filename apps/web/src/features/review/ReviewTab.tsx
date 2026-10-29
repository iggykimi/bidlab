// Revisar tab (own tenders only): your company fallback, automatic
// analysis tracker, manual review form and your local review history.
// The form draft lives above the tabs (UX-01 class): switching sections
// never loses it, and a 409 re-reads the revision keeping every word.

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  submitReview,
  type PriceBasis,
  type Workspace,
} from "../../api/client";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import { Alert, Button, Card } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import { TEMPLATE_COPY, TEMPLATE_IDS, type TemplateId } from "../../lib/expressionTemplates";
import { formatFechaNormal, parsePrecioInput, PRECIO_INPUT_MODE } from "../../lib/format";
import { hasOwnCompany, nextRuleRevision, ruleIdFor } from "./ownTender";
import { loadSession } from "../../lib/session";
import { CompanyCreateForm } from "../company/CompanyCreateForm";
import { useWorkspaceDrafts } from "../workspace/WorkspaceDrafts";
import { AnalysisTracker } from "./AnalysisTracker";
import { ProposalClaims } from "./ProposalClaims";
import { RadarSection } from "./RadarSection";
import { appendReviewHistory, loadReviewHistory } from "./reviewHistory";
import {
  ANOMALY_COPY,
  ANOMALY_VARIANTS,
  buildReviewRequest,
  defaultThreeBidderFlag,
  parseDecimalInput,
  parsePeriodInput,
  type AnomalyVariant,
} from "./reviewRequest";

interface Props {
  workspace: Workspace;
}

const INPUT_CLASS = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-base";

/** Protocol money ("80000.00") -> display ("80000,00"). */
function displayMoney(value: string | null): string {
  return value === null ? "" : value.replace(".", ",");
}

function basisOf(workspace: Workspace): PriceBasis | null {
  return workspace.tender.scopes[0]?.basis ?? null;
}

export function ReviewTab({ workspace }: Props) {
  const tender = workspace.tender;
  const scope = tender.scopes[0] ?? null;
  const basis = basisOf(workspace);
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const session = loadSession();
  const companyReady = hasOwnCompany(session, tender.id);
  // Review drafts are company-independent: one per tender+scope, so
  // creating the company never wipes what you already wrote.
  const { drafts, updateReview } = useWorkspaceDrafts({
    tenderId: tender.id,
    scopeId: scope?.id ?? "none",
    companyId: "review",
  });
  const draft = drafts.review;
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitRaw, setSubmitRaw] = useState<string | null>(null);
  const [approvedRevision, setApprovedRevision] = useState<number | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [, setCompanyTick] = useState(0);

  // Seed once from the workspace; edits and 409 refetches never reseed.
  // Drafts from before baseRevision adopt the current revision silently.
  useEffect(() => {
    if (basis === null) return;
    if (draft.baseKey === null) {
      const sameReference =
        basis.scoring_reference_net === null || basis.scoring_reference_net === basis.budget_net;
      updateReview({
        baseKey: tender.id,
        baseRevision: workspace.interpretation_revision,
        budgetNet: displayMoney(basis.budget_net),
        periodMonths: basis.period_months === null ? "" : String(basis.period_months),
        referenceSame: sameReference,
        referenceNet: sameReference ? "" : displayMoney(basis.scoring_reference_net),
      });
    } else if (draft.baseRevision === null) {
      updateReview({ baseRevision: workspace.interpretation_revision });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed-once guard via baseKey.
  }, [draft.baseKey, draft.baseRevision, tender.id]);
  const baseStale =
    draft.baseKey !== null &&
    draft.baseRevision !== null &&
    draft.baseRevision !== workspace.interpretation_revision;

  if (!scope || !basis) {
    return (
      <p role="alert" className="surface">
        Esta licitación no tiene ámbito. No puedes revisarla.
      </p>
    );
  }
  // Non-null aliases: narrowing does not cross into the submit closure.
  const activeScope = scope;
  const activeBasis = basis;

  const templateId = draft.templateId as TemplateId;
  const anomalyVariant = draft.anomalyVariant as AnomalyVariant;

  const budgetProtocol = draft.budgetNet.trim() === "" ? null : parsePrecioInput(draft.budgetNet.trim());
  const budgetError =
    budgetProtocol === null
      ? "Escribe el presupuesto sin impuestos."
      : Number(budgetProtocol) <= 0
        ? "El presupuesto debe ser mayor que cero."
        : null;
  const periodProtocol = draft.periodMonths.trim() === "" ? null : parsePeriodInput(draft.periodMonths);
  const periodError =
    draft.periodMonths.trim() !== "" && periodProtocol === null
      ? "Escribe los meses como un número entero."
      : null;
  const pointsProtocol = parseDecimalInput(draft.maxPoints);
  const pointsError =
    pointsProtocol === null || Number(pointsProtocol) <= 0
      ? "Escribe los puntos máximos, como 49."
      : null;
  // P0-3: the scoring reference is confirmed on screen, never defaulted.
  const referenceProtocol = draft.referenceSame
    ? budgetProtocol
    : draft.referenceNet.trim() === ""
      ? null
      : parsePrecioInput(draft.referenceNet.trim());
  const referenceError =
    !draft.referenceSame && (referenceProtocol === null || Number(referenceProtocol) <= 0)
      ? "Escribe el importe de referencia."
      : null;
  const reasonError = draft.reason.trim() === "" ? "Cuéntanos qué revisaste." : null;
  const valid =
    budgetError === null &&
    periodError === null &&
    referenceError === null &&
    pointsError === null &&
    reasonError === null;

  function goTab(tab: string) {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    setParams(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setConflict(false);
    if (!valid || sending) return;
    if (budgetProtocol === null || pointsProtocol === null) return;
    setSending(true);
    setSubmitError(null);
    setSubmitRaw(null);
    try {
      // Rule id is stable; the revision bumps from the workspace so a
      // second review never resends an existing (rule_id, revision).
      const ruleId = ruleIdFor(tender.id);
      const reviewed = await submitReview(
        tender.id,
        buildReviewRequest({
          tenderId: tender.id,
          scopeId: activeScope.id,
          budgetNet: budgetProtocol,
          periodMonths: periodProtocol,
          referenceSame: draft.referenceSame,
          referenceNet: draft.referenceSame ? null : referenceProtocol,
          existingBasis: activeBasis,
          templateId,
          maxPoints: pointsProtocol,
          anomalyVariant,
          threeBidderAbsolute25: draft.threeBidder,
          percentageReductionOneThird: draft.oneThird,
          expectedRevision: draft.baseRevision ?? workspace.interpretation_revision,
          ruleRevision: nextRuleRevision(workspace.pricing_rules, ruleId),
          approvedClaimKeys: draft.approvedClaims,
          reason: draft.reason,
        })
      );
      updateReview({ baseRevision: reviewed.interpretation_revision });
      await queryClient.invalidateQueries({ queryKey: ["workspace", tender.id] });
      appendReviewHistory({
        tenderId: tender.id,
        revision: reviewed.interpretation_revision,
        actor: "usuario",
        reason: draft.reason.trim(),
      });
      setHistoryTick((t) => t + 1);
      setApprovedRevision(reviewed.interpretation_revision);
      setTouched(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.code === "revision_conflict")) {
        // Someone (or your own analysis) moved the revision, or won the
        // rule race: re-read, keep every word, and resend with fresh
        // numbers (the rule revision recomputes from the workspace).
        setConflict(true);
        await queryClient.invalidateQueries({ queryKey: ["workspace", tender.id] });
      } else {
        setSubmitError(errorEs(err, "No pudimos guardar tu revisión. Vuelve a intentarlo en unos segundos."));
        setSubmitRaw(errorCode(err));
      }
    } finally {
      setSending(false);
    }
  }

  void historyTick; // re-read after each approval
  const history = loadReviewHistory(tender.id);

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      {!companyReady && (
        <Card id="tu-empresa" aria-label="Tu empresa" tabIndex={-1}>
          <CompanyCreateForm
            tenderId={tender.id}
            scopeId={scope.id}
            initialPeriodMonths={basis.period_months === null ? "" : String(basis.period_months)}
            heading="¿Quién eres en esta licitación?"
            onCreated={() => {
              setCompanyTick((t) => t + 1);
              toast.success("Ya creamos tu empresa.");
            }}
          />
        </Card>
      )}

      <AnalysisTracker key={tender.id} workspace={workspace} />

      <ProposalClaims
        workspace={workspace}
        approved={draft.approvedClaims}
        onToggle={(key, checked) =>
          updateReview({
            approvedClaims: checked
              ? [...draft.approvedClaims, key]
              : draft.approvedClaims.filter((k) => k !== key),
          })
        }
      />

      <RadarSection report={workspace.consistency} />

      <Card aria-label="Revisión manual">
        <h2>¿Qué fórmula apruebas?</h2>
        <p className="mt-1 text-sm text-muted">
          Revisión {workspace.interpretation_revision}. Tú decides cada dato.
        </p>
        {approvedRevision !== null && (
          <div role="status" data-testid="review-success" className="mt-3 rounded-lg border border-primary bg-primary-soft p-3 text-sm">
            <p className="font-semibold">Ya guardamos tu revisión {approvedRevision}.</p>
            <p className="mt-1">
              <Button data-testid="review-go-pricing" onClick={() => goTab("precio")} className="mt-2">
                Ir a Precio
              </Button>
            </p>
          </div>
        )}
        {conflict && (
          <Alert tone="warn" className="mt-3" data-testid="review-conflict">
            La revisión avanzó mientras escribías. Tus datos siguen aquí: envía de nuevo.
          </Alert>
        )}
        {baseStale && (
          <Alert tone="warn" className="mt-3" data-testid="review-stale-base">
            <p>La revisión avanzó desde que empezaste (base {draft.baseRevision}).</p>
            <p className="mt-2">
              <Button
                variant="secondary"
                data-testid="review-rebase"
                onClick={() =>
                  updateReview({ baseRevision: workspace.interpretation_revision })
                }
              >
                Usar la revisión actual como base
              </Button>
            </p>
          </Alert>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate aria-label="Formulario de revisión" className="mt-4 grid gap-4">
          <div>
            <label htmlFor="review-budget" className="block text-sm font-medium">
              Presupuesto sin impuestos (€)
            </label>
            <input
              id="review-budget"
              data-testid="review-budget"
              type="text"
              autoComplete="off"
              inputMode={PRECIO_INPUT_MODE}
              value={draft.budgetNet}
              onChange={(e) => updateReview({ budgetNet: e.target.value })}
              aria-invalid={touched && budgetError !== null}
              aria-describedby={touched && budgetError ? "review-budget-error" : undefined}
              className={INPUT_CLASS}
            />
            {touched && budgetError && (
              <p id="review-budget-error" role="alert" className="mt-1 text-sm text-error">
                <span aria-hidden="true">⚠︎ </span>
                {budgetError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="review-period" className="block text-sm font-medium">
              Duración en meses (opcional)
            </label>
            <input
              id="review-period"
              data-testid="review-period"
              type="text"
              autoComplete="off"
              inputMode="numeric"
              value={draft.periodMonths}
              onChange={(e) => updateReview({ periodMonths: e.target.value })}
              aria-invalid={touched && periodError !== null}
              aria-describedby={touched && periodError ? "review-period-error" : undefined}
              className={INPUT_CLASS}
            />
            {touched && periodError && (
              <p id="review-period-error" role="alert" className="mt-1 text-sm text-error">
                <span aria-hidden="true">⚠︎ </span>
                {periodError}
              </p>
            )}
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">
              ¿Sobre qué importe reparte puntos tu pliego?
            </legend>
            <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm">
              <input
                type="radio"
                name="review-reference"
                data-testid="review-reference-same"
                checked={draft.referenceSame}
                onChange={() => updateReview({ referenceSame: true })}
                className="mt-1"
              />
              <span>
                <strong>Sobre el presupuesto.</strong> La fórmula usa tu presupuesto de arriba.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm">
              <input
                type="radio"
                name="review-reference"
                data-testid="review-reference-custom"
                checked={!draft.referenceSame}
                onChange={() => updateReview({ referenceSame: false })}
                className="mt-1"
              />
              <span>
                <strong>Sobre otro importe.</strong> Tu pliego nombra otra cifra.
              </span>
            </label>
            {!draft.referenceSame && (
              <div>
                <label htmlFor="review-reference-net" className="block text-sm font-medium">
                  Importe de referencia (€)
                </label>
                <input
                  id="review-reference-net"
                  data-testid="review-reference-net"
                  type="text"
                  autoComplete="off"
                  inputMode={PRECIO_INPUT_MODE}
                  value={draft.referenceNet}
                  onChange={(e) => updateReview({ referenceNet: e.target.value })}
                  aria-invalid={touched && referenceError !== null}
                  aria-describedby={touched && referenceError ? "review-reference-net-error" : undefined}
                  className={INPUT_CLASS}
                />
                {touched && referenceError && (
                  <p id="review-reference-net-error" role="alert" className="mt-1 text-sm text-error">
                    <span aria-hidden="true">⚠︎ </span>
                    {referenceError}
                  </p>
                )}
              </div>
            )}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">¿Cómo reparte puntos tu pliego?</legend>
            {TEMPLATE_IDS.map((id) => (
              <label key={id} className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm">
                <input
                  type="radio"
                  name="review-template"
                  data-testid={`review-template-${id}`}
                  checked={templateId === id}
                  onChange={() => updateReview({ templateId: id })}
                  className="mt-1 h-5 w-5"
                />
                <span>
                  <strong>{TEMPLATE_COPY[id].question}</strong>
                  <span className="block text-muted">{TEMPLATE_COPY[id].plain}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="review-maxpoints" className="block text-sm font-medium">
              Puntos máximos del precio
            </label>
            <input
              id="review-maxpoints"
              data-testid="review-maxpoints"
              type="text"
              autoComplete="off"
              inputMode={PRECIO_INPUT_MODE}
              placeholder="49"
              value={draft.maxPoints}
              onChange={(e) => updateReview({ maxPoints: e.target.value })}
              aria-invalid={touched && pointsError !== null}
              aria-describedby={touched && pointsError ? "review-maxpoints-error" : undefined}
              className={INPUT_CLASS}
            />
            {touched && pointsError && (
              <p id="review-maxpoints-error" role="alert" className="mt-1 text-sm text-error">
                <span aria-hidden="true">⚠︎ </span>
                {pointsError}
              </p>
            )}
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">¿Cómo detecta tu pliego las ofertas sospechosas?</legend>
            <p className="text-xs text-muted">
              La ley la llama presunción de anormalidad (art. 149 LCSP).
            </p>
            {ANOMALY_VARIANTS.map((variant) => (
              <label key={variant} className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm">
                <input
                  type="radio"
                  name="review-anomaly"
                  data-testid={`review-anomaly-${variant}`}
                  checked={anomalyVariant === variant}
                  onChange={() =>
                    updateReview({ anomalyVariant: variant, threeBidder: defaultThreeBidderFlag(variant) })
                  }
                  className="mt-1 h-5 w-5"
                />
                <span>
                  <strong>{ANOMALY_COPY[variant].question}</strong>
                  <span className="block text-muted">{ANOMALY_COPY[variant].plain}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-2 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                data-testid="review-flag-three"
                checked={draft.threeBidder}
                onChange={(e) => updateReview({ threeBidder: e.target.checked })}
                className="mt-1 h-5 w-5"
              />
              <span>Con tres ofertas, aplica el tope del 25 %.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                data-testid="review-flag-third"
                checked={draft.oneThird}
                onChange={(e) => updateReview({ oneThird: e.target.checked })}
                className="mt-1 h-5 w-5"
              />
              <span>Mi pliego pide la rebaja de un tercio en porcentaje.</span>
            </label>
            {draft.oneThird && (
              <p className="rounded-lg bg-surface p-3">
                Este caso aún no se calcula: tus puntos saldrán sin determinar.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="review-reason" className="block text-sm font-medium">
              ¿Qué revisaste? (motivo)
            </label>
            <textarea
              id="review-reason"
              data-testid="review-reason"
              value={draft.reason}
              onChange={(e) => updateReview({ reason: e.target.value })}
              rows={3}
              maxLength={2000}
              placeholder="Leí la cláusula de puntos del pliego y…"
              aria-invalid={touched && reasonError !== null}
              aria-describedby={touched && reasonError ? "review-reason-error" : undefined}
              className={INPUT_CLASS}
            />
            {touched && reasonError && (
              <p id="review-reason-error" role="alert" className="mt-1 text-sm text-error">
                <span aria-hidden="true">⚠︎ </span>
                {reasonError}
              </p>
            )}
          </div>
          {submitError && (
            <Alert title={submitRaw ?? undefined}>{submitError}</Alert>
          )}
          <div>
            <Button data-testid="review-submit" type="submit" disabled={sending}>
              {sending ? "Guardando…" : "Aprobar tu revisión"}
            </Button>
          </div>
        </form>
      </Card>

      <Card aria-label="Historial de revisiones">
        <h2>¿Qué aprobaste hasta ahora?</h2>
        <p className="mt-1 text-sm text-muted">
          Revisión actual: {workspace.interpretation_revision}. Solo ves lo que apruebas en este navegador.
        </p>
        {history.length === 0 ? (
          <p className="mt-2 text-sm">Aún no apruebas ninguna revisión aquí.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {[...history].reverse().map((entry, i) => (
              <li key={`${entry.revision}-${i}`} className="rounded-lg border border-line p-3">
                <p>
                  <strong>Revisión {entry.revision}</strong> · {formatFechaNormal(entry.createdAt)}
                </p>
                <p className="mt-1">Motivo: {entry.reason}</p>
              </li>
            ))}
          </ul>
        )}
        <TechnicalDetails
          className="mt-3"
          items={[{ label: "Actor de tus aprobaciones", value: "usuario" }]}
        />
      </Card>

      <p className="text-sm">
        <Link to="?tab=precio" className="font-semibold text-primary underline hover:text-primary-ink">
          Ir a Precio
        </Link>
      </p>
    </div>
  );
}
