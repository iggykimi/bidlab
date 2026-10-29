import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Workspace } from "../../api/client";
import { compareScenarios, listTenderScenarios } from "../../api/client";
import { Card } from "../../components/ui";
import { formatEurosExact, formatMaxPoints, formatPoints1, formatSignedEurosExact } from "../../lib/format";
import { loadSession } from "../../lib/session";
import { approvedPricingRule, isOwnTender } from "../review/ownTender";

/**
 * Héroe de decisión BL-V3 P0-04 (§3): la conclusión la redacta el backend
 * (`indicator_motivo` del comparador); el frontal solo formatea cifras
 * devueltas. Compara siempre las dos últimas pruebas guardadas de ESTA
 * licitación, con nombres explícitos. Sin dos pruebas comparables no hay
 * veredicto: hay un estado pendiente con el siguiente paso real.
 */
export function DecisionSpotlight({ workspace }: { workspace: Workspace }) {
  const tenderId = workspace.tender.id;
  const own = isOwnTender(workspace.tender);
  const session = loadSession();
  const scope = session?.tender_id === tenderId ? session.scope_id : undefined;
  const rule = approvedPricingRule(workspace);

  const scenariosQuery = useQuery({
    queryKey: ["tenderScenarios", tenderId, scope],
    queryFn: ({ signal }) =>
      listTenderScenarios(tenderId, { scopeId: scope, pageSize: 100, signal }),
    enabled: tenderId !== "" && scope !== undefined,
  });
  const items = [...(scenariosQuery.data?.items ?? [])].reverse();
  const pair = items.length >= 2 ? [items[0]!, items[1]!] as const : null;

  const compareQuery = useQuery({
    queryKey: ["spotlight-compare", tenderId, pair?.[0].id ?? "none", pair?.[1].id ?? "none"],
    queryFn: ({ signal }) =>
      compareScenarios(
        { scenario_ids: [pair![0].id, pair![1].id], primary_id: pair![0].id },
        signal
      ),
    enabled: pair !== null,
    retry: false,
  });

  const maxHint = rule ? formatMaxPoints(rule.max_points) : "—";
  // Sin sesión de ámbito la consulta queda deshabilitada: no es "cargando",
  // es "aún no hay nada que comparar". El pendiente es orientación, no conteo.
  const noSession = scope === undefined;

  return (
    <Card aria-label="Decisión destacada" data-testid="decision-spotlight" className="spotlight">
      {!noSession && scenariosQuery.isPending && <p className="text-sm">Cargando tus pruebas…</p>}
      {scenariosQuery.isError && (
        <p className="text-sm">
          No pudimos cargar tus pruebas aquí.{" "}
          <Link to="?tab=informe" className="font-semibold text-primary underline">
            Míralas en el informe
          </Link>
        </p>
      )}
      {(noSession || scenariosQuery.isSuccess) && pair === null && (
        <>
          <h2>
            {own && rule === null
              ? "Completa requisitos y costes para comparar."
              : "Guarda dos pruebas para compararlas aquí."}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {own && rule === null ? (
              <>
                Revisa tu fórmula y guarda dos pruebas.{" "}
                <Link to="?tab=revisar" className="font-semibold text-primary underline">
                  Revisar fórmula
                </Link>
              </>
            ) : (
              <>
                Prueba precios y guarda dos pruebas.{" "}
                <Link to="?tab=precio" className="font-semibold text-primary underline">
                  Probar precios
                </Link>
              </>
            )}
          </p>
        </>
      )}
      {pair !== null && compareQuery.isPending && (
        <p className="text-sm">Comparando «{pair[0].name}» y «{pair[1].name}»…</p>
      )}
      {pair !== null && compareQuery.isError && (
        <p className="text-sm">
          No pudimos comparar «{pair[0].name}» y «{pair[1].name}» aquí.{" "}
          <Link to="?tab=informe" className="font-semibold text-primary underline">
            Compáralas en el informe
          </Link>
        </p>
      )}
      {pair !== null && compareQuery.data?.status === "no_comparable" && (
        <>
          <h2>«{pair[0].name}» y «{pair[1].name}» no comparten contexto.</h2>
          <p className="mt-1 text-sm text-muted">
            <Link to="?tab=informe" className="font-semibold text-primary underline">
              Compáralas en el informe
            </Link>
          </p>
        </>
      )}
      {pair !== null &&
        compareQuery.data !== undefined &&
        compareQuery.data.status !== "no_comparable" &&
        compareQuery.data.deltas[0] !== undefined && (
          <>
            <h2>{compareQuery.data.deltas[0].indicator_motivo}</h2>
            <dl className="spotlight-figures">
              {compareQuery.data.entries.map((entry) => (
                <div key={entry.scenario_id}>
                  <dt>«{entry.name}»</dt>
                  <dd className="tnum">
                    {formatEurosExact(entry.price_net)} ·{" "}
                    {entry.profit_net !== null
                      ? formatSignedEurosExact(entry.profit_net)
                      : "Sin determinar"}{" "}
                    ·{" "}
                    {entry.score_status === "defined" && entry.score_value !== null
                      ? `${formatPoints1(entry.score_value)} de ${maxHint}`
                      : "Sin determinar"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-sm text-muted">
              Bajo hipótesis declaradas de «{pair[0].name}» y «{pair[1].name}».
            </p>
            <p className="spotlight-ctas">
              <Link to="?tab=informe">Explorar comparación</Link>
              {" · "}
              <Link to="?tab=revisar">Ver regla de precio</Link>
              {" · "}
              <Link to="?tab=evidencia">Abrir evidencia</Link>
            </p>
          </>
        )}
    </Card>
  );
}
