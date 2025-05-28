import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Search, DollarSign, Info, TriangleAlert, Loader2, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { cn, formatPhone } from '@/lib/utils'; // Import cn and formatPhone

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for aggregated cashback data per client (from webhook)
interface ClientCashbackBalance {
    id_cliente: number; // The client's ID from north_clinic_clientes
    nome_cliente: string | null; // Client's name
    telefone_cliente: number | null; // Client's phone number
    saldo_cashback_ativo: number; // Sum of active cashback values
    validade_mais_proxima: string | null; // Earliest expiry date (ISO string)
    total_cashbacks_ativos: number; // Count of active cashback entries for this client
}


interface CashbackBalancePageProps {
    clinicData: ClinicData | null;
}

// Placeholder webhook URL for fetching aggregated cashback data
const CASHBACK_BALANCE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/SEU-WEBHOOK-SALDO-CASHBACK'; // TODO: Replace with your actual webhook URL


// Helper function to format date string
const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Sem Validade';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
             return 'Data inválida';
        }
        return format(date, 'dd/MM/yyyy');
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Erro';
    }
};


const CashbackBalancePage: React.FC<CashbackBalancePageProps> = ({ clinicData }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('saldo_cashback_ativo_desc'); // Default sort
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 15;

    const clinicId = clinicData?.id;

    // Fetch aggregated cashback data from the webhook using react-query
    const { data: balanceData, isLoading, error, refetch } = useQuery<ClientCashbackBalance[]>({
        queryKey: ['cashbackBalance', clinicId], // Key includes clinicId
        queryFn: async () => {
            if (!clinicId) {
                console.error("CashbackBalancePage: ID da clínica não disponível para buscar saldos.");
                throw new Error("ID da clínica não disponível para buscar saldos.");
            }

            console.log(`[CashbackBalancePage] Calling webhook for cashback balance for clinic ${clinicId}...`);

            try {
                // TODO: Replace with actual fetch call to your webhook
                // The webhook should accept clinic_id and return the aggregated data
                const response = await fetch(CASHBACK_BALANCE_WEBHOOK_URL, {
                    method: 'POST', // Assuming POST method
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        id_clinica: clinicId,
                        // Add any other parameters needed by your webhook (e.g., current date for filtering active)
                    })
                });

                console.log('[CashbackBalancePage] Webhook response status:', {
                    status: response.status,
                    statusText: response.statusText
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Cashback balance webhook error response:", errorText);
                    throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
                }

                const data = await response.json();
                console.log('[CashbackBalancePage] Data received from webhook:', data);

                // Assuming the webhook returns an array of ClientCashbackBalance objects
                if (!Array.isArray(data)) {
                     console.error("Cashback balance webhook returned non-array data:", data);
                     throw new Error("Formato de resposta inesperado do webhook.");
                }

                // Filter out clients with 0 active balance if needed, or handle it in the webhook
                // For now, let's assume the webhook only returns clients with active balance > 0
                return data as ClientCashbackBalance[];

            } catch (err: any) {
                console.error('Erro na chamada ao webhook de saldo de cashback:', err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 60 * 1000, // Cache data for 1 minute
        refetchOnWindowFocus: false,
    });

    // Apply filtering and sorting on the frontend for now
    const filteredAndSortedData = useMemo(() => {
        if (!balanceData) return [];

        const lowerSearchTerm = searchTerm.toLowerCase();
        const filtered = balanceData.filter(client => {
            const name = client.nome_cliente?.toLowerCase() || '';
            const phone = client.telefone_cliente ? String(client.telefone_cliente).toLowerCase() : '';
            // Filter by name or phone
            return name.includes(lowerSearchTerm) || phone.includes(lowerSearchTerm);
        });

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'saldo_cashback_ativo_desc':
                    return (b.saldo_cashback_ativo || 0) - (a.saldo_cashback_ativo || 0);
                case 'saldo_cashback_ativo_asc':
                    return (a.saldo_cashback_ativo || 0) - (b.saldo_cashback_ativo || 0);
                case 'nome_cliente_asc':
                    return (a.nome_cliente || '').localeCompare(b.nome_cliente || '');
                case 'nome_cliente_desc':
                    return (b.nome_cliente || '').localeCompare(a.nome_cliente || '');
                case 'validade_mais_proxima_asc':
                    // Treat null validity as very far in the future for sorting
                    const dateA = a.validade_mais_proxima ? new Date(a.validade_mais_proxima).getTime() : Infinity;
                    const dateB = b.validade_mais_proxima ? new Date(b.validade_mais_proxima).getTime() : Infinity;
                    return dateA - dateB;
                case 'validade_mais_proxima_desc':
                     // Treat null validity as very far in the future for sorting
                    const dateA_desc = a.validade_mais_proxima ? new Date(a.validade_mais_proxima).getTime() : Infinity;
                    const dateB_desc = b.validade_mais_proxima ? new Date(b.validade_mais_proxima).getTime() : Infinity;
                    return dateB_desc - dateA_desc;
                default:
                    return 0; // No sort
            }
        });

        return filtered;
    }, [balanceData, searchTerm, sortValue]);

    // Apply pagination
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredAndSortedData.slice(startIndex, endIndex);
    }, [filteredAndSortedData, currentPage, ITEMS_PER_PAGE]);

    const totalItems = filteredAndSortedData.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    // Update current page if filtering/sorting reduces total pages
    useEffect(() => {
        if (totalItems > 0) {
            const newTotalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages) {
                setCurrentPage(newTotalPages);
            }
        } else if (totalItems === 0 && currentPage !== 1) {
             setCurrentPage(1);
        }
    }, [totalItems, currentPage]);

    // Handle pagination clicks
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Placeholder for viewing client details (log to console for now)
    const handleViewClientDetails = (client: ClientCashbackBalance) => {
        console.log("Detalhes do Cliente e Cashbacks:", client);
        alert(`Detalhes do cliente ${client.nome_cliente || 'S/ Nome'} (ID: ${client.id_cliente}) logados no console do navegador.`);
        // TODO: Implement navigation or modal to show detailed cashback history for this client
    };


    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="cashback-balance-container flex flex-col h-full p-6 bg-gray-100">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                    Saldo de Cashback por Cliente
                </h1>
                <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                    <div className="relative flex-grow max-w-sm">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                         <Input
                            type="text"
                            placeholder="Buscar cliente (nome, telefone)..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9"
                         />
                    </div>
                    <span id="recordsCount" className="text-sm text-gray-600 whitespace-nowrap">
                        {isLoading ? 'Carregando...' : `${totalItems} registro(s)`}
                    </span>
                    <Select value={sortValue} onValueChange={(value) => { setSortValue(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="saldo_cashback_ativo_desc">Saldo (Maior Primeiro)</SelectItem>
                            <SelectItem value="saldo_cashback_ativo_asc">Saldo (Menor Primeiro)</SelectItem>
                            <SelectItem value="nome_cliente_asc">Nome (A-Z)</SelectItem>
                            <SelectItem value="nome_cliente_desc">Nome (Z-A)</SelectItem>
                            <SelectItem value="validade_mais_proxima_asc">Validade (Mais Próxima)</SelectItem>
                            <SelectItem value="validade_mais_proxima_desc">Validade (Mais Distante)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {/* Optional: Add a button for actions like "Exportar Lista" */}
                {/* <Button variant="outline" className="flex-shrink-0">
                    <Download className="h-4 w-4 mr-2" /> Exportar Lista
                </Button> */}
            </div>

            <Card className="balance-list-container h-full flex flex-col">
                <CardContent className="p-0 flex-grow overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary p-8">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando saldos de cashback...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-8 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar saldos: {error.message}</span>
                            <Button variant="outline" onClick={() => refetch()} className="mt-4">Tentar Novamente</Button>
                        </div>
                    ) : totalItems === 0 && searchTerm !== '' ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum cliente encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : totalItems === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum cliente com saldo de cashback ativo encontrado.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto"> {/* Add overflow for smaller screens */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Telefone</TableHead>
                                        <TableHead className="text-right">Saldo Ativo</TableHead>
                                        <TableHead className="text-right">Validade Mais Próxima</TableHead>
                                        <TableHead className="text-center">Cashbacks Ativos</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedData.map(client => (
                                        <TableRow key={client.id_cliente} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewClientDetails(client)}>
                                            <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-5 w-5 text-primary" />
                                                    {client.nome_cliente || "S/ Nome"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-700 whitespace-nowrap">
                                                {formatPhone(client.telefone_cliente)}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-green-700 whitespace-nowrap">
                                                {client.saldo_cashback_ativo !== undefined && client.saldo_cashback_ativo !== null ?
                                                    `R$ ${client.saldo_cashback_ativo.toFixed(2).replace('.', ',')}` :
                                                    'R$ 0,00'
                                                }
                                            </TableCell>
                                            <TableCell className="text-right text-gray-700 whitespace-nowrap">
                                                {formatDate(client.validade_mais_proxima)}
                                            </TableCell>
                                            <TableCell className="text-center text-gray-700">
                                                {client.total_cashbacks_ativos ?? 0}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewClientDetails(client); }}>
                                                    Ver Detalhes
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                {totalItems > 0 && (
                    <div className="pagination-container p-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                        <div className="pagination-info text-sm text-gray-600">
                            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                            {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} de {totalItems} registro(s)
                        </div>
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage <= 1}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink isActive>{currentPage}</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage >= totalPages}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CashbackBalancePage;