import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Atkinson Hyperlegible Next ships with the bundle (no font CDN): the app
// runs offline, and the typeface must not depend on a network request.
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/400-italic.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource/atkinson-hyperlegible-next/800.css";
import "./styles.css";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>
);
