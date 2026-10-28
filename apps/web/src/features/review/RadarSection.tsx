// Incoherence radar (T20): pairwise observation mismatches with both
// evidences and a neutral question. The backend compares; this view only
// presents. The tool asks, the review decides.

import type {
  ConsistencyEvidence,
  ConsistencyFinding,
  ConsistencyReport,
} from "../../api/client";
import { Alert, Card } from "../../components/ui";
import { consistencyFieldLabel } from "./radarCopy";

interface Props {
  report: ConsistencyReport;
}

function Evidence({ evidence, testid }: { evidence: ConsistencyEvidence; testid: string }) {
  return (
    <div data-testid={testid} className="rounded-lg bg-surface p-2 text-sm">
      <p className="text-xs text-muted">
        {`Documento ${evidence.document_id} · Página ${evidence.physical_page}`}
      </p>
      {evidence.value !== null && <p className="mt-1 text-base font-semibold">{evidence.value}</p>}
      {evidence.verbatim_excerpt !== null ? (
        <p className="mt-1 whitespace-pre-wrap">«{evidence.verbatim_excerpt}»</p>
      ) : (
        <p className="mt-1 text-xs text-muted">Sin cita literal.</p>
      )}
    </div>
  );
}

function FindingCard({ finding, testid }: { finding: ConsistencyFinding; testid: string }) {
  return (
    <li data-testid={testid} className="rounded-lg border border-line p-3">
      <p className="text-sm font-semibold">{consistencyFieldLabel(finding.field)}</p>
      <div className="mt-2 grid gap-2">
        <Evidence evidence={finding.evidence_a} testid={`${testid}-a`} />
        <Evidence evidence={finding.evidence_b} testid={`${testid}-b`} />
      </div>
      <Alert tone="warn" className="mt-2">
        {finding.question}
      </Alert>
    </li>
  );
}

export function RadarSection({ report }: Props) {
  return (
    <Card aria-label="Radar de incoherencias">
      <h2 className="text-lg font-semibold">Radar de incoherencias</h2>
      <p className="mt-1 text-sm text-muted">
        Si dos fuentes compatibles dicen valores distintos, lo verás aquí con ambas citas. La
        herramienta pregunta; tú decides.
      </p>
      {report.items.length === 0 ? (
        <p data-testid="radar-empty" className="mt-3 rounded-lg bg-surface p-3 text-sm">
          Sin pares comparables en tu revisión por ahora: ninguna pareja de observaciones comparte
          dimensión y versión.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {report.items.map((finding, index) => (
            <FindingCard key={index} finding={finding} testid={`radar-item-${index}`} />
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <p data-testid="radar-synthetic-badge" className="text-xs font-semibold uppercase text-muted">
          Ejemplo sintético
        </p>
        <ul className="mt-2 grid gap-3">
          <FindingCard finding={report.synthetic_example} testid="radar-synthetic" />
        </ul>
        <p className="mt-2 text-xs text-muted">
          Datos inventados para mostrarte cómo se ve un aviso; no salen de tus documentos.
        </p>
      </div>
    </Card>
  );
}
