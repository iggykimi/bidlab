import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LibraryPage } from "../features/library/LibraryPage";

const router = createBrowserRouter([{ path: "/", element: <LibraryPage /> }]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
