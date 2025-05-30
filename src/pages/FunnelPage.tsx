import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarCheck, LineChart, MessageSquare, CalendarDays, ShoppingCart, Loader2, BadgeDollarSign, Scale, CalendarClock, CalendarHeart, Search, List, Kanban, Star, User, Info, TriangleAlert, MessageSquarePlus, Clock, Hourglass, Settings, ArrowRight } from "lucide-react"; 
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; 
import { format } from 'date-fns';
import { cn, formatPhone } from '@/lib/utils'; 
import UnderConstructionPage from './UnderConstructionPage'; 
import { supabase } from '@/integrations/supabase/client'; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; 
import { showSuccess, showError } from '@/utils/toast'; 
import NewLeadModal from '@/components/NewLeadModal';

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

// Define the structure for Funnel Leads (from Supabase)
interface FunnelLead {
    id: number;
    nome_lead: string | null;
    remoteJid: string; // Changed from 'telefone' to 'remoteJid'
    id_etapa: number | null;
    origem: string | null;
    lead_score: number | null;
    created_at: string; 
    sourceUrl?: string | null; 
}

// Define the structure for Funnel Details (from Supabase)
interface FunnelDetails {
    id: number;
    nome_funil: string;
}

// NEW: Interface for an action linked to a stage (from north_clinic_funil_etapa_sequencias)
interface StageAction {
    id: number; // ID from north_clinic_funil_etapa_sequencias
    id_clinica: number;
    id_funil: number;
    id_etapa: number;
    action_type: string; // 'message' or 'change_stage'
    id_sequencia: number | null; // Linked message sequence ID
    target_etapa_id: number | null; // Target stage ID for 'change_stage' action
    timing_type: string; // 'immediate' or 'delay'
    delay_value: number | null;
    delay_unit: string | null; // 'minutes', 'hours', 'days'
    
    // Joined data from other tables (optional, for display)
    north_clinic_mensagens_sequencias?: {
        nome_sequencia: string | null;
        ativo: boolean;
    } | null;
    target_stage_details?: {
        nome_etapa: string | null;
        id_funil: number;
    } | null;
}

// Define the return type for the leads query
interface LeadsQueryData {
    leads: FunnelLead[];
    totalCount?: number | null; 
}

interface FunnelPageProps {
    clinicData: ClinicData | null;
}

// Webhook URL for updating lead stage
const UPDATE_LEAD_STAGE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/eaf897be-7829-4e59-b16c-028138e88939';

// Helper functions 
function renderStars(score: number | null): JSX.Element[] {
    const stars = [];
    const numScore = score ? Math.min(5, Math.max(0, Math.round(score / 2))) : 0; 
    for (let i = 1; i <= 5; i++) {
        stars.push(<Star key={i} className={cn("h-3 w-3", i <= numScore ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />);
    }
    return stars;
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

// Mapping from menu item ID (from URL) to actual funnel ID (for database queries)
const menuIdToFunnelIdMap: { [key: number]: number } = {
    4: 1, 
    5: 2, 
    6: 3, 
    7: 4, 
    8: 5, 
};

const FunnelPage: React.FC<FunnelPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient(); 
    const navigate = useNavigate(); 
    const { funnelId: menuIdParam } = useParams<{ funnelId: string }>();
    const menuId = parseInt(menuIdParam || '0', 10);
    const funnelIdForQuery = menuIdToFunnelIdMap[menuId];

    const [currentView, setCurrentView] = useState<'kanban' | 'list'>('kanban');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('created_at_desc'); 
    const [currentPage, setCurrentPage] = useState(1);
    const [dragOverStageId, setDragOverStageId] = useState<number | null>(null); 
    const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false); 

    const ITEMS_PER_PAGE = 15;
    const clinicId = clinicData?.id;
    const clinicCode = clinicData?.code;

    // Add this log for initial parameter values
    console.log("[FunnelPage - DIAGNOSIS] menuIdParam:", menuIdParam, "parsed menuId:", menuId, "mapped funnelIdForQuery:", funnelIdForQuery);

    const isInvalidFunnel = !clinicData || isNaN(menuId) || funnelIdForQuery === undefined;

    // Add a log for the overall invalid funnel status
    useEffect(() => {
        console.log("[FunnelPage - DIAGNOSIS] isInvalidFunnel:", isInvalidFunnel);
        if (isInvalidFunnel) {
            console.log("[FunnelPage - DIAGNOSIS] Reason for invalid funnel:", {
                clinicDataPresent: !!clinicData,
                menuIdIsNumber: !isNaN(menuId),
                funnelIdForQueryDefined: funnelIdForQuery !== undefined
            });
        }
    }, [isInvalidFunnel, clinicData, menuId, funnelIdForQuery]);


    const { data: stagesData, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
        queryKey: ['funnelStages', funnelIdForQuery], 
        queryFn: async () => {
            if (isNaN(funnelIdForQuery)) { 
                 console.warn("FunnelPage: Skipping stages fetch due to invalid funnelIdForQuery.");
                 throw new Error("ID do funil inválido.");
            }

            console.log(`FunnelPage: Fetching stages for funnel ${funnelIdForQuery} from Supabase...`);

            const { data, error } = await supabase
                .from('north_clinic_crm_etapa')
                .select('id, nome_etapa, ordem, id_funil')
                .eq('id_funil', funnelIdForQuery) 
                .order('ordem', { ascending: true }); 

            console.log("FunnelPage: Supabase stages fetch result - data:", data, "error:", error);

            if (error) {
                console.error("FunnelPage: Supabase stages fetch error:", error);
                throw new Error(`Erro ao buscar etapas: ${error.message}`);
            }

            if (!data || !Array.isArray(data)) {
                 console.warn("FunnelPage: Supabase stages fetch returned non-array data:", data);
                 return []; 
            }

            return data as FunnelStage[];
        },
        enabled: !isNaN(funnelIdForQuery) && !isInvalidFunnel, 
        staleTime: 5 * 60 * 1000, 
        refetchOnWindowFocus: false,
    });

    // Add this log immediately after stagesData query
    useEffect(() => {
        console.log("[FunnelPage - DIAGNOSIS] stagesData state:", {
            data: stagesData,
            isLoading: isLoadingStages,
            error: stagesError,
            funnelIdForQuery: funnelIdForQuery // Add funnelIdForQuery here for context
        });
    }, [stagesData, isLoadingStages, stagesError, funnelIdForQuery]);


    const { data: funnelDetailsData, isLoading: isLoadingFunnelDetails, error: funnelDetailsError } = useQuery<FunnelDetails | null>({
        queryKey: ['funnelDetails', funnelIdForQuery], 
        queryFn: async () => {
            if (isNaN(funnelIdForQuery)) { 
                 console.warn("FunnelPage: Skipping funnel details fetch due to invalid funnelIdForQuery.");
                 throw new Error("ID do funil inválido.");
            }

            console.log(`FunnelPage: Fetching funnel details for funnel ${funnelIdForQuery} from Supabase...`);

            const { data, error } = await supabase
                .from('north_clinic_crm_funil')
                .select('id, nome_funil')
                .eq('id', funnelIdForQuery) 
                .single(); 

            console.log("FunnelPage: Supabase funnel details fetch result - data:", data, "error:", error);

            if (error && error.code !== 'PGRST116') { 
                console.error("FunnelPage: Supabase funnel details fetch error:", error);
                throw new Error(`Erro ao buscar detalhes do funil: ${error.message}`);
            }

            if (!data) {
                 console.warn("FunnelPage: No funnel details found for ID:", funnelIdForQuery);
                 return null;
            }

            return data as FunnelDetails; 
        },
        enabled: !isNaN(funnelIdForQuery) && !isInvalidFunnel, 
        staleTime: 5 * 60 * 1000, 
        refetchOnWindowFocus: false,
    });

    const { data: leadsQueryData, isLoading: isLoadingLeads, error: leadsError } = useQuery<LeadsQueryData | null>({
        queryKey: ['funnelLeads', clinicId, funnelIdForQuery, currentView, currentPage, ITEMS_PER_PAGE, searchTerm, sortValue, stagesData?.map(s => s.id).join(',')], 
        queryFn: async ({ queryKey }) => {
            const [, currentClinicId, currentFunnelIdForQuery, currentView, currentPage, itemsPerPage, currentSearchTerm, currentSortValue, stagesDependency] = queryKey;

            if (!currentClinicId || isNaN(currentFunnelIdForQuery)) {
                 console.warn("FunnelPage: Skipping leads fetch due to missing clinicId or invalid funnelIdForQuery.");
                 throw new Error("Dados da clínica ou ID do funil inválidos.");
            }
            if (!stagesData || stagesData.length === 0) {
                 console.warn("FunnelPage: Skipping leads fetch because stages data is not available or empty.");
                 return { leads: [], totalCount: 0 };
            }

            const stageIds = stagesData.map(stage => stage.id);
            console.log(`FunnelPage: Stage IDs for leads query: [${stageIds.join(', ')}]`); // Log the stage IDs
            if (stageIds.length === 0) {
                 console.warn("FunnelPage: Skipping leads fetch because no stage IDs found for the funnel.");
                 return { leads: [], totalCount: 0 };
            }

            // NEW LOG: Log the exact parameters being used in the Supabase query
            console.log(`[FunnelPage - Leads Query] Executing query with: clinicId=${currentClinicId}, funnelId=${currentFunnelIdForQuery}, stageIds=[${stageIds.join(', ')}], searchTerm='${currentSearchTerm}', sortValue='${currentSortValue}', currentPage=${currentPage}, itemsPerPage=${itemsPerPage}`);


            let query = supabase
                .from('north_clinic_leads_API')
                .select('id, nome_lead, remoteJid, id_etapa, origem, lead_score, created_at, sourceUrl', { count: currentView === 'list' ? 'exact' : undefined }) // Changed 'telefone' to 'remoteJid'
                .eq('id_clinica', currentClinicId) 
                .in('id_etapa', stageIds); 

            if (currentSearchTerm) {
                const searchTermLower = currentSearchTerm.toLowerCase();
                query = query.or(`nome_lead.ilike.%${searchTermLower}%,remoteJid.ilike.%${currentSearchTerm}%,origem.ilike.%${searchTermLower}%`); // Changed 'telefone::text' to 'remoteJid'
                 console.log(`FunnelPage: Applying search filter: nome_lead ILIKE '%${searchTermLower}%' OR remoteJid ILIKE '%${currentSearchTerm}%' OR origem ILIKE '%${searchTermLower}%'`);
            }

            let orderByColumn = 'created_at';
            let ascending = false; 

            switch (currentSortValue) {
                case 'created_at_desc':
                    orderByColumn = 'created_at';
                    ascending = false;
                    break;
                case 'created_at_asc':
                    orderByColumn = 'created_at';
                    ascending = true;
                    break;
                case 'name_asc': 
                    orderByColumn = 'nome_lead';
                    ascending = true;
                    break;
                case 'name_desc': 
                    orderByColumn = 'nome_lead';
                    ascending = false;
                    break;
                default:
                    break;
            }

            query = query.order(orderByColumn, { ascending: ascending });
            console.log(`FunnelPage: Applying sort: order by ${orderByColumn} ${ascending ? 'ASC' : 'DESC'}`);


            if (currentView === 'list') {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage - 1;
                query = query.range(startIndex, endIndex);
                console.log(`FunnelPage: Applying pagination: range from ${startIndex} to ${endIndex}`);
            }

            const { data, error, count } = await query;

            console.log('FunnelPage: Supabase leads fetch result:', { data, error, count });
            // NEW LOGS: Detailed inspection of leadsQueryData
            console.log('FunnelPage: leadsQueryData.leads (content):', data);
            console.log('FunnelPage: leadsQueryData.totalCount (content):', count);


            if (error) {
                console.error("FunnelPage: Supabase leads fetch error:", error);
                throw new Error(`Erro ao buscar leads: ${error.message}`);
            }

            return { leads: data || [], totalCount: count };

        },
        enabled: !!clinicId && !isNaN(funnelIdForQuery) && !isInvalidFunnel && !!stagesData, 
        staleTime: 60 * 1000, 
        refetchOnWindowFocus: false,
    });

    // Add a log for the enabled status of the leads query
    useEffect(() => {
        console.log("[FunnelPage - DIAGNOSIS] leadsQueryData enabled status:", {
            clinicId: !!clinicId,
            funnelIdForQuery: !isNaN(funnelIdForQuery),
            isInvalidFunnel: !isInvalidFunnel,
            stagesDataPresent: !!stagesData,
            overallEnabled: !!clinicId && !isNaN(funnelIdForQuery) && !isInvalidFunnel && !!stagesData
        });
    }, [clinicId, funnelIdForQuery, isInvalidFunnel, stagesData]);


    // NEW: Fetch Actions linked to stages in this funnel from north_clinic_funil_etapa_sequencias
    const { data: stageActions, isLoading: isLoadingStageActions, error: stageActionsError } = useQuery<StageAction[]>({
        queryKey: ['stageActions', clinicId, funnelIdForQuery],
        queryFn: async ({ queryKey }) => {
            const [, currentClinicId, currentFunnelIdForQuery] = queryKey;

            if (!currentClinicId || isNaN(currentFunnelIdForQuery)) {
                 return [];
            }

            const { data, error } = await supabase
                .from('north_clinic_funil_etapa_sequencias')
                .select(`
                    *,
                    north_clinic_mensagens_sequencias ( nome_sequencia, ativo ),
                    target_stage_details:north_clinic_crm_etapa!target_etapa_id(nome_etapa, id_funil)
                `)
                .eq('id_clinica', currentClinicId)
                .eq('id_funil', currentFunnelIdForQuery);

            if (error) throw new Error(`Erro ao buscar ações das etapas: ${error.message}`);
            return data || [];
        },
        enabled: !!clinicId && !isNaN(funnelIdForQuery) && !isInvalidFunnel && !!stagesData && (stagesData?.length ?? 0) > 0,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Map stage actions by stage ID for quick lookup
    const stageActionsMap = useMemo(() => {
        const map = new Map<number, StageAction[]>(); // A stage can have multiple actions
        stageActions?.forEach(action => {
            if (action.id_etapa !== null) {
                const currentActions = map.get(action.id_etapa) || [];
                map.set(action.id_etapa, [...currentActions, action]);
            }
        });
        return map;
    }, [stageActions]);

    const updateLeadStageMutation = useMutation({
        mutationFn: async ({ leadId, targetStageId, clinicId }: { leadId: number; targetStageId: number; clinicId: string | number }) => {
            console.log(`[FunnelPage] Calling webhook to update lead ${leadId} to stage ${targetStageId} for clinic ${clinicId}`);
            const response = await fetch(UPDATE_LEAD_STAGE_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, targetStageId, clinicId }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            return response.json();
        },
        onSuccess: (_, variables) => {
            showSuccess(`Lead ${variables.leadId} movido para a etapa ${variables.targetStageId} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['funnelLeads', clinicId, funnelIdForQuery] });
        },
        onError: (error: Error, variables) => {
            showError(`Erro ao mover lead ${variables.leadId}: ${error.message}`);
            queryClient.invalidateQueries({ queryKey: ['funnelLeads', clinicId, funnelIdForQuery] }); 
        },
    });

    const isLoading = isLoadingStages || isLoadingFunnelDetails || isLoadingLeads || isLoadingStageActions || updateLeadStageMutation.isLoading;
    const fetchError = stagesError || funnelDetailsError || leadsError || stageActionsError || updateLeadStageMutation.error;

    const leadsToDisplay = leadsQueryData?.leads || [];
    const totalItems = currentView === 'list' ? (leadsQueryData?.totalCount ?? 0) : leadsToDisplay.length; 
    const totalPages = currentView === 'list' ? Math.ceil(totalItems / ITEMS_PER_PAGE) : 1; 

    useEffect(() => {
        if (currentView === 'list') {
            if (totalItems > 0) {
                const newTotalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
                if (currentPage > newTotalPages) {
                    setCurrentPage(newTotalPages);
                }
            } else if (totalItems === 0 && currentPage !== 1) {
                 setCurrentPage(1);
            }
        }
    }, [totalItems, currentPage, currentView]); 

    const handlePageChange = (page: number) => {
        if (currentView === 'list' && page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const getStageName = (idEtapa: number | null): string => {
        if (idEtapa === null) return 'Etapa Desconhecida';
        const stage = stagesData?.find(s => s.id === idEtapa);
        return stage ? stage.nome_etapa : 'Etapa Desconhecida';
    };

    const leadsByStage = useMemo(() => {
        const grouped: { [stageId: number]: FunnelLead[] } = {};
        stagesData?.forEach(stage => {
            grouped[stage.id] = [];
        });
        leadsToDisplay.forEach(lead => {
            if (lead.id_etapa !== null && grouped[lead.id_etapa]) {
                grouped[lead.id_etapa].push(lead);
            } else {
                 console.warn(`Lead ${lead.id} has invalid stage ID: ${lead.id_etapa}`);
            }
        });
        return grouped;
    }, [leadsToDisplay, stagesData]);

    const funnelName = funnelDetailsData?.nome_funil || `Funil ID ${funnelIdForQuery}`;

    const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetStageId: number) => {
        event.preventDefault();
        setDragOverStageId(null); 

        const leadId = event.dataTransfer.getData('text/plain');
        if (!leadId) return;

        const leadIdNum = parseInt(leadId, 10);
        if (isNaN(leadIdNum)) return;

        console.log(`Dropped lead ${leadIdNum} onto stage ${targetStageId}`);

        queryClient.setQueryData(['funnelLeads', clinicId, funnelIdForQuery, currentView, currentPage, ITEMS_PER_PAGE, searchTerm, sortValue, stagesData?.map(s => s.id).join(',')], (oldData: LeadsQueryData | undefined) => {
            if (!oldData || !oldData.leads) return oldData;

            const draggedLead = oldData.leads.find(lead => lead.id === leadIdNum);

            if (!draggedLead || draggedLead.id_etapa === targetStageId) {
                console.log(`Lead ${leadIdNum} not found or already in stage ${targetStageId}. No UI update.`);
                return oldData;
            }

            console.log(`Optimistically updating lead ${leadIdNum} from stage ${draggedLead.id_etapa} to ${targetStageId}`);

            const newLeads = oldData.leads.map(lead =>
                lead.id === leadIdNum ? { ...lead, id_etapa: targetStageId } : lead
            );

            return { ...oldData, leads: newLeads };
        });

        if (clinicId) {
            updateLeadStageMutation.mutate({ leadId: leadIdNum, targetStageId: targetStageId, clinicId: clinicId });
        } else {
            showError("Erro: ID da clínica não disponível para atualizar o lead.");
        }
    };

    const handleConfigureMessages = () => {
        if (!clinicCode || funnelIdForQuery === undefined) {
            showError("Código da clínica ou ID do funil não disponível para navegação.");
            return;
        }
        navigate(`/dashboard/funnel-config/${menuIdParam}`);
    };

    // Helper to format timing display for StageAction
    const formatTiming = (timingType: string, delayValue: number | null, delayUnit: string | null): string => {
        if (timingType === 'immediate') {
            return 'Imediata';
        }
        if (timingType === 'delay' && delayValue !== null && delayUnit) {
            return `+${delayValue}${delayUnit.charAt(0)}`; // e.g., +2h, +30m, +1d
        }
        return 'N/D';
    };

    const openNewLeadModal = () => setIsNewLeadModalOpen(true);
    const closeNewLeadModal = () => setIsNewLeadModalOpen(false); // Corrected setter
    const handleLeadAdded = () => {
        queryClient.invalidateQueries({ queryKey: ['funnelLeads', clinicId, funnelIdForQuery] });
    };

    // --- DIAGNOSTIC LOGS ---
    console.log("[FunnelPage Render Check] isLoading (overall):", isLoading);
    console.log("[FunnelPage Render Check] fetchError (overall):", fetchError);
    console.log("[FunnelPage Render Check] stagesData:", stagesData);
    console.log("[FunnelPage Render Check] stagesData.length:", stagesData?.length);
    console.log("[FunnelPage Render Check] funnelDetailsData:", funnelDetailsData);
    console.log("[FunnelPage Render Check] leadsQueryData:", leadsQueryData);
    console.log("[FunnelPage Render Check] totalItems:", totalItems);
    // --- END DIAGNOSTIC LOGS ---

    if (isInvalidFunnel) {
        console.error("FunnelPage: Invalid funnel ID or clinic data. Rendering UnderConstructionPage.", {
            clinicData: clinicData,
            menuId: menuId,
            isNaN_menuId: isNaN(menuId),
            funnelIdForQuery: funnelIdForQuery 
        });
        return <UnderConstructionPage />;
    }

    return (
        <TooltipProvider>
            <div className="funnel-container flex flex-col h-full p-6 bg-gray-100">
                <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                    <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                        {funnelName} 
                    </h1>
                    <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                        <div className="relative flex-grow max-w-sm">
                             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                             <Input
                                type="text"
                                placeholder="Buscar leads..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="pl-9"
                             />
                        </div>
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                            {isLoading ? 'Carregando...' : `${totalItems} leads`} 
                        </span>
                        {currentView === 'list' && ( 
                            <Select value={sortValue} onValueChange={(value) => { setSortValue(value); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Ordenar por..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="created_at_desc">Cadastro Recente</SelectItem>
                                    <SelectItem value="created_at_asc">Cadastro Antigo</SelectItem>
                                    <SelectItem value="name_asc">Nome A-Z</SelectItem>
                                    <SelectItem value="name_desc">Nome Z-A</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="view-toggle flex gap-2 ml-auto flex-shrink-0">
                        <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as 'kanban' | 'list')}>
                            <TabsList>
                                <TabsTrigger value="kanban" title="Visão Kanban">
                                    <Kanban className="h-4 w-4 mr-2" /> Kanban
                                </TabsTrigger>
                                <TabsTrigger value="list" title="Visão Lista">
                                    <List className="h-4 w-4 mr-2" /> Lista
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    <Button onClick={handleConfigureMessages} className="flex-shrink-0">
                        <Settings className="h-4 w-4 mr-2" /> Configurar
                    </Button>
                    <Button onClick={openNewLeadModal} className="flex-shrink-0"> 
                        <User className="h-4 w-4 mr-2" /> Novo Lead
                    </Button>
                </div>

                <div className="view-container flex-grow overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando dados do funil...</span>
                        </div>
                    ) : fetchError ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-4 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar dados do funil: {fetchError.message}</span>
                        </div>
                    ) : (stagesData?.length ?? 0) === 0 ? ( 
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhuma etapa configurada para este funil ou nenhum dado retornado.</span>
                        </div>
                    ) : totalItems === 0 && searchTerm !== '' ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum lead encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : totalItems === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum lead encontrado neste funil.</span>
                        </div>
                    ) : (
                        <>
                            {currentView === 'kanban' && (
                                <div className="kanban-board flex gap-4 h-full overflow-x-auto pb-4">
                                    {stagesData?.map(stage => {
                                        const actionsForStage = stageActionsMap.get(stage.id) || [];

                                        return (
                                            <Card
                                                key={stage.id}
                                                className={cn(
                                                    "kanban-column flex flex-col flex-shrink-0 w-80 bg-gray-200 h-full",
                                                    dragOverStageId === stage.id && "border-2 border-primary" 
                                                )}
                                                onDragOver={(e) => e.preventDefault()} 
                                                onDrop={(e) => handleDrop(e, stage.id)} 
                                                onDragEnter={(e) => { e.preventDefault(); setDragOverStageId(stage.id); }} 
                                                onDragLeave={() => setDragOverStageId(null)} 
                                            >
                                                <CardHeader className="py-3 px-4 border-b-2 border-gray-300 bg-gray-300 rounded-t-md flex flex-row items-center justify-between">
                                                    <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                                        {stage.nome_etapa || 'S/Nome'}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-2">
                                                        {actionsForStage.length > 0 && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="text-xs font-normal text-gray-600 bg-gray-400 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                                                        <List className="h-3 w-3" /> {actionsForStage.length}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{actionsForStage.length} Ações configuradas</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        <span className="text-xs font-normal text-gray-600 bg-gray-400 px-1.5 py-0.5 rounded-sm">
                                                            {leadsByStage[stage.id]?.length || 0}
                                                        </span>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="flex-grow overflow-y-auto p-3 flex flex-col gap-3">
                                                    {leadsByStage[stage.id]?.map(lead => (
                                                        <div
                                                            key={lead.id}
                                                            className="kanban-card bg-white rounded-md p-3 shadow-sm border border-gray-200 cursor-grab hover:shadow-md hover:border-l-4 hover:border-primary transition-all duration-200"
                                                            draggable 
                                                            onDragStart={(e) => {
                                                                console.log('Drag started for lead:', lead.id);
                                                                e.dataTransfer.setData('text/plain', String(lead.id)); 
                                                            }}
                                                            onDragEnd={() => setDragOverStageId(null)} 
                                                        >
                                                            <div className="lead-name font-medium text-sm mb-1">{lead.nome_lead || "S/ Nome"}</div>
                                                            <div className="lead-phone text-xs text-gray-600 mb-2">{formatPhone(lead.remoteJid.split('@')[0])}</div> {/* Changed to remoteJid */}
                                                            {lead.lead_score !== null && (
                                                                <div className="lead-score flex items-center gap-1 mb-2">
                                                                    {renderStars(lead.lead_score)}
                                                                </div>
                                                            )}
                                                            <div className="card-footer text-xs text-gray-500 border-t border-gray-200 pt-2 flex justify-between items-center">
                                                                <span className="origin truncate max-w-[70%]" title={`Origem: ${lead.origem || 'N/D'}`}>Origem: {lead.origem || 'N/D'}</span>
                                                                <Button
                                                                    variant="link"
                                                                    size="sm"
                                                                    className="p-0 h-auto text-primary text-xs"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); 
                                                                        console.log("Detalhes do Lead:", lead); 
                                                                        alert("Detalhes do Lead logados no console do navegador."); 
                                                                    }}
                                                                >
                                                                    Detalhes
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}

                            {currentView === 'list' && (
                                <Card className="leads-list-container h-full flex flex-col">
                                    <CardContent className="p-0 flex-grow overflow-y-auto">
                                        {leadsToDisplay.map(lead => {
                                             const stageInfo = getStageName(lead.id_etapa); 
                                             const actionsForStage = lead.id_etapa !== null ? stageActionsMap.get(lead.id_etapa) || [] : [];

                                             return (
                                                <div
                                                    key={lead.id}
                                                    className="lead-item flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                                >
                                                    <User className="h-6 w-6 mr-4 text-primary flex-shrink-0" />
                                                    <div className="lead-info flex flex-col flex-1 min-w-0 mr-4">
                                                        <span className="lead-name font-medium text-base truncate">{lead.nome_lead || "S/ Nome"}</span>
                                                        <span className="lead-phone text-sm text-gray-600">{formatPhone(lead.remoteJid.split('@')[0])}</span> {/* Changed to remoteJid */}
                                                    </div>
                                                    <div className="lead-details flex flex-col text-sm text-gray-600 min-w-[150px] mr-4">
                                                        {lead.origem && <div className="lead-origin truncate">Origem: {lead.origem}</div>}
                                                        {lead.sourceUrl && <div className="lead-source truncate">Anúncio: <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">Ver link</a></div>}
                                                        <div className="lead-creation-date text-xs text-gray-500">Cadastro: {formatLeadTimestamp(lead.created_at)}</div>
                                                    </div>
                                                    <div className="lead-funnel flex flex-col items-center text-xs font-semibold min-w-[120px]">
                                                        <span className={cn("stage px-2 py-1 rounded-md mt-1 bg-gray-100 text-gray-800 border border-gray-800")}>{stageInfo}</span> 
                                                        {actionsForStage.length > 0 && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="text-xs font-normal text-gray-600 bg-gray-400 px-1.5 py-0.5 rounded-sm flex items-center gap-1 mt-1">
                                                                        <List className="h-3 w-3" /> {actionsForStage.length} Ações
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    {actionsForStage.map((action, idx) => (
                                                                        <div key={idx} className="flex items-center gap-1">
                                                                            {action.action_type === 'message' ? (
                                                                                <>
                                                                                    <MessageSquare className="h-3 w-3" /> Mensagem: {action.north_clinic_mensagens_sequencias?.nome_sequencia || 'Sem nome'} ({formatTiming(action.timing_type, action.delay_value, action.delay_unit)})
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <ArrowRight className="h-3 w-3" /> Mover para: {action.target_stage_details?.nome_etapa || 'Etapa Desconhecida'} ({formatTiming(action.timing_type, action.delay_value, action.delay_unit)})
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                    {lead.lead_score !== null && (
                                                        <div className="lead-score flex items-center ml-4">
                                                            <div className="stars flex gap-0.5" title={`Lead Score: ${lead.lead_score}`}>
                                                                {renderStars(lead.lead_score)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="ml-4 flex-shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); 
                                                            console.log("Detalhes do Lead:", lead); 
                                                            alert("Detalhes do Lead logados no console do navegador."); 
                                                        }}
                                                    >
                                                        Detalhes
                                                    </Button>
                                                </div>
                                            );
                                        })}
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
                            )}
                        </>
                    )}
                </div>
            </div>

            {clinicId && funnelIdForQuery !== undefined && (
                <NewLeadModal
                    isOpen={isNewLeadModalOpen}
                    onClose={closeNewLeadModal}
                    clinicId={clinicId}
                    funnelIdForQuery={funnelIdForQuery}
                    onLeadAdded={handleLeadAdded}
                />
            )}
        </TooltipProvider>
    );
};

export default FunnelPage;