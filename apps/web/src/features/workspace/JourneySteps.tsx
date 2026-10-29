import { Link } from "react-router-dom";

const STEPS = [
  { tab: "requisitos", title: "Revisa los requisitos", detail: "Comprueba qué puedes acreditar.", icon: "M9 4H4v24h24V9H18V4Zm9 0v8h10M9 18h14M9 23h9" },
  { tab: "precio", title: "Prueba precios", detail: "Compara puntos y beneficio.", icon: "M5 4v24h24M9 23l6-8 6 3 8-12M24 6h5v5" },
  { tab: "informe", title: "Guarda tu decisión", detail: "Conserva tu prueba y sus fuentes.", icon: "M8 4h13l6 6v18H8ZM21 4v7h6M12 16h10M12 21h6" },
] as const;

/** Three task links, not a fabricated completion indicator. */
export function JourneySteps() {
  return (
    <ol className="summary-journey" aria-label="Tu recorrido en tres pasos">
      {STEPS.map((step, index) => (
        <li key={step.tab}>
          <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={step.icon} />
          </svg>
          <div>
            <span className="journey-number" aria-hidden="true">0{index + 1}</span>
            <Link to={`?tab=${step.tab}`}>{step.title}<span aria-hidden="true"> →</span></Link>
            <p>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
