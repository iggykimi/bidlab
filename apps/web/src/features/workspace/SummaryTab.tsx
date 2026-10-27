// Resumen UX phase 1: "Lo esencial" up top (deadline, budget, duration,
// what scores), three guided steps, plain-ES facts, and every internal
// code behind TechnicalDetails. Display only: backend strings pass through
// the canonical format.ts/dates formatters, never recomputed here.

import { Link } from "react-router-dom";
import type { Decision, PricingRule, Workspace } from "../../api/client";
import { TechnicalDetails, type TechnicalDetailItem } from "../../components/TechnicalDetails";
import { Card } from "../../components/ui";
import { diasRestantes } from "../../lib/dates";
import {
  discountPercentToRate,
  formatEurosExact,
  formatEurosHeadline,
  formatFechaCorta,
  formatFechaNormal,
  formatMaxPoints,
  formatPercent,
} from "../../lib/format";
import { loadSession } from "../../lib/session";
import { nombreImpuesto } from "../../lib/taxKind";
import { decisionEs } from "../report/ReportTab";
import { useWorkspaceDrafts } from "./WorkspaceDrafts";

interface Props {
  workspace: Workspace;
}

/** Published status: PUB means the tender is published. Unknown codes pass through. */
function estadoPublicacion(statusRaw: string): string {
  if (statusRaw === "") return "Sin determinar";
  if (statusRaw === "PUB") return "Publicada";
  return statusRaw;
}

function textoPresupuesto(pblNet: string | null, pblGross: string | null, taxKind: string): string {
  const impuesto = nombreImpuesto(taxKind);
  const net = pblNet ? formatEurosHeadline(pblNet) : null;
  const gross = pblGross ? formatEurosExact(pblGross) : null;
  if (net && gross) return `${net} sin ${impuesto} (${gross} con ${impuesto})`;
  if (net) return `${net} sin ${impuesto}`;
  if (gross) return `${gross} con ${impuesto}`;
  return "Sin determinar";
}

function textoDuracion(periodMonths: number | null): string {
  if (periodMonths === null) return "Sin determinar";
  if (periodMonths === 1) return "1 mes";
  return `${periodMonths} meses`;
}

/** Official CPV nomenclature descriptions for the demo codes; others stay bare. */
function descripcionCPV(code: string): string | null {
  if (code === "79411000") return "Servicios generales de consultoría en gestión";
  if (code === "71356200") return "Servicios de asistencia técnica";
  return null;
}

function lineaCPV(codes: string[]): string {
  if (codes.length === 0) return "Sin determinar";
  return codes.map((c) => (descripcionCPV(c) ? `${c} · ${descripcionCPV(c)}` : c)).join(", ");
}

/** Plain sentence for the points formula; the raw identifier goes to Detalles técnicos. */
function frasePuntos(rule: PricingRule): string {
  if (rule.template_id === "unsupported") return "Fórmula no soportada.";
  if (rule.template_id === "proportional_inverse") {
    return `Cuanto más barata tu oferta, más puntos (hasta ${formatMaxPoints(rule.max_points)}).`;
  }
  return `Tu oferta compite por precio (hasta ${formatMaxPoints(rule.max_points)} puntos).`;
}

function avisoRevision(rule: PricingRule): string | null {
  if (rule.review_status === "approved") return null;
  if (rule.review_status === "blocked") return "La fórmula está bloqueada. No uses estos puntos.";
  return "La fórmula aún no está revisada. Los puntos pueden cambiar.";
}

/**
 * Deadline countdown. The backend literal once carried an unproven zone
 * claim ("Hora peninsular"), so unknown deadlines show "sin determinar"
 * and the literal only survives zone-stripped in Detalles técnicos.
 */
function textoPlazo(deadlineAt: string | null): string {
  if (deadlineAt === null) return "Sin determinar";
  const cuenta = diasRestantes(deadlineAt);
  const fecha = `Hasta el ${formatFechaNormal(deadlineAt)}.`;
  return cuenta === "—" ? fecha : `${fecha} ${cuenta}.`;
}

function literalSinZona(deadlineLiteral: string | null): string | null {
  if (deadlineLiteral === null) return null;
  const limpio = deadlineLiteral.replace(/Hora peninsular/g, "").replace(/\s*;\s*$/, "").trim();
  return limpio === "" ? null : limpio;
}

export function SummaryTab({ workspace }: Props) {
  const tender = workspace.tender;
  const basis = tender.scopes[0]?.basis ?? null;
  const taxKind = basis?.tax_kind ?? "unknown";
  const periodMonths = basis?.period_months ?? null;
  const rule = workspace.pricing_rules[0] ?? null;
  const session = loadSession();
  const { drafts } = useWorkspaceDrafts({
    tenderId: tender.id,
    scopeId: tender.scopes[0]?.id ?? "none",
    companyId: session?.company_id ?? "none",
  });
  const rebate = formatPercent(discountPercentToRate(drafts.pricing.h.discountPct));

  const detalles: TechnicalDetailItem[] = [
    { label: "Copia del anuncio oficial (SHA-256)", value: tender.raw_snapshot_sha256 },
  ];
  for (const flag of tender.quality_flags) {
    detalles.push({ label: "Código de calidad", value: flag });
  }
  for (const warning of workspace.warnings) {
    detalles.push({ label: "Aviso interno", value: warning });
  }
  if (tender.status_raw !== "") {
    detalles.push({ label: "Estado publicado (código)", value: tender.status_raw });
  }
  const literal = literalSinZona(tender.deadline_literal);
  if (literal !== null) {
    detalles.push({ label: "Plazo publicado (literal)", value: literal });
  }
  for (const r of workspace.pricing_rules) {
    detalles.push({ label: "Fórmula de puntos (identificador)", value: r.template_id });
    detalles.push({ label: "Revisión de la fórmula", value: String(r.revision) });
    detalles.push({ label: "Regla de oferta sospechosa (variante)", value: r.anomaly_policy.variant });
  }
  if (tender.pbl_net && tender.pbl_gross && taxKind === "IGIC") {
    detalles.push({ label: "Tipo de IGIC", value: "7 % calculado a partir de ambas cifras oficiales" });
  }

  return (
    <div className="grid gap-4">
      <Card aria-label="Lo esencial" data-testid="lo-esencial">
        <h2 className="text-lg font-semibold">Lo esencial</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Plazo</dt>
            <dd className="text-right font-semibold">{textoPlazo(tender.deadline_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Presupuesto de salida</dt>
            <dd className="tnum text-right font-semibold">
              {textoPresupuesto(tender.pbl_net, tender.pbl_gross, taxKind)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Duración</dt>
            <dd className="text-right font-semibold">{textoDuracion(periodMonths)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Qué puntúa</dt>
            <dd className="max-w-md text-right font-semibold">
              {rule ? (
                <>
                  El precio da hasta {formatMaxPoints(rule.max_points)} puntos. Aquí solo calculas los puntos del precio.
                  Revisa los demás criterios en el pliego de condiciones (PCAP).
                </>
              ) : (
                "Los puntos de precio aún no están revisados."
              )}
            </dd>
          </div>
        </dl>
        <h3 className="mt-4 font-semibold">Sigue estos tres pasos</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-6 text-sm">
          <li>
            <Link to="?tab=requisitos" className="font-semibold text-primary underline hover:text-primary-ink">
              Revisa los requisitos
            </Link>{" "}
            y comprueba si puedes presentarte.
          </li>
          <li>
            <Link to="?tab=precio" className="font-semibold text-primary underline hover:text-primary-ink">
              Prueba precios
            </Link>{" "}
            y mira cuántos puntos consigues.
          </li>
          <li>
            <Link to="?tab=informe" className="font-semibold text-primary underline hover:text-primary-ink">
              Guarda tu decisión
            </Link>{" "}
            en el informe, con tus notas.
          </li>
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-label="Hechos de la licitación">
          <h2 className="text-lg font-semibold">Hechos</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Valor estimado del contrato</dt>
              <dd className="text-right">
                <span className="tnum font-semibold">
                  {tender.estimated_value ? formatEurosHeadline(tender.estimated_value) : "Sin determinar"}
                </span>
                {tender.estimated_value && (
                  <span className="mt-1 block text-xs font-normal text-muted">
                    {periodMonths === null
                      ? "Incluye todo el periodo posible."
                      : `Incluye todo el periodo posible, no solo ${periodMonths} meses.`}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Estado</dt>
              <dd className="text-right font-semibold">{estadoPublicacion(tender.status_raw)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Tipo de servicio (código CPV)</dt>
              <dd className="max-w-md text-right font-semibold">{lineaCPV(tender.cpv_codes)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm">Datos del {formatFechaCorta(tender.source_updated_at)}.</p>
          <p className="mt-2 text-sm">
            <span className="font-medium">Fuente oficial: </span>
            <a
              href={tender.source_url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary underline"
            >
              Ver publicación en Contratación del Estado
            </a>
          </p>
          <TechnicalDetails items={detalles} className="mt-4" />
        </Card>

        <div className="grid content-start gap-4">
          <Card aria-label="Tu trabajo">
            <h2 className="text-lg font-semibold">Tu trabajo</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Borrador de precio: rebaja del {rebate}.</li>
              <li>
                {drafts.pricing.savedCopy
                  ? `Copia guardada «${drafts.pricing.savedCopy.name}».`
                  : "Aún no guardas ninguna prueba."}
              </li>
              <li>
                Decisión: {decisionEs(drafts.report.decision as Decision).toLowerCase()}.
                {drafts.report.note
                  ? " Tienes una nota que aún no está en ningún informe."
                  : " Sin notas todavía."}
              </li>
            </ul>
            <p className="mt-3 space-x-4 text-sm">
              <Link to="?tab=precio" className="font-semibold text-primary underline hover:text-primary-ink">
                Retomar en Precio
              </Link>
              <Link to="?tab=informe" className="font-semibold text-primary underline hover:text-primary-ink">
                Abrir el informe
              </Link>
            </p>
          </Card>

          <Card aria-label="¿Cómo suma puntos tu oferta?">
            <h2 className="text-lg font-semibold">¿Cómo suma puntos tu oferta?</h2>
            {workspace.pricing_rules.length === 0 ? (
              <p className="mt-2 text-sm">Aún no hay fórmula de puntos revisada.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {workspace.pricing_rules.map((r) => (
                  <li key={`${r.id}:${r.revision}`}>
                    <p>{frasePuntos(r)}</p>
                    {avisoRevision(r) && <p className="mt-1">{avisoRevision(r)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <section aria-label="Asistente de IA">
            <p data-testid="live-unavailable" className="text-sm">
              El asistente de IA no está disponible en esta demo: aquí los datos ya vienen
              revisados.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
