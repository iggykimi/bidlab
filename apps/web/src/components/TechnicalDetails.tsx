// Accessible disclosure for hashes, IDs and formulas. Native <details> keeps
// keyboard behaviour (Enter/Espacio) free; copy buttons expose hash values
// without cluttering the main view. Spanish UI throughout.

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

export interface TechnicalDetailItem {
  /** Row label, e.g. "SHA-256 del PCAP". */
  label: string;
  /** Raw technical value (hash, ID, formula). Rendered verbatim. */
  value: string;
  /** Show a "Copiar" button. Defaults to true. */
  copyable?: boolean;
}

export interface TechnicalDetailsProps {
  items: TechnicalDetailItem[];
  /** Disclosure title. Defaults to "Detalles técnicos". */
  title?: string;
  className?: string;
}

/**
 * Best-effort clipboard write: Clipboard API first, legacy execCommand
 * fallback, false when neither is available. Never throws.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard) {
      await clipboard.writeText(text);
      return true;
    }
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function TechnicalDetails({ items, title = "Detalles técnicos", className }: TechnicalDetailsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [failedIndex, setFailedIndex] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const flash = (setter: (i: number | null) => void, index: number) => {
    setter(index);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setCopiedIndex(null);
      setFailedIndex(null);
    }, 2000);
  };

  const onCopy = async (index: number, value: string) => {
    const ok = await copyText(value);
    flash(ok ? setCopiedIndex : setFailedIndex, index);
  };

  return (
    <details className={clsx("group rounded-lg border border-border bg-surface", className)}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        {title}
      </summary>
      <div className="border-t border-border px-4 py-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted">Sin detalles técnicos disponibles.</p>
        ) : (
          <dl className="flex flex-col gap-3">
            {items.map((item, index) => {
              const copyable = item.copyable ?? true;
              const copied = copiedIndex === index;
              const failed = failedIndex === index;
              return (
                <div key={`${item.label}-${index}`}>
                  <dt className="text-sm font-semibold text-ink">{item.label}</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-sm text-ink">
                      {item.value}
                    </code>
                    {copyable && (
                      <button
                        type="button"
                        onClick={() => void onCopy(index, item.value)}
                        aria-label={`Copiar ${item.label}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-primary px-3 py-1 text-sm font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {copied ? "Copiado" : failed ? "No pudimos copiar" : "Copiar"}
                      </button>
                    )}
                  </dd>
                  <p aria-live="polite" className="sr-only">
                    {copied ? `${item.label} copiado al portapapeles.` : ""}
                  </p>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </details>
  );
}
