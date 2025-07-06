import React from "react";

import { RouterProvider } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/context/AuthContext";

import router from "@/lib/router";
import Skeleton from "./components/Animation/Skeleton";

const queryClient = new QueryClient();

function App() {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </React.Suspense>
  );
}

export default App;
