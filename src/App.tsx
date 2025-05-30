import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login"; // Updated import to Login
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout"; // Our new layout component
import DashboardPage from "./pages/DashboardPage"; // We will create this
import FilaMensagensPage from "./pages/FilaMensagensPage"; // Added import back
import UnderConstructionPage from "./pages/UnderConstructionPage"; // Import the new UnderConstructionPage
import FunnelPage from "./pages/FunnelPage"; // Import the new FunnelPage component
import AllLeadsPage from "./pages/AllLeadsPage"; // Import the new AllLeadsPage
import CashbackSalesPage from "./pages/CashbackSalesPage"; // Renamed import
import ConversasPage from "./pages/ConversasPage"; // Import the correct ConversasPage
import WhatsappInstancesPage from "./pages/WhatsappInstancesPage"; // Import the new WhatsappInstancesPage
import MensagensListPage from "./pages/MensagensListPage"; // Import the new MensagensListPage
import MensagensConfigPage from "./pages/MensagensConfigPage"; // Import the new MensagensConfigPage
import CashbackMessagesPage from "./pages/CashbackMessagesPage"; // Import the new CashbackMessagesPage
import LeadsMessagesPage from "./pages/LeadsMessagesPage"; // Import the new LeadsMessagesPage
import MensagensSequenciaConfigPage from "./pages/MensagensSequenciaConfigPage"; // Import the NEW sequence config page
import CashbackBalancePage from "./pages/CashbackBalancePage"; // Import the NEW CashbackBalancePage
import FunnelConfigPage from "./pages/FunnelConfigPage"; // Import the NEW FunnelConfigPage
import SelectClinicPage from "./pages/SelectClinicPage"; // Import the new SelectClinicPage

import React, { useState, useEffect } from 'react';

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  // acesso_crm: boolean; // Removido
  // acesso_config_msg: boolean; // Removido
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

  // Function to handle logout
  const handleLogout = () => {
    setClinicData(null);
  };

  // Simple component to protect routes
  const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    if (!clinicData || !clinicData.id) { // Check for clinicData.id to ensure a clinic is selected
      // If not logged in or no clinic selected, redirect to the login page or select-clinic page
      return <Navigate to="/" replace />;
    }
    // If logged in and clinic selected, render the children (the route component)
    return children;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* Removed BrowserRouter here */}
          <Routes>
            {/* Login Page - Renders if not logged in */}
            <Route path="/" element={clinicData ? <Navigate to="/dashboard" replace /> : <Login /* onLogin={handleLogin} */ />} />
            
            {/* Route for selecting clinic */}
            <Route path="/select-clinic" element={<SelectClinicPage />} />

            {/* Protected Routes - Require login */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  {/* Pass handleLogout to Layout */}
                  <Layout onLogout={handleLogout} clinicName={clinicData?.nome || ''} /> {/* Pass clinicName to Header */}
                </ProtectedRoute>
              }
            >
              {/* Nested routes within the Layout */}
              {/* Use path="" for the default route /dashboard */}
              {/* DashboardPage no longer needs onLogout prop as Header handles it */}
              <Route path="" element={<DashboardPage clinicData={clinicData} />} />

              {/* Route for the Fila de Mensagens page - Using menu item ID 12 */}
              <Route path="12" element={<FilaMensagensPage clinicData={clinicData} />} />

              {/* Route for the All Leads page - Using menu item ID 3 */}
              <Route path="3" element={<AllLeadsPage clinicData={clinicData} />} />

              {/* Route for the main Cashback page (now balance) - Using menu item ID 14 */}
              <Route path="14" element={<CashbackBalancePage clinicData={clinicData} />} /> {/* Changed to CashbackBalancePage */}

              {/* Nested route for Cashback Sales page under the Cashback menu item (14) */}
              <Route path="14/sales" element={<CashbackSalesPage clinicData={clinicData} />} /> {/* New route for sales */}

              {/* Nested route for Cashback Messages page under the Cashback menu item (14) */}
              <Route path="14/messages" element={<CashbackMessagesPage clinicData={clinicData} />} />

              {/* NEW Route for Cashback Balance page (removed as it's now the main 14 route) */}
              {/* <Route path="cashback/balance" element={<CashbackBalancePage clinicData={clinicData} />} /> */}


              {/* Route for the Leads Messages page - Using menu item ID 9 */}
              <Route path="9" element={<LeadsMessagesPage clinicData={clinicData} />} />

              {/* NEW Route for the Message Sequence Config page */}
              {/* This route will be used for configuring sequences for Leads */}
              <Route path="config-sequencia" element={<MensagensSequenciaConfigPage clinicData={clinicData} />} />

              {/* NEW Route for Funnel Configuration page */}
              <Route path="funnel-config/:funnelId" element={<FunnelConfigPage clinicData={clinicData} />} />


              {/* Route for the Conversas page - Using menu item ID 2 */}
              <Route path="2" element={<ConversasPage clinicData={clinicData} />} />

              {/* Route for the Whatsapp Instances page - Using menu item ID 10 */}
              <Route path="10" element={<WhatsappInstancesPage clinicData={clinicData} />} />

              {/* Route for the Mensagens List page (General) - Using menu item ID 11 */}
              <Route path="11" element={<MensagensListPage clinicData={clinicData} />} />

              {/* Route for the Message Config/Edit page (moved inside layout) */}
              {/* This route is used by *all* message list pages (General, Cashback, etc.) */}
              <Route path="config-mensagem" element={<MensagensConfigPage clinicData={clinicData} />} />

              {/* Dynamic route for all Funnel Pages (IDs 4, 5, 6, 7, 8) */}
              {/* The :funnelId parameter will be the menu item ID */}
              {/* This route should come AFTER specific routes like /dashboard/2, /dashboard/3, /dashboard/9, /dashboard/10, /dashboard/11, /dashboard/12, /dashboard/14, /dashboard/cashback/balance */}
              <Route path=":funnelId" element={<FunnelPage clinicData={clinicData} />} />

              {/* Catch-all for any other path under /dashboard */}
              {/* This must be the LAST route defined within the /dashboard group */}
              <Route path="*" element={<UnderConstructionPage />} />
            </Route>

            {/* Catch-all route for 404 outside of /dashboard */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        {/* Removed BrowserRouter here */}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;