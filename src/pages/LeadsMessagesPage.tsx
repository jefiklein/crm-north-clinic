import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, Filter, ListOrdered } from 'lucide-react'; // Removed Eye, EyeOff, MessagesSquare
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a MESSAGE item fetched from Supabase
interface MessageItem { // Renamed from SequenceItem
    id: number;
    id_clinica: number;
    nome_sequencia: string; // Field name from DB, will be displayed as "Nome da Mensagem"
    contexto: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
    // numero_passos is removed
}

// Interface InstanceInfo, FunnelDetails, FunnelStage remain the same

interface LeadsMessagesPageProps {
    clinicData: ClinicData | null;
}

const LeadsMessagesPage: React.FC<LeadsMessagesPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
    const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

    const clinicId = clinicData?.id;

    // Fetch messages list (previously rawSequencesList)
    const { data: messagesList, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery<MessageItem[]>({ // Renamed data and isLoading/error
        queryKey: ['leadMessagesList', clinicId, selectedFunnelId, selectedStageId], // Updated queryKey
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`[LeadsMessagesPage] Fetching lead messages for clinic ${clinicId}`);
            let query = supabase
                .from('north_clinic_mensagens_sequencias') // Table name remains 'north_clinic_mensagens_sequencias'
                .select('id, id_clinica, nome_sequencia, contexto, ativo, created_at, updated_at')
                .eq('id_clinica', clinicId)
                .eq('contexto', 'leads') // Contexto 'leads' is still used for filtering
                .order('nome_sequencia', { ascending: true });
            
            const { data, error } = await query;
            if (error) {
                 console.error("[LeadsMessagesPage] Error fetching lead messages from Supabase:", error);
                 throw new Error(error.message);
            }
            console.log("[LeadsMessagesPage] Lead messages fetched:", data);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Removed sequenceIds and useQuery for sequenceSteps as numero_passos is no longer needed

    // Fetch instances list (remains the same)
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<any[]>({ // Type any for simplicity as it's not directly used in this snippet
        queryKey: ['instancesListLeadsMessagesPage', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });
            if (error) {
                 console.error("Error fetching instances for leads messages from Supabase:", error);
                 throw new Error(error.message);
            }
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
    
    // Fetch all funnels (remains the same)
    const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<any[]>({ // Type any
        queryKey: ['allFunnelsLeadsMessages'],
        queryFn: async () => {
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
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch stages for the selected funnel (remains the same)
    const { data: stagesForSelectedFunnel, isLoading: isLoadingStages, error: stagesError } = useQuery<any[]>({ // Type any
        queryKey: ['stagesForFunnelLeadsMessages', selectedFunnelId],
        queryFn: async () => {
            if (selectedFunnelId === null) return [];
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
        enabled: !!clinicId && selectedFunnelId !== null,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Mutation for toggling message status
    const toggleMessageStatusMutation = useMutation({ // Renamed from toggleSequenceStatusMutation
        mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const { data, error } = await supabase
                .from('north_clinic_mensagens_sequencias') // Table name remains
                .update({ ativo: ativo, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('id_clinica', clinicId)
                .select();
            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (_, variables) => {
            showSuccess(`Mensagem ${variables.ativo ? 'ativada' : 'desativada'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['leadMessagesList', clinicId, selectedFunnelId, selectedStageId] }); // Updated queryKey
        },
        onError: (error: Error) => {
            showError(`Erro ao alterar status da mensagem: ${error.message}`);
        },
    });

    // Mutation for deleting a message VIA N8N WEBHOOK
    const deleteMessageMutation = useMutation({ // Renamed from deleteSequenceMutation
        mutationFn: async (messageId: number) => { // Renamed parameter
            if (!clinicId) throw new Error("ID da clínica não disponível."); 
            // Use clinicId (numeric) instead of clinicData?.code
            const payload = { sequenceId: messageId, clinicId: clinicId }; // Removed clinicCode
            const response = await fetch("https://n8n-n8n.sbw0pc.easypanel.host/webhook/cb701587-26dd-4f7a-bc55-5ba70e807273", {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorText = await response.text(); let parsedError = errorText;
                try { const jsonError = JSON.parse(errorText); parsedError = jsonError.message || jsonError.error || errorText; } catch (parseErr) {}
                throw new Error(`Falha ao excluir mensagem via n8n (Status: ${response.status}): ${parsedError.substring(0, 200)}`);
            }
            return await response.json(); 
        },
        onSuccess: () => { 
            showSuccess(`Mensagem excluída com sucesso.`); 
            queryClient.invalidateQueries({ queryKey: ['leadMessagesList', clinicId, selectedFunnelId, selectedStageId] }); // Updated queryKey
        },
        onError: (error: Error) => {
            showError(`Erro ao solicitar exclusão da mensagem: ${error.message}`);
        },
    });

    const handleEditMessage = (messageId: number) => { // Renamed from handleEditSequence
        if (!clinicData?.code) { showError("Erro: Código da clínica não disponível."); return; }
        // Navigation URL still uses 'config-sequencia' as the route path hasn't changed
        navigate(`/dashboard/config-sequencia?id=${messageId}&clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    const handleAddMessage = () => { // Renamed from handleAddSequence
        if (!clinicData?.code) { showError("Erro: Código da clínica não disponível."); return; }
        navigate(`/dashboard/config-sequencia?clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    const handleToggleMessageStatus = (message: MessageItem) => { // Renamed from handleToggleSequenceStatus
        toggleMessageStatusMutation.mutate({ id: message.id, ativo: !message.ativo });
    };

    const handleDeleteMessage = (messageId: number) => { // Renamed from handleDeleteSequence
        if (window.confirm(`Tem certeza que deseja excluir esta Mensagem (ID: ${messageId})?\n\nTODOS OS PASSOS DESTA MENSAGEM SERÃO PERDIDOS.\nEsta ação não pode ser desfeita!`)) {
            deleteMessageMutation.mutate(messageId);
        }
    };
    
    const getMessageDisplayInfo = (message: MessageItem): { name: string } => { // Renamed from getSequenceDisplayInfo
        return { name: message.nome_sequencia }; // nome_sequencia is the DB field
    };

    const isLoading = isLoadingMessages || isLoadingInstances || isLoadingFunnels || isLoadingStages || toggleMessageStatusMutation.isPending || deleteMessageMutation.isPending;
    const fetchError = messagesError || instancesError || funnelsError || stagesError;

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="leads-messages-container max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="config-title text-3xl font-extrabold text-primary whitespace-nowrap">
                    Mensagens de Leads
                </h1>
                <div className="flex gap-4 flex-wrap justify-center sm:justify-end">
                    <Button onClick={handleAddMessage} className="add-message-btn flex-shrink-0 bg-primary text-white hover:bg-primary/90 transition-colors shadow-md"> {/* Renamed class */}
                        <ListOrdered className="h-5 w-5 mr-2" /> Configurar Mensagem
                    </Button>
                </div>
            </div>

            {/* Filter section remains the same */}
            <div className="filter-section flex flex-col sm:flex-row items-center gap-4 mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                <Filter className="h-5 w-5 text-gray-600 flex-shrink-0" />
                <span className="text-lg font-semibold text-gray-700 flex-shrink-0">Filtrar por:</span>
                <div className="flex-grow min-w-[150px]">
                    <Label htmlFor="funnelFilter" className="sr-only">Funil</Label>
                    <Select value={selectedFunnelId?.toString() || ''} onValueChange={(value) => { setSelectedFunnelId(value ? parseInt(value, 10) : null); setSelectedStageId(null); }} disabled={isLoadingFunnels || !!funnelsError}>
                        <SelectTrigger id="funnelFilter"><SelectValue placeholder="Todos os Funis" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={null as any}>Todos os Funis</SelectItem>
                            {allFunnels?.map((funnel: any) => (<SelectItem key={funnel.id} value={funnel.id.toString()}>{funnel.nome_funil}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-grow min-w-[150px]">
                    <Label htmlFor="stageFilter" className="sr-only">Etapa</Label>
                    <Select value={selectedStageId?.toString() || ''} onValueChange={(value) => setSelectedStageId(value ? parseInt(value, 10) : null)} disabled={selectedFunnelId === null || isLoadingStages || !!stagesError || (stagesForSelectedFunnel?.length ?? 0) === 0}>
                        <SelectTrigger id="stageFilter"><SelectValue placeholder="Todas as Etapas" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={null as any}>Todas as Etapas</SelectItem>
                            {stagesForSelectedFunnel?.map((stage: any) => (<SelectItem key={stage.id} value={stage.id.toString()}>{stage.nome_etapa}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-grow text-sm text-gray-600 italic">
                    Filtros de funil/etapa serão aplicados quando as mensagens estiverem vinculadas.
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
                    <span className="text-xl font-medium">Carregando mensagens...</span>
                </div>
            )}

            {!isLoading && !fetchError && (messagesList?.length ?? 0) === 0 ? (
                <div id="noMessagesFound" className="text-center text-gray-600 p-12 bg-gray-50 rounded-lg border border-gray-200 shadow-sm"> {/* Renamed id */}
                    <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
                    <p className="text-2xl font-semibold">Nenhuma mensagem configurada para leads.</p>
                    <p className="mt-2">Clique em "Configurar Mensagem" para começar.</p>
                </div>
            ) : (
                <div id="messageListContainer" className="overflow-x-auto rounded-lg border border-gray-300 shadow-md"> {/* Renamed id */}
                    <Table className="message-table min-w-full">
                        <TableHeader className="bg-gray-100 border-b border-gray-300">
                            <TableRow>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Nome da Mensagem</TableHead>
                                {/* Nº de Passos column removed */}
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Status</TableHead>
                                <TableHead className="text-right text-lg font-semibold text-gray-700 px-6 py-3">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody id="messageTableBody" className="divide-y divide-gray-200"> {/* Renamed id */}
                            {messagesList?.map(message => { // Renamed variable
                                const displayInfo = getMessageDisplayInfo(message);
                                return (
                                    <React.Fragment key={message.id}>
                                        <TableRow data-message-id={message.id} className="hover:bg-gray-50 transition-colors"> {/* Renamed data attribute */}
                                            <TableCell className="font-medium text-gray-900 px-6 py-4 whitespace-nowrap">
                                                {displayInfo.name}
                                            </TableCell>
                                            {/* Cell for numero_passos removed */}
                                            <TableCell className="text-center">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold transition-colors",
                                                    message.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                )}>
                                                    {message.ativo ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right px-6 py-4">
                                                <div className="message-item-actions flex gap-2 justify-end"> {/* Renamed class */}
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="outline" size="sm" onClick={() => handleEditMessage(message.id)} className="edit-message-btn p-1"> {/* Renamed class */}
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>Editar Mensagem</p></TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant={message.ativo ? 'secondary' : 'default'} size="sm" onClick={() => handleToggleMessageStatus(message)} className="toggle-message-btn p-1" disabled={toggleMessageStatusMutation.isPending}> {/* Renamed class */}
                                                                    {toggleMessageStatusMutation.isPending && toggleMessageStatusMutation.variables?.id === message.id ? (<Loader2 className="h-4 w-4 animate-spin" />) : message.ativo ? (<ToggleLeft className="h-4 w-4" />) : (<ToggleRight className="h-4 w-4" />)}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>{message.ativo ? 'Desativar Mensagem' : 'Ativar Mensagem'}</p></TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="destructive" size="sm" onClick={() => handleDeleteMessage(message.id)} className="delete-message-btn p-1" disabled={deleteMessageMutation.isPending}> {/* Renamed class */}
                                                                    {deleteMessageMutation.isPending && deleteMessageMutation.variables === message.id ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Trash2 className="h-4 w-4" />)}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>Excluir Mensagem</p></TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
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