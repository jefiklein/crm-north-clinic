import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Search, List, Star, User, Info, TriangleAlert, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import { cn } from '@/lib/utils'; // Utility for class names

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for Funnel Stages (needed to display stage names)
interface FunnelStage {
    id: number;
    nome_etapa: string;
    ordem: number | null;
    id_funil: number;
}

// Define the structure for Funnel Details (needed to display funnel names)
interface FunnelDetails {
    id: number;
    nome_funil: string;
}

// Define the structure for Leads
interface Lead {
    id: number;
    nome_lead: string | null;
    telefone: number | null;
    id_etapa: number | null;
    origem: string | null;
    lead_score: number | null;
    interesses: string | null; // Assuming interests is a comma-separated string
    created_at: string; // ISO timestamp from DB
    sourceUrl?: string | null; // Optional source URL
    id_funil?: number | null; // Assuming lead data might include funnel ID
}


interface AllLeadsPageProps {
    clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const ALL_LEADS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/2382f80f-240e-4aaf-9194-5d91e710c774`;
const ALL_STAGES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/43323d0c-2855-4a8c-8a4e-c38e2e801440`;
const ALL_FUNNELS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/f95a53c6-7e87-4139-8d0b-cc3d26489f4a`;
const LEAD_DETAILS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/9c8216dd-f489-464e-8ce4-45c227857707`;


// Helper functions (adapted from HTML)
function formatPhone(phone: number | string | null): string {
    if (!phone) return 'S/ Tel.';
    const s = String(phone).replace(/\D/g, '');
    if (s.length === 11) return `(${s.substring(0, 2)}) ${s.substring(2, 7)}-${s.substring(7)}`;
    if (s.length === 10) return `(${s.substring(0, 2)}) ${s.substring(2, 6)}-${s.substring(6)}`;
    return s;
}

function renderStars(score: number | null): JSX.Element[] {
    const stars = [];
    // Assuming score is out of 10 based on HTML, but rendering 5 stars
    const numScore = score ? Math.min(5, Math.max(0, Math.round(score / 2))) : 0; // Adjusting for 5 stars
    for (let i = 1; i <= 5; i++) {
        stars.push(<Star key={i} className={cn("h-3 w-3", i <= numScore ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />);
    }
    return stars;
}

function renderInterests(interests: string | null): JSX.Element[] {
    if (!interests) return [];
    const arr = interests.split(',').map(i => i.trim()).filter(i => i);
    const colors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-yellow-100 text-yellow-800', 'bg-red-100 text-red-800', 'bg-purple-100 text-purple-800'];
    return arr.map((interest, index) => (
        <span key={index} className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colors[index % colors.length])}>
            {interest}
        </span>
    ));
}

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
    const [sortValue, setSortValue] = useState('recent');
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 15;

    const clinicId = clinicData?.id;

    // Fetch All Leads
    const { data: allLeads, isLoading: isLoadingLeads, error: leadsError } = useQuery<Lead[]>({
        queryKey: ['allLeads', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível para buscar leads.");

            console.log(`Fetching all leads for clinic ${clinicId}`);
            const response = await fetch(ALL_LEADS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ action: "get_all_leads", clinic_id: clinicId })
            });

            console.log('All Leads webhook response:', { status: response.status, statusText: response.statusText });

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error("All Leads webhook error response:", errorText);
                 throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
            }

            const data = await response.json();
            console.log('Data received from all leads webhook:', data);

            // Handle potential nested data structure from n8n
            let leadsArray: any[] = [];
            if (Array.isArray(data)) {
                leadsArray = data;
            } else if (data && typeof data === 'object' && Array.isArray(data.data)) {
                leadsArray = data.data;
            } else if (data && typeof data === 'object' && Array.isArray(data.json)) {
                 leadsArray = data.json;
            } else {
                console.warn("Unexpected data format for all leads:", data);
                leadsArray = [];
            }

            // Ensure leads have a 'created_at' for sorting, default if missing
            return leadsArray.map(lead => ({
                ...lead,
                created_at: lead.created_at || new Date(0).toISOString() // Default to epoch if missing
            })) as Lead[];
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
    });

    // Fetch All Stages (for displaying stage names)
    const { data: allStages, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
        queryKey: ['allStages', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível para buscar etapas.");

            console.log(`Fetching all stages for clinic ${clinicId}`);
            const response = await fetch(ALL_STAGES_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ action: "get_etapas", clinic_id: clinicId })
            });

            console.log('All Stages webhook response:', { status: response.status, statusText: response.statusText });

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error("All Stages webhook error response:", errorText);
                 throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                 console.warn("Unexpected data format for all stages:", data);
                 return [];
            }
            return data as FunnelStage[];
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch All Funnels (for displaying funnel names)
    const { data: allFunnelDetails, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
        queryKey: ['allFunnels', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível para buscar funis.");

            console.log(`Fetching all funnels for clinic ${clinicId}`);
            const response = await fetch(ALL_FUNNELS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ action: "get_funis", clinic_id: clinicId })
            });

            console.log('All Funnels webhook response:', { status: response.status, statusText: response.statusText });

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error("All Funnels webhook error response:", errorText);
                 throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                 console.warn("Unexpected data format for all funnels:", data);
                 return [];
            }
            return data as FunnelDetails[];
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });


    // Combine loading states and errors
    const isLoading = isLoadingLeads || isLoadingStages || isLoadingFunnels;
    const fetchError = leadsError || stagesError || funnelsError;

    // Map stages and funnels for quick lookup
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

    // Get Stage and Funnel Name Helper
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
                 else { stageInfo.funnelClass = 'bg-gray-100 text-gray-800 border border-gray-800'; } // Default
            }
        }
        return stageInfo;
    };


    // Filter and Sort Leads
    const filteredAndSortedLeads = useMemo(() => {
        if (!allLeads) return [];

        let filtered = allLeads.filter(lead => {
            const searchTermLower = searchTerm.toLowerCase();
            const nameMatch = lead.nome_lead?.toLowerCase().includes(searchTermLower) || false;
            const phoneMatch = String(lead.telefone || '').includes(searchTerm) || false;
            const originMatch = lead.origem?.toLowerCase().includes(searchTermLower) || false;
            const interestsMatch = lead.interesses?.toLowerCase().includes(searchTermLower) || false;
            const stageInfo = getStageAndFunnelInfo(lead.id_etapa);
            const funnelMatch = stageInfo.funil.toLowerCase().includes(searchTermLower) || false;
            const stageMatch = stageInfo.etapa.toLowerCase().includes(searchTermLower) || false;

            return nameMatch || phoneMatch || originMatch || interestsMatch || funnelMatch || stageMatch;
        });

        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'recent':
                    // Use created_at for sorting
                    const dateA = new Date(a.created_at).getTime();
                    const dateB = new Date(b.created_at).getTime();
                    return dateB - dateA; // Newest first
                case 'oldest':
                    const dateA_ = new Date(a.created_at).getTime();
                    const dateB_ = new Date(b.created_at).getTime();
                    return dateA_ - dateB_; // Oldest first
                case 'name_asc':
                    return (a.nome_lead || '').localeCompare(b.nome_lead || '');
                case 'name_desc':
                    return (b.nome_lead || '').localeCompare(a.nome_lead || '');
                default:
                    return 0;
            }
        });

        return filtered;
    }, [allLeads, searchTerm, sortValue, stageMap, funnelMap]); // Depend on maps too

    // Pagination for List View
    const totalItems = filteredAndSortedLeads.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredAndSortedLeads.slice(start, end);
    }, [filteredAndSortedLeads, currentPage, ITEMS_PER_PAGE]);

    // Update current page if filtering/sorting reduces total pages
    useEffect(() => {
        const newTotalPages = Math.ceil(filteredAndSortedLeads.length / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
            setCurrentPage(newTotalPages);
        } else if (filteredAndSortedLeads.length > 0 && currentPage === 0) {
             setCurrentPage(1);
        } else if (filteredAndSortedLeads.length === 0) {
             setCurrentPage(1); // Reset page if no leads
        }
    }, [filteredAndSortedLeads.length, currentPage]);


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
                            <SelectItem value="recent">Cadastro mais recente</SelectItem>
                            <SelectItem value="oldest">Cadastro mais antigo</SelectItem>
                            <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
                            <SelectItem value="name_desc">Nome (Z-A)</SelectItem>
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
                        paginatedLeads.map(lead => {
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
                                        {lead.interesses && (
                                            <div className="lead-tags flex flex-wrap gap-1 mt-1">
                                                {renderInterests(lead.interesses)}
                                            </div>
                                        )}
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
                            {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} de {totalItems} leads
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