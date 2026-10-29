// Bandeja de comparación (UX-15, T06): 2-3 copias guardadas lado a lado.
// Los deltas los calcula el backend en Decimal; aquí solo se formatean.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  compareScenarios,
  type CompareDelta,
  type CompareEntry,
  type CompareResult,
  type ScenarioSummary,
} from "../../api/client";
import { Button, Card } from "../../components/ui";
import { DecisionFrontier } from "./DecisionFrontier";
import {
  formatEurosExact,
  formatFechaNormal,
  formatPercent,
  formatPoints1,
  formatSignedEurosExact,
} from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { anomalyVerdictEs } from "../pricing/sources";

interface Props {
  summaries: ScenarioSummary[];
  /** Puntos máximos ya formateados (vienen de la regla del workspace). */
  scoreMax: string;
}

/** Sign prefix for display only; the figure itself is a backend string. */
function formatSignedPoints1(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${formatPoints1(value)}`;
}

function DeltaRow({
  label,
  value,
  motivo,
  format,
}: {
  label: string;
  value: string | null;
  motivo: string | null;
  format: (v: string) => string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum text-right font-semibold">{value !== null ? format(value) : (motivo ?? "Sin determinar")}</dd>
    </div>
  );
}

function DeltaBlock({ delta, base, other }: { delta: CompareDelta; base: string; other: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <h4 className="font-semibold">
        «{other}» frente a «{base}»
      </h4>
      <dl className="mt-2 grid gap-1 text-sm">
        <DeltaRow
          label="Precio"
          value={delta.delta_price_net}
          motivo={delta.delta_price_motivo}
          format={formatSignedEurosExact}
        />
        <DeltaRow
          label="Beneficio"
          value={delta.delta_profit_net}
          motivo={delta.delta_profit_motivo}
          format={formatSignedEurosExact}
        />
        <DeltaRow
          label="Puntos"
          value={delta.delta_score}
          motivo={delta.delta_score_motivo}
          format={formatSignedPoints1}
        />
        <DeltaRow
          label="Coste por punto"
          value={delta.cost_per_point_net}
          motivo={delta.cost_per_point_motivo}
          format={(v) => `${formatSignedEurosExact(v)} por punto`}
        />
      </dl>
      <p className="mt-2 text-sm">{delta.indicator_motivo}</p>
      <p className="mt-1 text-sm text-muted">{delta.dominance_motivo}</p>
    </div>
  );
}

function EntryRow({ entry, maxHint }: { entry: CompareEntry; maxHint: string }) {
  return (
    <tr>
      <td className="border-b border-line p-2 font-medium">{entry.name}</td>
      <td className="tnum border-b border-line p-2">{formatPercent(entry.discount_rate)}</td>
      <td className="tnum border-b border-line p-2">{formatEurosExact(entry.price_net)}</td>
      <td className="tnum border-b border-line p-2">
        {entry.profit_net !== null ? formatSignedEurosExact(entry.profit_net) : "—"}
      </td>
      <td className="tnum border-b border-line p-2">
        {entry.score_status === "defined" && entry.score_value !== null
          ? `${formatPoints1(entry.score_value)} de ${maxHint}`
          : "Sin determinar"}
      </td>
      <td className="border-b border-line p-2">{anomalyVerdictEs(entry.anomaly_status)}</td>
    </tr>
  );
}

function CompareResultView({ result, scoreMax }: { result: CompareResult; scoreMax: string }) {
  const names = new Map(result.entries.map((e) => [e.scenario_id, e.name]));
  // BL-V2-08: with 3 scenarios the backend returns 2 pairs; the hero never
  // pins an arbitrary first pair — the user picks which pair it tells.
  const [pairIdx, setPairIdx] = useState(0);
  const idx = result.deltas.length === 0 ? 0 : Math.min(pairIdx, result.deltas.length - 1);
  const hero = result.deltas[idx] ?? null;
  const pairLabel = (d: CompareDelta): string =>
    `«${names.get(d.other_id) ?? d.other_id}» frente a «${names.get(d.base_id) ?? d.base_id}»`;
  return (
    <div className="mt-3 grid gap-3" data-testid="compare-result">
      <p className="text-sm font-semibold" role="status">
        {result.status === "comparable" && "Puedes compararlas: comparten contexto."}
        {result.status === "partial" && "Comparación parcial: revisa los avisos."}
        {result.status === "no_comparable" && "No puedes compararlas como si fueran el mismo caso."}
      </p>
      <p className="text-xs text-muted">
        Las pruebas comparan tus supuestos de rivales, no ofertas reales.
      </p>
      {result.deltas.length > 1 && (
        <fieldset>
          <legend className="text-sm font-semibold">Par destacado en el titular</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {result.deltas.map((d, i) => (
              <label key={`${d.base_id}:${d.other_id}`} className="flex min-h-[48px] items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="compare-hero-pair"
                  checked={i === idx}
                  onChange={() => setPairIdx(i)}
                />
                {pairLabel(d)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {hero !== null && (
        <div className="compare-hero" data-testid="decision-comparison-hero">
          <p className="text-lg font-bold">{hero.indicator_motivo}</p>
          {hero.dominance_motivo ? (
            <p className="mt-1 text-sm text-muted">{hero.dominance_motivo}</p>
          ) : null}
        </div>
      )}
      {result.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-alert">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        «Sospechosa» abrevia oferta sospechosamente baja (la ley la llama presunción de anormalidad,
        art. 149 LCSP).
      </p>
      <div className="table-scroll overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla comparativa, desplázate horizontalmente">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className="border-b border-border p-2">Prueba</th>
              <th scope="col" className="border-b border-border p-2">Rebaja</th>
              <th scope="col" className="border-b border-border p-2">Precio</th>
              <th scope="col" className="border-b border-border p-2">Beneficio</th>
              <th scope="col" className="border-b border-border p-2">Puntos</th>
              <th scope="col" className="border-b border-border p-2">¿Sospechosa?</th>
            </tr>
          </thead>
          <tbody>
            {result.entries.map((e) => (
              <EntryRow key={e.scenario_id} entry={e} maxHint={scoreMax} />
            ))}
          </tbody>
        </table>
      </div>
      {result.status === "comparable" && (
        <DecisionFrontier
          key={result.entries.map((e) => e.scenario_id).join(":")}
          scenarioIds={result.entries.map((e) => e.scenario_id)}
        />
      )}
      {result.deltas.map((d) => (
        <DeltaBlock
          key={`${d.base_id}:${d.other_id}`}
          delta={d}
          base={names.get(d.base_id) ?? d.base_id}
          other={names.get(d.other_id) ?? d.other_id}
        />
      ))}
      {result.deltas.length === 0 && result.entries.length > 0 && (
        <p className="text-sm text-muted">Sin diferencias para este contexto.</p>
      )}
    </div>
  );
}

export function CompareSection({ summaries, scoreMax }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ ids: string[]; primary: string } | null>(null);

  const compareQuery = useQuery({
    queryKey: ["compare", submitted?.ids.join(","), submitted?.primary],
    queryFn: ({ signal }) =>
      compareScenarios({ scenario_ids: submitted?.ids ?? [], primary_id: submitted?.primary ?? "" }, signal),
    enabled: submitted !== null,
    retry: false,
  });

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((v) => v !== id);
        if (primary === id) setPrimary(next[0] ?? null);
        return next;
      }
      if (prev.length >= 3) return prev;
      if (primary === null) setPrimary(id);
      return [...prev, id];
    });
    setSubmitted(null);
  }

  function run() {
    if (selected.length < 2 || !primary || !selected.includes(primary)) return;
    setSubmitted({ ids: selected, primary });
  }

  if (summaries.length < 2) {
    return (
      <Card aria-label="Comparar pruebas">
        <h2>¿Qué prueba te conviene más?</h2>
        <p className="mt-2 text-sm">
          Guarda al menos dos pruebas en Precio y podrás verlas lado a lado con sus diferencias.
        </p>
      </Card>
    );
  }

  return (
    <Card aria-label="Comparar pruebas">
      <h2>¿Qué prueba te conviene más?</h2>
      <p className="mt-1 text-sm text-muted">
        Elige dos o tres. La base es la prueba con la que comparas las demás.
      </p>
      <ul className="mt-2 space-y-2">
        {summaries.map((s) => {
          const checked = selected.includes(s.id);
          const capped = !checked && selected.length >= 3;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <label className="flex min-h-[48px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={capped}
                  onChange={() => toggle(s.id)}
                  aria-label={`Comparar ${s.name}`}
                />
                <span>
                  <strong>{s.name}</strong> · {formatEurosExact(s.price_net)} · guardado{" "}
                  {formatFechaNormal(s.created_at)}
                </span>
              </label>
              {checked && (
                <label className="flex min-h-[48px] items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="compare-primary"
                    checked={primary === s.id}
                    onChange={() => {
                      setPrimary(s.id);
                      setSubmitted(null);
                    }}
                    aria-label={`${s.name} como base`}
                  />
                  Base
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <Button data-testid="compare-run" onClick={run} disabled={selected.length < 2 || primary === null} className="mt-3">
        Comparar
      </Button>
      {compareQuery.isPending && submitted && (
        <p className="mt-2 text-sm" role="status">
          Comparando tus pruebas…
        </p>
      )}
      {compareQuery.isError && (
        <p role="alert" title={errorCode(compareQuery.error) ?? undefined} className="mt-2 text-sm text-error">
          {errorEs(compareQuery.error, "No pudimos comparar. Vuelve a intentarlo en unos segundos.")}
        </p>
      )}
      {compareQuery.data && <CompareResultView result={compareQuery.data} scoreMax={scoreMax} />}
    </Card>
  );
}
