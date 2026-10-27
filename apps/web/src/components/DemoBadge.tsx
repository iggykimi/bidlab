import { Badge } from "./ui";

interface Props {
  mode: string | null | undefined;
}

/** Honest origin badge. Example-data sessions say so in plain words. */
export function DemoBadge({ mode }: Props) {
  if (mode === "demo") {
    return (
      <Badge tone="demo" data-testid="demo-badge">
        Datos de ejemplo
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
