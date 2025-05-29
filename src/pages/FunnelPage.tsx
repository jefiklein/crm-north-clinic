import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useNavigate
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarCheck, LineChart, MessageSquare, CalendarDays, ShoppingCart, Loader2, BadgeDollarSign, Scale, CalendarClock, CalendarHeart, Search, List, Kanban, Star, User, Info, TriangleAlert, MessageSquarePlus, Clock, Hourglass, Settings } from "lucide-react"; // Added Settings icon
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation and useQueryClient
import { format } from 'date-fns';
import { cn, formatPhone } from '@/lib/utils'; // Import cn and formatPhone
import UnderConstructionPage from './UnderConstructionPage'; // Import UnderConstructionPage
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip
import { showSuccess, showError } from '@/utils/toast'; // Import toast utilities

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
    telefone: number | null;
    id_etapa: number | null;
    origem: string | null;
    lead_score: number | null;
    // interesses: string | null; // Removed interests property as it's not in the Supabase query
    created_at: string; // ISO timestamp from DB
    sourceUrl?: string | null; // Optional source URL
    // id_funil is not directly in north_clinic_leads_API, derived from id_etapa
}

// Define the structure for Funnel Details (from Supabase)
interface FunnelDetails {
    id: number;
    nome_funil: string;
}

// Define the structure for a Message linked to a stage (fetched from Supabase)
interface StageMessage {
    id: number;
    modelo_mensagem: string | null;
    timing_type: string | null; // 'immediate' or 'delay'
    delay_value: number | null;
    delay_unit: string | null; // 'minutes', 'hours', 'days'
    id_etapa: number; // Link back to the stage
    // Add other message fields if needed for display (e.g., url_arquivo)
}


// Define the return type for the leads query
interface LeadsQueryData {
    leads: FunnelLead[];
    totalCount?: number | null; // totalCount is optional, only present for list view
}


interface FunnelPageProps {
    clinicData: ClinicData | null;
}

// Webhook URL for updating lead stage
const UPDATE_LEAD_STAGE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/eaf897be-7829-4e59-b16c-028138e88939';


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

// Removed openLeadDetails function as we are no longer opening a new tab


// Mapping from menu item ID (from URL) to actual funnel ID (for database queries)
const menuIdToFunnelIdMap: { [key: number]: number } = {
    4: 1, // Funil de Vendas
    5: 2, // Funil de Recuperação
    6: 3, // Funil de Faltas
    7: 4, // Funil Compareceram
    8: 5, // Clientes
    // Add other menu item IDs and their corresponding funnel IDs here as needed
};


const FunnelPage: React.FC<FunnelPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient(); // Get query client instance
    const navigate = useNavigate(); // Initialize navigate hook
    const { funnelId: menuIdParam } = useParams<{ funnelId: string }>(); // Get menu item ID from URL
    const menuId = parseInt(menuIdParam || '0', 10);

    // Determine the actual funnel ID to use for database queries
    const funnelIdForQuery = menuIdToFunnelIdMap[menuId];

    const [currentView, setCurrentView] = useState<'kanban' | 'list'>('kanban');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('created_at_desc'); // Use DB column name + direction
    const [currentPage, setCurrentPage] = useState(1);
    const [dragOverStageId, setDragOverStageId] = useState<number | null>(null); // State for drag over visual feedback

    // NEW: State for toggling between view mode and config mode
    const [isConfigMode, setIsConfigMode] = useState(false);


    const ITEMS_PER_PAGE = 15;

    const clinicId = clinicData?.id;
    const clinicCode = clinicData?.code;


    // --- Debugging Logs ---
    console.log("FunnelPage: Rendering");
    console.log("FunnelPage: menuIdParam from URL:", menuIdParam);
    console.log("FunnelPage: Parsed menuId:", menuId);
    console.log("FunnelPage: isNaN(menuId):", isNaN(menuId));
    console.log("FunnelPage: menuIdToFunnelIdMap:", menuIdToFunnelIdMap);
    console.log("FunnelPage: menuId in map?", menuIdToFunnelIdMap.hasOwnProperty(menuId));
    console.log("FunnelPage: clinicData:", clinicData);
    console.log("FunnelPage: !clinicData:", !clinicData);
    console.log("FunnelPage: funnelIdForQuery:", funnelIdForQuery);
    // --- End Debugging Logs ---


    // Check if the menuIdParam corresponds to a valid funnel ID
    const isInvalidFunnel = !clinicData || isNaN(menuId) || funnelIdForQuery === undefined;

    // Fetch Stages directly from Supabase - REMOVED id_clinica filter
    const { data: stagesData, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
        queryKey: ['funnelStages', funnelIdForQuery], // Removed clinicId from key as it's not filtered by it
        queryFn: async () => {
            if (isNaN(funnelIdForQuery)) { // Only check for valid funnelIdForQuery
                 console.warn("FunnelPage: Skipping stages fetch due to invalid funnelIdForQuery.");
                 throw new Error("ID do funil inválido.");
            }

            console.log(`FunnelPage: Fetching stages for funnel ${funnelIdForQuery} from Supabase...`);

            const { data, error } = await supabase
                .from('north_clinic_crm_etapa')
                .select('id, nome_etapa, ordem, id_funil')
                .eq('id_funil', funnelIdForQuery) // Filter by the determined funnel ID
                // REMOVED: .eq('id_clinica', clinicId)
                .order('ordem', { ascending: true }); // Order by 'ordem'

            console.log("FunnelPage: Supabase stages fetch result - data:", data, "error:", error);

            if (error) {
                console.error("FunnelPage: Supabase stages fetch error:", error);
                throw new Error(`Erro ao buscar etapas: ${error.message}`);
            }

            if (!data || !Array.isArray(data)) {
                 console.warn("FunnelPage: Supabase stages fetch returned non-array data:", data);
                 return []; // Return empty array if data is null or not an array
            }

            return data as FunnelStage[];
        },
        enabled: !isNaN(funnelIdForQuery) && !isInvalidFunnel, // Enable only if valid funnelIdForQuery exists and not invalid overall
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch Funnel Details directly from Supabase - REMOVED id_clinica filter
    const { data: funnelDetailsData, isLoading: isLoadingFunnelDetails, error: funnelDetailsError } = useQuery<FunnelDetails | null>({
        queryKey: ['funnelDetails', funnelIdForQuery], // Removed clinicId from key
        queryFn: async () => {
            if (isNaN(funnelIdForQuery)) { // Only check for valid funnelIdForQuery
                 console.warn("FunnelPage: Skipping funnel details fetch due to invalid funnelIdForQuery.");
                 throw new Error("ID do funil inválido.");
            }

            console.log(`FunnelPage: Fetching funnel details for funnel ${funnelIdForQuery} from Supabase...`);

            const { data, error } = await supabase
                .from('north_clinic_crm_funil')
                .select('id, nome_funil')
                .eq('id', funnelIdForQuery) // Filter by the determined funnel ID
                // REMOVED: .eq('id_clinica', clinicId)
                .single(); // Expecting a single result

            console.log("FunnelPage: Supabase funnel details fetch result - data:", data, "error:", error);

            if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                console.error("FunnelPage: Supabase funnel details fetch error:", error);
                throw new Error(`Erro ao buscar detalhes do funil: ${error.message}`);
            }

            // If no rows found or data is null, return null
            if (!data) {
                 console.warn("FunnelPage: No funnel details found for ID:", funnelIdForQuery);
                 return null;
            }

            return data as FunnelDetails; // Return the single object
        },
        enabled: !isNaN(funnelIdForQuery) && !isInvalidFunnel, // Enable only if valid funnelIdForQuery exists and not invalid overall
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch Leads directly from Supabase - Conditional Pagination based on view
    const { data: leadsQueryData, isLoading: isLoadingLeads, error: leadsError } = useQuery<LeadsQueryData | null>({
        queryKey: ['funnelLeads', clinicId, funnelIdForQuery, currentView, currentPage, ITEMS_PER_PAGE, searchTerm, sortValue, stagesData?.map(s => s.id).join(',')], // Add currentView to key
        queryFn: async ({ queryKey }) => {
            const [, currentClinicId, currentFunnelIdForQuery, currentView, currentPage, itemsPerPage, currentSearchTerm, currentSortValue, stagesDependency] = queryKey;

            if (!currentClinicId || isNaN(currentFunnelIdForQuery)) {
                 console.warn("FunnelPage: Skipping leads fetch due to missing clinicId or invalid funnelIdForQuery.");
                 throw new Error("Dados da clínica ou ID do funil inválidos.");
            }
            if (!stagesData || stagesData.length === 0) {
                 console.warn("FunnelPage: Skipping leads fetch because stages data is not available or empty.");
                 // This is not an error, just means there are no stages for this funnel, so no leads either.
                 return { leads: [], totalCount: 0 };
            }

            const stageIds = stagesData.map(stage => stage.id);
            if (stageIds.length === 0) {
                 console.warn("FunnelPage: Skipping leads fetch because no stage IDs found for the funnel.");
                 return { leads: [], totalCount: 0 };
            }

            console.log(`FunnelPage: Fetching leads for clinic ${currentClinicId}, funnel ${currentFunnelIdForQuery} (stages: ${stageIds.join(',')}) from Supabase... View: ${currentView}`);

            let query = supabase
                .from('north_clinic_leads_API')
                // Removed 'interesses' from the select list
                .select('id, nome_lead, telefone, id_etapa, origem, lead_score, created_at, sourceUrl', { count: currentView === 'list' ? 'exact' : undefined }) // Request exact count only for list view
                .eq('id_clinica', currentClinicId) // Filter by clinic ID - KEEP THIS
                .in('id_etapa', stageIds); // Filter by stages belonging to this funnel

            // Apply filtering if searchTerm is not empty
            if (currentSearchTerm) {
                const searchTermLower = currentSearchTerm.toLowerCase();
                // Note: 'telefone::text' is the correct way to cast to text for ilike in Supabase/Postgres
                query = query.or(`nome_lead.ilike.%${searchTermLower}%,telefone::text.ilike.%${currentSearchTerm}%,origem.ilike.%${searchTermLower}%`);
                 console.log(`FunnelPage: Applying search filter: nome_lead ILIKE '%${searchTermLower}%' OR telefone::text ILIKE '%${currentSearchTerm}%' OR origem ILIKE '%${searchTermLower}%'`);
            }

            // Apply sorting
            let orderByColumn = 'created_at';
            let ascending = false; // Default to recent (descending created_at)

            switch (currentSortValue) {
                case 'created_at_desc':
                    orderByColumn = 'created_at';
                    ascending = false;
                    break;
                case 'created_at_asc':
                    orderByColumn = 'created_at';
                    ascending = true;
                    break;
                case 'name_asc': // Assuming 'name_asc' corresponds to 'nome_lead'
                    orderByColumn = 'nome_lead';
                    ascending = true;
                    break;
                case 'name_desc': // Assuming 'name_desc' corresponds to 'nome_lead'
                    orderByColumn = 'nome_lead';
                    ascending = false;
                    break;
                default:
                    // Default sort is already set
                    break;
            }

            query = query.order(orderByColumn, { ascending: ascending });
            console.log(`FunnelPage: Applying sort: order by ${orderByColumn} ${ascending ? 'ASC' : 'DESC'}`);


            // Apply pagination ONLY for list view
            if (currentView === 'list') {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage - 1;
                query = query.range(startIndex, endIndex);
                console.log(`FunnelPage: Applying pagination: range from ${startIndex} to ${endIndex}`);
            }


            const { data, error, count } = await query;

            console.log('FunnelPage: Supabase leads fetch result:', { data, error, count });

            if (error) {
                console.error("FunnelPage: Supabase leads fetch error:", error);
                throw new Error(`Erro ao buscar leads: ${error.message}`);
            }

            // Return data and count (count will be undefined for kanban view)
            return { leads: data || [], totalCount: count };

        },
        enabled: !!clinicId && !isNaN(funnelIdForQuery) && !isInvalidFunnel && !!stagesData && !isConfigMode, // Enable only if clinicId, valid funnelIdForQuery, stagesData exist, and not invalid overall, AND NOT IN CONFIG MODE
        staleTime: 60 * 1000, // 1 minute for leads
        refetchOnWindowFocus: false,
    });

    // NEW: Fetch Messages linked to stages in this funnel
    const { data: stageMessages, isLoading: isLoadingStageMessages, error: stageMessagesError } = useQuery<StageMessage[]>({
        queryKey: ['stageMessages', clinicId, funnelIdForQuery, stagesData?.map(s => s.id).join(',')], // Depend on clinicId, funnelId, and stage IDs
        queryFn: async ({ queryKey }) => {
            const [, currentClinicId, currentFunnelIdForQuery, stagesDependency] = queryKey;

            if (!currentClinicId || isNaN(currentFunnelIdForQuery) || !stagesData || stagesData.length === 0) {
                 console.warn("FunnelPage: Skipping stage messages fetch due to missing clinicId, invalid funnelId, or no stages.");
                 return [];
            }

            const stageIds = stagesData.map(stage => stage.id);
             if (stageIds.length === 0) {
                 console.warn("FunnelPage: Skipping stage messages fetch because no stage IDs found for the funnel.");
                 return [];
             }

            console.log(`FunnelPage: Fetching stage messages for clinic ${currentClinicId}, funnel ${currentFunnelIdForQuery} (stages: ${stageIds.join(',')}) from Supabase...`);

            const { data, error } = await supabase
                .from('north_clinic_config_mensagens')
                .select('id, modelo_mensagem, timing_type, delay_value, delay_unit, id_etapa') // Select relevant message fields
                .eq('id_clinica', currentClinicId) // Filter by clinic ID
                .eq('context', 'leads') // Filter for leads context messages
                .eq('id_funil', currentFunnelIdForQuery) // Filter by the current funnel ID
                .in('id_etapa', stageIds); // Filter by stages belonging to this funnel

            console.log('FunnelPage: Supabase stage messages fetch result:', { data, error });

            if (error) {
                console.error("FunnelPage: Supabase stage messages fetch error:", error);
                throw new Error(`Erro ao buscar mensagens das etapas: ${error.message}`);
            }

            return data || [];
        },
        enabled: !!clinicId && !isNaN(funnelIdForQuery) && !isInvalidFunnel && !!stagesData && (stagesData?.length ?? 0) > 0, // Enable only if clinicId, valid funnelId, stagesData exist (and not empty), and not invalid overall
        staleTime: 60 * 1000, // 1 minute for messages
        refetchOnWindowFocus: false,
    });

    // Map stage messages by stage ID for quick lookup
    const stageMessagesMap = useMemo(() => {
        const map = new Map<number, StageMessage>();
        stageMessages?.forEach(msg => {
            // Assuming only one message per stage for now
            map.set(msg.id_etapa, msg);
        });
        console.log("FunnelPage: Created stage messages map:", map);
        return map;
    }, [stageMessages]);


    // Mutation for updating lead stage
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
            // Invalidate the leads query to refetch the actual data and ensure consistency
            queryClient.invalidateQueries({ queryKey: ['funnelLeads', clinicId, funnelIdForQuery] });
        },
        onError: (error: Error, variables) => {
            showError(`Erro ao mover lead ${variables.leadId}: ${error.message}`);
            // If the optimistic update was made, you might want to revert it here
            // For now, we'll just let the next refetch correct it.
            queryClient.invalidateQueries({ queryKey: ['funnelLeads', clinicId, funnelIdForQuery] }); // Force refetch on error
        },
    });


    // Combine loading states and errors (include stage messages)
    const isLoading = isLoadingStages || isLoadingFunnelDetails || isLoadingLeads || isLoadingStageMessages || updateLeadStageMutation.isLoading;
    const fetchError = stagesError || funnelDetailsError || leadsError || stageMessagesError || updateLeadStageMutation.error;

    // Data for rendering is now directly from leadsQueryData
    const leadsToDisplay = leadsQueryData?.leads || [];
    // totalItems and totalPages are only relevant for list view
    const totalItems = currentView === 'list' ? (leadsQueryData?.totalCount ?? 0) : leadsToDisplay.length; // Use actual length for Kanban count display
    const totalPages = currentView === 'list' ? Math.ceil(totalItems / ITEMS_PER_PAGE) : 1; // Only calculate pages for list view


    // Update current page if filtering/sorting reduces total pages (only for list view)
    useEffect(() => {
        if (currentView === 'list') {
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
        }
    }, [totalItems, currentPage, currentView]); // Add currentView dependency


    // Handle pagination clicks (only for list view)
    const handlePageChange = (page: number) => {
        if (currentView === 'list' && page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };


    // Get Stage Name Helper (uses the fetched stagesData)
    const getStageName = (idEtapa: number | null): string => {
        if (idEtapa === null) return 'Etapa Desconhecida';
        const stage = stagesData?.find(s => s.id === idEtapa);
        return stage ? stage.nome_etapa : 'Etapa Desconhecida';
    };

    // Group leads by stage for Kanban (uses the fetched leadsToDisplay and stagesData)
    const leadsByStage = useMemo(() => {
        const grouped: { [stageId: number]: FunnelLead[] } = {};
        stagesData?.forEach(stage => {
            grouped[stage.id] = [];
        });
        // Use leadsToDisplay which contains ALL leads for Kanban view
        leadsToDisplay.forEach(lead => {
            if (lead.id_etapa !== null && grouped[lead.id_etapa]) {
                grouped[lead.id_etapa].push(lead);
            } else {
                 // Handle leads with null or invalid stage IDs if necessary
                 // For now, they won't appear in Kanban
                 console.warn(`Lead ${lead.id} has invalid stage ID: ${lead.id_etapa}`);
            }
        });
        return grouped;
    }, [leadsToDisplay, stagesData]);


    const funnelName = funnelDetailsData?.nome_funil || `Funil ID ${funnelIdForQuery}`; // Use funnelIdForQuery for default name display

    // Handle drop event on a stage column
    const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetStageId: number) => {
        event.preventDefault();
        setDragOverStageId(null); // Clear drag over state

        const leadId = event.dataTransfer.getData('text/plain');
        if (!leadId) return;

        const leadIdNum = parseInt(leadId, 10);
        if (isNaN(leadIdNum)) return;

        console.log(`Dropped lead ${leadIdNum} onto stage ${targetStageId}`);

        // Optimistically update the UI using react-query cache
        queryClient.setQueryData(['funnelLeads', clinicId, funnelIdForQuery, currentView, currentPage, ITEMS_PER_PAGE, searchTerm, sortValue, stagesData?.map(s => s.id).join(',')], (oldData: LeadsQueryData | undefined) => {
            if (!oldData || !oldData.leads) return oldData;

            const draggedLead = oldData.leads.find(lead => lead.id === leadIdNum);

            // If lead not found or already in the target stage, do nothing
            if (!draggedLead || draggedLead.id_etapa === targetStageId) {
                console.log(`Lead ${leadIdNum} not found or already in stage ${targetStageId}. No UI update.`);
                return oldData;
            }

            console.log(`Optimistically updating lead ${leadIdNum} from stage ${draggedLead.id_etapa} to ${targetStageId}`);

            // Create a new array of leads with the dragged lead's stage updated
            const newLeads = oldData.leads.map(lead =>
                lead.id === leadIdNum ? { ...lead, id_etapa: targetStageId } : lead
            );

            // Return the new data object
            return { ...oldData, leads: newLeads };
        });

        // Call webhook here to update lead stage in database
        if (clinicId) {
            updateLeadStageMutation.mutate({ leadId: leadIdNum, targetStageId: targetStageId, clinicId: clinicId });
        } else {
            showError("Erro: ID da clínica não disponível para atualizar o lead.");
        }
    };

    // Handle navigation to message sequence config page
    const handleConfigureSequence = (stageId: number) => { // Removed messageId parameter
        if (!clinicCode || funnelIdForQuery === undefined) {
            console.error("Clinic code or funnel ID not available for navigation.");
            return;
        }
        // Navigate to the sequence config page, passing context, funnelId, stageId
        const url = `/dashboard/config-sequencia?clinic_code=${encodeURIComponent(clinicCode)}&funnelId=${funnelIdForQuery}&stageId=${stageId}`;
        navigate(url);
    };

    // Helper to format timing display
    const formatTiming = (message: StageMessage): string => {
        if (message.timing_type === 'immediate') {
            return 'Imediata';
        }
        if (message.timing_type === 'delay' && message.delay_value !== null && message.delay_unit) {
            return `+${message.delay_value}${message.delay_unit.charAt(0)}`; // e.g., +2h, +30m, +1d
        }
        return 'N/D';
    };


    // Display UnderConstructionPage if the funnel is invalid
    if (isInvalidFunnel) {
        console.error("FunnelPage: Invalid funnel ID or clinic data. Rendering UnderConstructionPage.", {
            clinicData: clinicData,
            menuId: menuId,
            isNaN_menuId: isNaN(menuId),
            funnelIdForQuery: funnelIdForQuery // Log the determined funnelIdForQuery
        });
        return <UnderConstructionPage />;
    }


    return (
        <TooltipProvider>
            <div className="funnel-container flex flex-col h-full p-6 bg-gray-100">
                <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                    <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                        {funnelName} {/* Removed clinicData?.nome */}
                    </h1>
                    <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                        {/* Hide search and sort in config mode */}
                        {!isConfigMode && (
                            <>
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
                                    {isLoading ? 'Carregando...' : `${totalItems} leads`} {/* Use totalItems here */}
                                </span>
                                {currentView === 'list' && ( // Only show sort for list view
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
                            </>
                        )}
                    </div>
                    <div className="view-toggle flex gap-2 ml-auto flex-shrink-0">
                        {/* Hide view toggle and "Novo Lead" in config mode */}
                        {!isConfigMode && (
                            <>
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
                                <Button onClick={() => alert('Funcionalidade "Novo Lead" ainda não implementada.')} className="flex-shrink-0">
                                    <User className="h-4 w-4 mr-2" /> Novo Lead
                                </Button>
                            </>
                        )}
                        {/* NEW: Configurar / Voltar ao Funil Button */}
                        <Button onClick={() => setIsConfigMode(prev => !prev)} className="flex-shrink-0">
                            <Settings className="h-4 w-4 mr-2" /> {isConfigMode ? 'Voltar ao Funil' : 'Configurar'}
                        </Button>
                    </div>
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
                            {/* Add a retry button if needed */}
                        </div>
                    ) : (stagesData?.length ?? 0) === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhuma etapa configurada para este funil ou nenhum dado retornado.</span>
                        </div>
                    ) : totalItems === 0 && searchTerm !== '' && !isConfigMode ? ( {/* Only show this message if not in config mode */}
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum lead encontrado com o filtro "{searchTerm}".</span>
                        </div>
                    ) : totalItems === 0 && !isConfigMode ? ( {/* Only show this message if not in config mode */}
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhum lead encontrado neste funil.</span>
                        </div>
                    ) : (
                        <>
                            {/* NEW: Configuration Mode View */}
                            {isConfigMode ? (
                                <div className="config-mode-container flex flex-col gap-4">
                                    <h2 className="text-xl font-bold text-primary">Configurar Ações por Etapa</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {stagesData?.map(stage => {
                                            const stageMessage = stageMessagesMap.get(stage.id);
                                            const hasMessage = !!stageMessage;
                                            const messageTiming = hasMessage ? formatTiming(stageMessage!) : '';
                                            return (
                                                <Card key={stage.id} className="stage-config-card p-4">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="text-lg font-semibold">{stage.nome_etapa}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="pt-2">
                                                        <p className="text-sm text-gray-600 mb-3">
                                                            Configure as mensagens e ações automáticas para leads que entrarem nesta etapa.
                                                        </p>
                                                        {hasMessage && (
                                                            <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                                                                <MessageSquare className="h-4 w-4" />
                                                                <span>Mensagem configurada: {messageTiming}</span>
                                                            </div>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => handleConfigureSequence(stage.id)}
                                                            className="w-full"
                                                        >
                                                            <Settings className="h-4 w-4 mr-2" /> {hasMessage ? 'Editar Mensagem/Ações' : 'Configurar Mensagem/Ações'}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Kanban View */}
                                    {currentView === 'kanban' && (
                                        <div className="kanban-board flex gap-4 h-full overflow-x-auto pb-4">
                                            {stagesData?.map(stage => {
                                                const stageMessage = stageMessagesMap.get(stage.id);
                                                const hasMessage = !!stageMessage;
                                                const messageTiming = hasMessage ? formatTiming(stageMessage!) : ''; // Format timing if message exists

                                                return (
                                                    <Card
                                                        key={stage.id}
                                                        className={cn(
                                                            "kanban-column flex flex-col flex-shrink-0 w-80 bg-gray-200 h-full",
                                                            dragOverStageId === stage.id && "border-2 border-primary" // Add border when dragging over
                                                        )}
                                                        onDragOver={(e) => e.preventDefault()} // Allow dropping
                                                        onDrop={(e) => handleDrop(e, stage.id)} // Handle drop
                                                        onDragEnter={(e) => { e.preventDefault(); setDragOverStageId(stage.id); }} // Set drag over state
                                                        onDragLeave={() => setDragOverStageId(null)} // Clear drag over state on drag end
                                                    >
                                                        <CardHeader className="py-3 px-4 border-b-2 border-gray-300 bg-gray-300 rounded-t-md flex flex-row items-center justify-between">
                                                            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                                                {stage.nome_etapa || 'S/Nome'}
                                                                {/* REMOVED: MessageSquarePlus icon and its button */}
                                                            </CardTitle>
                                                            <div className="flex items-center gap-2">
                                                                {/* Display Timing Info */}
                                                                {hasMessage && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="text-xs font-normal text-gray-600 bg-gray-400 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                                                                {stageMessage?.timing_type === 'immediate' ? <Clock className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                                                                                {messageTiming}
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Agendamento: {messageTiming}</p>
                                                                            {stageMessage?.modelo_mensagem && <p>Mensagem: {stageMessage.modelo_mensagem.substring(0, 50)}...</p>}
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
                                                                    draggable // Make cards draggable
                                                                    onDragStart={(e) => {
                                                                        console.log('Drag started for lead:', lead.id);
                                                                        e.dataTransfer.setData('text/plain', String(lead.id)); // Set lead ID
                                                                    }}
                                                                    onDragEnd={() => setDragOverStageId(null)} // Clear drag over state on drag end
                                                                    // Removed onClick from the card itself
                                                                >
                                                                    <div className="lead-name font-medium text-sm mb-1">{lead.nome_lead || "S/ Nome"}</div>
                                                                    <div className="lead-phone text-xs text-gray-600 mb-2">{formatPhone(lead.telefone)}</div>
                                                                    {/* Removed rendering of interests */}
                                                                    {lead.lead_score !== null && (
                                                                        <div className="lead-score flex items-center gap-1 mb-2">
                                                                            {renderStars(lead.lead_score)}
                                                                        </div>
                                                                    )}
                                                                    <div className="card-footer text-xs text-gray-500 border-t border-gray-200 pt-2 flex justify-between items-center">
                                                                        <span className="origin truncate max-w-[70%]" title={`Origem: ${lead.origem || 'N/D'}`}>Origem: {lead.origem || 'N/D'}</span>
                                                                        {/* Modified button onClick to log data */}
                                                                        <Button
                                                                            variant="link"
                                                                            size="sm"
                                                                            className="p-0 h-auto text-primary text-xs"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation(); // Prevent card click
                                                                                console.log("Detalhes do Lead:", lead); // Log the lead data
                                                                                alert("Detalhes do Lead logados no console do navegador."); // Optional: provide visual feedback
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

                                    {/* List View */}
                                    {currentView === 'list' && (
                                        <Card className="leads-list-container h-full flex flex-col">
                                            <CardContent className="p-0 flex-grow overflow-y-auto">
                                                {leadsToDisplay.map(lead => {
                                                     // Get stage and funnel info for list view
                                                    const stageInfo = getStageName(lead.id_etapa); // Use getStageName helper
                                                    // Find message linked to this lead's stage
                                                    const stageMessage = lead.id_etapa !== null ? stageMessagesMap.get(lead.id_etapa) : undefined;
                                                    const hasMessage = !!stageMessage;
                                                    const messageTiming = hasMessage ? formatTiming(stageMessage!) : ''; // Format timing if message exists

                                                    return (
                                                        <div
                                                            key={lead.id}
                                                            className="lead-item flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                                            // Removed onClick from the list item itself
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
                                                                {/* Funnel name is not directly available per lead in this query */}
                                                                {/* <span className={cn("funnel px-2 py-1 rounded-md mt-1", stageInfo.funnelClass)}>{stageInfo.funil}</span> */}
                                                                <span className={cn("stage px-2 py-1 rounded-md mt-1 bg-gray-100 text-gray-800 border border-gray-800")}>{stageInfo}</span> {/* Display stage name */}
                                                                {/* Display Timing Info for the stage message */}
                                                                {hasMessage && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="text-xs font-normal text-gray-600 bg-gray-400 px-1.5 py-0.5 rounded-sm flex items-center gap-1 mt-1">
                                                                                {stageMessage?.timing_type === 'immediate' ? <Clock className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                                                                                {messageTiming}
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Agendamento: {messageTiming}</p>
                                                                            {stageMessage?.modelo_mensagem && <p>Mensagem: {stageMessage.modelo_mensagem.substring(0, 50)}...</p>}
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
                                                            {/* Modified button onClick to log data */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="ml-4 flex-shrink-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Prevent list item click (though none exists now)
                                                                    console.log("Detalhes do Lead:", lead); // Log the lead data
                                                                    alert("Detalhes do Lead logados no console do navegador."); // Optional: provide visual feedback
                                                                }}
                                                            >
                                                                Detalhes
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                            {totalItems > 0 && ( // Only show pagination for list view if there are items
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
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
};

export default FunnelPage;