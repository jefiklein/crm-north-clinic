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
import { useAuth } from "./contexts/AuthContext"; // Import useAuth

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
  // Use useAuth hook to get clinicData and logout function
  const { clinicData, logout, isLoadingAuth, availableClinics, session } = useAuth(); // Added availableClinics

  // Log clinicData whenever it changes in App.tsx
  useEffect(() => {
    console.log("[App.tsx] clinicData state updated:", clinicData);
  }, [clinicData]);

  // Function to handle logout (now comes from AuthContext)
  const handleLogout = () => {
    logout();
  };

  // Top-level routing logic based on authentication and clinic selection state
  if (isLoadingAuth) {
    return <div className="flex items-center justify-center min-h-screen text-lg font-semibold text-gray-700">Carregando autenticação...</div>;
  }

  // If not logged in, always redirect to login page
  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} /> {/* Catch all and redirect to login */}
      </Routes>
    );
  }

  // If logged in but no clinic selected AND there are available clinics (or none found)
  // This covers:
  // 1. User just logged in and has multiple clinics -> go to select-clinic
  // 2. User just logged in and has no clinics -> go to select-clinic (to show "no clinic associated")
  // 3. User is logged in, has a clinic selected, but explicitly navigated to /select-clinic -> allow them to stay on /select-clinic
  if (!clinicData || !clinicData.id || (availableClinics && availableClinics.length === 0)) {
    // Allow access to /select-clinic, otherwise redirect to it
    return (
      <Routes>
        <Route path="/select-clinic" element={<SelectClinicPage />} />
        <Route path="*" element={<Navigate to="/select-clinic" replace />} /> {/* Redirect any other path to select-clinic */}
      </Routes>
    );
  }

  // If logged in AND a clinic is selected, render the main application routes
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Redirect from login page if already authenticated and clinic selected */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {/* Redirect from select-clinic page if a clinic is now selected */}
          <Route path="/select-clinic" element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/dashboard"
            element={<Layout onLogout={handleLogout} />}
          >
            {/* Nested routes within the Layout */}
            <Route path="" element={<DashboardPage clinicData={clinicData} />} />
            <Route path="12" element={<FilaMensagensPage clinicData={clinicData} />} />
            <Route path="3" element={<AllLeadsPage clinicData={clinicData} />} />
            <Route path="14" element={<CashbackBalancePage clinicData={clinicData} />} />
            <Route path="14/sales" element={<CashbackSalesPage clinicData={clinicData} />} />
            <Route path="14/messages" element={<CashbackMessagesPage clinicData={clinicData} />} />
            <Route path="9" element={<LeadsMessagesPage clinicData={clinicData} />} />
            <Route path="config-sequencia" element={<MensagensSequenciaConfigPage clinicData={clinicData} />} />
            <Route path="funnel-config/:funnelId" element={<FunnelConfigPage clinicData={clinicData} />} />
            <Route path="2" element={<ConversasPage clinicData={clinicData} />} />
            <Route path="10" element={<WhatsappInstancesPage clinicData={clinicData} />} />
            <Route path="11" element={<MensagensListPage clinicData={clinicData} />} />
            <Route path="config-mensagem" element={<MensagensConfigPage clinicData={clinicData} />} />
            <Route path=":funnelId" element={<FunnelPage clinicData={clinicData} />} />
            <Route path="*" element={<UnderConstructionPage />} />
          </Route>

          {/* Catch-all for 404 if somehow outside protected routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;