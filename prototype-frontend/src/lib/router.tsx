import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import React from "react";

import { useAuth } from "@/context/AuthContext";

const SubstationDashboard = React.lazy(
  () => import("@/pages/SubstationDashboard")
);
const PoiComparison = React.lazy(
  () => import("@/pages/Comparison/PoiComparison")
);
const LMPPage = React.lazy(() => import("@/pages/LMP/LMPDashboard"));
import { SignInPage } from "@/pages/SignIn";

import Layout from "@/components/Layout/layout";
import { DisclaimerModal } from "@/components/Disclaimer";
import Error404 from "@/pages/Error404";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <PublicRoute>
        <Outlet />
      </PublicRoute>
    ),
    children: [
      {
        path: "login",
        element: <SignInPage />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout>
          <DisclaimerModal />
          <Outlet />
        </Layout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <SubstationDashboard /> },
      { path: "lmp", element: <LMPPage /> },
      { path: "poi-comparison", element: <PoiComparison /> },
    ],
  },
  {
    path: "*",
    element: <Error404 />,
  },
]);

export default router;
