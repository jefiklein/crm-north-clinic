import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client (though we'll use webhook)
import { Loader2, TriangleAlert, User, Search, List } from "lucide-react"; // Icons for loading/error/placeholder/search/list
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // shadcn/ui Table components
import { format } from 'date-fns'; // For date formatting
import { Input } from "@/components/ui/input"; // shadcn/ui Input
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // shadcn/ui Select
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination"; // shadcn/ui Pagination
import { Button } from "@/components/ui/button"; // shadcn/ui Button

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

// Define the specific funnel ID for the Clients page as requested
const CLIENTS_FUNNEL_ID = 5;


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

    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('recent'); // Default sort by recent creation
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 15; // Number of clients per page

    // Fetch client data using react-query
    const { data: clients, isLoading, error } = useQuery<Client[]>({
        // Use a query key that includes the funnel ID, similar to FunnelPage
        queryKey: ['clients', clinicId, CLIENTS_FUNNEL_ID],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }

            console.log(`Fetching clients for clinic ID: ${clinicId}, Funnel ID: ${CLIENTS_FUNNEL_ID} using webhook ${CLIENTS_WEBHOOK_URL}`);

            // Call the webhook with clinic_id AND funnel_id
            const response = await fetch(CLIENTS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ clinic_id: clinicId, funnel_id: CLIENTS_FUNNEL_ID }) // Pass both clinic_id and funnel_id
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

    // Filter and Sort Clients
    const filteredAndSortedClients = useMemo(() => {
        if (!clients) return [];

        let filtered = clients.filter(client => {
            const searchTermLower = searchTerm.toLowerCase();
            const nameMatch = client.nome_north?.toLowerCase().includes(searchTermLower) || false;
            const phoneMatch = String(client.telefone_north || '').includes(searchTerm) || false;
            const cpfMatch = String(client.cpf_north || '').includes(searchTerm) || false;
            return nameMatch || phoneMatch || cpfMatch;
        });

        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'recent':
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
                    return dateB - dateA; // Newest first
                case 'oldest':
                    const dateA_ = a.created_at ? new Date(a.created_at).getTime() : Infinity;
                    const dateB_ = b.created_at ? new Date(b.created_at).getTime() : Infinity;
                    return dateA_ - dateB_; // Oldest first
                case 'name_asc':
                    return (a.nome_north || '').localeCompare(b.nome_north || '');
                case 'name_desc':
                    return (b.nome_north || '').localeCompare(a.nome_north || '');
                default:
                    return 0;
            }
        });

        return filtered;
    }, [clients, searchTerm, sortValue]);

    // Pagination
    const totalPages = Math.ceil(filteredAndSortedClients.length / ITEMS_PER_PAGE);
    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredAndSortedClients.slice(start, end);
    }, [filteredAndSortedClients, currentPage]);

    // Update current page if filtering/sorting reduces total pages
    useEffect(() => {
        const newTotalPages = Math.ceil(filteredAndSortedClients.length / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
            setCurrentPage(newTotalPages);
        } else if (filteredAndSortedClients.length > 0 && currentPage === 0) {
             setCurrentPage(1);
        } else if (filteredAndSortedClients.length === 0) {
             setCurrentPage(1); // Reset page if no clients
        }
    }, [filteredAndSortedClients.length, currentPage]);


    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="clientes-container max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
             <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <h2 className="page-title text-2xl font-bold text-primary whitespace-nowrap">Clientes - {clinicData.nome}</h2>
                <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                    <div className="relative flex-grow max-w-sm">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                         <Input
                            type="text"
                            placeholder="Buscar clientes (Nome, Telefone, CPF)..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9"
                         />
                    </div>
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                        {isLoading ? 'Carregando...' : `${filteredAndSortedClients.length} clientes`}
                    </span>
                    <Select value={sortValue} onValueChange={(value) => { setSortValue(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="recent">Cadastro Recente</SelectItem>
                            <SelectItem value="oldest">Cadastro Antigo</SelectItem>
                            <SelectItem value="name_asc">Nome A-Z</SelectItem>
                            <SelectItem value="name_desc">Nome Z-A</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 {/* Removed the view toggle as we're only implementing list view for clients */}
                 {/* Add a "Novo Cliente" button if needed */}
                 {/* <Button onClick={() => alert('Funcionalidade "Novo Cliente" ainda não implementada.')} className="flex-shrink-0">
                    <User className="h-4 w-4 mr-2" /> Novo Cliente
                 </Button> */}
            </div>

            <Card className="flex-grow overflow-hidden">
                <CardContent className="p-0 h-full flex flex-col"> {/* Added flex-col here */}
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
                    ) : (filteredAndSortedClients?.length ?? 0) === 0 && searchTerm !== '' ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <User className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum cliente encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : (filteredAndSortedClients?.length ?? 0) === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                           <User className="h-12 w-12 mb-4" />
                           <span className="text-lg text-center">Nenhum cliente encontrado para esta clínica.</span>
                       </div>
                    ) : (
                        <div className="overflow-y-auto flex-grow"> {/* Make table container scrollable and take available height */}
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
                                    {paginatedClients.map(client => (
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
                     {/* Pagination */}
                    {filteredAndSortedClients.length > 0 && (
                        <div className="pagination-container p-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                            <div className="pagination-info text-sm text-gray-600">
                                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                                {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedClients.length)} de {filteredAndSortedClients.length} clientes
                            </div>
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage <= 1}
                                        />
                                    </PaginationItem>
                                    {/* Simple page number display - could be enhanced */}
                                    <PaginationItem>
                                        <PaginationLink isActive>{currentPage}</PaginationLink>
                                    </PaginationItem>
                                    <PaginationItem>
                                        <PaginationNext
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage >= totalPages}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ClientesPage;