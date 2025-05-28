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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for aggregated cashback data per client (from the Supabase RPC function)
interface ClientCashbackBalance {
    id: number; // The client's ID from north_clinic_clientes
    nome_north: string | null; // Client's name
    telefone_north: number | null; // Client's phone number
    total_cashback: number; // Sum of active cashback values
    nearest_expiry: string | null; // Earliest expiry date (ISO string)
    // The RPC function doesn't return total_cashbacks_ativos, so we won't include it here
}


interface CashbackBalancePageProps {
    clinicData: ClinicData | null;
}

// Helper function to format date string
const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Sem Validade';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
             const parts = dateString.split('-');
             if (parts.length === 3) {
                 const [year, month, day] = parts;
                 const fallbackDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
                  if (!isNaN(fallbackDate.getTime())) {
                      return format(fallbackDate, 'dd/MM/yyyy');
                  }
             }
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
    const [sortValue, setSortValue] = useState('total_cashback_desc'); // Default sort
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 15;

    const clinicId = clinicData?.id;

    // Fetch aggregated cashback data from the Supabase RPC function
    const { data: balanceData, isLoading, error, refetch } = useQuery<ClientCashbackBalance[]>({
        queryKey: ['cashbackBalance', clinicId], // Key includes clinicId
        queryFn: async () => {
            if (!clinicId) {
                console.error("CashbackBalancePage: ID da clínica não disponível para buscar saldos.");
                throw new Error("ID da clínica não disponível para buscar saldos.");
            }

            console.log(`[CashbackBalancePage] Calling Supabase RPC 'get_clients_cashback' for clinic ${clinicId}...`);

            try {
                // Call the RPC function
                const { data, error } = await supabase.rpc('get_clients_cashback', {
                    p_clinic_id: clinicId // Pass the clinic ID as a parameter
                });

                console.log('[CashbackBalancePage] RPC response data:', data, 'error:', error);

                if (error) {
                    console.error("Cashback balance RPC error:", error);
                    throw new Error(`Erro ao buscar saldos: ${error.message}`);
                }

                // The RPC function should return an array of objects matching ClientCashbackBalance
                if (!Array.isArray(data)) {
                     console.error("Cashback balance RPC returned non-array data:", data);
                     throw new Error("Formato de resposta inesperado da função RPC.");
                }

                // Ensure numeric values are parsed correctly if needed (RPC usually handles this)
                // Also ensure telefone_north is treated as string for formatPhone
                return data.map(item => ({
                    ...item,
                    total_cashback: parseFloat(item.total_cashback as any), // Cast to any to allow parseFloat
                    telefone_north: item.telefone_north ? String(item.telefone_north) : null, // Ensure telefone is string or null
                })) as ClientCashbackBalance[]; // Cast the mapped result


            } catch (err: any) {
                console.error('Erro na chamada da função RPC de saldo de cashback:', err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 60 * 1000, // Cache data for 1 minute
        refetchOnWindowFocus: false,
    });

    // Apply filtering and sorting on the frontend
    const filteredAndSortedData = useMemo(() => {
        if (!balanceData) return [];

        const lowerSearchTerm = searchTerm.toLowerCase();
        const filtered = balanceData.filter(client => {
            const name = client.nome_north?.toLowerCase() || '';
            const phone = client.telefone_north ? String(client.telefone_north).toLowerCase() : '';
            // Filter by name or phone
            return name.includes(lowerSearchTerm) || phone.includes(lowerSearchTerm);
        });

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'total_cashback_desc':
                    return (b.total_cashback || 0) - (a.total_cashback || 0);
                case 'total_cashback_asc':
                    return (a.total_cashback || 0) - (b.total_cashback || 0);
                case 'nome_cliente_asc':
                    return (a.nome_north || '').localeCompare(b.nome_north || '');
                case 'nome_cliente_desc':
                    return (b.nome_north || '').localeCompare(a.nome_north || '');
                case 'validade_mais_proxima_asc':
                    // Treat null validity as very far in the future for sorting
                    const dateA = a.nearest_expiry ? new Date(a.nearest_expiry).getTime() : Infinity;
                    const dateB = b.nearest_expiry ? new Date(b.nearest_expiry).getTime() : Infinity;
                    return dateA - dateB;
                case 'validade_mais_proxima_desc':
                     // Treat null validity as very far in the future for sorting
                    const dateA_desc = a.nearest_expiry ? new Date(a.nearest_expiry).getTime() : Infinity;
                    const dateB_desc = b.nearest_expiry ? new Date(b.nearest_expiry).getTime() : Infinity;
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
        alert(`Detalhes do cliente ${client.nome_north || 'S/ Nome'} (ID: ${client.id}) logados no console do navegador.`);
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
                            <SelectItem value="total_cashback_desc">Saldo (Maior Primeiro)</SelectItem>
                            <SelectItem value="total_cashback_asc">Saldo (Menor Primeiro)</SelectItem>
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

            <Card className="balance-list-container">
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
                            <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
                            <span className="text-lg text-center">Nenhum cliente encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : totalItems === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
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
                                        {/* Removed "Cashbacks Ativos" column as RPC doesn't return count */}
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TooltipProvider>
                                        {paginatedData.map(client => (
                                            <TableRow key={client.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewClientDetails(client)}>
                                                <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-5 w-5 text-primary" />
                                                        {client.nome_north || "S/ Nome"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-gray-700 whitespace-nowrap">
                                                    {formatPhone(client.telefone_north)}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-green-700 whitespace-nowrap">
                                                    {client.total_cashback !== undefined && client.total_cashback !== null ?
                                                        `R$ ${client.total_cashback.toFixed(2).replace('.', ',')}` :
                                                        'R$ 0,00'
                                                    }
                                                </TableCell>
                                                <TableCell className="text-right text-gray-700 whitespace-nowrap">
                                                    {formatDate(client.nearest_expiry)}
                                                </TableCell>
                                                {/* Removed "Cashbacks Ativos" Cell */}
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewClientDetails(client); }}>
                                                        Ver Detalhes
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TooltipProvider>
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