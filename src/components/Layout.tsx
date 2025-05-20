import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

// Define a estrutura para os dados da clínica
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface LayoutProps {
    clinicData: ClinicData | null; // Layout agora recebe clinicData
    onLogout: () => void; // Layout agora recebe onLogout
}

// This component provides the basic layout structure: Sidebar + Header + Content Area
const Layout: React.FC<LayoutProps> = ({ clinicData, onLogout }) => {
  // O Outlet renderiza a rota aninhada.
  // As props passadas para o elemento <Route element={<Layout ... />}>
  // não são automaticamente passadas para o Outlet.
  // As páginas aninhadas (Dashboard, Fila, etc.) já estão recebendo clinicData e onLogout
  // diretamente na definição da rota em App.tsx.
  // Portanto, não precisamos passar nada explicitamente para o Outlet aqui.

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Passa clinicData para que a Sidebar possa filtrar o menu */}
      <Sidebar clinicData={clinicData} />

      {/* Main Wrapper */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header - Passa clinicName e onLogout */}
        <Header clinicName={clinicData?.nome || ''} onLogout={onLogout} />

        {/* Content Area - This is where nested routes will render */}
        <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <Outlet /> {/* Renders the matched nested route component */}
        </main>
      </div>
    </div>
  );
};

export default Layout;