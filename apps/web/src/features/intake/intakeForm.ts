// Intake step 1: form state, entry-level validation and TenderCreate mapping.
// Money goes through parsePrecioInput; tax is passed through verbatim and
// never inferred from a single amount.

import type { TenderBasisInput, TenderCreate } from "../../api/client";
import { parsePrecioInput } from "../../lib/format";

/** Tax choice shown as IVA / IGIC / Sin determinar in the form. */
export type TaxChoice = "VAT" | "IGIC" | "unknown";

export interface IntakeForm {
  title: string;
  externalId: string;
  contractingBody: string;
  sourceUrl: string;
  scopeLabel: string;
  pblNet: string;
  pblGross: string;
  taxKind: TaxChoice;
  periodMonths: string;
}

export const EMPTY_INTAKE_FORM: IntakeForm = {
  title: "",
  externalId: "",
  contractingBody: "",
  sourceUrl: "",
  scopeLabel: "",
  pblNet: "",
  pblGross: "",
  taxKind: "unknown",
  periodMonths: "",
};

export type IntakeErrors = Partial<Record<keyof IntakeForm, string>>;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parsePeriodMonths(raw: string): number | null {
  const clean = raw.trim();
  if (!/^\d+$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** Plain-Spanish, per-field errors. Empty object means the form is valid. */
export function validateIntake(form: IntakeForm): IntakeErrors {
  const errors: IntakeErrors = {};
  if (form.title.trim() === "") {
    errors.title = "Escribe el título de la licitación.";
  } else if (form.title.trim().length > 2000) {
    errors.title = "El título es demasiado largo.";
  }
  if (form.externalId.trim() === "") {
    errors.externalId = "Escribe la referencia o expediente.";
  } else if (form.externalId.trim().length > 200) {
    errors.externalId = "La referencia es demasiado larga.";
  }
  if (form.contractingBody.trim() === "") {
    errors.contractingBody = "Escribe el organismo que convoca.";
  } else if (form.contractingBody.trim().length > 1000) {
    errors.contractingBody = "El nombre del organismo es demasiado largo.";
  }
  if (form.sourceUrl.trim() !== "") {
    if (form.sourceUrl.trim().length > 3000 || !isHttpUrl(form.sourceUrl.trim())) {
      errors.sourceUrl = "Pega una dirección válida que empiece por https://.";
    }
  }
  if (form.scopeLabel.trim().length > 80) {
    errors.scopeLabel = "El ámbito admite 80 caracteres como máximo.";
  }
  if (form.pblNet.trim() !== "" && parsePrecioInput(form.pblNet.trim()) === null) {
    errors.pblNet = "Escribe un importe válido, como 1234,56.";
  }
  if (form.pblGross.trim() !== "" && parsePrecioInput(form.pblGross.trim()) === null) {
    errors.pblGross = "Escribe un importe válido, como 1234,56.";
  }
  if (form.periodMonths.trim() !== "" && parsePeriodMonths(form.periodMonths) === null) {
    errors.periodMonths = "Escribe los meses como un número entero.";
  }
  return errors;
}

function nullIfBlank(value: string): string | null {
  const clean = value.trim();
  return clean === "" ? null : clean;
}

/**
 * Form state -> TenderCreate payload. Callers validate first; an
 * unparseable optional amount maps to null rather than blocking.
 * Tax is never inferred: the selected value passes through as is.
 */
export function buildTenderCreate(form: IntakeForm): TenderCreate {
  const pblNet = form.pblNet.trim() === "" ? null : parsePrecioInput(form.pblNet.trim());
  const pblGross = form.pblGross.trim() === "" ? null : parsePrecioInput(form.pblGross.trim());
  const periodMonths = form.periodMonths.trim() === "" ? null : parsePeriodMonths(form.periodMonths);
  const basisTouched =
    pblNet !== null || pblGross !== null || periodMonths !== null || form.taxKind !== "unknown";
  const basis: TenderBasisInput | null = basisTouched
    ? {
        pbl_net: pblNet,
        pbl_gross: pblGross,
        tax_kind: form.taxKind,
        period_months: periodMonths,
        currency: "EUR",
      }
    : null;
  return {
    title: form.title.trim(),
    external_id: form.externalId.trim(),
    contracting_body: form.contractingBody.trim(),
    source_url: nullIfBlank(form.sourceUrl),
    scope_label: nullIfBlank(form.scopeLabel),
    basis,
  };
}
