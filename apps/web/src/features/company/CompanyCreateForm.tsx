// Create your company for an own tender (intake step 3, Revisar fallback).
// One POST /companies with your real costs (synthetic: false): no example
// data, no guessing. On success the manual session is stored, so Precio
// and Informe stop asking for the example.

import { useState } from "react";
import { createCompany, type Company } from "../../api/client";
import { Alert, Button } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import { PRECIO_INPUT_MODE } from "../../lib/format";
import { rememberOwnCompany, storeSession } from "../../lib/session";
import { moneyFieldToProtocol } from "./CostEditor";

interface Props {
  tenderId: string;
  scopeId: string;
  /** Prefill from the intake budget block; empty when unknown. */
  initialPeriodMonths: string;
  /** Compact heading when embedded in the Revisar tab. */
  heading?: string;
  onCreated: (company: Company) => void;
}

const INPUT_CLASS = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-base";

function parsePeriod(raw: string): number | null {
  const clean = raw.trim();
  if (!/^\d+$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

export function CompanyCreateForm({ tenderId, scopeId, initialPeriodMonths, heading, onCreated }: Props) {
  const [name, setName] = useState("");
  const [direct, setDirect] = useState("");
  const [overhead, setOverhead] = useState("");
  const [period, setPeriod] = useState(initialPeriodMonths);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveRaw, setSaveRaw] = useState<string | null>(null);

  const nameError = name.trim() === "" ? "Tu empresa necesita un nombre." : null;
  const directParsed = moneyFieldToProtocol(direct);
  const overheadParsed = moneyFieldToProtocol(overhead);
  const directError = directParsed.ok ? null : directParsed.error;
  const overheadError = overheadParsed.ok ? null : overheadParsed.error;
  const periodError = parsePeriod(period) === null ? "Escribe los meses como un número entero." : null;
  const valid = nameError === null && directError === null && overheadError === null && periodError === null;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid || saving) return;
    const months = parsePeriod(period);
    if (!directParsed.ok || !overheadParsed.ok || months === null) return;
    setSaving(true);
    setSaveError(null);
    setSaveRaw(null);
    try {
      const company = await createCompany({
        name: name.trim(),
        synthetic: false,
        scope_id: scopeId,
        period_months: months,
        direct_cost_net: directParsed.value,
        overhead_net: overheadParsed.value,
        target_margin_rate: null,
        evidence: [],
      });
      rememberOwnCompany(tenderId, scopeId, company.id);
      storeSession({ tender_id: tenderId, scope_id: scopeId, company_id: company.id, mode: "manual" });
      onCreated(company);
    } catch (error) {
      setSaveError(errorEs(error, "No pudimos crear tu empresa. Vuelve a intentarlo en unos segundos."));
      setSaveRaw(errorCode(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleCreate(e)} noValidate aria-label="Crear tu empresa">
      <h2>{heading ?? "¿Quién eres en esta licitación?"}</h2>
      <p className="mt-1 text-sm text-muted">Tus costes valen solo para este ámbito.</p>
      <div className="mt-4 grid gap-4">
        <div>
          <label htmlFor="company-create-name" className="block text-sm font-medium">
            Nombre de tu empresa
          </label>
          <input
            id="company-create-name"
            data-testid="company-create-name"
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={touched && nameError !== null}
            className={INPUT_CLASS}
          />
          {touched && nameError && (
            <p role="alert" className="mt-1 text-sm text-error">
              {nameError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="company-create-direct" className="block text-sm font-medium">
            Costes directos netos (€)
          </label>
          <input
            id="company-create-direct"
            data-testid="company-create-direct"
            type="text"
            autoComplete="off"
            inputMode={PRECIO_INPUT_MODE}
            placeholder="Como 80000,00"
            value={direct}
            onChange={(e) => setDirect(e.target.value)}
            aria-invalid={touched && directError !== null}
            className={INPUT_CLASS}
          />
          {touched && directError && (
            <p role="alert" className="mt-1 text-sm text-error">
              {directError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="company-create-overhead" className="block text-sm font-medium">
            Costes indirectos netos (€)
          </label>
          <input
            id="company-create-overhead"
            data-testid="company-create-overhead"
            type="text"
            autoComplete="off"
            inputMode={PRECIO_INPUT_MODE}
            placeholder="Como 10000,00"
            value={overhead}
            onChange={(e) => setOverhead(e.target.value)}
            aria-invalid={touched && overheadError !== null}
            className={INPUT_CLASS}
          />
          {touched && overheadError && (
            <p role="alert" className="mt-1 text-sm text-error">
              {overheadError}
            </p>
          )}
        </div>
        <p className="text-sm text-muted">Déjalo vacío si no lo sabes. Escribe 0 solo si es cero.</p>
        <div>
          <label htmlFor="company-create-period" className="block text-sm font-medium">
            Duración en meses
          </label>
          <input
            id="company-create-period"
            data-testid="company-create-period"
            type="text"
            autoComplete="off"
            inputMode="numeric"
            placeholder="24"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-invalid={touched && periodError !== null}
            className={INPUT_CLASS}
          />
          {touched && periodError && (
            <p role="alert" className="mt-1 text-sm text-error">
              {periodError}
            </p>
          )}
        </div>
      </div>
      {saveError && (
        <Alert className="mt-4" title={saveRaw ?? undefined}>
          {saveError}
        </Alert>
      )}
      <div className="mt-4">
        <Button data-testid="company-create-submit" type="submit" disabled={saving}>
          {saving ? "Creando…" : "Crear tu empresa"}
        </Button>
      </div>
    </form>
  );
}
