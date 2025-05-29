import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, Info, MessageSquarePlus, Clock, Hourglass, Edit, Trash2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import UnderConstructionPage from './UnderConstructionPage';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { showSuccess, showError } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select for target stage

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

// Define the structure for a Message linked to a stage (fetched from Supabase)
interface StageMessage {
    id: number;
    modelo_mensagem: string | null;
    timing_type: string | null; // 'immediate' or 'delay'
    delay_value: number | null;
    delay_unit: string | null; // 'minutes', 'hours', 'days'
    id_etapa: number; // Link back to the stage
    id_funil: number; // Link back to the funnel
}

// Define the structure for a Message item for selection (from Supabase)
interface SelectableMessageItem {
    id: number;
    modelo_mensagem: string | null;
    id_funil: number | null;
    id_etapa: number | null;
    // Add other fields if needed for display in the selection list
}

// Mapping from menu item ID (from URL) to actual funnel ID (for database queries)
const menuIdToFunnelIdMap: { [key: number]: number } = {
    4: 1, // Funil de Vendas
    5: 2, // Funil de Recuperação
    6: 3, // Funil de Faltas
    7: 4, // Funil Compareceram
    8: 5, // Clientes
    // Add other menu item IDs and their corresponding funnel IDs here as needed
};

interface FunnelConfigPageProps {
    clinicData: ClinicData | null;
}

const FunnelConfigPage: React.FC<FunnelConfigPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { funnelId: menuIdParam } = useParams<{ funnelId: string }>();
    const menuId = parseInt(menuIdParam || '0', 10);

    const funnelIdForQuery = menuIdToFunnelIdMap[menuId];

    const clinicId = clinicData?.id;
    const clinicCode = clinicData?.code;

    // State for the action configuration modal
    const [isActionConfigModalOpen, setIsActionConfigModalOpen] = useState(false);
    const [stageToConfigureId, setStageToConfigureId] = useState<number | null>(null);
    const [selectedActionType, setSelectedActionType] = useState<'message' | 'change_stage'>('message'); // New state for action type
    const [selectedMessageToLink, setSelectedMessageToLink] = useState<number | null>(null);
    const [messageSearchTerm, setMessageSearchTerm] = useState('');
    const [targetStageForChange, setTargetStageForChange] = useState<number | null>(null); // New state for target stage


    // Check if the menuIdParam corresponds to a valid funnel ID
    const isInvalidFunnel = !clinicData || isNaN(menuId) || funnelIdForQuery === undefined;

    // Fetch Stages directly from Supabase
    const { data: stagesData, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
        queryKey: ['funnelStagesConfig', funnelIdForQuery],
        queryFn: async () => {
            if (isNaN(funnelIdForQuery)) {
                 throw new Error("ID do funil inválido.");
            }
            const { data, error } = await supabase
                .from('north_clinic_crm_etapa')
                .select('id, nome_etapa, ordem, id_funil')
                .eq('id_funil', funnelIdForQuery)
                .order('ordem', { ascending: true });
            if (error) throw new Error(`Erro ao buscar etapas: ${error.message}`);
            return data || [];
        },
        enabled: !isNaN(funnelIdForQuery) && !isInvalidFunnel,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch ALL Stages (for 'Mudar Etapa' target selection)
    const { data: allStages, isLoading: isLoadingAllStages, error: allStagesError } = useQuery<FunnelStage[]>({
        queryKey: ['allStagesForFunnelConfig'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('north_clinic_crm_etapa')
                .select('id, nome_etapa, ordem, id_funil')
                .order('nome_etapa', { ascending: true }); // Order by name for selection
            if (error) throw new Error(`Erro ao buscar todas as etapas: ${error.message}`);
            return data || [];
        },
        enabled: isActionConfigModalOpen && selectedActionType === 'change_stage', // Only fetch when needed
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });


    // Fetch Funnel Details directly from Supabase
    const { data: funnelDetailsData, isLoading: isLoadingFunnelDetails, error: funnelDetailsError } = useQuery<FunnelDetails | null>({
        queryKey: ['funnelDetailsConfig', funnelIdForQuery],
        queryFn: async () => {
            if (isNaN(funnelIdForQuery)) {
                 throw new Error("ID do funil inválido.");
            }
            const { data, error } = await supabase
                .from('north_clinic_crm_funil')
                .select('id, nome_funil')
                .eq('id', funnelIdForQuery)
                .single();
            if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar detalhes do funil: ${error.message}`);
            return data || null;
        },
        enabled: !isNaN(funnelIdForQuery) && !isInvalidFunnel,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch Messages linked to stages in this funnel
    const { data: stageMessages, isLoading: isLoadingStageMessages, error: stageMessagesError } = useQuery<StageMessage[]>({
        queryKey: ['stageMessagesConfig', clinicId, funnelIdForQuery, stagesData?.map(s => s.id).join(',')],
        queryFn: async ({ queryKey }) => {
            const [, currentClinicId, currentFunnelIdForQuery, stagesDependency] = queryKey;

            if (!currentClinicId || isNaN(currentFunnelIdForQuery) || !stagesData || stagesData.length === 0) {
                 return [];
            }

            const stageIds = stagesData.map(stage => stage.id);
             if (stageIds.length === 0) {
                 return [];
             }

            const { data, error } = await supabase
                .from('north_clinic_config_mensagens')
                .select('id, modelo_mensagem, timing_type, delay_value, delay_unit, id_etapa, id_funil') // Select id_funil
                .eq('id_clinica', currentClinicId)
                .eq('context', 'leads')
                .eq('id_funil', currentFunnelIdForQuery)
                .in('id_etapa', stageIds);

            if (error) throw new Error(`Erro ao buscar mensagens das etapas: ${error.message}`);
            return data || [];
        },
        enabled: !!clinicId && !isNaN(funnelIdForQuery) && !isInvalidFunnel && !!stagesData && (stagesData?.length ?? 0) > 0,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Map stage messages by stage ID for quick lookup
    const stageMessagesMap = useMemo(() => {
        const map = new Map<number, StageMessage>();
        stageMessages?.forEach(msg => {
            map.set(msg.id_etapa, msg);
        });
        return map;
    }, [stageMessages]);

    // Fetch all Leads messages for the selection modal
    const { data: selectableLeadsMessages, isLoading: isLoadingSelectableMessages, error: selectableMessagesError } = useQuery<SelectableMessageItem[]>({
        queryKey: ['selectableLeadsMessages', clinicId, messageSearchTerm],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            let query = supabase
                .from('north_clinic_config_mensagens')
                .select('id, modelo_mensagem, id_funil, id_etapa')
                .eq('id_clinica', clinicId)
                .eq('context', 'leads'); // Only show leads context messages

            if (messageSearchTerm) {
                query = query.ilike('modelo_mensagem', `%${messageSearchTerm}%`);
            }
            query = query.order('modelo_mensagem', { ascending: true });

            const { data, error } = await query;
            if (error) throw new Error(`Erro ao buscar mensagens: ${error.message}`);
            return data || [];
        },
        enabled: isActionConfigModalOpen && selectedActionType === 'message' && !!clinicId, // Only fetch when modal is open and message type selected
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });


    // Mutation for deleting a message linked to a stage
    const deleteMessageMutation = useMutation({
        mutationFn: async (messageId: number) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const response = await fetch('https://n8n-n8n.sbw0pc.easypanel.host/webhook/4632ce57-e78a-4c62-9578-5a33b576ad73', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: messageId, id_clinica: clinicId })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            return response.json();
        },
        onSuccess: () => {
            showSuccess('Mensagem excluída com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['stageMessagesConfig', clinicId, funnelIdForQuery] });
            queryClient.invalidateQueries({ queryKey: ['selectableLeadsMessages', clinicId] }); // Invalidate selectable messages too
        },
        onError: (error: Error) => {
            showError(`Erro ao excluir mensagem: ${error.message}`);
        },
    });

    // Mutation for linking an existing message to a stage
    const linkMessageToStageMutation = useMutation({
        mutationFn: async ({ messageId, funnelId, stageId, clinicId }: { messageId: number; funnelId: number; stageId: number; clinicId: string | number }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`Linking message ${messageId} to funnel ${funnelId} and stage ${stageId} for clinic ${clinicId}`);
            const { data, error } = await supabase
                .from('north_clinic_config_mensagens')
                .update({ id_funil: funnelId, id_etapa: stageId })
                .eq('id', messageId)
                .eq('id_clinica', clinicId)
                .select(); // Select the updated row to confirm

            if (error) throw new Error(`Erro ao vincular mensagem: ${error.message}`);
            return data;
        },
        onSuccess: () => {
            showSuccess('Mensagem vinculada à etapa com sucesso!');
            setIsActionConfigModalOpen(false); // Close modal
            setSelectedMessageToLink(null); // Clear selection
            queryClient.invalidateQueries({ queryKey: ['stageMessagesConfig', clinicId, funnelIdForQuery] }); // Refetch stage messages
        },
        onError: (error: Error) => {
            showError(`Erro ao vincular mensagem: ${error.message}`);
        },
    });


    // Handle opening the action configuration modal
    const handleConfigureAction = (stageId: number) => {
        setStageToConfigureId(stageId);
        setIsActionConfigModalOpen(true);
        setSelectedActionType('message'); // Default to 'message' when opening
        setSelectedMessageToLink(null); // Clear previous message selection
        setMessageSearchTerm(''); // Clear search term
        setTargetStageForChange(null); // Clear previous target stage selection
    };

    // Handle navigation to message sequence config page (for creating/editing)
    const handleNavigateToMessageConfig = (messageId?: number) => {
        if (!clinicCode || funnelIdForQuery === undefined || stageToConfigureId === null) {
            showError("Dados necessários para navegação não disponíveis.");
            return;
        }
        const url = `/dashboard/config-sequencia?clinic_code=${encodeURIComponent(clinicCode)}&funnelId=${funnelIdForQuery}&stageId=${stageToConfigureId}${messageId ? `&id=${messageId}` : ''}`;
        navigate(url);
        setIsActionConfigModalOpen(false); // Close the selection modal
    };

    const handleDeleteMessage = (messageId: number) => {
        if (window.confirm(`Tem certeza que deseja excluir esta mensagem (ID: ${messageId})?\n\nEsta ação não pode ser desfeita!`)) {
            deleteMessageMutation.mutate(messageId);
        }
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

    const isLoading = isLoadingStages || isLoadingFunnelDetails || isLoadingStageMessages || deleteMessageMutation.isLoading;
    const fetchError = stagesError || funnelDetailsError || stageMessagesError;

    const funnelName = funnelDetailsData?.nome_funil || `Funil ID ${funnelIdForQuery}`;

    // Display UnderConstructionPage if the funnel is invalid
    if (isInvalidFunnel) {
        return <UnderConstructionPage />;
    }

    return (
        <TooltipProvider>
            <div className="funnel-config-container flex flex-col h-full p-6 bg-gray-100">
                <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                    <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                        Configuração do Funil - {funnelName}
                    </h1>
                    <Button onClick={() => navigate(`/dashboard/${menuIdParam}`)} variant="outline" className="flex-shrink-0">
                        Voltar para o Funil
                    </Button>
                </div>

                <div className="view-container flex-grow overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando configurações do funil...</span>
                        </div>
                    ) : fetchError ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-4 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar dados: {fetchError.message}</span>
                        </div>
                    ) : (stagesData?.length ?? 0) === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4 bg-gray-50 rounded-md">
                            <Info className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Nenhuma etapa configurada para este funil.</span>
                        </div>
                    ) : (
                        <div className="kanban-board flex gap-4 h-full overflow-x-auto pb-4">
                            {stagesData?.map(stage => {
                                const stageMessage = stageMessagesMap.get(stage.id);
                                const hasMessage = !!stageMessage;
                                const messageTiming = hasMessage ? formatTiming(stageMessage!) : '';

                                return (
                                    <Card
                                        key={stage.id}
                                        className="kanban-column flex flex-col flex-shrink-0 w-80 bg-gray-200 h-full"
                                    >
                                        <CardHeader className="py-3 px-4 border-b-2 border-gray-300 bg-gray-300 rounded-t-md flex flex-row items-center justify-between">
                                            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                                {stage.nome_etapa || 'S/Nome'}
                                            </CardTitle>
                                            <span className="text-xs font-normal text-gray-600 bg-gray-400 px-1.5 py-0.5 rounded-sm">
                                                {hasMessage ? 'Configurado' : 'Não Configurado'}
                                            </span>
                                        </CardHeader>
                                        <CardContent className="flex-grow overflow-y-auto p-3 flex flex-col gap-3">
                                            {hasMessage ? (
                                                <div className="config-card bg-white rounded-md p-3 shadow-sm border border-gray-200">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium text-sm text-gray-800">Mensagem Automática</span>
                                                        <div className="flex gap-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        className="h-6 w-6 p-0"
                                                                        onClick={() => handleNavigateToMessageConfig(stageMessage?.id)}
                                                                        aria-label="Editar Mensagem"
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
                                                                        variant="destructive"
                                                                        size="icon"
                                                                        className="h-6 w-6 p-0"
                                                                        onClick={() => handleDeleteMessage(stageMessage!.id)}
                                                                        disabled={deleteMessageMutation.isLoading}
                                                                        aria-label="Excluir Mensagem"
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
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-600 mb-2 line-clamp-3">{stageMessage?.modelo_mensagem || 'Sem texto'}</p>
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                        {stageMessage?.timing_type === 'immediate' ? <Clock className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                                                        <span>Agendamento: {messageTiming}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="config-card bg-white rounded-md p-3 shadow-sm border border-gray-200 flex flex-col items-center justify-center h-32 text-center text-gray-500">
                                                    <Info className="h-8 w-8 mb-2" />
                                                    <p className="text-sm mb-3">Nenhuma ação configurada para esta etapa.</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleConfigureAction(stage.id)}
                                                        className="flex items-center gap-1"
                                                    >
                                                        <MessageSquarePlus className="h-4 w-4" /> Configurar Ação
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Configuration Dialog */}
            <Dialog open={isActionConfigModalOpen} onOpenChange={setIsActionConfigModalOpen}>
                <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Configurar Ação para Etapa</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4 flex-grow overflow-hidden">
                        {/* Action Type Selection */}
                        <div>
                            <Label className="block mb-2 font-medium text-gray-700">Tipo de Ação:</Label>
                            <RadioGroup
                                value={selectedActionType}
                                onValueChange={(value: 'message' | 'change_stage') => setSelectedActionType(value)}
                                className="flex space-x-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="message" id="action-message" />
                                    <Label htmlFor="action-message">Mensagem</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="change_stage" id="action-change-stage" />
                                    <Label htmlFor="action-change-stage">Mudar Etapa</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Conditional Content based on selectedActionType */}
                        {selectedActionType === 'message' && (
                            <>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <Input
                                        type="text"
                                        placeholder="Buscar mensagens existentes..."
                                        value={messageSearchTerm}
                                        onChange={(e) => setMessageSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>

                                {isLoadingSelectableMessages ? (
                                    <div className="flex items-center justify-center gap-2 text-primary py-8">
                                        <Loader2 className="animate-spin" />
                                        Carregando mensagens...
                                    </div>
                                ) : selectableMessagesError ? (
                                    <div className="text-red-600 font-semibold flex items-center gap-2 py-8">
                                        <TriangleAlert className="h-5 w-5" />
                                        Erro ao carregar mensagens: {selectableMessagesError.message}
                                    </div>
                                ) : (selectableLeadsMessages?.length ?? 0) === 0 ? (
                                    <div className="text-gray-600 text-center py-8">
                                        Nenhuma mensagem de leads encontrada.
                                    </div>
                                ) : (
                                    <RadioGroup
                                        value={selectedMessageToLink?.toString() || ''}
                                        onValueChange={(value) => setSelectedMessageToLink(parseInt(value, 10))}
                                        className="flex flex-col gap-2 overflow-y-auto pr-2"
                                    >
                                        {selectableLeadsMessages?.map(msg => (
                                            <div key={msg.id} className="flex items-start space-x-3 p-3 border rounded-md hover:bg-gray-50">
                                                <RadioGroupItem value={msg.id.toString()} id={`msg-${msg.id}`} />
                                                <Label htmlFor={`msg-${msg.id}`} className="flex flex-col flex-grow cursor-pointer">
                                                    <span className="font-medium text-gray-900 line-clamp-1">{msg.modelo_mensagem || 'Mensagem sem texto'}</span>
                                                    <span className="text-xs text-gray-600 line-clamp-2">
                                                        {msg.id_funil && msg.id_etapa ? `Vinculada a Funil ${msg.id_funil} / Etapa ${msg.id_etapa}` : 'Não vinculada a funil/etapa'}
                                                    </span>
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                )}
                            </>
                        )}

                        {selectedActionType === 'change_stage' && (
                            <div className="flex flex-col gap-4">
                                <p className="text-sm text-gray-600">Quando um lead entrar nesta etapa, ele será automaticamente movido para a etapa selecionada abaixo.</p>
                                <div>
                                    <Label htmlFor="targetStageSelect" className="block mb-1 font-medium text-gray-700">
                                        Mover para a Etapa: *
                                    </Label>
                                    {isLoadingAllStages ? (
                                        <div className="flex items-center justify-center gap-2 text-primary py-4">
                                            <Loader2 className="animate-spin" />
                                            Carregando etapas...
                                        </div>
                                    ) : allStagesError ? (
                                        <div className="text-red-600 font-semibold flex items-center gap-2 py-4">
                                            <TriangleAlert className="h-5 w-5" />
                                            Erro ao carregar etapas: {allStagesError.message}
                                        </div>
                                    ) : (allStages?.length ?? 0) === 0 ? (
                                        <p className="text-gray-600 text-center py-4">Nenhuma etapa disponível.</p>
                                    ) : (
                                        <Select
                                            value={targetStageForChange?.toString() || ''}
                                            onValueChange={(value) => setTargetStageForChange(value ? parseInt(value, 10) : null)}
                                            id="targetStageSelect"
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione a etapa de destino" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allStages?.map(stage => (
                                                    <SelectItem key={stage.id} value={stage.id.toString()}>
                                                        {stage.nome_etapa} (Funil: {stage.id_funil})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div className="text-sm text-orange-600">
                                    <TriangleAlert className="h-4 w-4 inline-block mr-1" />
                                    Esta funcionalidade está em desenvolvimento. A ação de "Mudar Etapa" não será salva ou executada ainda.
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                        {selectedActionType === 'message' && (
                            <Button
                                variant="outline"
                                onClick={() => handleNavigateToMessageConfig()}
                                disabled={linkMessageToStageMutation.isLoading}
                            >
                                <MessageSquarePlus className="h-4 w-4 mr-2" /> Criar Nova Mensagem
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <DialogClose asChild>
                                <Button type="button" variant="secondary" disabled={linkMessageToStageMutation.isLoading}>
                                    Cancelar
                                </Button>
                            </DialogClose>
                            {selectedActionType === 'message' && (
                                <Button
                                    onClick={() => {
                                        if (selectedMessageToLink !== null && stageToConfigureId !== null && clinicId !== null && funnelIdForQuery !== undefined) {
                                            linkMessageToStageMutation.mutate({
                                                messageId: selectedMessageToLink,
                                                funnelId: funnelIdForQuery,
                                                stageId: stageToConfigureId,
                                                clinicId: clinicId
                                            });
                                        } else {
                                            showError('Selecione uma mensagem para vincular.');
                                        }
                                    }}
                                    disabled={selectedMessageToLink === null || linkMessageToStageMutation.isLoading}
                                >
                                    {linkMessageToStageMutation.isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Vinculando...
                                        </>
                                    ) : (
                                        'Vincular Mensagem Selecionada'
                                    )}
                                </Button>
                            )}
                            {selectedActionType === 'change_stage' && (
                                <Button
                                    onClick={() => {
                                        if (targetStageForChange === null) {
                                            showError('Selecione uma etapa de destino.');
                                            return;
                                        }
                                        showError('Funcionalidade "Mudar Etapa" em desenvolvimento. Ação não salva.');
                                        // TODO: Implement actual save logic for "change_stage" action
                                        setIsActionConfigModalOpen(false); // Close modal even if not saved
                                    }}
                                    disabled={targetStageForChange === null}
                                >
                                    Salvar Ação
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
};

export default FunnelConfigPage;