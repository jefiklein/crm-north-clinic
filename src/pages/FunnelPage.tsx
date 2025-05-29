import React from 'react';
import { useParams } from 'react-router-dom';
import UnderConstructionPage from './UnderConstructionPage'; // Import UnderConstructionPage

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface FunnelPageProps {
    clinicData: ClinicData | null;
}

// Mapping from menu item ID (from URL) to actual funnel ID (for database queries)
const menuIdToFunnelIdMap: { [key: number]: number } = {
    4: 1, // Funil de Vendas
    5: 2, // Funil de Recuperação
    6: 3, // Funil de Faltas
    7: 4, // Funil Compareceram
    8: 5, // Clientes
};

const FunnelPage: React.FC<FunnelPageProps> = ({ clinicData }) => {
    const { funnelId: menuIdParam } = useParams<{ funnelId: string }>();
    const menuId = parseInt(menuIdParam || '0', 10);
    const funnelIdForQuery = menuIdToFunnelIdMap[menuId];

    const isInvalidFunnel = !clinicData || isNaN(menuId) || funnelIdForQuery === undefined;

    if (isInvalidFunnel) {
        return <UnderConstructionPage />;
    }

    return (
        <div className="p-4">
            <h1>Funnel Page - Teste</h1>
            <p>Clinic: {clinicData?.nome}</p>
            <p>Funnel ID: {funnelIdForQuery}</p>
        </div>
    );
};

export default FunnelPage;