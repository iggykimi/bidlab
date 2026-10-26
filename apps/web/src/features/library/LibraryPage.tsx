export function LibraryPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">BidLab</h1>
      <p className="mt-2">De un pliego a una decisión de oferta</p>
      {/* T19 wires the real demo load. Disabled until then: no fake success. */}
      <button type="button" data-testid="demo-load" disabled title="Disponible en T19">
        Cargar ejemplo (T19)
      </button>
    </main>
  );
}
