import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import FilaMensagensPage from "./pages/FilaMensagensPage";
import UnderConstructionPage from "./pages/UnderConstructionPage";
import FunnelPage from "./pages/FunnelPage";
import AllLeadsPage from "./pages/AllLeadsPage";
import CashbackSalesPage from "./pages/CashbackSalesPage";
import ConversasPage from "./pages/ConversasPage";
import WhatsappInstancesPage from "./pages/WhatsappInstancesPage";
import MensagensListPage from "./pages/MensagensListPage";
import MensagensConfigPage from "./pages/MensagensConfigPage";
import CashbackMessagesPage from "./pages/CashbackMessagesPage";
import LeadsMessagesPage from "./pages/LeadsMessagesPage";
import MensagensSequenciaConfigPage from "./pages/MensagensSequenciaConfigPage";
import CashbackBalancePage from "./pages/CashbackBalancePage";
import FunnelConfigPage from "./pages/FunnelConfigPage";
import SelectClinicPage from "./pages/SelectClinicPage";
import UserRegistrationPage from "./pages/UserRegistrationPage";
import UserListPage from "./pages/UserListPage";
import RequestResetCodePage from "./pages/RequestResetCodePage";
import SetNewPasswordPage from "./pages/SetNewPasswordPage"; 
import ChangePasswordPage from "./pages/ChangePasswordPage"; // Import the new page
import LeadDetailPage from "./pages/LeadDetailPage"; // Import the new LeadDetailPage

import React, { useState, useEffect } from 'react';
import { useAuth } from "./contexts/AuthContext";

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  id_permissao: number;
}

const queryClient = new QueryClient();

const App = () => {
  const { clinicData, logout, isLoadingAuth, availableClinics, session } = useAuth();

  useEffect(() => {
    console.log("[App.tsx] clinicData state updated:", clinicData);
  }, [clinicData]);

  const handleLogout = () => {
    logout();
  };

  const isAppLoading = isLoadingAuth;

  if (isAppLoading) {
    return <div className="flex items-center justify-center min-h-screen text-lg font-semibold text-gray-700">Carregando aplicação...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* The Login page is now the entry point and handles its own redirects */}
          <Route path="/" element={<Login />} />

          {/* New routes for password reset by code */}
          <Route path="/request-reset-code" element={<RequestResetCodePage />} />
          <Route path="/set-new-password" element={<SetNewPasswordPage />} />
          
          {/* SelectClinicPage is a direct route */}
          <Route path="/select-clinic" element={<SelectClinicPage />} />

          {/* Protected routes: only accessible if clinicData is available */}
          {session && clinicData && clinicData.id ? (
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
              <Route path="register-user" element={<UserRegistrationPage />} />
              <Route path="15" element={<UserListPage clinicData={clinicData} />} />
              <Route path="change-password" element={<ChangePasswordPage />} /> {/* New route for ChangePasswordPage */}
              <Route path="leads/:leadId" element={<LeadDetailPage clinicData={clinicData} />} /> {/* NEW ROUTE FOR LEAD DETAIL PAGE */}
              <Route path=":funnelId" element={<FunnelPage clinicData={clinicData} />} />
              <Route path="*" element={<UnderConstructionPage />} />
            </Route>
          ) : (
            // If not authenticated or clinic not selected, redirect any /dashboard/* access to /
            <Route path="/dashboard/*" element={<Navigate to="/" replace />} />
          )}

          {/* Catch-all for 404 if no other route matches */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;