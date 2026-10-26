import { Badge } from "./ui";

interface Props {
  mode: string | null | undefined;
}

/** Honest origin badge. "Demo curada" renders only for demo-mode sessions. */
export function DemoBadge({ mode }: Props) {
  if (mode === "demo") {
    return (
      <Badge tone="demo" data-testid="demo-badge">
        Demo curada
      </Badge>
    );
  }
  if (mode === "live") {
    return (
      <Badge tone="live" data-testid="demo-badge">
        Análisis en vivo
      </Badge>
    );
  }
  return null;
}
