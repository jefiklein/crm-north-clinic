import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface ClientesPageProps {
    clinicData: ClinicData | null;
}

const ClientesPage: React.FC<ClientesPageProps> = ({ clinicData }) => {
    if (!clinicData) {
        return <div className="text-center text-red-500">Erro: Dados da clínica não disponíveis.</div>;
    }

    return (
        <div className="clientes-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">Clientes - {clinicData.nome}</h2>
            <p className="text-gray-700 mb-6">Esta é a página de Clientes. Aqui você poderá gerenciar as informações dos clientes.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Conteúdo da Página de Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Em breve, a funcionalidade completa de gestão de clientes estará disponível aqui.</p>
                    {/* Futuramente, adicione tabelas, formulários, etc. aqui */}
                </CardContent>
            </Card>
        </div>
    );
};

export default ClientesPage;