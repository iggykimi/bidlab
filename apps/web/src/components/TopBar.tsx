// Shared top bar (mock shell: brand + portfolio link + comfort font toggle).
// No h1 here (pages own the single h1; qa-visual pins the count).

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
    <header className="top">
      <div className="bar">
        <Link to="/" className="brand">
          <span className="mark" aria-hidden="true">
            B
          </span>
          BidLab
        </Link>
        <nav aria-label="Principal">
          <Link to="/">Licitaciones</Link>
          <button
            type="button"
            className="fontbtn"
            aria-pressed={large}
            title="Aumenta el tamaño de letra"
            onClick={toggleFont}
          >
            <span className="label">Letra más grande · </span>
            <span className="aa">Aa</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
