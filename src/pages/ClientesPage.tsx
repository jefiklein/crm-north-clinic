import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Keep useParams for potential future use or consistency, though not used for funnelId here
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarCheck, LineChart, MessageSquare, CalendarDays, ShoppingCart, Loader2, BadgeDollarSign, Scale, CalendarClock, CalendarHeart, Search, List, Kanban, Star, User, Info, TriangleAlert } from "lucide-react";
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

// Define the structure for Funnel Stages (used for Kanban columns)
interface FunnelStage {
    id: number;
    nome_etapa: string;
    ordem: number | null;
    id_funil: number;
}

// Define the structure for Client/Lead data (using the same structure as FunnelLead)
interface ClientLead {
    id: number;
    nome_lead: string | null; // Using nome_lead for consistency with FunnelLead
    telefone: number | null;
    id_etapa: number | null;
    origem: string | null;
    lead_score: number | null;
    interesses: string | null; // Assuming interests is a comma-separated string
    data_entrada: string | null; // ISO timestamp (using data_entrada for consistency)
    // Add other client-specific fields if needed, but keep core structure similar
}

// Define the structure for Funnel Details (used for page title)
interface FunnelDetails {
    id: number;
    nome_funil: string;
}


interface ClientesPageProps {
    clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
// Webhook URLs - Using the same structure as FunnelPage
const STAGES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/b300a010-6bb8-470f-9028-c796f4f8bf0e`; // Webhook para buscar etapas
const FUNNEL_DETAILS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/9eee236a-9103-48e5-82bd-8178396dedfd`; // Webhook para buscar detalhes do funil
const CLIENTS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/41744e59-6dec-4583-99e1-66192db618d4`; // Webhook para buscar leads/clientes
const LEAD_DETAILS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/9c8216dd-f489-464e-8ce4-45c227857707`; // Webhook para detalhes do lead/cliente


// Define the specific funnel ID for the Clients page
const CLIENTS_FUNNEL_ID = 5;


// Helper functions (copied from FunnelPage)
function formatPhone(phone: number | string | null): string {
    if (!phone) return 'S/ Tel.';
    const s = String(phone).replace(/\D/g, '');
    if (s.length === 11) return `(${s.substring(0, 2)}) ${s.substring(2, 7)}-${s.substring(7)}`;
    if (s.length === 10) return `(${s.substring(0, 2)}) ${s.substring(2, 6)}-${s.substring(6)}`;
    return s;
}

function renderStars(score: number | null): JSX.Element[] {
    const stars = [];
    const numScore = score ? Math.min(5, Math.max(0, Math.round(score))) : 0;
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


const ClientesPage: React.FC<ClientesPageProps> = ({ clinicData }) => {
    // We don't get funnelId from URL here, it's fixed for this page
    // const { funnelId: menuIdParam } = useParams<{ funnelId: string }>();
    // const menuId = parseInt(menuIdParam || '0', 10);

    // The actual funnel ID to use for webhook calls is fixed
    const funnelIdForWebhook = CLIENTS_FUNNEL_ID; // Use the fixed ID 5

    const [currentView, setCurrentView] = useState<'kanban' | 'list'>('kanban'); // Default view
    const [searchTerm, setSearchTerm] = useState('');
    const [sortValue, setSortValue] = useState('recent'); // Default sort
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 15;

    const clinicId = clinicData?.id;

    // --- Debugging Logs ---
    console.log("ClientesPage: Rendering");
    console.log("ClientesPage: clinicData:", clinicData);
    console.log("ClientesPage: !clinicData:", !clinicData);
    console.log("ClientesPage: funnelIdForWebhook (fixed):", funnelIdForWebhook);
    // --- End Debugging Logs ---


    // Fetch Stages (using the same webhook as FunnelPage)
    const { data: stagesData, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
        queryKey: ['funnelStages', clinicId, funnelIdForWebhook], // Use fixed funnelIdForWebhook
        queryFn: async () => {
            if (!clinicId) throw new Error("Dados da clínica não disponíveis.");
            const response = await fetch(STAGES_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ funnel_id: funnelIdForWebhook, clinic_id: clinicId }) // Use fixed funnelIdForWebhook in the body
            });
            if (!response.ok) throw new Error(`Erro ao buscar etapas: ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("Resposta de etapas inválida: não é um array.");
            return data.sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity));
        },
        enabled: !!clinicId, // Enable only if clinicId exists
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Fetch Funnel Details (using the same webhook as FunnelPage)
    const { data: funnelDetailsData, isLoading: isLoadingFunnelDetails, error: funnelDetailsError } = useQuery<FunnelDetails[]>({
        queryKey: ['funnelDetails', clinicId, funnelIdForWebhook], // Use fixed funnelIdForWebhook
        queryFn: async () => {
            if (!clinicId) throw new Error("Dados da clínica não disponíveis.");
            const response = await fetch(FUNNEL_DETAILS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ funnel_id: funnelIdForWebhook, clinic_id: clinicId }) // Use fixed funnelIdForWebhook in the body
            });
            if (!response.ok) throw new Error(`Erro ao buscar detalhes do funil: ${response.status}`);
            const data = await response.json();
             // Expecting an array with one object: [{ "nome_funil": "Nome do Funil" }]
            if (!Array.isArray(data) || data.length === 0 || !data[0] || typeof data[0].nome_funil === 'undefined') {
                 console.warn("Resposta de detalhes do funil inválida:", data);
                 // Provide a default name based on the fixed ID
                 return [{ id: funnelIdForWebhook, nome_funil: `Funil ${funnelIdForWebhook}` }];
            }
            return data; // Should be an array with one item
        },
        enabled: !!clinicId, // Enable only if clinicId exists
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Fetch Clients/Leads (using the same webhook as FunnelPage)
    const { data: clientsData, isLoading: isLoadingClients, error: clientsError } = useQuery<ClientLead[]>({
        queryKey: ['funnelClients', clinicId, funnelIdForWebhook], // Use fixed funnelIdForWebhook
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponíveis.");
            const response = await fetch(CLIENTS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ funnel_id: funnelIdForWebhook, clinic_id: clinicId }) // Use fixed funnelIdForWebhook in the body
            });
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
                throw new Error(`Erro ao buscar clientes/leads (${response.status}): ${errorDetail}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                 console.warn("Resposta de clientes/leads inválida: não é um array. Recebeu:", data);
                 return []; // Return empty array if not an array
            }
            return data;
        },
        enabled: !!clinicId, // Enable only if clinicId exists
        staleTime: 60 * 1000, // 1 minute for leads/clients
    });

    // Combine loading states and errors
    const isLoading = isLoadingStages || isLoadingFunnelDetails || isLoadingClients;
    const fetchError = stagesError || funnelDetailsError || clientsError;

    // Filter and Sort Clients/Leads (using the same logic as FunnelPage)
    const filteredAndSortedClients = useMemo(() => {
        if (!clientsData) return [];

        let filtered = clientsData.filter(lead => {
            const searchTermLower = searchTerm.toLowerCase();
            const nameMatch = lead.nome_lead?.toLowerCase().includes(searchTermLower) || false;
            const phoneMatch = String(lead.telefone || '').includes(searchTerm) || false;
            // Add CPF search if 'cpf_north' was included in the ClientLead interface and webhook response
            // const cpfMatch = String(lead.cpf_north || '').includes(searchTerm) || false;
            return nameMatch || phoneMatch; // || cpfMatch;
        });

        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'recent':
                    const dateA = a.data_entrada ? new Date(a.data_entrada).getTime() : -Infinity;
                    const dateB = b.data_entrada ? new Date(b.data_entrada).getTime() : -Infinity;
                    return dateB - dateA; // Newest first
                case 'oldest':
                    const dateA_ = a.data_entrada ? new Date(a.data_entrada).getTime() : Infinity;
                    const dateB_ = b.data_entrada ? new Date(b.data_entrada).getTime() : Infinity;
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
    }, [clientsData, searchTerm, sortValue]);

    // Pagination for List View
    const totalPages = Math.ceil(filteredAndSortedClients.length / ITEMS_PER_PAGE);
    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredAndSortedClients.slice(start, end);
    }, [filteredAndSortedClients, currentPage]);

    // Update current page if filtering/sorting reduces total pages
    useEffect(() => {
        // Corrected Math call here
        const newTotalPages = Math.ceil(filteredAndSortedClients.length / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
            setCurrentPage(newTotalPages);
        } else if (filteredAndSortedClients.length > 0 && currentPage === 0) {
             setCurrentPage(1);
        } else if (filteredAndSortedClients.length === 0) {
             setCurrentPage(1); // Reset page if no clients
        }
    }, [filteredAndSortedClients.length, currentPage]);


    // Get Stage Name Helper (using the same logic as FunnelPage)
    const getStageName = (idEtapa: number | null): string => {
        if (idEtapa === null) return 'Etapa Desconhecida';
        const stage = stagesData?.find(s => s.id === idEtapa);
        return stage ? stage.nome_etapa : 'Etapa Desconhecida';
    };

    // Group clients/leads by stage for Kanban (using the same logic as FunnelPage)
    const clientsByStage = useMemo(() => {
        const grouped: { [stageId: number]: ClientLead[] } = {};
        stagesData?.forEach(stage => {
            grouped[stage.id] = [];
        });
        filteredAndSortedClients.forEach(lead => {
            if (lead.id_etapa !== null && grouped[lead.id_etapa]) {
                grouped[lead.id_etapa].push(lead);
            } else {
                 // Handle leads with null or invalid stage IDs if necessary
                 // For now, they won't appear in Kanban
                 console.warn(`Client/Lead ${lead.id} has invalid stage ID: ${lead.id_etapa}`);
            }
        });
        return grouped;
    }, [filteredAndSortedClients, stagesData]);


    // Funnel Name (using the same logic as FunnelPage, but for the fixed ID)
    const funnelName = funnelDetailsData?.[0]?.nome_funil || `Funil ${funnelIdForWebhook}`;


    // Conditional rendering based on clinicData availability
    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }


    return (
        <div className="clientes-container flex flex-col h-full p-6 bg-gray-100"> {/* Changed class name */}
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                    {clinicData?.nome} | Clientes {/* Explicitly "Clientes" */}
                </h1>
                <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                    <div className="relative flex-grow max-w-sm">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                         <Input
                            type="text"
                            placeholder="Buscar clientes (Nome, Telefone, CPF)..." // Updated placeholder
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9"
                         />
                    </div>
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                        {isLoading ? 'Carregando...' : `${filteredAndSortedClients.length} clientes`} {/* Updated text */}
                    </span>
                    {currentView === 'list' && (
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
                <Button onClick={() => alert('Funcionalidade "Novo Cliente" ainda não implementada.')} className="flex-shrink-0"> {/* Updated button text */}
                    <User className="h-4 w-4 mr-2" /> Novo Cliente
                </Button>
            </div>

            <div className="view-container flex-grow overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-primary">
                        <Loader2 className="h-12 w-12 animate-spin mb-4" />
                        <span className="text-lg">Carregando dados de clientes...</span> {/* Updated text */}
                    </div>
                ) : fetchError ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-600 p-4 bg-red-50 rounded-md">
                        <TriangleAlert className="h-12 w-12 mb-4" />
                        <span className="text-lg text-center">Erro ao carregar dados de clientes: {fetchError.message}</span> {/* Updated text */}
                        {/* Add a retry button if needed */}
                    </div>
                ) : (stagesData?.length ?? 0) === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                        <Info className="h-12 w-12 mb-4" />
                        <span className="text-lg text-center">Nenhuma etapa configurada para este funil de clientes ou nenhum dado retornado.</span> {/* Updated text */}
                    </div>
                ) : filteredAndSortedClients.length === 0 && searchTerm !== '' ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                        <Info className="h-12 w-12 mb-4" />
                        <span className="text-lg text-center">Nenhum cliente encontrado com o filtro "{searchTerm}".</span> {/* Updated text */}
                    </div>
                ) : (
                    <>
                        {/* Kanban View */}
                        {currentView === 'kanban' && (
                            <div className="kanban-board flex gap-4 h-full overflow-x-auto pb-4">
                                {stagesData?.map(stage => (
                                    <Card key={stage.id} className="kanban-column flex flex-col flex-shrink-0 w-80 bg-gray-200 h-full">
                                        <CardHeader className="py-3 px-4 border-b-2 border-gray-300 bg-gray-300 rounded-t-md flex flex-row items-center justify-between">
                                            <CardTitle className="text-base font-semibold text-gray-800">{stage.nome_etapa || 'S/Nome'}</CardTitle>
                                            <span className="text-xs font-normal text-gray-600 bg-gray-400 px-1.5 py-0.5 rounded-sm">
                                                {clientsByStage[stage.id]?.length || 0} {/* Use clientsByStage */}
                                            </span>
                                        </CardHeader>
                                        <CardContent className="flex-grow overflow-y-auto p-3 flex flex-col gap-3">
                                            {clientsByStage[stage.id]?.map(lead => ( {/* Use clientsByStage */}
                                                <div
                                                    key={lead.id}
                                                    className="kanban-card bg-white rounded-md p-3 shadow-sm border border-gray-200 cursor-grab hover:shadow-md hover:border-l-4 hover:border-primary transition-all duration-200"
                                                    draggable // Make cards draggable (visual only for now)
                                                    onDragStart={(e) => {
                                                        // Basic drag start - no complex data transfer or state update yet
                                                        console.log('Drag started for client/lead:', lead.id);
                                                        e.dataTransfer.setData('text/plain', String(lead.id)); // Example data transfer
                                                    }}
                                                    onClick={() => openLeadDetails(lead.telefone)} // Open details on click
                                                >
                                                    <div className="lead-name font-medium text-sm mb-1">{lead.nome_lead || "S/ Nome"}</div>
                                                    <div className="lead-phone text-xs text-gray-600 mb-2">{formatPhone(lead.telefone)}</div>
                                                    {lead.interesses && (
                                                        <div className="lead-tags flex flex-wrap gap-1 mb-2">
                                                            {renderInterests(lead.interesses)}
                                                        </div>
                                                    )}
                                                    {lead.lead_score !== null && (
                                                        <div className="lead-score flex items-center gap-1 mb-2">
                                                            {renderStars(lead.lead_score)}
                                                        </div>
                                                    )}
                                                    <div className="card-footer text-xs text-gray-500 border-t border-gray-200 pt-2 flex justify-between items-center">
                                                        <span className="origin truncate max-w-[70%]" title={`Origem: ${lead.origem || 'N/D'}`}>Origem: {lead.origem || 'N/D'}</span>
                                                        <Button variant="link" size="sm" className="p-0 h-auto text-primary text-xs" onClick={(e) => { e.stopPropagation(); openLeadDetails(lead.telefone); }}>Detalhes</Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* List View */}
                        {currentView === 'list' && (
                            <Card className="clients-list-container h-full flex flex-col"> {/* Changed class name */}
                                <CardContent className="p-0 flex-grow overflow-y-auto">
                                    {paginatedClients.map(lead => ( {/* Use paginatedClients */}
                                        <div
                                            key={lead.id}
                                            className="client-item flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer" // Changed class name
                                            onClick={() => openLeadDetails(lead.telefone)}
                                        >
                                            <User className="h-6 w-6 mr-4 text-primary flex-shrink-0" />
                                            <div className="client-info flex flex-col flex-1 min-w-0 mr-4"> {/* Changed class name */}
                                                <span className="client-name font-medium text-base truncate">{lead.nome_lead || "S/ Nome"}</span> {/* Changed class name */}
                                                <span className="client-phone text-sm text-gray-600">{formatPhone(lead.telefone)}</span> {/* Changed class name */}
                                                {lead.interesses && (
                                                    <div className="lead-tags flex flex-wrap gap-1 mt-1">
                                                        {renderInterests(lead.interesses)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="client-details flex flex-col text-sm text-gray-600 min-w-[150px] mr-4"> {/* Changed class name */}
                                                {lead.origem && <div className="client-origin truncate">Origem: {lead.origem}</div>} {/* Changed class name */}
                                                <div className="client-creation-date text-xs text-gray-500">Cadastro: {formatLeadTimestamp(lead.data_entrada)}</div> {/* Changed class name */}
                                            </div>
                                            <div className="client-funnel flex flex-col items-center text-xs font-semibold min-w-[120px]"> {/* Changed class name */}
                                                <span className="funnel px-2 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-800">{funnelName}</span>
                                                <span className="stage px-2 py-1 rounded-md bg-green-100 text-green-800 border border-green-800 mt-1">{getStageName(lead.id_etapa)}</span>
                                            </div>
                                            {lead.lead_score !== null && (
                                                <div className="lead-score flex items-center ml-4">
                                                    <div className="stars flex gap-0.5">
                                                        {renderStars(lead.lead_score)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                                {filteredAndSortedClients.length > 0 && (
                                    <div className="pagination-container p-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                                        <div className="pagination-info text-sm text-gray-600">
                                            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                                            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedClients.length)} de {filteredAndSortedClients.length} clientes {/* Updated text */}
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
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ClientesPage;