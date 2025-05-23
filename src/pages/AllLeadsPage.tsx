import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Search, List, Star, User, Info, TriangleAlert, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import { cn, formatPhone } from '@/lib/utils'; // Import cn and formatPhone
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for Funnel Stages (from Supabase)
interface FunnelStage {
    id: number;
    nome_etapa: string;
    ordem: number | null;
    id_funil: number;
}

// Define the structure for Funnel Details (from Supabase)
interface FunnelDetails {
    id: number;
    nome_funil: string;
}

// Define the structure for Leads fetched from Supabase
interface SupabaseLead {
    id: number;
    nome_lead: string | null;
    telefone: number | null;
    id_etapa: number | null;
    origem: string | null;
    lead_score: number | null;
    // interesses: string | null; // Removed interests property
    created_at: string; // ISO timestamp from DB
    sourceUrl?: string | null; // Optional source URL
    // id_funil is not directly in north_clinic_leads_API, derived from id_etapa
}


interface AllLeadsPageProps {
    clinicData: ClinicData | null;
}

// Removed webhook URLs, fetching directly from Supabase now
// const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
// const ALL_STAGES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/43323d0c-2855-4a8c-8a4e-c38e2e801440`;
// const ALL_FUNNELS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/f95a53c6-7e87-4139-8d0b-cc3d26489f4a`;
const LEAD_DETAILS_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/9c8216dd-f489-464e-8ce4-45c226489fa'; // Keep this for opening lead details


// Helper functions (adapted from HTML)
// formatPhone moved to utils.ts

function renderStars(score: number | null): JSX.Element[] {
    const stars = [];
    // Assuming score is out of 10 based on HTML, but rendering 5 stars
    const numScore = score ? Math.min(5, Math.max(0, Math.round(score / 2))) : 0; // Adjusting for 5 stars
    for (let i = 1; i <= 5; i++) {
        stars.push(<Star key={i} className={cn("h-3 w-3", i <= numScore ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />);
    }
    return stars;
}

// Removed renderInterests as interests are not fetched in this query


function formatLeadTimestamp(iso: string | null): string {
    if (!iso) return 'N/D';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return 'Inválida';
        return format(d, 'dd/MM/yyyy');
    } catch (e) {
        return 'Erro';
    }
}

function openLeadDetails(phone: number | string | null) {
    if (!phone) return;
    const clean = String(phone).replace(/\D/g, '');
    if (clean) {
        // Open in a new tab
        window.open(`${LEAD_DETAILS_WEBHOOK_URL}?phone=${clean}`, '_blank');
    }
}


const AllLeadsPage: React.FC<AllLeadsPageProps> = ({ clinicData }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('created_at_desc'); // Use DB column name + direction
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 15;

    const clinicId = clinicData?.id;

    // Fetch All Stages directly from Supabase (for displaying stage names) - REMOVED id_clinica filter
    const { data: allStages, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
        queryKey: ['allStages'], // Removed clinicId from key
        queryFn: async () => {
            // No clinicId filter needed here based on schema
            console.log(`AllLeadsPage: Fetching all stages from Supabase...`);

            const { data, error } = await supabase
                .from('north_clinic_crm_etapa')
                .select('id, nome_etapa, ordem, id_funil') // Select necessary fields
                // REMOVED: .eq('id_clinica', clinicId)
                .order('ordem', { ascending: true }); // Order by 'ordem'

            console.log("AllLeadsPage: Supabase all stages fetch result - data:", data, "error:", error);

            if (error) {
                console.error("AllLeadsPage: Supabase all stages fetch error:", error);
                throw new Error(`Erro ao buscar etapas: ${error.message}`);
            }

            if (!data || !Array.isArray(data)) {
                 console.warn("AllLeadsPage: Supabase all stages fetch returned non-array data:", data);
                 return []; // Return empty array if data is null or not an array
            }

            return data as FunnelStage[];
        },
        enabled: true, // Always enabled as no clinicId filter is needed
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch All Funnels directly from Supabase (for displaying funnel names) - REMOVED id_clinica filter
    const { data: allFunnelDetails, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
        queryKey: ['allFunnels'], // Removed clinicId from key
        queryFn: async () => {
            // No clinicId filter needed here based on schema
            console.log(`AllLeadsPage: Fetching all funnels from Supabase...`);

            const { data, error } = await supabase
                .from('north_clinic_crm_funil')
                .select('id, nome_funil') // Select necessary fields
                // REMOVED: .eq('id_clinica', clinicId)
                .order('nome_funil', { ascending: true }); // Order by name

            console.log("AllLeadsPage: Supabase all funnels fetch result - data:", data, "error:", error);

            if (error) {
                console.error("AllLeadsPage: Supabase all funnels fetch error:", error);
                throw new Error(`Erro ao buscar funis: ${error.message}`);
            }

            if (!data || !Array.isArray(data)) {
                 console.warn("AllLeadsPage: Supabase all funnels fetch returned non-array data:", data);
                 return []; // Return empty array if data is null or not an array
            }

            return data as FunnelDetails[];
        },
        enabled: true, // Always enabled as no clinicId filter is needed
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });


    // Map stages and funnels for quick lookup (uses the fetched data)
    const stageMap = useMemo(() => {
        const map = new Map<number, FunnelStage>();
        allStages?.forEach(stage => map.set(stage.id, stage));
        return map;
    }, [allStages]);

    const funnelMap = useMemo(() => {
        const map = new Map<number, FunnelDetails>();
        allFunnelDetails?.forEach(funnel => map.set(funnel.id, funnel));
        return map;
    }, [allFunnelDetails]);

    // Get Stage and Funnel Info Helper (uses the maps)
    const getStageAndFunnelInfo = (idEtapa: number | null): { etapa: string, funil: string, etapaClass: string, funilClass: string } => {
        let stageInfo = { etapa: 'Não definida', funil: 'Não definido', etapaClass: '', funilClass: '' };
        if (idEtapa !== null) {
            const stage = stageMap.get(idEtapa);
            if (stage) {
                stageInfo.etapa = stage.nome_etapa || 'Sem nome';
                if (stage.id_funil !== null) {
                    const funnel = funnelMap.get(stage.id_funil);
                    if (funnel) {
                        stageInfo.funil = funnel.nome_funil || 'Sem nome';
                    }
                }

                // Determine classes based on names (simplified from HTML)
                const etapaLower = stageInfo.etapa.toLowerCase();
                if (etapaLower.includes('novo') || etapaLower.includes('lead')) { stageInfo.etapaClass = 'bg-blue-100 text-blue-800 border border-blue-800'; }
                else if (etapaLower.includes('agendado')) { stageInfo.etapaClass = 'bg-purple-100 text-purple-800 border border-purple-800'; } // Using purple for scheduled
                else if (etapaLower.includes('qualificação')) { stageInfo.etapaClass = 'bg-orange-100 text-orange-800 border border-orange-800'; } // Using orange for qualified
                else { stageInfo.etapaClass = 'bg-gray-100 text-gray-800 border border-gray-800'; } // Default

                const funnelLower = stageInfo.funil.toLowerCase();
                 if (funnelLower.includes('vendas')) { stageInfo.funnelClass = 'bg-green-100 text-green-800 border border-green-800'; } // Using green for sales
                 else if (funnelLower.includes('recuperação')) { stageInfo.funnelClass = 'bg-red-100 text-red-800 border border-red-800'; } // Using red for recovery
                 else if (funnelLower.includes('compareceram')) { stageInfo.funnelClass = 'bg-yellow-100 text-yellow-800 border border-yellow-800'; } // Using yellow for compareceram
                 else { stageInfo.funilClass = 'bg-gray-100 text-gray-800 border border-gray-800'; } // Default
            }
        }
        return stageInfo;
    };


    // Fetch Paginated, Filtered, and Sorted Leads from Supabase (already doing this)
    const { data: paginatedLeadsData, isLoading: isLoadingLeads, error: leadsError } = useQuery<{ leads: SupabaseLead[], totalCount: number } | null>({
        queryKey: ['paginatedLeads', clinicId, currentPage, ITEMS_PER_PAGE, searchTerm, sortValue],
        queryFn: async () => {
            if (!clinicId) {
                console.error("AllLeadsPage: ID da clínica não disponível para buscar leads.");
                throw new Error("ID da clínica não disponível para buscar leads.");
            }

            console.log(`[AllLeadsPage] Fetching leads from Supabase with parameters:`, {
                clinicId,
                currentPage,
                ITEMS_PER_PAGE,
                searchTerm,
                sortValue
            });

            let query = supabase
                .from('north_clinic_leads_API')
                // Removed 'interesses' from the select list
                .select('id, nome_lead, telefone, id_etapa, origem, lead_score, created_at, sourceUrl', { count: 'exact' }) // Request exact count
                .eq('id_clinica', clinicId); // Filter by clinic ID - KEEP THIS

            // Apply filtering if searchTerm is not empty
            if (searchTerm) {
                const searchTermLower = searchTerm.toLowerCase();
                // Note: 'telefone::text' is the correct way to cast to text for ilike in Supabase/Postgres
                query = query.or(`nome_lead.ilike.%${searchTermLower}%,telefone::text.ilike.%${searchTerm}%,origem.ilike.%${searchTermLower}%`);
                 console.log(`[AllLeadsPage] Applying search filter: nome_lead ILIKE '%${searchTermLower}%' OR telefone::text ILIKE '%${searchTerm}%' OR origem ILIKE '%${searchTermLower}%'`);
            }

            // Apply sorting
            let orderByColumn = 'created_at';
            let ascending = false; // Default to recent (descending created_at)

            switch (sortValue) {
                case 'created_at_desc':
                    orderByColumn = 'created_at';
                    ascending = false;
                    break;
                case 'created_at_asc':
                    orderByColumn = 'created_at';
                    ascending = true;
                    break;
                case 'nome_lead_asc':
                    orderByColumn = 'nome_lead';
                    ascending = true;
                    break;
                case 'nome_lead_desc':
                    orderByColumn = 'nome_lead';
                    ascending = false;
                    break;
                default:
                    // Default sort is already set
                    break;
            }

            query = query.order(orderByColumn, { ascending: ascending });
            console.log(`[AllLeadsPage] Applying sort: order by ${orderByColumn} ${ascending ? 'ASC' : 'DESC'}`);


            // Apply pagination
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE - 1;
            query = query.range(startIndex, endIndex);
            console.log(`[AllLeadsPage] Applying pagination: range from ${startIndex} to ${endIndex}`);


            const { data, error, count } = await query;

            console.log('[AllLeadsPage] Supabase fetch result:', { data, error, count });

            if (error) {
                console.error("[AllLeadsPage] Supabase fetch error:", error);
                throw new Error(`Erro ao buscar leads: ${error.message}`);
            }

            if (count === null) {
                 console.warn("[AllLeadsPage] Supabase count is null.");
                 // Decide how to handle null count - maybe assume data.length if count is not critical for this view?
                 // For now, let's return 0 for count if null, to allow rendering with available data.
            }


            return { leads: data || [], totalCount: count ?? 0 }; // Return data and count

        },
        enabled: !!clinicId && !!allStages && !!allFunnelDetails, // Enable only if clinicId, stages, and funnels are available
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
    });

    // Combine loading states and errors (include stages and funnels)
    const isLoading = isLoadingLeads || isLoadingStages || isLoadingFunnels;
    const fetchError = leadsError || stagesError || funnelsError;

    // Data for rendering is now directly from paginatedLeadsData
    const leadsToDisplay = paginatedLeadsData?.leads || [];
    const totalItems = paginatedLeadsData?.totalCount ?? 0;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);


    // Update current page if filtering/sorting reduces total pages
    useEffect(() => {
        // Only adjust if totalItems is loaded and greater than 0
        if (totalItems > 0) {
            const newTotalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages) {
                setCurrentPage(newTotalPages);
            }
        } else if (totalItems === 0 && currentPage !== 1) {
             // If no items match filter, reset to page 1
             setCurrentPage(1);
        }
         // No need to reset page if totalItems is 0 and currentPage is already 1
    }, [totalItems, currentPage]);


    // Handle pagination clicks
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="all-leads-container flex flex-col h-full p-6 bg-gray-100">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                    {clinicData?.nome} | Todos os Leads
                </h1>
                <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                    <div className="relative flex-grow max-w-sm">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                         <Input
                            type="text"
                            placeholder="Buscar leads (nome, telefone, origem...)"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9"
                         />
                    </div>
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                        {isLoading ? 'Carregando...' : `${totalItems} registros`}
                    </span>
                    <Select value={sortValue} onValueChange={(value) => { setSortValue(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="created_at_desc">Cadastro mais recente</SelectItem>
                            <SelectItem value="created_at_asc">Cadastro mais antigo</SelectItem>
                            <SelectItem value="nome_lead_asc">Nome (A-Z)</SelectItem>
                            <SelectItem value="nome_lead_desc">Nome (Z-A)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => alert('Funcionalidade "Novo Lead" ainda não implementada.')} className="flex-shrink-0">
                    <User className="h-4 w-4 mr-2" /> Novo Lead
                </Button>
            </div>

            <Card className="leads-list-container h-full flex flex-col">
                <CardContent className="p-0 flex-grow overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary p-8">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando leads...</span>
                        </div>
                    ) : fetchError ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-8 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar leads: {fetchError.message}</span>
                            {/* Add a retry button if needed */}
                        </div>
                    ) : totalItems === 0 && searchTerm !== '' ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum lead encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : totalItems === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum lead encontrado.</span>
                        </div>
                    ) : (
                        leadsToDisplay.map(lead => {
                            const stageInfo = getStageAndFunnelInfo(lead.id_etapa);
                            return (
                                <div
                                    key={lead.id}
                                    className="lead-item flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => openLeadDetails(lead.telefone)}
                                >
                                    <User className="h-6 w-6 mr-4 text-primary flex-shrink-0" />
                                    <div className="lead-info flex flex-col flex-1 min-w-0 mr-4">
                                        <span className="lead-name font-medium text-base truncate">{lead.nome_lead || "S/ Nome"}</span>
                                        <span className="lead-phone text-sm text-gray-600">{formatPhone(lead.telefone)}</span>
                                        {/* Removed rendering of interests */}
                                    </div>
                                    <div className="lead-details flex flex-col text-sm text-gray-600 min-w-[150px] mr-4">
                                        {lead.origem && <div className="lead-origin truncate">Origem: {lead.origem}</div>}
                                        {lead.sourceUrl && <div className="lead-source truncate">Anúncio: <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">Ver link</a></div>}
                                        <div className="lead-creation-date text-xs text-gray-500">Cadastro: {formatLeadTimestamp(lead.created_at)}</div>
                                    </div>
                                    <div className="lead-funnel flex flex-col items-center text-xs font-semibold min-w-[120px]">
                                        <span className={cn("funnel px-2 py-1 rounded-md mt-1", stageInfo.funnelClass)}>{stageInfo.funil}</span>
                                        <span className={cn("stage px-2 py-1 rounded-md mt-1", stageInfo.etapaClass)}>{stageInfo.etapa}</span>
                                    </div>
                                    {lead.lead_score !== null && (
                                        <div className="lead-score flex items-center ml-4">
                                            <div className="stars flex gap-0.5" title={`Lead Score: ${lead.lead_score}`}>
                                                {renderStars(lead.lead_score)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </CardContent>
                {totalItems > 0 && (
                    <div className="pagination-container p-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                        <div className="pagination-info text-sm text-gray-600">
                            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                            {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} de {totalItems} registros
                        </div>
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage <= 1}
                                    />
                                </PaginationItem>
                                {/* Simple page number display - could be enhanced */}
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

export default AllLeadsPage;