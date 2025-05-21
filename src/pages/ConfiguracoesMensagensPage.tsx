import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from 'lucide-react'; // Using Settings icon

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface ConfiguracoesMensagensPageProps {
    clinicData: ClinicData | null;
}

const ConfiguracoesMensagensPage: React.FC<ConfiguracoesMensagensPageProps> = ({ clinicData }) => {
    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="config-mensagens-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="content-header flex items-center justify-between mb-6">
                <h1 className="page-title text-2xl font-bold text-primary">
                    {clinicData?.nome} | Configurações de Mensagens
                </h1>
                <Settings className="h-6 w-6 text-gray-600" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Conteúdo da Página</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700">
                        Esta é a página de Configurações de Mensagens. O conteúdo será implementado com base no HTML e webhooks fornecidos.
                    </p>
                    <p className="mt-4 text-gray-600">
                        Por favor, forneça o HTML ou uma descrição detalhada da interface e os URLs dos webhooks necessários para buscar/enviar dados.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default ConfiguracoesMensagensPage;