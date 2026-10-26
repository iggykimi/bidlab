import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurvePoint } from "../../api/client";

interface Props {
  curve: CurvePoint[];
}

interface Row {
  price: number;
  score: number | null;
  profit: number | null;
  discount: string;
}

const axisTick = { fontSize: 12 };

/** Price→points and price→profit curves. Every point comes from the API response. */
export function CurveChart({ curve }: Props) {
  if (curve.length === 0) return null;
  const rows: Row[] = curve.map((p) => ({
    price: Number(p.price_net),
    score: p.score.value !== null ? Number(p.score.value) : null,
    profit: p.profit_net !== null ? Number(p.profit_net) : null,
    discount: p.discount_rate,
  }));

  return (
    <div className="grid gap-4" data-testid="curve-chart">
      <figure>
        <figcaption className="text-sm font-semibold">
          Puntos de precio según precio de oferta ({rows.length} puntos del backend)
        </figcaption>
        <div className="h-56" role="img" aria-label={`Curva precio-puntos con ${rows.length} puntos calculados por el backend`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="price" tick={axisTick} tickFormatter={(v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 0 })} />
              <YAxis tick={axisTick} domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value) => (typeof value === "number" ? value.toLocaleString("es-ES", { maximumFractionDigits: 4 }) : value)}
                labelFormatter={(label) => `Precio ${Number(label).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              />
              <Line type="monotone" dataKey="score" name="Puntos" stroke="#3159D9" dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure>
        <figcaption className="text-sm font-semibold">
          Beneficio según precio de oferta (coste sintético de la empresa demo)
        </figcaption>
        <div className="h-56" role="img" aria-label={`Curva precio-beneficio con ${rows.length} puntos calculados por el backend`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="price" tick={axisTick} tickFormatter={(v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 0 })} />
              <YAxis tick={axisTick} domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value) => (typeof value === "number" ? value.toLocaleString("es-ES", { minimumFractionDigits: 2 }) : value)}
                labelFormatter={(label) => `Precio ${Number(label).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              />
              <Line type="monotone" dataKey="profit" name="Beneficio €" stroke="#1E7B3C" dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
