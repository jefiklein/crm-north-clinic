import React, { useMemo, useState } from 'react'; // Import useState
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, Info, MessageSquarePlus, Clock, Hourglass, Edit, Trash2, Settings2 } from "lucide-react"; // Added Settings2 icon
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import UnderConstructionPage from './UnderConstructionPage';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { showSuccess, showError } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Import Dialog components

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
    // Add other message fields if needed for display (e.g., url_arquivo)
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

    // State for the stage configuration modal
    const [isStageConfigModalOpen, setIsStageConfigModalOpen] = useState(false);
    const [selectedStageForConfig, setSelectedStageForConfig] = useState<FunnelStage | null>(null);


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
                .select('id, modelo_mensagem, timing_type, delay_value, delay_unit, id_etapa, id_funil') // Added id_funil to select
                .eq('id_clinica', currentClinicId)
                .eq('context', 'leads')
                .eq('id_funil', currentFunnelIdForQuery) // Filter by the current funnel ID
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
        },
        onError: (error: Error) => {
            showError(`Erro ao excluir mensagem: ${error.message}`);
        },
    });

    // Handle opening the stage configuration modal
    const handleOpenStageConfigModal = (stage: FunnelStage) => {
        setSelectedStageForConfig(stage);
        setIsStageConfigModalOpen(true);
    };

    // Handle navigation to message sequence config page from the modal
    const handleConfigureMessageFromModal = (stageId: number, messageId?: number) => {
        if (!clinicCode || funnelIdForQuery === undefined) {
            showError("Código da clínica ou ID do funil não disponível para navegação.");
            return;
        }
        // Close the modal before navigating
        setIsStageConfigModalOpen(false);
        const url = `/dashboard/config-sequencia?clinic_code=${encodeURIComponent(clinicCode)}&funnelId=${funnelIdForQuery}&stageId=${stageId}${messageId ? `&id=${messageId}` : ''}`;
        navigate(url);
    };

    const handleDeleteMessageFromModal = (messageId: number) => {
        // Confirm deletion then trigger mutation
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
                                            {/* Button to open the stage configuration modal */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenStageConfigModal(stage)}
                                                className="flex items-center justify-center gap-1 w-full"
                                            >
                                                <Settings2 className="h-4 w-4" /> Configurar Etapa
                                            </Button>

                                            {/* Display summary of message if configured */}
                                            {hasMessage && (
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
                                                                        onClick={() => handleConfigureMessageFromModal(stage.id, stageMessage?.id)}
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
                                                                        onClick={() => handleDeleteMessageFromModal(stageMessage!.id)}
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
                                                    <p className="text-sm mb-3">Nenhuma mensagem configurada para esta etapa.</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleConfigureMessageFromModal(stage.id)}
                                                        className="flex items-center gap-1"
                                                    >
                                                        <MessageSquarePlus className="h-4 w-4" /> Configurar Mensagem
                                                    </Button>
                                                </div>
                                            )}
                                            {/* Placeholder for other actions */}
                                            <div className="config-card bg-white rounded-md p-3 shadow-sm border border-gray-200 flex flex-col items-center justify-center h-32 text-center text-gray-500">
                                                <Info className="h-8 w-8 mb-2" />
                                                <p className="text-sm mb-3">Nenhuma ação configurada para esta etapa.</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => alert('Configurar Ação (Em Breve)')}
                                                    className="flex items-center gap-1"
                                                >
                                                    <Settings2 className="h-4 w-4" /> Configurar Ação
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Stage Configuration Modal */}
            <Dialog open={isStageConfigModalOpen} onOpenChange={setIsStageConfigModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Etapa: {selectedStageForConfig?.nome_etapa || 'N/D'}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 flex flex-col gap-4">
                        <p className="text-sm text-gray-700">Gerencie as configurações para a etapa "{selectedStageForConfig?.nome_etapa || 'N/D'}" do funil "{funnelName}".</p>

                        {selectedStageForConfig && (
                            <>
                                {/* Message Configuration Section */}
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Mensagem Automática</h3>
                                {(() => {
                                    const message = stageMessagesMap.get(selectedStageForConfig.id);
                                    const hasMessage = !!message;
                                    const messageTiming = hasMessage ? formatTiming(message!) : '';

                                    return hasMessage ? (
                                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                            <p className="font-medium text-sm text-gray-800 mb-1">Mensagem Configurada:</p>
                                            <p className="text-xs text-gray-600 mb-2 line-clamp-3">{message?.modelo_mensagem || 'Sem texto'}</p>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                                {message?.timing_type === 'immediate' ? <Clock className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                                                <span>Agendamento: {messageTiming}</span>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleConfigureMessageFromModal(selectedStageForConfig.id, message?.id)}
                                                >
                                                    <Edit className="h-4 w-4 mr-2" /> Editar Mensagem
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDeleteMessageFromModal(message!.id)}
                                                    disabled={deleteMessageMutation.isLoading}
                                                >
                                                    {deleteMessageMutation.isLoading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                    )}
                                                    Excluir
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-center text-gray-600">
                                            <p className="mb-3">Nenhuma mensagem automática configurada para esta etapa.</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleConfigureMessageFromModal(selectedStageForConfig.id)}
                                            >
                                                <MessageSquarePlus className="h-4 w-4 mr-2" /> Configurar Mensagem
                                            </Button>
                                        </div>
                                    );
                                })()}

                                {/* Other Actions Section (Placeholder) */}
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mt-4">Outras Ações</h3>
                                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-center text-gray-600">
                                    <p className="mb-3">Nenhuma ação adicional configurada para esta etapa.</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => alert('Funcionalidade de Ações da Etapa em desenvolvimento!')}
                                    >
                                        <Settings2 className="h-4 w-4 mr-2" /> Adicionar Ação
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Fechar
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
};

export default FunnelConfigPage;