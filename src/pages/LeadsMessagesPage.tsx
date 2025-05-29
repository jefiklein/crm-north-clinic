import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Filter, ListOrdered } from 'lucide-react';
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

// Define the structure for a SEQUENCE item fetched from Supabase
interface SequenceItem {
    id: number;
    id_clinica: number;
    nome_sequencia: string;
    contexto: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
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

const LeadsMessagesPage: React.FC<LeadsMessagesPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // State for filters
    const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
    const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

    const clinicId = clinicData?.id;

    // Fetch sequence list filtered by context 'leads'
    const { data: sequencesList, isLoading: isLoadingSequences, error: sequencesError, refetch: refetchSequences } = useQuery<SequenceItem[]>({
        queryKey: ['leadSequencesList', clinicId, selectedFunnelId, selectedStageId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`[LeadsMessagesPage] Fetching lead sequences for clinic ${clinicId} from Supabase`);

            let query = supabase
                .from('north_clinic_mensagens_sequencias')
                .select('id, id_clinica, nome_sequencia, contexto, ativo, created_at, updated_at')
                .eq('id_clinica', clinicId)
                .eq('contexto', 'leads')
                .order('nome_sequencia', { ascending: true });

            if (selectedFunnelId !== null) {
                console.warn("[LeadsMessagesPage] Funnel filtering based on sequence links is not yet implemented.");
            }
            if (selectedStageId !== null) {
                console.warn("[LeadsMessagesPage] Stage filtering based on sequence links is not yet implemented.");
            }

            const { data, error } = await query;

            if (error) {
                 console.error("[LeadsMessagesPage] Error fetching lead sequences from Supabase:", error);
                 throw new Error(error.message);
            }
            console.log("[LeadsMessagesPage] Lead sequences fetched:", data);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch instances list
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListLeadsMessagesPage', clinicId],
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

    // Fetch all funnels
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
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch stages for the selected funnel
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
        enabled: !!clinicId && selectedFunnelId !== null,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Mutation for toggling sequence status
    const toggleSequenceStatusMutation = useMutation({
        mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`[LeadsMessagesPage] Toggling sequence ${id} to active=${ativo}`);
            
            const { data, error } = await supabase
                .from('north_clinic_mensagens_sequencias')
                .update({ ativo: ativo, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('id_clinica', clinicId)
                .select();

            if (error) {
                console.error('[LeadsMessagesPage] Error toggling sequence status:', error);
                throw new Error(error.message);
            }
            console.log(`[LeadsMessagesPage] Sequence ${id} toggle successful:`, data);
            return data;
        },
        onSuccess: (_, variables) => {
            showSuccess(`Sequência ${variables.ativo ? 'ativada' : 'desativada'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['leadSequencesList', clinicId, selectedFunnelId, selectedStageId] });
        },
        onError: (error: Error) => {
            showError(`Erro ao alterar status da sequência: ${error.message}`);
        },
    });

    // Mutation for deleting a sequence VIA N8N WEBHOOK
    const deleteSequenceMutation = useMutation({
        mutationFn: async (sequenceId: number) => {
            if (!clinicId) throw new Error("ID da clínica não disponível."); 
            if (!clinicData?.code) throw new Error("Código da clínica não disponível.");

            console.log(`[LeadsMessagesPage] Requesting deletion of sequence ${sequenceId} for clinic ID ${clinicId} via n8n webhook.`);

            const payload = {
                sequenceId: sequenceId,
                clinicId: clinicId, 
                clinicCode: clinicData.code 
            };

            const response = await fetch("https://n8n-n8n.sbw0pc.easypanel.host/webhook/cb701587-26dd-4f7a-bc55-5ba70e807273", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LeadsMessagesPage] Error deleting sequence via n8n webhook:', errorText);
                let parsedError = errorText;
                try {
                    const jsonError = JSON.parse(errorText);
                    parsedError = jsonError.message || jsonError.error || errorText;
                } catch (parseErr) {
                }
                throw new Error(`Falha ao excluir sequência via n8n (Status: ${response.status}): ${parsedError.substring(0, 200)}`);
            }
            
            const result = await response.json(); 
            console.log(`[LeadsMessagesPage] Sequence ${sequenceId} deletion request to n8n successful:`, result);
            return result; 
        },
        onSuccess: (data, variables) => { 
            showSuccess(`Solicitação para excluir sequência (ID: ${variables}) enviada com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['leadSequencesList', clinicId, selectedFunnelId, selectedStageId] });
        },
        onError: (error: Error) => {
            showError(`Erro ao solicitar exclusão da sequência: ${error.message}`);
        },
    });

    // Handle navigation to the Sequence Config Page for editing
    const handleEditSequence = (sequenceId: number) => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        navigate(`/dashboard/config-sequencia?id=${sequenceId}&clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    // Handle navigation to the NEW Sequence Config Page
    const handleAddSequence = () => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        navigate(`/dashboard/config-sequencia?clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    const handleToggleSequenceStatus = (sequence: SequenceItem) => {
        toggleSequenceStatusMutation.mutate({ id: sequence.id, ativo: !sequence.ativo });
    };

    const handleDeleteSequence = (sequenceId: number) => {
        if (window.confirm(`Tem certeza que deseja excluir esta Sequência (ID: ${sequenceId})?\n\nTODOS OS PASSOS DESTA SEQUÊNCIA SERÃO PERDIDOS.\nEsta ação não pode ser desfeita!`)) {
            deleteSequenceMutation.mutate(sequenceId);
        }
    };

    // Helper to display sequence information
    const getSequenceDisplayInfo = (sequence: SequenceItem): { name: string; context: string } => {
        return {
            name: sequence.nome_sequencia,
            context: sequence.contexto,
        };
    };

    const isLoading = isLoadingSequences || isLoadingInstances || isLoadingFunnels || isLoadingStages || toggleSequenceStatusMutation.isPending || deleteSequenceMutation.isPending;
    const fetchError = sequencesError || instancesError || funnelsError || stagesError;

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="leads-messages-container max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="config-title text-3xl font-extrabold text-primary whitespace-nowrap">
                    Sequências de Mensagens de Leads
                </h1>
                <div className="flex gap-4 flex-wrap justify-center sm:justify-end">
                    <Button onClick={handleAddSequence} className="add-sequence-btn flex-shrink-0 bg-primary text-white hover:bg-primary/90 transition-colors shadow-md">
                        <ListOrdered className="h-5 w-5 mr-2" /> Configurar Nova Sequência
                    </Button>
                </div>
            </div>

            <div className="filter-section flex flex-col sm:flex-row items-center gap-4 mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                <Filter className="h-5 w-5 text-gray-600 flex-shrink-0" />
                <span className="text-lg font-semibold text-gray-700 flex-shrink-0">Filtrar por:</span>
                <div className="flex-grow min-w-[150px]">
                    <Label htmlFor="funnelFilter" className="sr-only">Funil</Label>
                    <Select
                        value={selectedFunnelId?.toString() || ''}
                        onValueChange={(value) => {
                            setSelectedFunnelId(value ? parseInt(value, 10) : null);
                            setSelectedStageId(null);
                        }}
                        disabled={isLoadingFunnels || !!funnelsError}
                    >
                        <SelectTrigger id="funnelFilter">
                            <SelectValue placeholder="Todos os Funis" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={null as any}>Todos os Funis</SelectItem>
                            {allFunnels?.map(funnel => (
                                <SelectItem key={funnel.id} value={funnel.id.toString()}>{funnel.nome_funil}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
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
                            <SelectItem value={null as any}>Todas as Etapas</SelectItem>
                            {stagesForSelectedFunnel?.map(stage => (
                                <SelectItem key={stage.id} value={stage.id.toString()}>{stage.nome_etapa}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-grow text-sm text-gray-600 italic">
                    Filtros de funil/etapa serão aplicados quando as sequências estiverem vinculadas.
                </div>
            </div>

            {fetchError && (
                <div className="error-message flex items-center gap-2 p-4 mb-6 bg-red-100 text-red-700 border border-red-300 rounded-md shadow-sm">
                    <TriangleAlert className="h-6 w-6 flex-shrink-0" />
                    <span className="text-lg font-semibold">Erro ao carregar dados: {fetchError.message}</span>
                    <Button variant="outline" size="sm" onClick={() => { refetchSequences(); queryClient.invalidateQueries({ queryKey: ['instancesListLeadsMessagesPage', clinicId] }); queryClient.invalidateQueries({ queryKey: ['allFunnelsLeadsMessages'] }); queryClient.invalidateQueries({ queryKey: ['stagesForFunnelLeadsMessages', selectedFunnelId] }); }} className="ml-auto">
                        Tentar Novamente
                    </Button>
                </div>
            )}

            {isLoading && !fetchError && (
                <div className="loading-indicator flex flex-col items-center justify-center p-12 text-primary">
                    <Loader2 className="h-16 w-16 animate-spin mb-6" />
                    <span className="text-xl font-medium">Carregando sequências...</span>
                </div>
            )}

            {!isLoading && !fetchError && (sequencesList?.length ?? 0) === 0 ? (
                <div id="noSequencesFound" className="text-center text-gray-600 p-12 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                    <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
                    <p className="text-2xl font-semibold">Nenhuma sequência de mensagens configurada para leads.</p>
                    <p className="mt-2">Clique em "Configurar Nova Sequência" para começar.</p>
                </div>
            ) : (
                <div id="sequenceListContainer" className="overflow-x-auto rounded-lg border border-gray-300 shadow-md">
                    <Table className="message-table min-w-full">
                        <TableHeader className="bg-gray-100 border-b border-gray-300">
                            <TableRow>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Nome da Sequência</TableHead>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Contexto</TableHead>
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Status</TableHead>
                                <TableHead className="text-right text-lg font-semibold text-gray-700 px-6 py-3">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody id="sequenceTableBody" className="divide-y divide-gray-200">
                            {sequencesList?.map(sequence => {
                                const displayInfo = getSequenceDisplayInfo(sequence);
                                return (
                                    <React.Fragment key={sequence.id}>
                                        <TableRow data-sequence-id={sequence.id} data-context={sequence.contexto} className="hover:bg-gray-50 transition-colors">
                                            <TableCell className="font-medium text-gray-900 px-6 py-4 whitespace-nowrap">
                                                {displayInfo.name}
                                            </TableCell>
                                            <TableCell className="text-gray-700 px-6 py-4">
                                                <span className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-medium">
                                                    {displayInfo.context}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold transition-colors",
                                                    sequence.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                )}>
                                                    {sequence.ativo ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right px-6 py-4">
                                                <div className="sequence-item-actions flex gap-2 justify-end">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleEditSequence(sequence.id)}
                                                                    className="edit-sequence-btn p-1"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Editar Sequência</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant={sequence.ativo ? 'secondary' : 'default'}
                                                                    size="sm"
                                                                    onClick={() => handleToggleSequenceStatus(sequence)}
                                                                    className="toggle-sequence-btn p-1"
                                                                    disabled={toggleSequenceStatusMutation.isPending}
                                                                >
                                                                    {toggleSequenceStatusMutation.isPending && toggleSequenceStatusMutation.variables?.id === sequence.id ? (
                                                                         <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : sequence.ativo ? (
                                                                        <ToggleLeft className="h-4 w-4" />
                                                                    ) : (
                                                                        <ToggleRight className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{sequence.ativo ? 'Desativar Sequência' : 'Ativar Sequência'}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteSequence(sequence.id)}
                                                                    className="delete-sequence-btn p-1"
                                                                    disabled={deleteSequenceMutation.isPending}
                                                                >
                                                                    {deleteSequenceMutation.isPending && deleteSequenceMutation.variables === sequence.id ? (
                                                                         <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                         <Trash2 className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Excluir Sequência</p>
                                                            </TooltipContent>
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