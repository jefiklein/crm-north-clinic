import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, Info, MessageSquarePlus, Clock, Hourglass, Edit, Trash2, Search, ArrowRight, MessageSquareText, Repeat, Check, ChevronsUpDown } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"; // Import Command components

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface FunnelStage {
    id: number;
    nome_etapa: string;
    ordem: number | null;
    id_funil: number;
}

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

// Interface for a Message item for selection (from north_clinic_mensagens_sequencias)
interface SelectableMessageItem {
    id: number;
    nome_sequencia: string | null;
    contexto: string | null;
    ativo: boolean;
}

// Mapping from menu item ID (from URL) to actual funnel ID (for database queries)
const menuIdToFunnelIdMap: { [key: number]: number } = {
    4: 1, // Funil de Vendas
    5: 2, // Funil de Recuperação
    6: 3, // Funil de Faltas
    7: 4, // Funil Compareceram
    8: 5, // Clientes
};

interface FunnelConfigPageProps {
    clinicData: ClinicData | null;
}

// New N8N webhook URL for saving/updating actions
const N8N_SAVE_ACTION_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/c3ace473-a07c-4bff-9c48-46ced144a319';
// New N8N webhook URL for deleting actions
const N8N_DELETE_ACTION_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/184b3691-67db-4bab-9cb0-4bf18b13832b';
// NEW N8N webhook URL for updating actions
const N8N_UPDATE_ACTION_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/2c2b517e-8c98-4d1b-bf49-9fe655582dbd';


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
    const [selectedActionType, setSelectedActionType] = useState<'message' | 'change_stage' | null>(null); // Can be null initially
    const [selectedMessageToLink, setSelectedMessageToLink] = useState<number | null>(null);
    const [messageSearchTerm, setMessageSearchTerm] = useState(''); // Keep for query, but UI will use CommandInput
    const [targetStageForChange, setTargetStageForChange] = useState<number | null>(null);
    
    // State for timing configuration within the modal
    const [timingType, setTimingType] = useState<string>('immediate'); 
    const [delayValue, setDelayValue] = useState<string>(''); 
    const [delayUnit, setDelayUnit] = useState<string>('hours'); 

    // State to store the currently configured action for editing
    const [currentActionBeingEdited, setCurrentActionBeingEdited] = useState<StageAction | null>(null);

    // New state to control the modal's internal view
    const [modalView, setModalView] = useState<'initial' | 'action_details'>('initial');

    // State for combobox open status
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);


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
                .order('nome_etapa', { ascending: true });
            if (error) throw new Error(`Erro ao buscar todas as etapas: ${error.message}`);
            return data || [];
        },
        enabled: isActionConfigModalOpen && selectedActionType === 'change_stage',
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

    // NEW: Fetch Actions linked to stages in this funnel from north_clinic_funil_etapa_sequencias
    const { data: stageActions, isLoading: isLoadingStageActions, error: stageActionsError } = useQuery<StageAction[]>({
        queryKey: ['stageActionsConfig', clinicId, funnelIdForQuery],
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

    // Fetch all Leads messages for the selection modal
    const { data: selectableLeadsMessages, isLoading: isLoadingSelectableMessages, error: selectableMessagesError } = useQuery<SelectableMessageItem[]>({
        queryKey: ['selectableLeadsMessages', clinicId], // Removed messageSearchTerm from key as CommandInput handles filtering
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            let query = supabase
                .from('north_clinic_mensagens_sequencias')
                .select('id, nome_sequencia, contexto, ativo')
                .eq('id_clinica', clinicId)
                .eq('contexto', 'leads');

            // No filtering by messageSearchTerm here, CommandInput will filter client-side
            query = query.order('nome_sequencia', { ascending: true });

            const { data, error } = await query;
            if (error) throw new Error(`Erro ao buscar mensagens: ${error.message}`);
            return data || [];
        },
        enabled: isActionConfigModalOpen && selectedActionType === 'message' && !!clinicId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });


    // Mutation for deleting an action linked to a stage
    const deleteActionMutation = useMutation({
        mutationFn: async (actionId: number) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            
            console.log(`[FunnelConfigPage] Calling webhook to delete action ${actionId} for clinic ${clinicId}`);
            const response = await fetch(N8N_DELETE_ACTION_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionId: actionId, clinicId: clinicId }),
            });

            if (!response.ok) {
                let errorMsg = `Erro ${response.status} ao excluir ação`;
                try { 
                    const errorData = await response.json(); 
                    errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; 
                } catch (e) { 
                    errorMsg = `${errorMsg}: ${await response.text()}`; 
                }
                throw new Error(errorMsg);
            }
            return response.json();
        },
        onSuccess: () => {
            showSuccess('Ação excluída com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['stageActionsConfig', clinicId, funnelIdForQuery] });
        },
        onError: (error: Error) => {
            showError(`Erro ao excluir ação: ${error.message}`);
        },
    });

    // Mutation for linking/updating an action to a stage
    const saveActionToStageMutation = useMutation({
        mutationFn: async (payload: {
            actionId?: number; // For update
            id_clinica: number | string;
            id_funil: number;
            id_etapa: number;
            action_type: string;
            id_sequencia?: number | null;
            target_etapa_id?: number | null;
            timing_type: string;
            delay_value?: number | null;
            delay_unit?: string | null;
        }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");

            const webhookPayload = {
                event: payload.actionId ? "action_updated" : "action_created",
                actionId: payload.actionId,
                id_clinica: payload.id_clinica,
                id_funil: payload.id_funil,
                id_etapa: payload.id_etapa,
                action_type: payload.action_type,
                timing_type: payload.timing_type,
                delay_value: payload.timing_type === 'delay' ? payload.delay_value : null,
                delay_unit: payload.timing_type === 'delay' ? payload.delay_unit : null,
                id_sequencia: payload.action_type === 'message' ? payload.id_sequencia : null,
                target_etapa_id: payload.action_type === 'change_stage' ? payload.target_etapa_id : null,
            };

            console.log("[FunnelConfigPage] Sending payload to N8N webhook:", webhookPayload);

            const targetWebhookUrl = payload.actionId ? N8N_UPDATE_ACTION_WEBHOOK_URL : N8N_SAVE_ACTION_WEBHOOK_URL;

            const response = await fetch(targetWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload),
            });

            if (!response.ok) {
                let errorMsg = `Erro ${response.status} ao salvar ação`;
                try { 
                    const errorData = await response.json(); 
                    errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; 
                } catch (e) { 
                    errorMsg = `${errorMsg}: ${await response.text()}`; 
                }
                throw new Error(errorMsg);
            }
            return response.json();
        },
        onSuccess: (_, variables) => {
            showSuccess(`Ação ${variables.actionId ? 'atualizada' : 'vinculada'} com sucesso!`);
            setIsActionConfigModalOpen(false);
            setCurrentActionBeingEdited(null);
            setSelectedMessageToLink(null);
            setTargetStageForChange(null);
            setTimingType('immediate');
            setDelayValue('');
            setDelayUnit('hours');
            queryClient.invalidateQueries({ queryKey: ['stageActionsConfig', clinicId, funnelIdForQuery] });
        },
        onError: (error: Error) => {
            showError(`Erro ao salvar ação: ${error.message}`);
        },
    });


    // Handle opening the action configuration modal
    const handleConfigureAction = (stageId: number, actionToEdit?: StageAction) => {
        setStageToConfigureId(stageId);
        setIsActionConfigModalOpen(true);
        setCurrentActionBeingEdited(actionToEdit || null);

        if (actionToEdit) {
            // If editing, go directly to details view and pre-fill
            setModalView('action_details');
            setSelectedActionType(actionToEdit.action_type as 'message' | 'change_stage');
            setSelectedMessageToLink(actionToEdit.id_sequencia);
            setTargetStageForChange(actionToEdit.target_etapa_id);
            setTimingType(actionToEdit.timing_type);
            setDelayValue(actionToEdit.delay_value?.toString() || '');
            setDelayUnit(actionToEdit.delay_unit as 'minutes' | 'hours' | 'days' || 'hours');
        } else {
            // If new action, start with initial choice view
            setModalView('initial');
            setSelectedActionType(null); // Reset action type for new selection
            setSelectedMessageToLink(null);
            setTargetStageForChange(null);
            setTimingType('immediate');
            setDelayValue('');
            setDelayUnit('hours');
        }
        setMessageSearchTerm('');
    };

    // Handle navigation to message sequence config page (for creating/editing)
    const handleNavigateToMessageConfig = (messageId?: number) => {
        if (!clinicCode) {
            showError("Dados necessários para navegação não disponíveis.");
            return;
        }
        const url = `/dashboard/config-sequencia?clinic_code=${encodeURIComponent(clinicCode)}${messageId ? `&id=${messageId}` : ''}`;
        navigate(url);
        setIsActionConfigModalOpen(false); // Close the selection modal
    };

    const handleDeleteAction = (actionId: number) => {
        if (window.confirm(`Tem certeza que deseja excluir esta ação (ID: ${actionId})?\n\nEsta ação não pode ser desfeita!`)) {
            deleteActionMutation.mutate(actionId);
        }
    };

    // Helper to format timing display
    const formatTiming = (timingType: string, delayValue: number | null, delayUnit: string | null): string => {
        if (timingType === 'immediate') {
            return 'Imediata';
        }
        if (timingType === 'delay' && delayValue !== null && delayUnit) {
            return `+${delayValue}${delayUnit.charAt(0)}`; // e.g., +2h, +30m, +1d
        }
        return 'N/D';
    };

    const handleSaveAction = () => {
        if (!clinicId || !funnelIdForQuery || !stageToConfigureId) {
            showError("Dados essenciais para salvar a ação estão faltando.");
            return;
        }

        if (selectedActionType === null) {
            showError("Selecione um tipo de ação.");
            return;
        }

        let payload: Parameters<typeof saveActionToStageMutation.mutate>[0] = {
            id_clinica: clinicId,
            id_funil: funnelIdForQuery,
            id_etapa: stageToConfigureId,
            action_type: selectedActionType,
            timing_type: timingType,
            delay_value: timingType === 'delay' ? (parseInt(delayValue, 10) || null) : null,
            delay_unit: timingType === 'delay' ? delayUnit : null,
        };

        if (currentActionBeingEdited) {
            payload.actionId = currentActionBeingEdited.id;
        }

        if (selectedActionType === 'message') {
            if (selectedMessageToLink === null) {
                showError('Selecione uma mensagem para vincular.');
                return;
            }
            payload.id_sequencia = selectedMessageToLink;
        } else if (selectedActionType === 'change_stage') {
            if (targetStageForChange === null) {
                showError('Selecione uma etapa de destino.');
                return;
            }
            payload.target_etapa_id = targetStageForChange;
        }

        if (timingType === 'delay') {
            const delayNum = parseInt(delayValue, 10);
            if (delayValue.trim() === '' || isNaN(delayNum) || delayNum < 0) {
                 showError("Informe um valor de atraso válido (número >= 0).");
                 return;
            }
            if (!delayUnit) {
                 showError("Selecione a unidade do atraso (minutos, horas, dias).");
                 return;
            }
        }

        saveActionToStageMutation.mutate(payload);
    };


    const isLoading = isLoadingStages || isLoadingFunnelDetails || isLoadingStageActions || deleteActionMutation.isLoading;
    const fetchError = stagesError || funnelDetailsError || stageActionsError;

    const funnelName = funnelDetailsData?.nome_funil || `Funil ID ${funnelIdForQuery}`;

    // Get the selected message name for display in the combobox trigger
    const selectedMessageName = useMemo(() => {
        return selectableLeadsMessages?.find(msg => msg.id === selectedMessageToLink)?.nome_sequencia || "Selecione uma mensagem...";
    }, [selectedMessageToLink, selectableLeadsMessages]);


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
                                const actionsForStage = stageActionsMap.get(stage.id) || [];

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
                                                {actionsForStage.length > 0 ? `${actionsForStage.length} Ações` : 'Nenhuma Ação'}
                                            </span>
                                        </CardHeader>
                                        <CardContent className="flex-grow overflow-y-auto p-3 flex flex-col gap-3">
                                            {actionsForStage.length > 0 ? (
                                                actionsForStage.map(action => (
                                                    <div key={action.id} className="config-card bg-white rounded-md p-3 shadow-sm border border-gray-200">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="font-medium text-sm text-gray-800">
                                                                {action.action_type === 'message' ? 'Mensagem Automática' : 'Mudar Etapa'}
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-6 w-6 p-0"
                                                                            onClick={() => handleConfigureAction(stage.id, action)}
                                                                            aria-label="Editar Ação"
                                                                        >
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Editar Ação</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            className="h-6 w-6 p-0"
                                                                            onClick={() => handleDeleteAction(action.id)}
                                                                            disabled={deleteActionMutation.isLoading}
                                                                            aria-label="Excluir Ação"
                                                                        >
                                                                            {deleteActionMutation.isLoading ? (
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                            ) : (
                                                                                <Trash2 className="h-4 w-4" />
                                                                            )}
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Excluir Ação</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                        </div>
                                                        {action.action_type === 'message' && (
                                                            <>
                                                                <p className="text-xs text-gray-600 mb-2 line-clamp-3">{action.north_clinic_mensagens_sequencias?.nome_sequencia || 'Mensagem sem nome'}</p>
                                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                    {action.timing_type === 'immediate' ? <Clock className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                                                                    <span>Agendamento: {formatTiming(action.timing_type, action.delay_value, action.delay_unit)}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {action.action_type === 'change_stage' && (
                                                            <>
                                                                <p className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                                                                    <ArrowRight className="h-3 w-3" /> Mover para: {action.target_stage_details?.nome_etapa || 'Etapa Desconhecida'}
                                                                </p>
                                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                    {action.timing_type === 'immediate' ? <Clock className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                                                                    <span>Agendamento: {formatTiming(action.timing_type, action.delay_value, action.delay_unit)}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center text-gray-600 italic py-6">Nenhuma ação configurada para esta etapa.</div>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleConfigureAction(stage.id)}
                                                className="flex items-center gap-1 mt-auto"
                                            >
                                                <MessageSquarePlus className="h-4 w-4 mr-1" /> Adicionar Ação
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Configuration Dialog */}
            <Dialog open={isActionConfigModalOpen} onOpenChange={(open) => {
                setIsActionConfigModalOpen(open);
                if (!open) { // Reset modal state when closed
                    setModalView('initial');
                    setCurrentActionBeingEdited(null);
                    setSelectedActionType(null);
                    setSelectedMessageToLink(null);
                    setTargetStageForChange(null);
                    setTimingType('immediate');
                    setDelayValue('');
                    setDelayUnit('hours');
                    setMessageSearchTerm('');
                }
            }}>
                <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>
                            {currentActionBeingEdited ? 'Editar Ação' : 'Configurar Nova Ação'} para Etapa
                            {stageToConfigureId && stagesData && (
                                <span className="text-sm text-gray-500 ml-2">
                                    ({stagesData.find(s => s.id === stageToConfigureId)?.nome_etapa || 'Etapa Desconhecida'})
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    
                    {modalView === 'initial' && (
                        <div className="flex flex-col items-center justify-center gap-6 py-8">
                            <p className="text-lg font-medium text-gray-700">Qual tipo de ação você deseja configurar?</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
                                <Button
                                    variant="outline"
                                    className="flex flex-col items-center justify-center h-32 text-lg font-semibold text-primary border-2 border-primary hover:bg-primary hover:text-white transition-colors"
                                    onClick={() => {
                                        setSelectedActionType('message');
                                        setModalView('action_details');
                                    }}
                                >
                                    <MessageSquareText className="h-8 w-8 mb-2" />
                                    Mensagem Automática
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex flex-col items-center justify-center h-32 text-lg font-semibold text-blue-600 border-2 border-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                    onClick={() => {
                                        setSelectedActionType('change_stage');
                                        setModalView('action_details');
                                    }}
                                >
                                    <Repeat className="h-8 w-8 mb-2" />
                                    Mudar Etapa
                                </Button>
                            </div>
                        </div>
                    )}

                    {modalView === 'action_details' && (
                        <div className="flex flex-col gap-4 py-4 flex-grow overflow-hidden">
                            {/* Action Type Display (read-only) */}
                            <div>
                                <Label className="block mb-2 font-medium text-gray-700">Tipo de Ação Selecionada:</Label>
                                <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50">
                                    {selectedActionType === 'message' ? (
                                        <>
                                            <MessageSquareText className="h-5 w-5 text-primary" />
                                            <span className="font-semibold text-primary">Mensagem Automática</span>
                                        </>
                                    ) : (
                                        <>
                                            <Repeat className="h-5 w-5 text-blue-600" />
                                            <span className="font-semibold text-blue-600">Mudar Etapa</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Timing Configuration */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label
                                        htmlFor="timingType"
                                        className="block mb-1 font-medium text-gray-700"
                                    >
                                        Agendar Envio *
                                    </label>
                                    <Select
                                        value={timingType}
                                        onValueChange={setTimingType}
                                        id="timingType"
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="immediate">Imediatamente ao entrar na etapa</SelectItem>
                                            <SelectItem value="delay">Com atraso após entrar na etapa</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {timingType === 'delay' && (
                                    <>
                                        <div>
                                            <label
                                                htmlFor="delayValue"
                                                className="block mb-1 font-medium text-gray-700"
                                            >
                                                Valor do Atraso *
                                            </label>
                                            <Input
                                                id="delayValue"
                                                type="number"
                                                placeholder="Ex: 2"
                                                value={delayValue}
                                                onChange={(e) => setDelayValue(e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label
                                                htmlFor="delayUnit"
                                                className="block mb-1 font-medium text-gray-700"
                                            >
                                                Unidade do Atraso *
                                            </label>
                                            <Select
                                                value={delayUnit}
                                                onValueChange={setDelayUnit}
                                                id="delayUnit"
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione a unidade" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="minutes">Minutos</SelectItem>
                                                    <SelectItem value="hours">Horas</SelectItem>
                                                    <SelectItem value="days">Dias</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Conditional Content based on selectedActionType */}
                            {selectedActionType === 'message' && (
                                <>
                                    <Label htmlFor="messageSelect" className="block mb-1 font-medium text-gray-700">
                                        Mensagem para Vincular *
                                    </Label>
                                    <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isComboboxOpen}
                                                className="w-full justify-between"
                                                disabled={isLoadingSelectableMessages || !!selectableMessagesError}
                                            >
                                                {selectedMessageName}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Buscar mensagem..." />
                                                <CommandList>
                                                    {isLoadingSelectableMessages ? (
                                                        <CommandEmpty>
                                                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando mensagens...
                                                        </CommandEmpty>
                                                    ) : selectableMessagesError ? (
                                                        <CommandEmpty>
                                                            <TriangleAlert className="h-5 w-5 text-red-500 mr-2" /> Erro: {selectableMessagesError.message}
                                                        </CommandEmpty>
                                                    ) : (selectableLeadsMessages?.length ?? 0) === 0 ? (
                                                        <CommandEmpty>Nenhuma mensagem encontrada.</CommandEmpty>
                                                    ) : (
                                                        <CommandGroup>
                                                            {selectableLeadsMessages?.map((msg) => (
                                                                <CommandItem
                                                                    key={msg.id}
                                                                    value={msg.nome_sequencia || `Mensagem ${msg.id}`} // Use nome_sequencia for search value
                                                                    onSelect={() => {
                                                                        setSelectedMessageToLink(msg.id);
                                                                        setIsComboboxOpen(false);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            selectedMessageToLink === msg.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {msg.nome_sequencia}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    )}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
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
                    )}
                    
                    {modalView === 'action_details' && (
                        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                            <div className="flex gap-2">
                                {!currentActionBeingEdited && ( // Only show "Voltar" if it's a new action
                                    <Button type="button" variant="outline" onClick={() => setModalView('initial')} disabled={saveActionToStageMutation.isLoading}>
                                        Voltar
                                    </Button>
                                )}
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary" disabled={saveActionToStageMutation.isLoading}>
                                        Cancelar
                                    </Button>
                                </DialogClose>
                                <Button
                                    onClick={handleSaveAction}
                                    disabled={
                                        saveActionToStageMutation.isLoading ||
                                        selectedActionType === null || // Ensure an action type is selected
                                        (selectedActionType === 'message' && selectedMessageToLink === null) ||
                                        (selectedActionType === 'change_stage' && targetStageForChange === null) ||
                                        (timingType === 'delay' && (delayValue.trim() === '' || isNaN(parseInt(delayValue, 10)) || parseInt(delayValue, 10) < 0 || !delayUnit))
                                    }
                                >
                                    {saveActionToStageMutation.isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        currentActionBeingEdited ? 'Salvar Alterações' : 'Vincular Ação'
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
};

export default FunnelConfigPage;