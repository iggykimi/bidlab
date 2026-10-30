// Intake flow: three short steps, "Identificar", "Añadir documento", "Tu empresa".
// Step 1 first offers the import from the Plataforma de Contratación (link ->
// tender + pliegos, then straight to "Tu empresa"); the manual form stays
// below for tenders that are not there. The PDF and the company stay
// optional (Revisar offers the company form again if you skip it).
// Voice: Spanish tú, short sentences, questions as headings.

import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTender,
  getCapabilities,
  importTender,
  newIdempotencyKey,
  uploadTenderDocument,
  type TenderDocument,
  type TenderImport,
} from "../../api/client";
import { Alert, Button } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import { formatEurosExact, formatFechaNormal, PRECIO_INPUT_MODE } from "../../lib/format";
import { CompanyCreateForm } from "../company/CompanyCreateForm";
import {
  buildTenderCreate,
  EMPTY_INTAKE_FORM,
  validateIntake,
  type IntakeErrors,
  type IntakeForm,
  type TaxChoice,
} from "./intakeForm";
import { documentKindEs, documentReasonEs, importErrorEs } from "./importErrors";
import {
  formatBytesEs,
  parseStatusToState,
  precheckFile,
  uploadErrorEs,
  type UploadState,
} from "./uploadErrors";

const INPUT_CLASS = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-base";

function Field({
  htmlFor,
  label,
  error,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-error">
          <span aria-hidden="true">⚠︎ </span>
          {error}
        </p>
      )}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Identificar", "Añadir documento", "Tu empresa"];
  return (
    <ol aria-label="Pasos para dar de alta" className="flex flex-wrap gap-2">
      {steps.map((label, index) => {
        const current = index + 1 === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={
              current
                ? "rounded-full bg-primary px-3 py-1 text-sm font-semibold text-white"
                : "rounded-full border border-border bg-white px-3 py-1 text-sm text-muted"
            }
          >
            {`Paso ${index + 1}: ${label}`}
          </li>
        );
      })}
    </ol>
  );
}

const IMPORT_EXAMPLE =
  "https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=…";

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-base text-muted">{label}</dt>
      <dd className="text-lg font-semibold text-ink">{children}</dd>
    </div>
  );
}

/** What the import found, before the user continues. Figures stay backend strings. */
function ImportSummary({ result }: { result: TenderImport }) {
  const { tender } = result;
  const missing = "Sin dato en la Plataforma";
  return (
    <div data-testid="import-summary" className="mt-4 rounded-xl border-2 border-primary bg-white p-4 sm:p-6">
      <h3>¿Es esta la licitación?</h3>
      {result.already_imported && (
        <Alert tone="info" role="status" className="mt-3">
          Ya la tenías en BidLab. Seguimos con la que ya existe.
        </Alert>
      )}
      <dl className="mt-3 divide-y divide-border">
        <SummaryRow label="Título">{tender.title}</SummaryRow>
        <SummaryRow label="Expediente">{tender.external_id}</SummaryRow>
        <SummaryRow label="Organismo que convoca">{tender.contracting_body || missing}</SummaryRow>
        <SummaryRow label="Presupuesto de salida sin impuestos">
          {tender.pbl_net ? formatEurosExact(tender.pbl_net) : missing}
        </SummaryRow>
        <SummaryRow label="Presupuesto de salida con impuestos">
          {tender.pbl_gross ? formatEurosExact(tender.pbl_gross) : missing}
        </SummaryRow>
        <SummaryRow label="Plazo para presentar ofertas">
          {tender.deadline_at ? formatFechaNormal(tender.deadline_at) : (tender.deadline_literal ?? missing)}
        </SummaryRow>
      </dl>
      <p className="mt-2 text-base text-muted">La Plataforma no indica el tipo de impuesto. Lo revisas después.</p>

      <h4 className="mt-5 text-lg font-semibold">Documentos</h4>
      <ul className="mt-2 grid gap-3">
        {result.documents.map((doc) => (
          <li key={`${doc.kind}-${doc.source_url}`} className="tnum rounded-lg border border-border p-3">
            <p className="break-all text-base font-semibold">{doc.label}</p>
            <p className="text-base text-muted">{documentKindEs(doc.kind)}</p>
            {doc.status === "downloaded" ? (
              <p className="text-base">
                {"Guardado"}
                {doc.size_bytes !== null && ` · ${formatBytesEs(doc.size_bytes)}`}
                {doc.pages_count !== null && ` · ${doc.pages_count} páginas`}
              </p>
            ) : (
              <p className="text-base">
                {documentReasonEs(doc.reason)}{" "}
                <a href={doc.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                  Ábrelo en la Plataforma
                </a>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IntakePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<IntakeForm>(EMPTY_INTAKE_FORM);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createRaw, setCreateRaw] = useState<string | null>(null);
  const [tenderId, setTenderId] = useState<string | null>(null);
  const [tenderTitle, setTenderTitle] = useState("");
  const [scopeId, setScopeId] = useState<string | null>(null);
  const creatingRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadRaw, setUploadRaw] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadKeyRef = useRef("");
  const uploadingRef = useRef(false);

  const capsQuery = useQuery({
    queryKey: ["capabilities"],
    queryFn: ({ signal }) => getCapabilities(signal),
  });
  const maxBytes = capsQuery.data?.limits.pdf_bytes ?? null;

  const submittedRef = useRef(false);

  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRaw, setImportRaw] = useState<string | null>(null);
  const [imported, setImported] = useState<TenderImport | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const importingRef = useRef(false);
  const importKeyRef = useRef({ url: "", key: "" });

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    if (importingRef.current) return;
    const pasted = importUrl.trim();
    if (!pasted) {
      setImportError("Pega primero el enlace de la licitación.");
      setImportRaw(null);
      document.getElementById("import-url")?.focus();
      return;
    }
    // Same key while the link stays the same: a retry never duplicates.
    if (importKeyRef.current.url !== pasted) importKeyRef.current = { url: pasted, key: newIdempotencyKey() };
    importingRef.current = true;
    setImporting(true);
    setImportError(null);
    setImportRaw(null);
    try {
      const result = await importTender(pasted, { idempotencyKey: importKeyRef.current.key });
      await queryClient.invalidateQueries({ queryKey: ["tenders"] });
      setImported(result);
      setTenderId(result.tender.id);
      setTenderTitle(result.tender.title);
      setScopeId(result.tender.scopes[0]?.id ?? `${result.tender.id}-whole`);
    } catch (error) {
      setImportError(importErrorEs(error));
      setImportRaw(errorCode(error));
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }

  function resetImport() {
    setImported(null);
    setTenderId(null);
    setScopeId(null);
    setImportUrl("");
  }

  function setField<K extends keyof IntakeForm>(field: K, value: IntakeForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }));
  }

  // Baymard/NN/g: validate on blur once the user engaged (non-empty value
  // or a previous submit), never on the first keystroke; the live error
  // clears as soon as the value is fixed (setField above).
  function handleBlurField(field: keyof IntakeForm) {
    const raw = form[field];
    const engaged = submittedRef.current || String(raw ?? "").trim() !== "";
    if (!engaged) return;
    const found = validateIntake(form);
    const message = found[field];
    setErrors((prev) => {
      if (message === undefined) {
        if (prev[field] === undefined) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev[field] === message ? prev : { ...prev, [field]: message };
    });
  }

  const FIELD_IDS: Partial<Record<keyof IntakeForm, string>> = {
    title: "intake-title",
    externalId: "intake-external-id",
    contractingBody: "intake-body",
    sourceUrl: "intake-source-url",
    scopeLabel: "intake-scope",
    pblNet: "intake-pbl-net",
    pblGross: "intake-pbl-gross",
    periodMonths: "intake-period",
  };
  const FIELD_ORDER = Object.keys(FIELD_IDS) as (keyof IntakeForm)[];

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (creatingRef.current) return;
    submittedRef.current = true;
    const found = validateIntake(form);
    setErrors(found);
    const firstBad = FIELD_ORDER.find((key) => found[key as keyof IntakeErrors] !== undefined);
    const firstId = firstBad !== undefined ? FIELD_IDS[firstBad] : undefined;
    if (firstId !== undefined) {
      document.getElementById(firstId)?.focus();
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);
    setCreateRaw(null);
    try {
      const tender = await createTender(buildTenderCreate(form));
      await queryClient.invalidateQueries({ queryKey: ["tenders"] });
      setTenderId(tender.id);
      setTenderTitle(tender.title);
      setScopeId(tender.scopes[0]?.id ?? `${tender.id}-whole`);
      setStep(2);
    } catch (error) {
      setCreateError(errorEs(error, "No pudimos crear tu licitación. Revisa los datos."));
      setCreateRaw(errorCode(error));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (!picked) return;
    uploadKeyRef.current = newIdempotencyKey();
    setFile(picked);
    setUploaded(false);
    setUploadRaw(null);
    const blocked = precheckFile(picked, maxBytes);
    if (blocked) {
      setUploadState("error");
      setUploadMessage(blocked);
    } else {
      setUploadState("recibido");
      setUploadMessage(null);
    }
  }

  function stateMessage(doc: TenderDocument): string | null {
    if (doc.parse_status === "ready") return "Tu documento está listo. Ya puedes abrir tu licitación.";
    if (doc.parse_status === "queued") return "Estamos leyendo tu documento. Ya puedes continuar.";
    if (doc.parse_status === "needs_review") return "Tu documento necesita una revisión. Ya puedes continuar.";
    return "No pudimos leer ese PDF. Prueba con otra copia.";
  }

  async function handleUpload() {
    if (uploadingRef.current || !file || !tenderId) return;
    const blocked = precheckFile(file, maxBytes);
    if (blocked) {
      setUploadState("error");
      setUploadMessage(blocked);
      setUploadRaw(null);
      return;
    }
    uploadingRef.current = true;
    setUploading(true);
    setUploadState("leyendo");
    setUploadMessage(null);
    setUploadRaw(null);
    try {
      // Same key on every retry of this file: no duplicates.
      const doc = await uploadTenderDocument(tenderId, file, { idempotencyKey: uploadKeyRef.current });
      setUploadState(parseStatusToState(doc.parse_status));
      setUploadMessage(stateMessage(doc));
      setUploaded(doc.parse_status !== "failed");
      if (doc.parse_status === "failed") setUploadRaw("failed");
    } catch (error) {
      setUploadState("error");
      setUploadMessage(uploadErrorEs(error));
      setUploadRaw(errorCode(error));
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  function openWorkspace(tab: string) {
    if (tenderId) void navigate(`/tenders/${tenderId}?tab=${tab}`);
  }

  return (
    <main id="main" className="wrap" tabIndex={-1}>
      <div className="mx-auto w-full max-w-2xl">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Saltar al contenido
      </a>
      <p className="backrow">
        <Link to="/">← Volver a mis licitaciones</Link>
      </p>
      <h1 className="mt-2">Nueva licitación</h1>
      <div className="mt-3">
        <Stepper step={step} />
      </div>

      <div id="contenido" className="mt-6">
        {step === 1 && (
          <div>
            <h2>¿Qué licitación quieres dar de alta?</h2>
            {imported ? (
              <>
                <ImportSummary result={imported} />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button data-testid="import-continue" onClick={() => setStep(3)}>
                    Continuar con tu empresa
                  </Button>
                  <Button variant="secondary" onClick={resetImport}>
                    No es esta, probar otro enlace
                  </Button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => void handleImport(e)}
                noValidate
                aria-label="Importar desde la Plataforma de Contratación"
                className="mt-4 rounded-xl border-2 border-primary bg-white p-4 sm:p-6"
              >
                <label htmlFor="import-url" className="block text-lg font-semibold">
                  Pega el enlace de la licitación en la Plataforma de Contratación
                </label>
                <p id="import-url-hint" className="mt-1 text-base text-muted">
                  En la ficha de la licitación, copia el «Enlace a la licitación». Se parece a este:{" "}
                  <span className="break-all">{IMPORT_EXAMPLE}</span>
                </p>
                <input
                  id="import-url"
                  data-testid="import-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={importUrl}
                  onChange={(e) => {
                    setImportUrl(e.target.value);
                    setImportError(null);
                  }}
                  aria-invalid={importError !== null}
                  aria-describedby={importError ? "import-url-hint import-url-error" : "import-url-hint"}
                  className="mt-3 min-h-[56px] w-full rounded-lg border-2 border-border px-4 py-3 text-lg"
                />
                {importError && (
                  <Alert id="import-url-error" className="mt-3" title={importRaw ?? undefined}>
                    {importError}
                  </Alert>
                )}
                {importing && (
                  <p role="status" className="mt-3 text-base">
                    Estamos trayendo la licitación y sus pliegos. Puede tardar un minuto.
                  </p>
                )}
                <Button data-testid="import-submit" type="submit" disabled={importing} className="mt-4 text-lg">
                  {importing ? "Importando…" : "Importar"}
                </Button>
              </form>
            )}

            {!imported && (
              <section aria-labelledby="intake-manual-heading" className="mt-10 border-t border-border pt-6">
                <h3 id="intake-manual-heading">¿No está en la Plataforma? Créala a mano</h3>
                {!manualOpen ? (
                  <Button
                    data-testid="intake-manual"
                    variant="secondary"
                    className="mt-3"
                    aria-expanded={false}
                    aria-controls="intake-manual-form"
                    onClick={() => setManualOpen(true)}
                  >
                    Crear a mano
                  </Button>
                ) : (
          <form id="intake-manual-form" onSubmit={(e) => void handleCreate(e)} noValidate aria-label="Identificar licitación">
            <p className="mt-1 text-sm text-muted">Escribe los datos tal como aparecen en el anuncio.</p>
            <div className="mt-4 grid gap-4">
              <Field htmlFor="intake-title" label="Título" error={errors.title}>
                <input
                  id="intake-title"
                  data-testid="intake-title"
                  type="text"
                  autoComplete="off"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  onBlur={() => handleBlurField("title")}
                  aria-invalid={errors.title !== undefined}
                  aria-describedby={errors.title ? "intake-title-error" : undefined}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field htmlFor="intake-external-id" label="Referencia o expediente" error={errors.externalId}>
                <input
                  id="intake-external-id"
                  data-testid="intake-external-id"
                  type="text"
                  autoComplete="off"
                  value={form.externalId}
                  onChange={(e) => setField("externalId", e.target.value)}
                  onBlur={() => handleBlurField("externalId")}
                  aria-invalid={errors.externalId !== undefined}
                  aria-describedby={errors.externalId ? "intake-external-id-error" : undefined}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field htmlFor="intake-body" label="Organismo que convoca" error={errors.contractingBody}>
                <input
                  id="intake-body"
                  data-testid="intake-body"
                  type="text"
                  autoComplete="off"
                  value={form.contractingBody}
                  onChange={(e) => setField("contractingBody", e.target.value)}
                  onBlur={() => handleBlurField("contractingBody")}
                  aria-invalid={errors.contractingBody !== undefined}
                  aria-describedby={errors.contractingBody ? "intake-body-error" : undefined}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field htmlFor="intake-source-url" label="Fuente oficial (opcional)" error={errors.sourceUrl}>
                <input
                  id="intake-source-url"
                  data-testid="intake-source-url"
                  type="url"
                  autoComplete="off"
                  inputMode="url"
                  placeholder="https://…"
                  value={form.sourceUrl}
                  onChange={(e) => setField("sourceUrl", e.target.value)}
                  onBlur={() => handleBlurField("sourceUrl")}
                  aria-invalid={errors.sourceUrl !== undefined}
                  aria-describedby={errors.sourceUrl ? "intake-source-url-error" : undefined}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field htmlFor="intake-scope" label="Ámbito inicial (opcional)" error={errors.scopeLabel}>
                <input
                  id="intake-scope"
                  data-testid="intake-scope"
                  type="text"
                  autoComplete="off"
                  value={form.scopeLabel}
                  onChange={(e) => setField("scopeLabel", e.target.value)}
                  onBlur={() => handleBlurField("scopeLabel")}
                  aria-invalid={errors.scopeLabel !== undefined}
                  aria-describedby={errors.scopeLabel ? "intake-scope-error" : undefined}
                  className={INPUT_CLASS}
                />
              </Field>

              <fieldset className="rounded-xl border border-border bg-white p-4">
                <legend className="px-1 text-sm font-semibold">¿Conoces el presupuesto de salida?</legend>
                <p className="text-sm text-muted">Este bloque es opcional. Complétalo solo si conoces los datos.</p>
                <div className="mt-3 grid gap-4">
                  <Field htmlFor="intake-pbl-net" label="Presupuesto sin impuestos (opcional)" error={errors.pblNet}>
                    <input
                      id="intake-pbl-net"
                      data-testid="intake-pbl-net"
                      type="text"
                      autoComplete="off"
                      inputMode={PRECIO_INPUT_MODE}
                      placeholder="118336,00"
                      value={form.pblNet}
                      onChange={(e) => setField("pblNet", e.target.value)}
                      onBlur={() => handleBlurField("pblNet")}
                      aria-invalid={errors.pblNet !== undefined}
                      aria-describedby={errors.pblNet ? "intake-pbl-net-error" : undefined}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field htmlFor="intake-pbl-gross" label="Presupuesto con impuestos (opcional)" error={errors.pblGross}>
                    <input
                      id="intake-pbl-gross"
                      data-testid="intake-pbl-gross"
                      type="text"
                      autoComplete="off"
                      inputMode={PRECIO_INPUT_MODE}
                      placeholder="126619,52"
                      value={form.pblGross}
                      onChange={(e) => setField("pblGross", e.target.value)}
                      onBlur={() => handleBlurField("pblGross")}
                      aria-invalid={errors.pblGross !== undefined}
                      aria-describedby={errors.pblGross ? "intake-pbl-gross-error" : undefined}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field htmlFor="intake-tax" label="Impuesto">
                    <select
                      id="intake-tax"
                      data-testid="intake-tax"
                      value={form.taxKind}
                      onChange={(e) => setField("taxKind", e.target.value as TaxChoice)}
                      className={INPUT_CLASS}
                    >
                      <option value="unknown">Sin determinar</option>
                      <option value="VAT">IVA</option>
                      <option value="IGIC">IGIC</option>
                    </select>
                  </Field>
                  <Field htmlFor="intake-period" label="Duración en meses (opcional)" error={errors.periodMonths}>
                    <input
                      id="intake-period"
                      data-testid="intake-period"
                      type="text"
                      autoComplete="off"
                      inputMode="numeric"
                      placeholder="Como 24"
                      value={form.periodMonths}
                      onChange={(e) => setField("periodMonths", e.target.value)}
                      onBlur={() => handleBlurField("periodMonths")}
                      aria-invalid={errors.periodMonths !== undefined}
                      aria-describedby={errors.periodMonths ? "intake-period-error" : undefined}
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
                <p className="mt-3 text-sm text-muted">Nunca deducimos el impuesto desde un solo importe.</p>
              </fieldset>
            </div>

            {createError && (
              <Alert className="mt-4" title={createRaw ?? undefined}>
                {createError}
              </Alert>
            )}
            <div className="mt-4">
              <Button data-testid="intake-submit" type="submit" disabled={creating}>
                {creating ? "Creando…" : "Crear y continuar"}
              </Button>
            </div>
          </form>
                )}
              </section>
            )}
          </div>
        )}

        {step === 2 && tenderId && (
          <section aria-label="Añadir documento">
            <h2>¿Quieres añadir el pliego en PDF?</h2>
            <p data-testid="intake-created" className="mt-1 text-sm text-muted">
              Tu licitación <span className="font-semibold text-ink">{tenderTitle}</span> ya existe. Este
              paso es opcional.
            </p>

            <div className="mt-4">
              <label
                htmlFor="intake-file"
                className="inline-flex min-h-[48px] cursor-pointer items-center rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-hover"
              >
                Elige un PDF de tu equipo
              </label>
              <input
                id="intake-file"
                data-testid="intake-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileSelect}
                className="sr-only"
              />
              <p className="mt-2 text-sm text-muted">
                Guardamos tu archivo solo en este equipo. No sale a ningún servicio externo.
              </p>
            </div>

            {file && (
              <div className="tnum mt-4 rounded-xl border border-border bg-white p-4">
                <p data-testid="intake-file-name" className="break-all font-semibold">
                  {file.name}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatBytesEs(file.size)}
                  {uploadState && (
                    <>
                      {" · Estado: "}
                      <span data-testid="intake-file-state" className="font-semibold text-ink">
                        {uploading ? "leyendo" : uploadState}
                      </span>
                    </>
                  )}
                </p>
                {uploadMessage && (
                  <p
                    role={uploadState === "error" ? "alert" : "status"}
                    title={uploadRaw ?? undefined}
                    className={uploadState === "error" ? "mt-2 text-sm text-error" : "mt-2 text-sm"}
                  >
                    {uploadMessage}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-3">
                  {!uploaded && uploadState !== "error" && (
                    <Button data-testid="intake-upload" onClick={() => void handleUpload()} disabled={uploading || !file}>
                      {uploading ? "Subiendo…" : "Subir documento"}
                    </Button>
                  )}
                  {!uploaded && uploadState === "error" && (
                    <Button data-testid="intake-retry" onClick={() => void handleUpload()} disabled={uploading}>
                      {uploading ? "Subiendo…" : "Reintentar"}
                    </Button>
                  )}
                  {uploaded && (
                    <Button data-testid="intake-open" onClick={() => setStep(3)}>
                      Continuar con tu empresa
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <Button data-testid="intake-skip" variant="secondary" onClick={() => setStep(3)}>
                Continuar sin documento
              </Button>
            </div>
          </section>
        )}

        {step === 3 && tenderId && scopeId && (
          <section aria-label="Tu empresa">
            <CompanyCreateForm
              tenderId={tenderId}
              scopeId={scopeId}
              initialPeriodMonths={
                imported ? String(imported.tender.scopes[0]?.basis.period_months ?? "") : form.periodMonths
              }
              onCreated={() => openWorkspace("revisar")}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button data-testid="intake-skip-company" variant="secondary" onClick={() => openWorkspace("resumen")}>
                Continuar sin empresa
              </Button>
            </div>
          </section>
        )}
      </div>
      </div>
    </main>
  );
}
