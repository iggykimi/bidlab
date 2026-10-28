// Shared top bar: the mock shell, exact markup (brand + portfolio link +
// font toggle + secondary link). No h1 here (pages own the single h1).
// Links point only at real routes; there is no help page to invent.

import { useState } from "react";
import { Link } from "react-router-dom";

export function TopBar() {
  const [large, setLarge] = useState(
    () => document.documentElement.classList.contains("font-large")
  );

  function toggleFont() {
    const next = !large;
    setLarge(next);
    document.documentElement.classList.toggle("font-large", next);
  }

  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <header className="top">
        <Link to="/" className="brand">
          <span className="mark">B</span> BidLab
        </Link>
        <Link to="/" className="quiet">
          Licitaciones
        </Link>
        <span className="grow" aria-hidden="true" />
        <button
          type="button"
          id="font"
          aria-pressed={large}
          title="Aumenta el tamaño de letra"
          onClick={toggleFont}
        >
          Letra más grande · Aa
        </button>
        <Link to="/nueva-licitacion" className="quiet secondary">
          Nueva licitación
        </Link>
      </header>
      <div className="disclosure">
        Programa local · Funciona sin conexión · Sin llamadas a Meta
      </div>
    </>
  );
}
