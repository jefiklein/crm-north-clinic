import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare } from 'lucide-react'; // Using Lucide icons, changed Whatsapp to MessagesSquare
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils'; // Utility for class names
import { showSuccess, showError } from '@/utils/toast'; // Using our toast utility
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client

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
    categoria: string;
    modelo_mensagem: string | null;
    midia_mensagem: string | null;
    id_instancia: number | null;
    grupo: string | null; // Group ID
    ativo: boolean;
    hora_envio: string | null; // HH:mm format
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
    prioridade: number; // Added priority field
    created_at: string;
    updated_at: string;
}

// Define the structure for Instance Info from Supabase
interface InstanceInfo {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null; // Technical name for Evolution API
    // Add other fields if needed from Supabase
}


interface MensagensListPageProps {
    clinicData: ClinicData | null;
}

// Placeholder data for message simulation
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

// Helper function to simulate message rendering with placeholders
function simulateMessage(template: string | null, placeholders: { [key: string]: string }): string {
    if (typeof template !== 'string' || !template) return '<i class="text-gray-500">(Modelo inválido ou vazio)</i>';
    let text = template;
    for (const key in placeholders) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        text = text.replace(regex, `<strong>${placeholders[key]}</strong>`);
    }
    // Highlight any remaining unreplaced tokens
    text = text.replace(/\{([\w_]+)\}/g, '<span class="unreplaced-token text-gray-600 bg-gray-200 px-1 rounded font-mono text-xs">{$1}</span>');
    // Basic markdown-like formatting for bold and italic
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    // Replace newline characters with <br> tags
    text = text.replace(/\\n|\n/g, '<br>');
    return text;
}


const MensagensListPage: React.FC<MensagensListPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate(); // Get the navigate function
    const [expandedPreviews, setExpandedPreviews] = useState<Set<number>>(new Set()); // State to track expanded previews

    const clinicId = clinicData?.id; // Use clinicId for Supabase queries

    // --- Fetch Messages List --- NOW FROM SUPABASE
    const { data: messagesList, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery<MessageItem[]>({
        queryKey: ['messagesList', clinicId], // Use clinicId in key
        queryFn: async () => {
            if (!clinicId) {
                 console.warn("[MensagensListPage] Skipping messages fetch: clinicId missing.");
                 throw new Error("ID da clínica não disponível.");
            }
            console.log(`[MensagensListPage] Fetching messages list from Supabase (Clinic ID: ${clinicId})...`);

            try {
                const { data, error } = await supabase
                    .from('north_clinic_config_mensagens')
                    .select('*') // Select all fields
                    .eq('id_clinica', clinicId) // Filter by clinic ID
                    .order('prioridade', { ascending: true }) // Order by priority
                    .order('categoria', { ascending: true }); // Then order by category

                console.log("[MensagensListPage] Supabase messages fetch result:", { data, error });

                if (error) {
                    console.error("[MensagensListPage] Supabase messages fetch error:", error);
                    throw new Error(`Erro ao buscar mensagens: ${error.message}`);
                }

                if (!data) {
                    console.warn("[MensagensListPage] Supabase messages fetch returned null data.");
                    return []; // Return empty array if data is null
                }

                console.log("[MensagensListPage] Messages list loaded:", data.length, "items");
                return data as MessageItem[]; // Cast to the defined interface

            } catch (err: any) {
                console.error("[MensagensListPage] Error fetching messages from Supabase:", err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 60 * 1000, // Cache messages for 1 minute
        refetchOnWindowFocus: false,
    });

    // --- Fetch Instances List --- NOW FROM SUPABASE
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListMessagesPage', clinicId], // Use clinicId for Supabase fetch
        queryFn: async () => {
            if (!clinicId) {
                console.warn("[MensagensListPage] Skipping instances fetch: clinicId missing.");
                throw new Error("ID da clínica não disponível.");
            }
            console.log(`[MensagensListPage] Fetching instances list from Supabase (Clinic ID: ${clinicId})...`);

            try {
                const { data, error } = await supabase
                    .from('north_clinic_config_instancias')
                    .select('id, nome_exibição, telefone, nome_instancia_evolution') // Select necessary fields
                    .eq('id_clinica', clinicId); // Filter by clinic ID

                console.log("[MensagensListPage] Supabase instances fetch result:", { data, error });

                if (error) {
                    console.error("[MensagensListPage] Supabase instances fetch error:", error);
                    throw new Error(`Erro ao buscar instâncias: ${error.message}`);
                }

                if (!data) {
                    console.warn("[MensagensListPage] Supabase instances fetch returned null data.");
                    return []; // Return empty array if data is null
                }

                console.log("[MensagensListPage] Instances list loaded:", data.length, "items");
                return data as InstanceInfo[]; // Cast to the defined interface

            } catch (err: any) {
                console.error("[MensagensListPage] Error fetching instances from Supabase:", err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // Cache instances for 5 minutes
        refetchOnWindowFocus: false,
    });

    // Map instance IDs to names for quick lookup
    const instanceMap = useMemo(() => {
        const map = new Map<number, InstanceInfo>();
        instancesList?.forEach(instance => map.set(instance.id, instance));
        return map;
    }, [instancesList]);

    // --- Mutations ---

    // Mutation for toggling active status
    const toggleMessageMutation = useMutation({
        mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`[MensagensListPage] Toggling message ID ${id} to active: ${ativo}`);
            // This mutation still uses a webhook. If you want to migrate this to Supabase,
            // you would use supabase.from('north_clinic_config_mensagens').update({ ativo: ativo }).eq('id', id).eq('id_clinica', clinicId);
            const response = await fetch('https://n8n-n8n.sbw0pc.easypanel.host/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, ativo: ativo, id_clinica: clinicId }) // Sending ID, new status, and clinic ID
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            return response.json();
        },
        onSuccess: (_, variables) => {
            showSuccess(`Mensagem ${variables.ativo ? 'ativada' : 'desativada'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['messagesList', clinicId] }); // Refetch messages list
        },
        onError: (error: Error) => {
            showError(`Erro ao alterar status da mensagem: ${error.message}`);
        },
    });

    // Mutation for deleting a message
    const deleteMessageMutation = useMutation({
        mutationFn: async (id: number) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`[MensagensListPage] Deleting message ID ${id}`);
             // This mutation still uses a webhook. If you want to migrate this to Supabase,
            // you would use supabase.from('north_clinic_config_mensagens').delete().eq('id', id).eq('id_clinica', clinicId);
            const response = await fetch('https://n8n-n8n.sbw0pc.easypanel.host/webhook/4632ce57-e78a-4c62-9578-5a33b576ad73', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, id_clinica: clinicId }) // Sending ID and clinic ID
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            return response.json();
        },
        onSuccess: () => {
            showSuccess('Mensagem excluída com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['messagesList', clinicId] }); // Refetch messages list
        },
        onError: (error: Error) => {
            showError(`Erro ao excluir mensagem: ${error.message}`);
        },
    });


    // --- Handlers ---

    // Handle click on "Configurar Nova Mensagem" button
    const handleAddMessage = () => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        navigate(`/config-mensagem?clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    // Handle click on "Editar" button
    const handleEditMessage = (messageId: number) => {
         if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        navigate(`/config-mensagem?id=${messageId}&clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    // Handle click on "Ativar/Desativar" button
    const handleToggleMessage = (message: MessageItem) => {
        toggleMessageMutation.mutate({ id: message.id, ativo: !message.ativo });
    };

    // Handle click on "Excluir" button
    const handleDeleteMessage = (messageId: number) => {
        if (window.confirm(`Tem certeza que deseja excluir esta mensagem (ID: ${messageId})?\n\nEsta ação não pode ser desfeita!`)) {
            deleteMessageMutation.mutate(messageId);
        }
    };

    // Handle click on "Preview" button
    const handlePreviewToggle = (messageId: number) => {
        setExpandedPreviews(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    // Combine loading states
    const isLoading = isLoadingMessages || isLoadingInstances || toggleMessageMutation.isLoading || deleteMessageMutation.isLoading;
    const fetchError = messagesError || instancesError;


    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }


    return (
        <div className="config-container max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="config-title text-2xl font-bold text-primary whitespace-nowrap">
                    {clinicData?.nome} | Mensagens Automáticas
                </h1>
                <Button onClick={handleAddMessage} className="add-message-btn flex-shrink-0">
                    <Plus className="h-5 w-5 mr-2" /> Configurar Nova Mensagem
                </Button>
            </div>

            {/* Error Display */}
            {fetchError && (
                <div className="error-message flex items-center gap-2 p-3 mb-4 bg-red-100 text-red-700 border border-red-200 rounded-md">
                    <TriangleAlert className="h-5 w-5 flex-shrink-0" />
                    <span>Erro ao carregar dados: {fetchError.message}</span>
                    <Button variant="outline" size="sm" onClick={() => { refetchMessages(); instancesList?.length === 0 && isLoadingInstances && instancesError && queryClient.invalidateQueries({ queryKey: ['instancesListMessagesPage', clinicId] }); }} className="ml-auto">Tentar Novamente</Button>
                </div>
            )}

            {/* Loading Indicator */}
            {isLoading && !fetchError && (
                <div className="loading-indicator flex flex-col items-center justify-center p-8 text-primary">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <span className="text-lg">Carregando configurações...</span>
                </div>
            )}

            {/* Message List Table */}
            {!isLoading && !fetchError && (messagesList?.length ?? 0) === 0 ? (
                 <div id="noMessagesFound" className="text-center text-gray-600 p-8 bg-gray-50 rounded-md border border-gray-200">
                    <Info className="h-12 w-12 mb-4 mx-auto" />
                    <p className="text-lg">Nenhuma mensagem automática configurada encontrada.</p>
                </div>
            ) : (
                <div id="messageListContainer" className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
                    <Table className="message-table min-w-full">
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="text-left">Categoria</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-left">Instância</TableHead>
                                <TableHead className="text-center">Prioridade</TableHead>
                                <TableHead className="text-center">Horário Prog.</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody id="messageTableBody" className="divide-y divide-gray-200">
                            {messagesList?.map(message => {
                                const isExpanded = expandedPreviews.has(message.id);
                                const instance = instanceMap.get(message.id_instancia || -1); // Use -1 for null/undefined lookup
                                const instanceName = instance ? (instance.nome_exibição || `ID ${instance.id}`) : "Não definida";
                                const instanceClass = instance ? '' : 'not-set';

                                return (
                                    <React.Fragment key={message.id}>
                                        <TableRow data-message-id={message.id} data-category={message.categoria} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                            <TableCell className="font-medium text-gray-800">{message.categoria || 'N/A'}</TableCell>
                                            <TableCell className="text-center">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold",
                                                    message.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                )}>
                                                    {message.ativo ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                <span className={cn("inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded select-none", instanceClass)}>
                                                    <MessagesSquare className="h-4 w-4" /> {instanceName}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-gray-700 font-semibold">{message.prioridade ?? 'N/D'}</TableCell>
                                            <TableCell className="text-center text-gray-700">
                                                {(message.categoria === 'Confirmar Agendamento' || message.categoria === 'Aniversário') && message.hora_envio ?
                                                    message.hora_envio : '-'
                                                }
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="message-item-actions flex gap-2 justify-end">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handlePreviewToggle(message.id)}
                                                                    className="preview-toggle-btn"
                                                                >
                                                                    {isExpanded ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                                                    {isExpanded ? 'Ocultar' : 'Preview'}
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
                                                                    onClick={() => handleEditMessage(message.id)} // Pass message.id
                                                                    className="edit-message-btn"
                                                                >
                                                                    <Edit className="h-4 w-4 mr-1" /> Editar
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Editar Mensagem</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant={message.ativo ? 'secondary' : 'default'} // Use default for primary look when activating
                                                                    size="sm"
                                                                    onClick={() => handleToggleMessage(message)}
                                                                    className="toggle-message-btn"
                                                                    disabled={toggleMessageMutation.isLoading}
                                                                >
                                                                    {toggleMessageMutation.isLoading ? (
                                                                         <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : message.ativo ? (
                                                                        <ToggleLeft className="h-4 w-4 mr-1" />
                                                                    ) : (
                                                                        <ToggleRight className="h-4 w-4 mr-1" />
                                                                    )}
                                                                    {toggleMessageMutation.isLoading ? 'Carregando...' : (message.ativo ? 'Desat.' : 'Ativar')}
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
                                                                    className="delete-message-btn"
                                                                    disabled={deleteMessageMutation.isLoading}
                                                                >
                                                                    {deleteMessageMutation.isLoading ? (
                                                                         <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                         <Trash2 className="h-4 w-4 mr-1" />
                                                                    )}
                                                                    Excluir
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
                                        <TableRow className={cn("preview-row bg-gray-50 text-gray-800 text-sm border-t border-gray-200", !isExpanded && 'hidden')}>
                                            <TableCell colSpan={6} className="p-4">
                                                <div
                                                    className="preview-content whitespace-pre-wrap"
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

export default MensagensListPage;