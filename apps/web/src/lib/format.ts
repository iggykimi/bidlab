// Display-only formatting (es-ES). Backend strings stay authoritative.

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const points4 = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatEUR(amount: string): string {
  return eur.format(Number(amount));
}

export function formatPoints(points: string): string {
  return points4.format(Number(points));
}
