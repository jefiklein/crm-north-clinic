import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Filter } from 'lucide-react'; // Added Filter icon
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { Label } from "@/components/ui/label"; // Import Label component

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a message item fetched from Supabase
interface MessageItem {
    id: number;
    categoria: string; // Still exists in DB, but not used for filtering/display here
    modelo_mensagem: string | null;
    midia_mensagem: string | null;
    id_instancia: number | null | string;
    grupo: string | null;
    ativo: boolean;
    hora_envio: string | null;
    intervalo: number | null;
    id_clinica: number;
    variacao_1: string | null;
    variacao_2: string | null;
    variacao_3: string | null;
    variacao_4: string | null;
    variacao_5: string | null;
    para_funcionario: boolean;
    para_grupo: boolean;
    para_cliente: boolean;
    url_arquivo: string | null;
    prioridade: number;
    created_at: string;
    updated_at: string;
    context: string | null; // Should be 'leads' for this page
    dias_mensagem_cashback: number | null;
    tipo_mensagem_cashback: string | null;
    // TODO: Add id_funil and id_etapa here once DB is updated
    // id_funil: number | null;
    // id_etapa: number | null;
}

// Define the structure for Instance Info from Supabase
interface InstanceInfo {
    id: number | string;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

// Define the structure for Funnel Details (from Supabase)
interface FunnelDetails {
    id: number;
    nome_funil: string;
}

// Define the structure for Funnel Stages (from Supabase)
interface FunnelStage {
    id: number;
    nome_etapa: string;
    id_funil: number;
}


interface LeadsMessagesPageProps {
    clinicData: ClinicData | null;
}

const placeholderData = {
    primeiro_nome_cliente: "Maria",
    nome_completo_cliente: "Maria Souza",
    primeiro_nome_funcionario: "Silva",
    nome_completo_funcionario: "Dr(a). João Silva",
    nome_servico_principal: "Consulta Inicial",
    lista_servicos: "Consulta Inicial, Exame Simples",
    data_agendamento: "19/04/2025",
    dia_agendamento_num: "19",
    dia_semana_relativo_extenso: "sábado",
    mes_agendamento_num: "04",
    mes_agendamento_extenso: "Abril",
    hora_agendamento: "15:30"
};

function simulateMessage(template: string | null, placeholders: { [key: string]: string }): string {
    if (typeof template !== 'string' || !template) return '<i class="text-gray-500">(Modelo inválido ou vazio)</i>';
    let text = template;
    for (const key in placeholders) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        text = text.replace(regex, `<strong>${placeholders[key]}</strong>`);
    }
    text = text.replace(/\{([\w_]+)\}/g, '<span class="unreplaced-token text-gray-600 bg-gray-200 px-1 rounded font-mono text-xs">{$1}</span>');
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    text = text.replace(/\\n|\n/g, '<br>');
    return text;
}

const LeadsMessagesPage: React.FC<LeadsMessagesPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [expandedPreviews, setExpandedPreviews] = useState<Set<number>>(new Set());

    // State for filters
    const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
    const [selectedStageId, setSelectedStageId] = useState<number | null>(null);


    const clinicId = clinicData?.id;

    // Fetch message list filtered by context 'leads'
    const { data: messagesList, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery<MessageItem[]>({
        queryKey: ['leadsMessagesList', clinicId, selectedFunnelId, selectedStageId], // Add filters to key
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`Fetching leads messages for clinic ${clinicId} from Supabase`);

            let query = supabase
                .from('north_clinic_config_mensagens')
                .select('*')
                .eq('id_clinica', clinicId)
                .eq('context', 'leads') // <-- Filter by context 'leads'
                .order('categoria', { ascending: true }) // Keep default order for now
                .order('prioridade', { ascending: true });

            // TODO: Add filtering by id_funil and id_etapa here once columns exist in DB
            // if (selectedFunnelId !== null) {
            //     // Need to filter messages based on their linked stage's funnel ID
            //     // This requires joining or a subquery, which is complex without direct columns
            //     console.warn("Funnel filtering not implemented yet due to DB schema.");
            // }
            // if (selectedStageId !== null) {
            //     // Need to filter messages based on their linked stage ID
            //     // This requires joining or a subquery, which is complex without direct columns
            //     console.warn("Stage filtering not implemented yet due to DB schema.");
            // }


            const { data, error } = await query;

            if (error) {
                 console.error("Error fetching leads messages from Supabase:", error);
                 throw new Error(error.message);
            }
            console.log("Leads messages fetched:", data);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch instances list (needed for displaying instance name)
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListLeadsMessagesPage', clinicId], // Unique key
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`Fetching instances for clinic ${clinicId} for leads messages page`);
            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });
            if (error) {
                 console.error("Error fetching instances for leads messages from Supabase:", error);
                 throw new Error(error.message);
            }
            console.log("Instances fetched for leads messages:", data);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const instanceMap = useMemo(() => {
        const map = new Map<string, InstanceInfo>();
        instancesList?.forEach(instance => {
            map.set(String(instance.id), instance);
        });
        return map;
    }, [instancesList]);

    // Fetch all funnels (for filter select)
    const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
        queryKey: ['allFunnelsLeadsMessages'],
        queryFn: async () => {
            console.log(`[LeadsMessagesPage] Fetching all funnels from Supabase...`);
            const { data, error } = await supabase
                .from('north_clinic_crm_funil')
                .select('id, nome_funil')
                .order('nome_funil', { ascending: true });
            if (error) {
                console.error("[LeadsMessagesPage] Supabase all funnels fetch error:", error);
                throw new Error(`Erro ao buscar funis: ${error.message}`);
            }
            return data || [];
        },
        enabled: !!clinicId, // Enabled if clinicId is available
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch stages for the selected funnel (for filter select)
    const { data: stagesForSelectedFunnel, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
        queryKey: ['stagesForFunnelLeadsMessages', selectedFunnelId],
        queryFn: async () => {
            if (selectedFunnelId === null) return [];
            console.log(`[LeadsMessagesPage] Fetching stages for funnel ${selectedFunnelId} from Supabase...`);
            const { data, error } = await supabase
                .from('north_clinic_crm_etapa')
                .select('id, nome_etapa, id_funil')
                .eq('id_funil', selectedFunnelId)
                .order('ordem', { ascending: true });
            if (error) {
                console.error("[LeadsMessagesPage] Supabase stages fetch error:", error);
                throw new Error(`Erro ao buscar etapas: ${error.message}`);
            }
            return data || [];
        },
        enabled: !!clinicId && selectedFunnelId !== null, // Enabled if clinicId is available and a funnel is selected
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });


    // Mutation for toggling message status (using the existing webhook)
    const toggleMessageMutation = useMutation({
        mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`Toggling message ${id} to active=${ativo} via webhook`);
            const response = await fetch('https://n8n-n8n.sbw0pc.easypanel.host/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ativo, id_clinica: clinicId })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            console.log(`Message ${id} toggle successful`);
            return response.json();
        },
        onSuccess: (_, variables) => {
            showSuccess(`Mensagem ${variables.ativo ? 'ativada' : 'desativada'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['leadsMessagesList', clinicId, selectedFunnelId, selectedStageId] }); // Invalidate this page's query
        },
        onError: (error: Error) => {
            showError(`Erro ao alterar status da mensagem: ${error.message}`);
        },
    });

    // Mutation for deleting message (using the existing webhook)
    const deleteMessageMutation = useMutation({
        mutationFn: async (id: number) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`Deleting message ${id} via webhook`);
            const response = await fetch('https://n8n-n8n.sbw0pc.easypanel.host/webhook/4632ce57-e78a-4c62-9578-5a33b576ad73', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, id_clinica: clinicId })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            console.log(`Message ${id} deletion successful`);
            return response.json();
        },
        onSuccess: () => {
            showSuccess('Mensagem excluída com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['leadsMessagesList', clinicId, selectedFunnelId, selectedStageId] }); // Invalidate this page's query
        },
        onError: (error: Error) => {
            showError(`Erro ao excluir mensagem: ${error.message}`);
        },
    });


    // Handle navigation to the *single* MensagensConfigPage for adding
    const handleAddMessage = () => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        // Navigate to the config page, passing the context 'leads'
        navigate(`/dashboard/config-mensagem?clinic_code=${encodeURIComponent(clinicData.code)}&context=leads`);
    };

    // Handle navigation to the *single* MensagensConfigPage for editing
    const handleEditMessage = (messageId: number) => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        // Navigate to the config page with the message ID
        navigate(`/dashboard/config-mensagem?id=${messageId}&clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    const handleToggleMessage = (message: MessageItem) => {
        toggleMessageMutation.mutate({ id: message.id, ativo: !message.ativo });
    };

    const handleDeleteMessage = (messageId: number) => {
        if (window.confirm(`Tem certeza que deseja excluir esta mensagem (ID: ${messageId})?\n\nEsta ação não pode ser desfeita!`)) {
            deleteMessageMutation.mutate(messageId);
        }
    };

    const handlePreviewToggle = (messageId: number) => {
        setExpandedPreviews(prev => {
            const newSet = new Set(prev);
            const itemIdString = String(messageId); // Ensure consistent key type
            if (newSet.has(itemIdString)) {
                newSet.delete(itemIdString);
            } else {
                newSet.add(itemIdString);
            }
            return newSet;
        });
    };

    // Helper to display Funnel/Stage (Placeholder for now)
    const getFunnelStageDisplay = (message: MessageItem): string => {
        // TODO: Implement logic to find linked funnel/stage once DB is updated
        // For now, display a placeholder or category if context is 'leads'
        if (message.context === 'leads') {
             // If message is linked to a stage/funnel, display it
             // Example (requires DB columns):
             // const stage = stagesForSelectedFunnel?.find(s => s.id === message.id_etapa);
             // const funnel = allFunnels?.find(f => f.id === stage?.id_funil);
             // if (stage && funnel) return `${funnel.nome_funil} / ${stage.nome_etapa}`;

             // Fallback to category for now, or a generic placeholder
             return message.categoria || 'Lead Message'; // Use category as fallback display
        }
        return message.categoria || 'N/A'; // Fallback for other contexts (shouldn't happen with filter)
    };


    const isLoading = isLoadingMessages || isLoadingInstances || isLoadingFunnels || isLoadingStages || toggleMessageMutation.isLoading || deleteMessageMutation.isLoading;
    const fetchError = messagesError || instancesError || funnelsError || stagesError;

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="leads-messages-container max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="config-title text-3xl font-extrabold text-primary whitespace-nowrap">
                    Lista de Mensagens de Leads
                </h1>
                <Button onClick={handleAddMessage} className="add-message-btn flex-shrink-0 bg-primary text-white hover:bg-primary/90 transition-colors shadow-md">
                    <Plus className="h-5 w-5 mr-2" /> Configurar Nova Mensagem de Lead
                </Button>
            </div>

            {/* Filter Section */}
            <div className="filter-section flex flex-col sm:flex-row items-center gap-4 mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                 <Filter className="h-5 w-5 text-gray-600 flex-shrink-0" />
                 <span className="text-lg font-semibold text-gray-700 flex-shrink-0">Filtrar por:</span>

                 {/* Funnel Select */}
                 <div className="flex-grow min-w-[150px]">
                     <Label htmlFor="funnelFilter" className="sr-only">Funil</Label>
                     <Select
                         value={selectedFunnelId?.toString() || ''}
                         onValueChange={(value) => {
                             setSelectedFunnelId(value ? parseInt(value, 10) : null);
                             setSelectedStageId(null); // Reset stage when funnel changes
                         }}
                         disabled={isLoadingFunnels || !!funnelsError}
                     >
                         <SelectTrigger id="funnelFilter">
                             <SelectValue placeholder="Todos os Funis" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectItem value={null as any}>Todos os Funis</SelectItem> {/* Changed value to null */}
                             {allFunnels?.map(funnel => (
                                 <SelectItem key={funnel.id} value={funnel.id.toString()}>{funnel.nome_funil}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                 </div>

                 {/* Stage Select */}
                 <div className="flex-grow min-w-[150px]">
                     <Label htmlFor="stageFilter" className="sr-only">Etapa</Label>
                     <Select
                         value={selectedStageId?.toString() || ''}
                         onValueChange={(value) => setSelectedStageId(value ? parseInt(value, 10) : null)}
                         disabled={selectedFunnelId === null || isLoadingStages || !!stagesError || (stagesForSelectedFunnel?.length ?? 0) === 0}
                     >
                         <SelectTrigger id="stageFilter">
                             <SelectValue placeholder="Todas as Etapas" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectItem value={null as any}>Todas as Etapas</SelectItem> {/* Changed value to null */}
                             {stagesForSelectedFunnel?.map(stage => (
                                 <SelectItem key={stage.id} value={stage.id.toString()}>{stage.nome_etapa}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                 </div>

                 {/* Placeholder for filter functionality explanation */}
                 <div className="flex-grow text-sm text-gray-600 italic">
                     {/* TODO: Implement filtering logic based on selected Funnel/Stage */}
                     {/* Filtering requires messages to be linked to stages/funnels in the database. */}
                 </div>
            </div>


            {fetchError && (
                <div className="error-message flex items-center gap-2 p-4 mb-6 bg-red-100 text-red-700 border border-red-300 rounded-md shadow-sm">
                    <TriangleAlert className="h-6 w-6 flex-shrink-0" />
                    <span className="text-lg font-semibold">Erro ao carregar dados: {fetchError.message}</span>
                    <Button variant="outline" size="sm" onClick={() => { refetchMessages(); queryClient.invalidateQueries({ queryKey: ['instancesListLeadsMessagesPage', clinicId] }); queryClient.invalidateQueries({ queryKey: ['allFunnelsLeadsMessages'] }); queryClient.invalidateQueries({ queryKey: ['stagesForFunnelLeadsMessages', selectedFunnelId] }); }} className="ml-auto">
                        Tentar Novamente
                    </Button>
                </div>
            )}

            {isLoading && !fetchError && (
                <div className="loading-indicator flex flex-col items-center justify-center p-12 text-primary">
                    <Loader2 className="h-16 w-16 animate-spin mb-6" />
                    <span className="text-xl font-medium">Carregando configurações...</span>
                </div>
            )}

            {!isLoading && !fetchError && (messagesList?.length ?? 0) === 0 ? (
                <div id="noMessagesFound" className="text-center text-gray-600 p-12 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                    <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
                    <p className="text-2xl font-semibold">Nenhuma mensagem automática configurada encontrada para leads.</p>
                </div>
            ) : (
                <div id="messageListContainer" className="overflow-x-auto rounded-lg border border-gray-300 shadow-md">
                    <Table className="message-table min-w-full">
                        <TableHeader className="bg-gray-100 border-b border-gray-300">
                            <TableRow>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Funil / Etapa</TableHead> {/* New column */}
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Status</TableHead>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Instância</TableHead>
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Prioridade</TableHead>
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Horário Prog.</TableHead>
                                <TableHead className="text-right text-lg font-semibold text-gray-700 px-6 py-3">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody id="messageTableBody" className="divide-y divide-gray-200">
                            {messagesList?.map(message => {
                                const isExpanded = expandedPreviews.has(message.id);
                                const instanceIdStr = message.id_instancia !== null && message.id_instancia !== undefined ? String(message.id_instancia) : '';
                                const instance = instanceMap.get(instanceIdStr);
                                const instanceName = instance ? (instance.nome_exibição || `ID ${instance.id}`) : "Não definida";
                                const instanceClass = instance ? '' : 'not-set';

                                // Determine if expansion is needed (same logic as MensagensListPage)
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = simulateMessage(message.modelo_mensagem, placeholderData);
                                const plainText = tempDiv.textContent || tempDiv.innerText || '';
                                const formattedMessage = simulateMessage(message.modelo_mensagem, placeholderData); // Re-simulate for full content
                                const needsExpansion = plainText.length > 150 || formattedMessage.includes('<br>') || formattedMessage.includes('<em>') || formattedMessage.includes('<strong>');


                                return (
                                    <React.Fragment key={message.id}>
                                        <TableRow data-message-id={message.id} data-category={message.categoria} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                            <TableCell className="font-medium text-gray-900 px-6 py-4 whitespace-nowrap">
                                                {/* Placeholder for Funnel / Stage */}
                                                {getFunnelStageDisplay(message)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold transition-colors",
                                                    message.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                )}>
                                                    {message.ativo ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-gray-700 px-6 py-4">
                                                <span className={cn("inline-flex items-center gap-2 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded select-none", instanceClass)}>
                                                    <MessagesSquare className="h-4 w-4" /> {instanceName}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-gray-900 font-semibold px-6 py-4">{message.prioridade ?? 'N/D'}</TableCell>
                                            <TableCell className="text-center text-gray-700 px-6 py-4">
                                                {message.hora_envio ? message.hora_envio : '-'}
                                            </TableCell>
                                            <TableCell className="text-right px-6 py-4">
                                                <div className="message-item-actions flex gap-2 justify-end">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handlePreviewToggle(message.id)}
                                                                    className="preview-toggle-btn p-1"
                                                                >
                                                                    {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{isExpanded ? 'Ocultar Preview' : 'Ver Preview'}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleEditMessage(message.id)}
                                                                    className="edit-message-btn p-1"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Editar Mensagem</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant={message.ativo ? 'secondary' : 'default'}
                                                                    size="sm"
                                                                    onClick={() => handleToggleMessage(message)}
                                                                    className="toggle-message-btn p-1"
                                                                    disabled={toggleMessageMutation.isLoading}
                                                                >
                                                                    {toggleMessageMutation.isLoading ? (
                                                                         <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : message.ativo ? (
                                                                        <ToggleLeft className="h-4 w-4" />
                                                                    ) : (
                                                                        <ToggleRight className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{message.ativo ? 'Desativar Mensagem' : 'Ativar Mensagem'}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteMessage(message.id)}
                                                                    className="delete-message-btn p-1"
                                                                    disabled={deleteMessageMutation.isLoading}
                                                                >
                                                                    {deleteMessageMutation.isLoading ? (
                                                                         <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                         <Trash2 className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Excluir Mensagem</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {/* Preview Row */}
                                        <TableRow className={cn("preview-row bg-gray-50 text-gray-900 text-base border-t border-gray-200", !isExpanded && 'hidden')}>
                                            <TableCell colSpan={6} className="p-6"> {/* Adjusted colspan */}
                                                <div
                                                    className="preview-content whitespace-pre-wrap leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: simulateMessage(message.modelo_mensagem, placeholderData) }}
                                                ></div>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default LeadsMessagesPage;