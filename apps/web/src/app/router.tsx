import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";
import { TopBar } from "../components/TopBar";

const LibraryPage = lazy(() =>
  import("../features/library/LibraryPage").then((m) => ({ default: m.LibraryPage }))
);
const WorkspacePage = lazy(() =>
  import("../features/workspace/WorkspacePage").then((m) => ({ default: m.WorkspacePage }))
);
const IntakePage = lazy(() =>
  import("../features/intake/IntakePage").then((m) => ({ default: m.IntakePage }))
);

function RouteFallback() {
  // Shell already rendered the top bar above this fallback.
  return (
    <main id="main" className="wrap">
      <Skeleton lines={5} label="Cargando la vista…" />
    </main>
  );
}

// Mock shell (skip link + top bar + disclosure) above every route. Pages
// keep their own <main id="main">; unported pages keep their own skip link
// too until their views adopt the shell target.
function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Shell>
        <Suspense fallback={<RouteFallback />}>
          <LibraryPage />
        </Suspense>
      </Shell>
    ),
  },
  {
    path: "/nueva-licitacion",
    element: (
      <Shell>
        <Suspense fallback={<RouteFallback />}>
          <IntakePage />
        </Suspense>
      </Shell>
    ),
  },
  {
    path: "/tenders/:tenderId",
    element: (
      <Shell>
        <Suspense fallback={<RouteFallback />}>
          <WorkspacePage />
        </Suspense>
      </Shell>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
