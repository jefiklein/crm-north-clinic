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
// Using the same webhook URL as the leads page as requested
const CLIENTS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/41744e59-6dec-4583-99e1-66192db618d4`;


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

            console.log(`Fetching clients for clinic ID: ${clinicId} using webhook ${CLIENTS_WEBHOOK_URL}`);

            // Call the webhook with clinic_id AND funnel_id
            const response = await fetch(CLIENTS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ clinic_id: clinicId, funnel_id: 5 }) // Added funnel_id: 5
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
                 if (data === null) return [];
                 throw new Error("Resposta inesperada API Clientes.");
            }
            console.log("Client list received:", data.length, "items");
            return data;
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes
        refetchOnWindowFocus: false,
    });


    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
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