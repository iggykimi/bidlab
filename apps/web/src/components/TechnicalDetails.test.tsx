import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TechnicalDetails, copyText, type TechnicalDetailItem } from "./TechnicalDetails";

const ITEMS: TechnicalDetailItem[] = [
  { label: "SHA-256 del PCAP", value: "abc123def456" },
  { label: "ID de licitación", value: "2026/00006554N", copyable: false },
  { label: "Fórmula", value: "P = 49 × (1 − baja)" },
];

function render(items: TechnicalDetailItem[] = ITEMS, title?: string): string {
  return renderToStaticMarkup(<TechnicalDetails items={items} title={title} />);
}

describe("TechnicalDetails", () => {
  it("renders a closed native disclosure titled Detalles técnicos", () => {
    const html = render();
    expect(html).toContain("<details");
    expect(html).not.toContain(" open");
    expect(html).toContain("<summary");
    expect(html).toContain("Detalles técnicos");
  });

  it("accepts a custom title", () => {
    expect(render(ITEMS, "Trazabilidad")).toContain("Trazabilidad");
  });

  it("hides hashes, IDs and formulas behind the disclosure", () => {
    const html = render();
    for (const item of ITEMS) {
      expect(html).toContain(item.label);
      expect(html).toContain(item.value);
    }
    // Values sit after the summary, i.e. inside the collapsible body.
    const body = html.slice(html.indexOf("</summary>"));
    expect(body).toContain("abc123def456");
  });

  it("renders a copy button per copyable item with a Spanish accessible name", () => {
    const html = render();
    expect(html).toContain('aria-label="Copiar SHA-256 del PCAP"');
    expect(html).toContain('aria-label="Copiar Fórmula"');
    expect(html).not.toContain('aria-label="Copiar ID de licitación"');
    expect(html).toContain(">Copiar<");
  });

  it("gives the summary and copy buttons 48px+ touch targets", () => {
    const html = render();
    expect(html).toContain("<summary class=\"flex min-h-[48px]");
    expect(html).toContain("min-h-[48px] min-w-[48px]");
  });

  it("renders no empty live region before copying (J2 F1)", () => {
    // The polite announcer mounts only with a message, so idle views
    // carry no silent live nodes for assistive tech to track.
    expect(render()).not.toContain("aria-live");
  });

  it("shows a Spanish empty state without copy buttons", () => {
    const html = render([]);
    expect(html).toContain("Sin detalles técnicos disponibles.");
    expect(html).not.toContain(">Copiar<");
  });
});

describe("copyText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes through the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyText("abc123")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("abc123");
  });

  it("resolves false instead of throwing when copying fails", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    await expect(copyText("abc123")).resolves.toBe(false);
  });

  it("resolves false with no clipboard and no document", async () => {
    vi.stubGlobal("navigator", undefined);
    await expect(copyText("abc123")).resolves.toBe(false);
  });
});
