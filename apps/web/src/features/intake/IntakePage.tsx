// Intake flow: two short steps, "Identificar" then "Añadir documento".
// The tender is created first; the PDF stays optional and local-only.
// Voice: Spanish tú, short sentences, questions as headings.

import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTender,
  getCapabilities,
  newIdempotencyKey,
  uploadTenderDocument,
  type TenderDocument,
} from "../../api/client";
import { Alert, Button } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import { PRECIO_INPUT_MODE } from "../../lib/format";
import {
  buildTenderCreate,
  EMPTY_INTAKE_FORM,
  validateIntake,
  type IntakeErrors,
  type IntakeForm,
  type TaxChoice,
} from "./intakeForm";
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
          {error}
        </p>
      )}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const steps = ["Identificar", "Añadir documento"];
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

export function IntakePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<IntakeForm>(EMPTY_INTAKE_FORM);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createRaw, setCreateRaw] = useState<string | null>(null);
  const [tenderId, setTenderId] = useState<string | null>(null);
  const [tenderTitle, setTenderTitle] = useState("");
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

  function setField<K extends keyof IntakeForm>(field: K, value: IntakeForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (creatingRef.current) return;
    const found = validateIntake(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);
    setCreateRaw(null);
    try {
      const tender = await createTender(buildTenderCreate(form));
      await queryClient.invalidateQueries({ queryKey: ["tenders"] });
      setTenderId(tender.id);
      setTenderTitle(tender.title);
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

  function openWorkspace() {
    if (tenderId) void navigate(`/tenders/${tenderId}?tab=resumen`);
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Saltar al contenido
      </a>
      <p>
        <Link to="/" className="text-primary underline hover:text-primary-ink">
          ← Volver a mis licitaciones
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">Nueva licitación</h1>
      <div className="mt-3">
        <Stepper step={step} />
      </div>

      <div id="contenido" className="mt-6">
        {step === 1 && (
          <form onSubmit={(e) => void handleCreate(e)} noValidate aria-label="Identificar licitación">
            <h2 className="text-lg font-semibold">¿Qué licitación quieres dar de alta?</h2>
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
                      placeholder="24"
                      value={form.periodMonths}
                      onChange={(e) => setField("periodMonths", e.target.value)}
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

        {step === 2 && tenderId && (
          <section aria-label="Añadir documento">
            <h2 className="text-lg font-semibold">¿Quieres añadir el pliego en PDF?</h2>
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
                    <Button data-testid="intake-open" onClick={openWorkspace}>
                      Abrir tu licitación
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <Button data-testid="intake-skip" variant="secondary" onClick={openWorkspace}>
                Continuar sin documento
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
