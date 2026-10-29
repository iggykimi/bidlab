// Frase de conclusión de la pestaña Precio. Se construye solo con datos
// reales del resultado y tus hipótesis; sin rivales usa la variante corta.

import { useEffect, useRef } from "react";
import { Card } from "../../components/ui";
import {
  discountPercentToRate,
  formatEurosHeadline,
  formatPercent,
  formatPoints,
  parsePrecioInput,
} from "../../lib/format";
import { commitResult } from "../../lib/motion";
import type { PricingState } from "./usePricingState";

interface Props {
  state: PricingState;
}

interface Rival {
  label: string;
  price: string;
}

/** Cheapest rival with a usable price, or null without rivals. */
function cheapestRival(h: PricingState["h"]): Rival | null {
  if (h.noRivals) return null;
  const parsed: Rival[] = [];
  const a = parsePrecioInput(h.rivalAPrice);
  if (a !== null) parsed.push({ label: "A", price: a });
  const b = parsePrecioInput(h.rivalBPrice);
  if (b !== null) parsed.push({ label: "B", price: b });
  if (parsed.length === 0) return null;
  let best = parsed[0] as Rival;
  for (const r of parsed) {
    if (Number(r.price) < Number(best.price)) best = r;
  }
  return best;
}

/** Conclusion text: fades only when a new committed result lands. */
function CommittedConclusion({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (first.current) {
      first.current = false;
      return;
    }
    void commitResult(node, text);
  }, [text]);
  return (
    <p ref={ref} data-testid="conclusion" className="text-lg font-semibold">
      {text}
    </p>
  );
}

export function ConclusionSection({ state }: Props) {
  const { result, pending, resultStale } = state;
  const h = state.resultHypotheses ?? state.h;
  if (!result) {
    if (!pending) return null;
    return (
      <Card aria-label="Conclusión">
        <p role="status">Calculando tu oferta…</p>
      </Card>
    );
  }

  const rate = formatPercent(discountPercentToRate(h.discountPct));
  const price = formatEurosHeadline(result.price_net);
  const sentences: string[] = [];

  const profitNum = result.profit_net === null ? null : Number(result.profit_net);
  if (profitNum !== null && Number.isFinite(profitNum) && result.cost_net !== null) {
    const cost = formatEurosHeadline(result.cost_net);
    if (profitNum > 0) {
      const profit = formatEurosHeadline(result.profit_net as string);
      sentences.push(
        `Con una rebaja del ${rate} ofertarías ${price} y ganarías unos ${profit} (si tu coste es ${cost}).`
      );
    } else if (profitNum < 0) {
      const loss = formatEurosHeadline(String(Math.abs(profitNum)));
      sentences.push(
        `Con una rebaja del ${rate} ofertarías ${price} y perderías unos ${loss} (si tu coste es ${cost}).`
      );
    } else {
      sentences.push(
        `Con una rebaja del ${rate} ofertarías ${price} y tu beneficio sería de ${formatEurosHeadline("0")}.`
      );
      sentences.push(`Para ese cálculo, tu coste es ${cost}.`);
    }
  } else {
    sentences.push(`Con una rebaja del ${rate} ofertarías ${price}.`);
  }

  if (result.score.status === "defined" && result.score.value !== null) {
    sentences.push(
      `Sacarías ${formatPoints(result.score.value, result.score.max_points)} puntos por precio.`
    );
  } else if (h.noRivals) {
    sentences.push("Vas sin rivales, así que tus puntos están sin determinar.");
  } else if (!h.complete) {
    sentences.push("Tus puntos están sin determinar. Marca “Tomar estos como todos los rivales” para calcularlos.");
  } else {
    sentences.push("Tus puntos están sin determinar.");
  }

  const rival = cheapestRival(h);
  if (rival !== null) {
    const own = Number(result.price_net);
    const other = Number(rival.price);
    if (Number.isFinite(own) && Number.isFinite(other)) {
      if (own < other) {
        sentences.push("De las ofertas supuestas, eres la más barata.");
      } else if (own > other) {
        sentences.push(`El rival ${rival.label}, con ${formatEurosHeadline(rival.price)}, ofrece menos.`);
      } else {
        sentences.push("De las ofertas supuestas, empatas como la más barata.");
      }
    }
  }

  return (
    <Card aria-label="Conclusión">
      {resultStale && (
        <p className="mb-1 text-sm text-muted">Cifras del cálculo anterior. Actualizando…</p>
      )}
      <CommittedConclusion text={sentences.join(" ")} />
    </Card>
  );
}
