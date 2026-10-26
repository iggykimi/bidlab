interface Props {
  mode: string | null | undefined;
}

/** Honest origin badge. "Demo curada" renders only for demo-mode sessions. */
export function DemoBadge({ mode }: Props) {
  if (mode === "demo") {
    return (
      <span
        data-testid="demo-badge"
        className="inline-block rounded-full border border-[#9A5B00] bg-[#FFF4D6] px-3 py-1 text-sm font-semibold text-[#7A4A00]"
      >
        Demo curada
      </span>
    );
  }
  if (mode === "live") {
    return (
      <span
        data-testid="demo-badge"
        className="inline-block rounded-full border border-[#3159D9] bg-[#E8EFFF] px-3 py-1 text-sm font-semibold text-[#1E3FA0]"
      >
        Análisis en vivo
      </span>
    );
  }
  return null;
}
