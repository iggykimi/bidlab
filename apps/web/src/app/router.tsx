import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LibraryPage } from "../features/library/LibraryPage";
import { WorkspacePage } from "../features/workspace/WorkspacePage";

const router = createBrowserRouter([
  { path: "/", element: <LibraryPage /> },
  { path: "/tenders/:tenderId", element: <WorkspacePage /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
