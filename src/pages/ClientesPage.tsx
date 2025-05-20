import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client (though we'll use webhook)
import { Loader2, TriangleAlert, User } from "lucide-react"; // Icons for loading/error/placeholder
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // shadcn/ui Table components
import { format } from 'date-fns'; // For date formatting

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for client data from the webhook
interface Client {
    id: number;
    created_at: string;
    id_clinica: number;
    id_north: number | null;
    nome_north: string | null;
    telefone_north: number | null;
    cpf_north: number | null;
    sexo_north: number | null;
    data_nascimento_north: string | null; // Assuming ISO date string
    // Add other fields from north_clinic_clientes as needed
}


interface ClientesPageProps {
    clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
// TODO: Replace with the actual webhook URL for fetching clients
const CLIENTS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/SEU_WEBHOOK_DE_CLIENTES_AQUI`;


// Helper function to format phone number
function formatPhone(phone: number | string | null): string {
    if (!phone) return 'N/A';
    const s = String(phone).replace(/\D/g, '');
    if (s.length === 11) return `(${s.substring(0, 2)}) ${s.substring(2, 7)}-${s.substring(7)}`;
    if (s.length === 10) return `(${s.substring(0, 2)}) ${s.substring(2, 6)}-${s.substring(6)}`;
    return s;
}

// Helper function to format date
function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        return format(date, 'dd/MM/yyyy');
    } catch (e) {
        return 'Erro';
    }
}


const ClientesPage: React.FC<ClientesPageProps> = ({ clinicData }) => {
    const clinicId = clinicData?.id;

    // Fetch client data using react-query
    const { data: clients, isLoading, error } = useQuery<Client[]>({
        queryKey: ['clients', clinicId],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }

            console.log(`Fetching clients for clinic ID: ${clinicId}`);

            // TODO: Ensure CLIENTS_WEBHOOK_URL is configured correctly in n8n
            // It should accept a POST request with { clinic_id: clinicId }
            // and return an array of client objects from north_clinic_clientes
            const response = await fetch(CLIENTS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ clinic_id: clinicId })
            });

            console.log('Clients webhook response:', { status: response.status, statusText: response.statusText });

            if (!response.ok) {
                 let errorDetail = response.statusText;
                 try {
                    const errorBody = await response.text();
                    errorDetail = errorBody.substring(0, 200) + (errorBody.length > 200 ? '...' : '');
                    try {
                        const errorJson = JSON.parse(errorBody);
                        errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                    } catch(e) { /* ignore parse error */ }
                } catch(readError) { /* ignore read error */ }
                throw new Error(`Falha API Clientes (${response.status}): ${errorDetail}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                 console.warn("API Clientes não retornou array:", data);
                 // Depending on the webhook's expected behavior for no clients,
                 // you might return [] or throw an error. Returning [] seems safer.
                 if (data === null) return []; // Treat null response as empty
                 throw new Error("Resposta inesperada API Clientes.");
            }
            console.log("Client list received:", data.length, "items");
            return data;
        },
        enabled: !!clinicId && CLIENTS_WEBHOOK_URL !== `${N8N_BASE_URL}/webhook/SEU_WEBHOOK_DE_CLIENTES_AQUI`, // Only fetch if clinicId is available AND webhook URL is updated
        staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes
        refetchOnWindowFocus: false,
    });


    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    // Display a message if the webhook URL hasn't been updated
    if (CLIENTS_WEBHOOK_URL === `${N8N_BASE_URL}/webhook/SEU_WEBHOOK_DE_CLIENTES_AQUI`) {
         return (
             <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                 <Card className="w-full max-w-md text-center">
                     <CardHeader>
                         <TriangleAlert className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
                         <CardTitle className="text-2xl font-bold text-primary">Configuração Necessária</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p className="text-gray-700 mb-4">
                             Por favor, configure o webhook para buscar dados de clientes no n8n e atualize a constante <code>CLIENTS_WEBHOOK_URL</code> no arquivo <code>src/pages/ClientesPage.tsx</code> com o URL correto.
                         </p>
                         <p className="text-sm text-gray-500">
                             O webhook deve aceitar um POST com <code>{`{ "clinic_id": ID_DA_CLINICA }`}</code> e retornar um array de objetos da tabela <code>north_clinic_clientes</code>.
                         </p>
                     </CardContent>
                 </Card>
             </div>
         );
    }


    return (
        <div className="clientes-container max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-primary mb-4 flex-shrink-0">Clientes - {clinicData.nome}</h2>

            <Card className="flex-grow overflow-hidden">
                <CardContent className="p-0 h-full">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando clientes...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-4 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar clientes: {error.message}</span>
                            {/* Add a retry button if needed */}
                        </div>
                    ) : (clients?.length ?? 0) === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                           <User className="h-12 w-12 mb-4" />
                           <span className="text-lg text-center">Nenhum cliente encontrado para esta clínica.</span>
                       </div>
                    ) : (
                        <div className="overflow-y-auto h-full"> {/* Make table container scrollable */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Telefone</TableHead>
                                        <TableHead>CPF</TableHead>
                                        <TableHead>Nascimento</TableHead>
                                        {/* Add more headers for other relevant columns */}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {clients?.map(client => (
                                        <TableRow key={client.id}>
                                            <TableCell className="font-medium">{client.nome_north || 'N/A'}</TableCell>
                                            <TableCell>{formatPhone(client.telefone_north)}</TableCell>
                                            <TableCell>{client.cpf_north || 'N/A'}</TableCell>
                                            <TableCell>{formatDate(client.data_nascimento_north)}</TableCell>
                                            {/* Add more cells for other relevant columns */}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ClientesPage;