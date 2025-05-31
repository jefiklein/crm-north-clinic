import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom"; // Import useLocation
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
import UserListPage from "./pages/UserListPage"; // Import the new page

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
  const location = useLocation(); // Initialize useLocation

  useEffect(() => {
    console.log("[App.tsx] clinicData state updated:", clinicData);
  }, [clinicData]);

  const handleLogout = () => {
    logout();
  };

  // NEW: Simplificando a condição de carregamento inicial
  const isAppLoading = isLoadingAuth;

  // Adicionando logs para depuração
  useEffect(() => {
    console.log("[App.tsx Debug] Estado de carregamento e autenticação:", {
      isLoadingAuth,
      session: !!session, // Convert to boolean for simpler logging
      clinicData: !!clinicData,
      availableClinics: availableClinics === null ? 'null' : availableClinics.length, // Log count or 'null'
      isAppLoading,
      currentPath: location.pathname
    });
  }, [isLoadingAuth, session, clinicData, availableClinics, isAppLoading, location.pathname]);


  if (isAppLoading) {
    return <div className="flex items-center justify-center min-h-screen text-lg font-semibold text-gray-700">Carregando aplicação...</div>;
  }

  // If not logged in, always redirect to login page
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} /> {/* Redireciona tudo para /login */}
      </Routes>
    );
  }

  // If logged in:
  // Determine if clinic selection is needed
  const needsClinicSelection = !clinicData || !clinicData.id || (availableClinics && availableClinics.length === 0);
  const isOnSelectClinicPage = location.pathname === '/select-clinic';

  // If clinic selection is needed AND we are NOT already on the select-clinic page, redirect there.
  if (needsClinicSelection && !isOnSelectClinicPage) {
    return <Navigate to="/select-clinic" replace />;
  }

  // If clinic is selected (or user is on select-clinic page to change it), render main app routes
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Allow access to SelectClinicPage directly, it's a top-level route */}
          <Route path="/select-clinic" element={<SelectClinicPage />} />

          {/* Redirect from root to dashboard if authenticated and clinic selected */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
            <Route path="15" element={<UserListPage clinicData={clinicData} />} /> {/* New route for UserListPage */}
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