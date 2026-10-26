import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";

const LibraryPage = lazy(() =>
  import("../features/library/LibraryPage").then((m) => ({ default: m.LibraryPage }))
);
const WorkspacePage = lazy(() =>
  import("../features/workspace/WorkspacePage").then((m) => ({ default: m.WorkspacePage }))
);

function RouteFallback() {
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <Skeleton lines={5} label="Cargando la vista…" />
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <LibraryPage />
      </Suspense>
    ),
  },
  {
    path: "/tenders/:tenderId",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <WorkspacePage />
      </Suspense>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
