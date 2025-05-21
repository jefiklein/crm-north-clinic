import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index"; // This will be our Login page
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout"; // Our new layout component
import DashboardPage from "./pages/DashboardPage"; // We will create this
import FilaMensagensPage from "./pages/FilaMensagensPage"; // Added import back
import UnderConstructionPage from "./pages/UnderConstructionPage"; // Import the new UnderConstructionPage
import FunnelPage from "./pages/FunnelPage"; // Import the new FunnelPage component
import AllLeadsPage from "./pages/AllLeadsPage"; // Import the new AllLeadsPage
import CashbackPage from "./pages/CashbackPage"; // Import the new CashbackPage
import ConversasPage from "./pages/ConversasPage"; // Import the correct ConversasPage

import React, { useState, useEffect } from 'react';

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

const queryClient = new QueryClient();

const App = () => {
  // State to hold clinic data and manage login status
  const [clinicData, setClinicData] = useState<ClinicData | null>(() => {
    // Initialize state from localStorage on mount
    const savedData = localStorage.getItem('clinicData');
    try {
      return savedData ? JSON.parse(savedData) : null;
    } catch (e) {
      console.error("Failed to parse clinicData from localStorage", e);
      return null;
    }
  });

  // Effect to update localStorage whenever clinicData changes
  useEffect(() => {
    if (clinicData) {
      localStorage.setItem('clinicData', JSON.stringify(clinicData));
    } else {
      localStorage.removeItem('clinicData');
    }
  }, [clinicData]);

  // Function to handle successful login
  const handleLogin = (data: ClinicData) => {
    setClinicData(data);
  };

  // Function to handle logout
  const handleLogout = () => {
    setClinicData(null);
  };

  // Simple component to protect routes
  const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    if (!clinicData || !clinicData.code) {
      // If not logged in, redirect to the login page
      return <Navigate to="/" replace />;
    }
    // If logged in, render the children (the route component)
    return children;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login Page - Renders if not logged in */}
            <Route path="/" element={clinicData ? <Navigate to="/dashboard" replace /> : <Index onLogin={handleLogin} />} />

            {/* Protected Routes - Require login */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout /> {/* Layout contains Sidebar, Header, and Outlet */}
                </ProtectedRoute>
              }
            >
              {/* Nested routes within the Layout */}
              {/* Use path="" for the default route /dashboard */}
              <Route path="" element={<DashboardPage clinicData={clinicData} onLogout={handleLogout} />} />

              {/* Route for the Fila de Mensagens page - Using menu item ID 12 */}
              <Route path="12" element={<FilaMensagensPage clinicData={clinicData} />} />

              {/* Route for the All Leads page - Using menu item ID 3 */}
              <Route path="3" element={<AllLeadsPage clinicData={clinicData} />} />

              {/* Route for the Cashback page - Using menu item ID 14 */}
              <Route path="14" element={<CashbackPage clinicData={clinicData} />} />

              {/* Route for the Conversas page - Using menu item ID 2 */}
              <Route path="2" element={<ConversasPage clinicData={clinicData} />} />


              {/* Dynamic route for all Funnel Pages (IDs 4, 5, 6, 7, 8) */}
              {/* The :funnelId parameter will be the menu item ID */}
              {/* This route should come AFTER specific routes like /dashboard/2, /dashboard/3, /dashboard/12, /dashboard/14 */}
              <Route path=":funnelId" element={<FunnelPage clinicData={clinicData} />} />


              {/* Catch-all for any other path under /dashboard */}
              {/* This must be the LAST route defined within the /dashboard group */}
              <Route path="*" element={<UnderConstructionPage />} />
            </Route>

            {/* Catch-all route for 404 outside of /dashboard */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;