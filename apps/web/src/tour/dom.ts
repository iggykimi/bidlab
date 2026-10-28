// Ayudas DOM del tour: clics y lecturas sobre la app real.
// Sin fixtures ocultas; si un nodo falta, el paso falla y el tour se detiene.

export function byTestId(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

export function textOf(id: string): string | null {
  const node = byTestId(id);
  if (!node) return null;
  return node.textContent?.trim() ?? null;
}

export async function waitFor(
  check: () => boolean,
  signal: AbortSignal,
  timeoutMs = 15000,
): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    if (signal.aborted) return false;
    if (check()) return true;
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

export function click(node: HTMLElement): void {
  node.scrollIntoView({ block: "center" });
  (node as HTMLButtonElement).click();
}

/** Escribe en un input controlado por React (setter nativo + evento). */
export function setInputValue(input: HTMLInputElement, value: string): void {
  // Siempre el setter nativo del prototipo: el descriptor propio del nodo es
  // el rastreador de React, y escribir a través de él hace que React ignore
  // el evento posterior (cree que nada cambió).
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function setChecked(input: HTMLInputElement, checked: boolean): void {
  if (input.checked === checked) return;
  input.click();
}
