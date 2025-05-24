import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
    context: string | null; // Added new column
    dias_mensagem_cashback: number | null; // Added new column (renamed)
    tipo_mensagem_cashback: string | null; // Added new column (renamed)
}

// Define the structure for Instance Info from Supabase
interface InstanceInfo {
    id: number | string;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

interface CashbackMessagesPageProps {
    clinicData: ClinicData | null;
}

// Placeholder data for message preview
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
    hora_agendamento: "15:30",
    // Add cashback specific placeholders if needed in the future
    valor_cashback: "R$ 50,00", // Added cashback placeholder
    validade_cashback: "20/05/2025" // Added cashback placeholder
};

// Categories relevant to Cashback context (kept for reference, but filtering by context now)
const cashbackCategories = [
    "Aniversário",
    // Add other cashback-specific categories here if they are created in the DB
    // "Cashback Concedido",
    // "Cashback Próximo a Expirar",
];


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


const CashbackMessagesPage: React.FC<CashbackMessagesPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [expandedPreviews, setExpandedPreviews] = useState<Set<number>>(new Set());

    const clinicId = clinicData?.id;

    // Fetch message list filtered by cashbackCategories
    const { data: messagesList, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery<MessageItem[]>({
        queryKey: ['cashbackMessagesList', clinicId], // Unique key for this page
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`Fetching cashback messages for clinic ${clinicId} from Supabase`);
            const { data, error } = await supabase
                .from('north_clinic_config_mensagens')
                .select('*')
                .eq('id_clinica', clinicId)
                .eq('context', 'cashback') // <-- Filter by context 'cashback'
                // Removed .in('categoria', cashbackCategories) filter
                .order('categoria', { ascending: true })
                .order('prioridade', { ascending: true });
            if (error) {
                 console.error("Error fetching cashback messages from Supabase:", error);
                 throw new Error(error.message);
            }
            console.log("Cashback messages fetched:", data);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch instances list (needed for displaying instance name)
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListCashbackMessagesPage', clinicId], // Unique key
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log(`Fetching instances for clinic ${clinicId} for cashback messages page`);
            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });
            if (error) {
                 console.error("Error fetching instances for cashback messages from Supabase:", error);
                 throw new Error(error.message);
            }
            console.log("Instances fetched for cashback messages:", data);
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
            queryClient.invalidateQueries({ queryKey: ['cashbackMessagesList', clinicId] }); // Invalidate this page's query
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
            queryClient.invalidateQueries({ queryKey: ['cashbackMessagesList', clinicId] }); // Invalidate this page's query
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
        // Navigate to the config page, passing the context 'cashback'
        navigate(`/dashboard/config-mensagem?clinic_code=${encodeURIComponent(clinicData.code)}&context=cashback`);
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

    // Helper to display cashback timing
    const formatCashbackTiming = (dias: number | null, tipo: string | null): string => {
        if (dias === null || tipo === null) return 'Não configurado';
        if (tipo === 'apos_venda') return `${dias} dias após a venda`;
        if (tipo === 'antes_validade') return `${dias} dias antes da validade`;
        return 'Configuração inválida';
    };


    const isLoading = isLoadingMessages || isLoadingInstances || toggleMessageMutation.isLoading || deleteMessageMutation.isLoading;
    const fetchError = messagesError || instancesError;

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="cashback-messages-container max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="config-title text-3xl font-extrabold text-primary whitespace-nowrap">
                    Lista de Mensagens de Cashback
                </h1>
                {/* Button to add a NEW message (will go to the single config page) */}
                <Button onClick={handleAddMessage} className="add-message-btn flex-shrink-0 bg-primary text-white hover:bg-primary/90 transition-colors shadow-md">
                    <Plus className="h-5 w-5 mr-2" /> Configurar Nova Mensagem
                </Button>
            </div>

            {fetchError && (
                <div className="error-message flex items-center gap-2 p-4 mb-6 bg-red-100 text-red-700 border border-red-300 rounded-md shadow-sm">
                    <TriangleAlert className="h-6 w-6 flex-shrink-0" />
                    <span className="text-lg font-semibold">Erro ao carregar dados: {fetchError.message}</span>
                    <Button variant="outline" size="sm" onClick={() => { refetchMessages(); queryClient.invalidateQueries({ queryKey: ['instancesListCashbackMessagesPage', clinicId] }); }} className="ml-auto">
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
                    <p className="text-2xl font-semibold">Nenhuma mensagem automática de Cashback configurada encontrada.</p>
                </div>
            ) : (
                <div id="messageListContainer" className="overflow-x-auto rounded-lg border border-gray-300 shadow-md">
                    <Table className="message-table min-w-full">
                        <TableHeader className="bg-gray-100 border-b border-gray-300">
                            <TableRow>
                                {/* Removed Categoria column */}
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Timing Cashback</TableHead> {/* New column */}
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Status</TableHead>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Instância</TableHead>
                                {/* Removed Prioridade column */}
                                {/* Removed Horário Prog. column */}
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
                                            {/* Removed Categoria Cell */}
                                            <TableCell className="font-medium text-gray-900 px-6 py-4 whitespace-nowrap"> {/* New Cell */}
                                                {formatCashbackTiming(message.dias_mensagem_cashback, message.tipo_mensagem_cashback)}
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
                                            {/* Removed Prioridade Cell */}
                                            {/* Removed Horário Prog. Cell */}
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
                                            <TableCell colSpan={4} className="p-6"> {/* Adjusted colspan to 4 */}
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

export default CashbackMessagesPage;