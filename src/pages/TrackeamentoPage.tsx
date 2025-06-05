"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Search, Loader2, TriangleAlert, Info, CalendarDays, ChevronLeft, ChevronRight, MessageSquare, User, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { cn, formatPhone } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added this import

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a single interaction
interface Interaction {
    id: number;
    created_at: string;
    interaction_type: string;
    instance_id: number | null;
    metadata: any | null;
    entry_point_app: string | null;
    entry_point_source: string | null;
    id_whatsapp: string | null;
    nome_lead: string | null;
    titulo_anuncio: string | null;
    texto_anuncio: string | null;
    midia_anuncio: string | null;
    source_id: string | null;
    source_url: string | null;
    ctwa_clid: string | null;
    data: string | null;
    hora: string | null;
    mensagem: string | null;
}

// Define the structure for a lead with aggregated interactions (from RPC function)
interface LeadWithInteractions {
    lead_id: number;
    nome_lead: string | null;
    telefone: number | null;
    remote_jid: string;
    id_etapa: number | null;
    origem: string | null;
    source_url: string | null;
    lead_score: number | null;
    created_at: string;
    avatar_url: string | null;
    interactions: Interaction[]; // Array of interactions
}

// Define the structure for Instance Info (to resolve instance_id to name)
interface InstanceInfo {
    id: number;
    nome_exibição: string;
    nome_instancia_evolution: string | null;
}

interface TrackeamentoPageProps {
    clinicData: ClinicData | null;
}

// Helper function to format date string
const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/D';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Erro';
    }
};

const TrackeamentoPage: React.FC<TrackeamentoPageProps> = ({ clinicData }) => {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState<Date>(startOfMonth(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('created_at_desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLeads, setExpandedLeads] = useState<Set<number>>(new Set()); // State for expanded lead interactions

    const ITEMS_PER_PAGE = 15;

    const clinicId = clinicData?.id;
    const currentMonthNum = currentDate.getMonth() + 1;
    const currentYearNum = currentDate.getFullYear();

    // Fetch leads with interactions using the RPC function
    const { data: leadsData, isLoading, error, refetch } = useQuery<LeadWithInteractions[]>({
        queryKey: ['trackedLeads', clinicId, currentMonthNum, currentYearNum],
        queryFn: async () => {
            if (!clinicId) {
                console.error("TrackeamentoPage: ID da clínica não disponível para buscar leads.");
                throw new Error("ID da clínica não disponível para buscar leads.");
            }

            console.log(`[TrackeamentoPage] Calling Supabase RPC 'get_leads_with_interactions_by_month' for clinic ${clinicId}, month ${currentMonthNum}, year ${currentYearNum}...`);

            try {
                const { data, error } = await supabase.rpc('get_leads_with_interactions_by_month', {
                    p_clinic_id: clinicId,
                    p_month: currentMonthNum,
                    p_year: currentYearNum
                });

                console.log('[TrackeamentoPage] RPC response data:', data, 'error:', error);

                if (error) {
                    console.error("Trackeamento RPC error:", error);
                    throw new Error(`Erro ao buscar leads: ${error.message}`);
                }

                if (!Array.isArray(data)) {
                     console.error("Trackeamento RPC returned non-array data:", data);
                     throw new Error("Formato de resposta inesperado da função RPC.");
                }

                return data as LeadWithInteractions[];

            } catch (err: any) {
                console.error('Erro na chamada da função RPC de trackeamento:', err);
                throw err;
            }
        },
        enabled: !!clinicId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch Instances (to resolve instance_id in interactions)
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListTrackeamentoPage', clinicId],
        queryFn: async () => {
            if (!clinicId) return [];
            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, nome_instancia_evolution')
                .eq('id_clinica', clinicId);
            if (error) throw new Error(`Erro ao buscar instâncias: ${error.message}`);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Map instances for quick lookup
    const instanceMap = useMemo(() => {
        const map = new Map<number, InstanceInfo>();
        instancesList?.forEach(instance => map.set(instance.id, instance));
        return map;
    }, [instancesList]);


    // Apply filtering and sorting on the frontend
    const filteredAndSortedData = useMemo(() => {
        if (!leadsData) return [];

        const lowerSearchTerm = searchTerm.toLowerCase();
        const filtered = leadsData.filter(lead => {
            const name = lead.nome_lead?.toLowerCase() || '';
            const phone = lead.telefone ? String(lead.telefone).toLowerCase() : '';
            const origin = lead.origem?.toLowerCase() || '';
            // Filter by name, phone, or origin
            return name.includes(lowerSearchTerm) || phone.includes(lowerSearchTerm) || origin.includes(lowerSearchTerm);
        });

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'created_at_desc':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'created_at_asc':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'nome_lead_asc':
                    return (a.nome_lead || '').localeCompare(b.nome_lead || '');
                case 'nome_lead_desc':
                    return (b.nome_lead || '').localeCompare(a.nome_lead || '');
                case 'interactions_desc':
                    return (b.interactions?.length || 0) - (a.interactions?.length || 0);
                case 'interactions_asc':
                    return (a.interactions?.length || 0) - (b.interactions?.length || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [leadsData, searchTerm, sortValue]);

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

    const goToPreviousMonth = () => {
        setCurrentDate(startOfMonth(subMonths(currentDate, 1)));
        setExpandedLeads(new Set()); // Reset expanded state
    };

    const goToNextMonth = () => {
        const today = startOfMonth(new Date());
        const nextMonth = startOfMonth(addMonths(currentDate, 1));
        if (!isAfter(nextMonth, today)) {
            setCurrentDate(nextMonth);
            setExpandedLeads(new Set()); // Reset expanded state
        }
    };

    const isNextMonthDisabled = !isBefore(currentDate, startOfMonth(new Date()));

    const currentMonthYear = format(currentDate, 'MMMM yyyy', { locale: ptBR }).replace(/\b\w/g, char => char.toUpperCase());

    const handleViewLeadDetails = (leadId: number) => {
        navigate(`/dashboard/leads/${leadId}`);
    };

    const toggleExpandLead = (leadId: number) => {
        setExpandedLeads(prev => {
            const newSet = new Set(prev);
            if (newSet.has(leadId)) {
                newSet.delete(leadId);
            } else {
                newSet.add(leadId);
            }
            return newSet;
        });
    };

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    const overallLoading = isLoading || isLoadingInstances;
    const overallError = error || instancesError;

    return (
        <div className="trackeamento-container flex flex-col h-full p-6 bg-gray-100">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                    Trackeamento de Leads
                </h1>
                <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                    <div className="relative flex-grow max-w-sm">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                         <Input
                            type="text"
                            placeholder="Buscar lead (nome, telefone, origem)..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9"
                         />
                    </div>
                    <span id="recordsCount" className="text-sm text-gray-600 whitespace-nowrap">
                        {overallLoading ? 'Carregando...' : `${totalItems} registro(s)`}
                    </span>
                    <Select value={sortValue} onValueChange={(value) => { setSortValue(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="created_at_desc">Cadastro (Mais Recente)</SelectItem>
                            <SelectItem value="created_at_asc">Cadastro (Mais Antigo)</SelectItem>
                            <SelectItem value="nome_lead_asc">Nome (A-Z)</SelectItem>
                            <SelectItem value="nome_lead_desc">Nome (Z-A)</SelectItem>
                            <SelectItem value="interactions_desc">Interações (Mais)</SelectItem>
                            <SelectItem value="interactions_asc">Interações (Menos)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="date-navigation flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="icon" onClick={goToPreviousMonth} title="Mês Anterior">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <strong id="monthYearDisplay" className="text-lg font-bold text-primary whitespace-nowrap">
                        {currentMonthYear}
                    </strong>
                    <Button variant="outline" size="icon" onClick={goToNextMonth} disabled={isNextMonthDisabled} title="Próximo Mês">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Card className="leads-list-container">
                <CardContent className="p-0 flex-grow overflow-y-auto">
                    {overallLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary p-8">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando leads e interações...</span>
                        </div>
                    ) : overallError ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-8 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar leads: {overallError.message}</span>
                            <Button variant="outline" onClick={() => refetch()} className="mt-4">Tentar Novamente</Button>
                        </div>
                    ) : totalItems === 0 && searchTerm !== '' ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
                            <span className="text-lg text-center">Nenhum lead encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : totalItems === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
                            <span className="text-lg text-center">Nenhum lead encontrado para {currentMonthYear}.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lead</TableHead>
                                        <TableHead>Origem</TableHead>
                                        <TableHead>Cadastro</TableHead>
                                        <TableHead className="text-center">Interações</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedData.map(lead => {
                                        const isLeadExpanded = expandedLeads.has(lead.lead_id);
                                        return (
                                            <React.Fragment key={lead.lead_id}>
                                                <TableRow className="hover:bg-gray-50 cursor-pointer">
                                                    <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-5 w-5 text-primary" />
                                                            {lead.nome_lead || "S/ Nome"}
                                                            <span className="text-sm text-gray-500 ml-2">{formatPhone(lead.telefone)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-gray-700 whitespace-nowrap">{lead.origem || 'N/D'}</TableCell>
                                                    <TableCell className="text-gray-700 whitespace-nowrap">{formatDate(lead.created_at)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => toggleExpandLead(lead.lead_id)}
                                                            className="flex items-center gap-1 mx-auto"
                                                        >
                                                            <MessageSquare className="h-4 w-4" /> {lead.interactions?.length || 0}
                                                            {isLeadExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => handleViewLeadDetails(lead.lead_id)}>
                                                            Ver Detalhes
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                                {isLeadExpanded && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="p-0">
                                                            <Collapsible open={isLeadExpanded}>
                                                                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                                                                    <div className="bg-gray-50 p-4 border-t border-b border-gray-200">
                                                                        <h4 className="text-md font-semibold mb-3 text-gray-800">Interações de {lead.nome_lead || 'este lead'}</h4>
                                                                        {lead.interactions && lead.interactions.length > 0 ? (
                                                                            <ScrollArea className="h-48 border rounded-md p-2 bg-white">
                                                                                <div className="space-y-3">
                                                                                    {lead.interactions.map((interaction, idx) => {
                                                                                        const instanceName = interaction.instance_id ? instanceMap.get(interaction.instance_id)?.nome_exibição || `ID ${interaction.instance_id}` : 'N/D';
                                                                                        return (
                                                                                            <div key={idx} className="border-b pb-2 last:border-b-0">
                                                                                                <p className="text-sm font-medium text-gray-700">
                                                                                                    Tipo: <span className="font-normal">{interaction.interaction_type.replace(/_/g, ' ')}</span>
                                                                                                </p>
                                                                                                <p className="text-xs text-gray-600">
                                                                                                    Data: <span className="font-normal">{formatDate(interaction.created_at)}</span>
                                                                                                </p>
                                                                                                {interaction.instance_id && (
                                                                                                    <p className="text-xs text-gray-600">
                                                                                                        Instância: <span className="font-normal">{instanceName}</span>
                                                                                                    </p>
                                                                                                )}
                                                                                                {interaction.source_url && (
                                                                                                    <p className="text-xs text-gray-600">
                                                                                                        URL: <a href={interaction.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{interaction.source_url}</a>
                                                                                                    </p>
                                                                                                )}
                                                                                                {interaction.mensagem && (
                                                                                                    <p className="text-xs text-gray-600">
                                                                                                        Mensagem: <span className="font-normal">{interaction.mensagem}</span>
                                                                                                    </p>
                                                                                                )}
                                                                                                {interaction.metadata && Object.keys(interaction.metadata).length > 0 && (
                                                                                                    <p className="text-xs text-gray-600">
                                                                                                        Metadata: <span className="font-normal">{JSON.stringify(interaction.metadata)}</span>
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </ScrollArea>
                                                                        ) : (
                                                                            <div className="text-center text-gray-600 text-sm py-4">Nenhuma interação registrada para este lead no período.</div>
                                                                        )}
                                                                    </div>
                                                                </CollapsibleContent>
                                                            </Collapsible>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
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

export default TrackeamentoPage;