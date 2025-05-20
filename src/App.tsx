import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import DashboardPage from './pages/DashboardPage';
import FilaMensagensPage from './pages/FilaMensagensPage';
import FunnelPage from './pages/FunnelPage';
import ClientesPage from './pages/ClientesPage'; // <-- Importação correta
import NotFound from './pages/NotFound';
import UnderConstructionPage from './pages/UnderConstructionPage';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/:id" element={<DashboardPage />} />
          <Route path="/fila-mensagens" element={<FilaMensagensPage />} />
          <Route path="/funil/:funnelId" element={<FunnelPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/under-construction" element={<UnderConstructionPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App; // <-- Exportação padrão correta