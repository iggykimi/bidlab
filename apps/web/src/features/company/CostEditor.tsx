// Editor de costes de tu empresa para este ámbito (UX-06).
// Sin aritmética: los importes viajan como cadenas del backend.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ApiError,
  getCompany,
  updateCompany,
  type Company,
  type CompanyEvidence,
  type CompanyUpdate,
} from "../../api/client";
import { Button, Card } from "../../components/ui";
import { errorEs } from "../../lib/errors";
import {
  EVIDENCE_FIELD_OPTIONS,
  isKnownEvidenceKey,
  keyForEvidenceSlug,
  labelForEvidenceKey,
} from "../../lib/evidenceFields";
import { formatEurosExact, parsePrecioInput, PRECIO_INPUT_MODE } from "../../lib/format";
import { rivalPriceSchema } from "../../lib/validation";
import { useWorkspaceDrafts } from "../workspace/WorkspaceDrafts";

/** Resultado de interpretar un campo de dinero del formulario. */
export type MoneyField = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Vacío significa desconocido (null); un cero explícito viaja como "0.00".
 * Acepta coma española mediante parsePrecioInput y valida el protocolo.
 */
export function moneyFieldToProtocol(raw: string): MoneyField {
  if (raw.trim() === "") return { ok: true, value: null };
  const normalized = parsePrecioInput(raw);
  if (normalized === null || !rivalPriceSchema.safeParse(normalized).success) {
    return { ok: false, error: "Escribe el importe con dos decimales (como 1234,56)." };
  }
  return { ok: true, value: normalized };
}

/** Fila nueva del formulario: siempre auto-declarada y sin revisar. */
export function buildEvidenceRow(input: {
  field_key: string;
  value: string;
  unit: string;
  reference: string;
}): CompanyEvidence {
  return {
    field_key: input.field_key.trim(),
    value: input.value.trim(),
    unit: input.unit.trim(),
    period_from: null,
    period_to: null,
    source_type: "user_attestation",
    reference: input.reference.trim(),
    reviewed: false,
  };
}

/** La evidencia que no tocas se conserva tal cual al guardar. */
export function mergeEvidence(
  existing: CompanyEvidence[],
  added: CompanyEvidence[],
): CompanyEvidence[] {
  return [...existing, ...added];
}

export interface CostDraft {
  name: string;
  direct: string;
  overhead: string;
  addedEvidence: CompanyEvidence[];
}

/** Campos del borrador que ya no coinciden con la revisión actual (R02). */
export function describeCostDrift(company: Company, draft: CostDraft): string[] {
  const out: string[] = [];
  const name = draft.name.trim();
  if (name !== "" && name !== company.name) {
    out.push(`Nombre: ahora «${company.name}», tu borrador «${name}».`);
  }
  const direct = moneyFieldToProtocol(draft.direct);
  if (direct.ok && direct.value !== company.direct_cost_net) {
    out.push(
      `Costes directos: ahora ${displayMoney(company.direct_cost_net) || "vacío"}, tu borrador ${draft.direct || "vacío"}.`
    );
  }
  const overhead = moneyFieldToProtocol(draft.overhead);
  if (overhead.ok && overhead.value !== company.overhead_net) {
    out.push(
      `Costes indirectos: ahora ${displayMoney(company.overhead_net) || "vacío"}, tu borrador ${draft.overhead || "vacío"}.`
    );
  }
  return out;
}

/** Cuerpo completo del PUT desde la revisión cargada y tu borrador. */
export function buildCompanyUpdate(
  company: Company,
  draft: CostDraft,
  expectedRevision: number
): CompanyUpdate | null {
  const direct = moneyFieldToProtocol(draft.direct);
  const overhead = moneyFieldToProtocol(draft.overhead);
  const name = draft.name.trim();
  if (!direct.ok || !overhead.ok || name === "") return null;
  return {
    expected_revision: expectedRevision,
    name,
    synthetic: false,
    scope_id: company.scope_id,
    period_months: company.period_months,
    direct_cost_net: direct.value,
    overhead_net: overhead.value,
    target_margin_rate: company.target_margin_rate,
    evidence: mergeEvidence(company.evidence, draft.addedEvidence),
  };
}

interface Props {
  companyId: string;
  tenderId: string;
  scopeId: string;
  scopeLabel: string;
}

const EMPTY_ROW = { field_key: "", value: "", unit: "", reference: "" };

/** Arrival flash on #tu-coste. Kept as a source literal so Tailwind generates it. */
const FLASH_CLASSES = "ring-2 ring-primary";

const inputClass = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-base";

/** Protocol money ("80000.00") -> display ("80000,00"). Parsing back is parsePrecioInput. */
function displayMoney(value: string | null): string {
  return value === null ? "" : value.replace(".", ",");
}

/** Draft seeded from the loaded company; user edits win afterwards. */
function seedFromCompany(company: Company): CostDraft {
  return {
    name: company.name,
    direct: displayMoney(company.direct_cost_net),
    overhead: displayMoney(company.overhead_net),
    addedEvidence: [],
  };
}

export function CostEditor({ companyId, tenderId, scopeId, scopeLabel }: Props) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const companyQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: ({ signal }) => getCompany(companyId, signal),
  });
  // Cost draft lives above the tabs: switching sections never loses it,
  // like pricing and report drafts (UX-01 class).
  const { drafts, updateCompany: patchCompanyDraft } = useWorkspaceDrafts({
    tenderId,
    scopeId,
    companyId,
  });
  // RequirementsTab links here with ?campo=<slug> so the select starts on
  // the datum that leaf needs (J1 P1-2, D3). Raw keys still decode, for
  // bookmarks written before slugs existed.
  const [params] = useSearchParams();
  const requestedField = params.get("campo");
  const preselectedField =
    requestedField === null
      ? ""
      : (keyForEvidenceSlug(requestedField) ??
        (isKnownEvidenceKey(requestedField) ? requestedField : ""));
  // R06: summary first, wide editor on demand. Arrivals from Requisitos
  // (#tu-coste) mount with the editor open; no effect, no extra render.
  const [open, setOpen] = useState(() => window.location.hash === "#tu-coste");
  const [row, setRow] = useState({ ...EMPTY_ROW, field_key: preselectedField });
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const company = companyQuery.data ?? null;
  const stored = drafts.company;
  // Initialize once per context; never overwrite user edits on refetch
  // (409 keeps inputs) or on our own save (revision bump).
  useEffect(() => {
    if (company && stored.baseRevision === null) {
      patchCompanyDraft({ ...seedFromCompany(company), baseRevision: company.revision });
    }
  }, [company, stored.baseRevision, patchCompanyDraft]);
  const draft: CostDraft | null =
    company === null ? null : stored.baseRevision === null ? seedFromCompany(company) : stored;
  const setDraft = (next: CostDraft) => patchCompanyDraft({ ...next });
  // R02: a draft based on an older revision never overwrites the newer one
  // silently. Saving requires the explicit confirm button below.
  const stale =
    company !== null && draft !== null && stored.baseRevision !== null && stored.baseRevision < company.revision;
  const drift = stale && company && draft ? describeCostDrift(company, draft) : [];

  // The card renders once the company loads: retry then, not just on mount.
  useEffect(() => {
    if (location.hash !== "#tu-coste") return;
    const card = document.getElementById("tu-coste");
    if (!card) return;
    card.scrollIntoView();
    // Move focus too (not just the scroll), and flash the card so arrivals
    // from Requisitos know where to look (J1 P2-3, J3 P1-1).
    card.focus({ preventScroll: true });
    // Transient flash via the DOM node: no state, no extra render.
    card.classList.add(...FLASH_CLASSES.split(" "));
    const timer = window.setTimeout(() => card.classList.remove(...FLASH_CLASSES.split(" ")), 2500);
    return () => {
      window.clearTimeout(timer);
      card.classList.remove(...FLASH_CLASSES.split(" "));
    };
  }, [location.hash, companyQuery.data]);

  const directParsed = draft ? moneyFieldToProtocol(draft.direct) : null;
  const overheadParsed = draft ? moneyFieldToProtocol(draft.overhead) : null;
  const directError = directParsed !== null && !directParsed.ok ? directParsed.error : null;
  const overheadError = overheadParsed !== null && !overheadParsed.ok ? overheadParsed.error : null;
  const nameError = draft !== null && draft.name.trim() === "" ? "Tu empresa necesita un nombre." : null;
  const valid =
    draft !== null && directError === null && overheadError === null && nameError === null;

  function addRow() {
    if (!draft) return;
    if (row.field_key === "") {
      setRowError("Elige qué dato aportas.");
      return;
    }
    if (row.value.trim() === "") {
      setRowError("Escribe el valor del dato.");
      return;
    }
    setRowError(null);
    setDraft({ ...draft, addedEvidence: [...draft.addedEvidence, buildEvidenceRow(row)] });
    setRow({ ...EMPTY_ROW, field_key: preselectedField });
  }

  function removeAdded(index: number) {
    if (!draft) return;
    setDraft({ ...draft, addedEvidence: draft.addedEvidence.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    if (!company || !draft) return;
    // Fresh seed (no base yet) or current base: send our base. Stale draft:
    // the user pressed the explicit confirm button, so rebase onto current.
    const expected = stored.baseRevision === null || stale ? company.revision : stored.baseRevision;
    const body = buildCompanyUpdate(company, draft, expected);
    if (!body) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateCompany(companyId, body);
      setDraft({ ...draft, addedEvidence: [] });
      await queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      const fresh = await companyQuery.refetch();
      patchCompanyDraft({ baseRevision: fresh.data?.revision ?? company.revision + 1 });
      toast.success("Ya guardamos tus costes.");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.code === "stale_revision")) {
        // Race lost: keep every keystroke, show current values beside the
        // draft (banner below) and require the explicit confirm to resend.
        try {
          await companyQuery.refetch();
        } catch {
          setSaveError("No pudimos traer los valores actuales. Vuelve a intentarlo en unos segundos.");
        }
      } else {
        setSaveError(
          errorEs(err, "No pudimos guardar tus costes. Vuelve a intentarlo en unos segundos."),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="tu-coste" aria-label="Tu coste" tabIndex={-1}>
      <h2 className="text-lg font-semibold">¿Cuánto te cuesta este contrato?</h2>
      <p className="mt-1 text-sm text-muted">Este coste vale solo para este ámbito.</p>
      {companyQuery.isPending && (
        <p role="status" className="mt-2 text-sm">
          Cargando tus costes…
        </p>
      )}
      {companyQuery.isError && (
        <div className="mt-2">
          <p role="alert" className="text-sm text-error">
            No pudimos cargar tus costes. Vuelve a intentarlo.
          </p>
          <Button variant="secondary" className="mt-2" onClick={() => companyQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {company && (
        <div className="mt-2">
          <Button
            variant="secondary"
            data-testid="cost-toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Ocultar el editor" : "Editar tus costes"}
          </Button>
        </div>
      )}
      {company && !open && (
        <p data-testid="cost-summary" className="mt-2 text-sm">
          <strong>{company.name}</strong> · directos{" "}
          {company.direct_cost_net ? formatEurosExact(company.direct_cost_net) : "sin determinar"} ·
          indirectos{" "}
          {company.overhead_net ? formatEurosExact(company.overhead_net) : "sin determinar"} ·
          revisión {company.revision}.
          {stale ? " Tus datos cambiaron en otro lugar: abre el editor para verlo." : ""}
        </p>
      )}
      {company && draft && open && (
        <div className="mt-3 grid gap-3" data-testid="cost-editor">
          <label className="block text-sm">
            <span className="font-medium">Nombre de tu empresa</span>
            <input
              type="text"
              data-testid="company-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={200}
              className={inputClass}
              aria-invalid={nameError !== null}
              aria-describedby={nameError ? "cost-name-error" : undefined}
            />
          </label>
          {nameError && (
            <p role="alert" id="cost-name-error" className="text-sm text-error">
              {nameError}
            </p>
          )}
          <label className="block text-sm">
            <span className="font-medium">Costes directos netos (€)</span>
            <input
              type="text"
              data-testid="cost-direct"
              inputMode={PRECIO_INPUT_MODE}
              value={draft.direct}
              onChange={(e) => setDraft({ ...draft, direct: e.target.value })}
              placeholder="Como 80000,00"
              className={inputClass}
              aria-invalid={directError !== null}
              aria-describedby={directError ? "cost-direct-error" : undefined}
            />
          </label>
          {directError && (
            <p role="alert" id="cost-direct-error" className="text-sm text-error">
              {directError}
            </p>
          )}
          <label className="block text-sm">
            <span className="font-medium">Costes indirectos netos (€)</span>
            <input
              type="text"
              data-testid="cost-overhead"
              inputMode={PRECIO_INPUT_MODE}
              value={draft.overhead}
              onChange={(e) => setDraft({ ...draft, overhead: e.target.value })}
              placeholder="Como 10000,00"
              className={inputClass}
              aria-invalid={overheadError !== null}
              aria-describedby={overheadError ? "cost-overhead-error" : undefined}
            />
          </label>
          {overheadError && (
            <p role="alert" id="cost-overhead-error" className="text-sm text-error">
              {overheadError}
            </p>
          )}
          <p className="text-sm text-muted">
            Déjalo vacío si no lo sabes. Escribe 0 solo si el coste es cero.
          </p>
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Ámbito</dt>
              <dd className="font-medium">{scopeLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Periodo</dt>
              <dd className="tnum font-medium">
                {company.period_months} {company.period_months === 1 ? "mes" : "meses"}
              </dd>
            </div>
          </dl>
          <h3 className="font-semibold">¿Qué datos aportas?</h3>
          {company.evidence.length === 0 ? (
            <p className="text-sm text-muted">Aún no aportaste ningún dato.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {company.evidence.map((ev, i) => (
                <li key={`${ev.field_key}-${i}`} title={ev.field_key}>
                  <strong>{labelForEvidenceKey(ev.field_key)}</strong>: {ev.value} {ev.unit} ·{" "}
                  {ev.reference} · {ev.reviewed ? "revisado" : "sin revisar"}
                </li>
              ))}
            </ul>
          )}
          {draft.addedEvidence.length > 0 && (
            <ul className="space-y-1 text-sm">
              {draft.addedEvidence.map((ev, i) => (
                <li key={`nuevo-${i}`} className="flex flex-wrap items-center gap-2">
                  <span title={ev.field_key}>
                    <strong>{labelForEvidenceKey(ev.field_key)}</strong>: {ev.value} {ev.unit} ·{" "}
                    {ev.reference} · nuevo
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => removeAdded(i)}
                    aria-label={`Quitar ${labelForEvidenceKey(ev.field_key)}`}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
            <label className="block text-sm">
              <span className="font-medium">Qué dato aportas</span>
              <select
                data-testid="evidence-key"
                value={row.field_key}
                onChange={(e) => setRow({ ...row, field_key: e.target.value })}
                className={inputClass}
              >
                <option value="">Elige un dato…</option>
                {EVIDENCE_FIELD_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Valor</span>
              <input
                type="text"
                data-testid="evidence-value"
                value={row.value}
                onChange={(e) => setRow({ ...row, value: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Unidad</span>
              <input
                type="text"
                data-testid="evidence-unit"
                value={row.unit}
                onChange={(e) => setRow({ ...row, unit: e.target.value })}
                placeholder="€"
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Referencia</span>
              <input
                type="text"
                data-testid="evidence-reference"
                value={row.reference}
                onChange={(e) => setRow({ ...row, reference: e.target.value })}
                placeholder="De dónde sale este dato"
                className={inputClass}
              />
            </label>
            {rowError && (
              <p role="alert" className="text-sm text-error">
                {rowError}
              </p>
            )}
            <div>
              <Button variant="secondary" data-testid="evidence-add" onClick={addRow}>
                Añadir dato
              </Button>
            </div>
          </div>
          {company.synthetic && (
            <p className="text-sm text-muted">
              Al guardar, estos costes dejan de ser de ejemplo.
            </p>
          )}
          {stale && company && (
            <div role="alert" className="rounded-lg border border-alert bg-alert-soft p-3 text-sm">
              <p className="font-semibold">
                Tus datos cambiaron en otro lugar. Tu borrador sigue intacto.
              </p>
              {drift.length > 0 && (
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {drift.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              <p className="mt-1">
                Guarda de todas formas solo si revisaste las diferencias.
              </p>
            </div>
          )}
          {saveError && (
            <p role="alert" className="text-sm text-error">
              {saveError}
            </p>
          )}
          <div>
            <Button data-testid="save-cost" onClick={handleSave} disabled={saving || !valid}>
              {saving ? "Guardando…" : stale ? "Guardar de todas formas" : "Guardar tus costes"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
