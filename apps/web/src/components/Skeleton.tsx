import { clsx } from "clsx";

interface Props {
  lines?: number;
  className?: string;
  label?: string;
}

/** Content-shaped loading placeholder (pulse disabled under reduced motion). */
export function Skeleton({ lines = 3, className, label = "Cargando contenido…" }: Props) {
  return (
    <div role="status" aria-label={label} className={clsx("grid gap-3", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-5" aria-hidden="true" />
      ))}
    </div>
  );
}
