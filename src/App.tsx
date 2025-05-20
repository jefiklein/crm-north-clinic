import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import DashboardPage from './pages/DashboardPage';
import FilaMensagensPage from './pages/FilaMensagensPage';
import FunnelPage from './pages/FunnelPage';
import ClientesPage from './pages/ClientesPage';
import NotFound from './pages/NotFound';
import UnderConstructionPage from './pages/UnderConstructionPage';
import Layout from './components/Layout';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

// Define a estrutura para os dados da clínica
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

function App() {
  // Estado para armazenar os dados da clínica logada
  const [clinicData, setClinicData] = useState<ClinicData | null>(() => {
    // Tenta carregar os dados da clínica do localStorage ao iniciar
    const savedClinicData = localStorage.getItem('clinicData');
    return savedClinicData ? JSON.parse(savedClinicData) : null;
  });

  // Efeito para salvar clinicData no localStorage sempre que ele mudar
  useEffect(() => {
    if (clinicData) {
      localStorage.setItem('clinicData', JSON.stringify(clinicData));
    } else {
      localStorage.removeItem('clinicData');
    }
  }, [clinicData]);


  // Função para lidar com o login bem-sucedido
  const handleLogin = (data: ClinicData) => {
    setClinicData(data);
  };

  // Função para lidar com o logout
  const handleLogout = () => {
    setClinicData(null);
  };

  return (
    <Router>
      <Routes>
        {/* Rota para a página de login */}
        <Route path="/" element={
          clinicData ? ( // Se já estiver logado, redireciona para o dashboard
            <Navigate to="/dashboard" replace />
          ) : ( // Se não estiver logado, mostra a página de login
            <Index onLogin={handleLogin} />
          )
        } />

        {/* Rotas protegidas que usam o Layout */}
        <Route element={
          clinicData ? ( // Se estiver logado, mostra o Layout
            <Layout clinicData={clinicData} onLogout={handleLogout} />
          ) : ( // Se não estiver logado, redireciona para a página de login
            <Navigate to="/" replace />
          )
        }>
          {/* Rotas aninhadas dentro do Layout */}
          {/* Passamos clinicData como prop para as páginas que precisam */}
          <Route path="/dashboard" element={<DashboardPage clinicData={clinicData} onLogout={handleLogout} />} />
          {/* A rota /dashboard/:id não parece ser usada para carregar dados diferentes,
              então podemos removê-la ou mantê-la redirecionando para /dashboard se necessário.
              Por enquanto, vamos mantê-la, mas a DashboardPage só usará clinicData. */}
          <Route path="/dashboard/:id" element={<DashboardPage clinicData={clinicData} onLogout={handleLogout} />} />
          <Route path="/fila-mensagens" element={<FilaMensagensPage clinicData={clinicData} />} />
          {/* A página de Funil precisa do ID do funil E dos dados da clínica */}
          <Route path="/funil/:funnelId" element={<FunnelPage clinicData={clinicData} />} />
          <Route path="/clientes" element={<ClientesPage clinicData={clinicData} />} />
          <Route path="/under-construction" element={<UnderConstructionPage />} />
        </Route>

        {/* Rota para 404 - Página não encontrada */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster /> {/* Adiciona o Toaster para exibir as notificações */}
    </Router>
  );
}

export default App;