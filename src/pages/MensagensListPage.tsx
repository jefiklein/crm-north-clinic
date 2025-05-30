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
    context: string | null;
    dias_mensagem_cashback: number | null;
    tipo_mensagem_cashback: string | null;
    sending_order: string | null; // <-- Added new column
}

// Define the structure for Instance Info from Supabase
interface InstanceInfo {
    id: number | string;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

interface MensagensListPageProps {
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

const MensagensListPage: React.FC<MensagensListPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    // Removed expandedPreviews state

    const clinicId = clinicData?.id;

    const { data: messagesList, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery<MessageItem[]>({
        queryKey: ['messagesList', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const { data, error } = await supabase
                .from('north_clinic_config_mensagens')
                .select('*')
                .eq('id_clinica', clinicId)
                .eq('context', 'clientes') // <-- Filter by context 'clientes'
                .order('categoria', { ascending: true })
                .order('prioridade', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListMessagesPage', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });
            if (error) throw new Error(error.message);
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

    const toggleMessageMutation = useMutation({
        mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const response = await fetch('https://n8n-n8n.sbw0pc.easypanel.host/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ativo, id_clinica: clinicId })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            return response.json();
        },
        onSuccess: (_, variables) => {
            showSuccess(`Mensagem ${variables.ativo ? 'ativada' : 'desativada'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['messagesList', clinicId] });
        },
        onError: (error: Error) => {
            showError(`Erro ao alterar status da mensagem: ${error.message}`);
        },
    });

    const deleteMessageMutation = useMutation({
        mutationFn: async (id: number) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const response = await fetch('https://n8n-n8n.sbw0pc.easypanel.host/webhook/4632ce57-e78a-4c62-9578-5a33b576ad73', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, id_clinica: clinicId })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
            }
            return response.json();
        },
        onSuccess: () => {
            showSuccess('Mensagem excluída com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['messagesList', clinicId] });
        },
        onError: (error: Error) => {
            showError(`Erro ao excluir mensagem: ${error.message}`);
        },
    });

    const handleAddMessage = () => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        // Navigate to the config page, passing the context 'clientes'
        navigate(`/dashboard/config-mensagem?clinic_code=${encodeURIComponent(clinicData.code)}&context=clientes`);
    };

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

    // Removed handlePreviewToggle function

    const isLoading = isLoadingMessages || isLoadingInstances || toggleMessageMutation.isLoading || deleteMessageMutation.isLoading;
    const fetchError = messagesError || instancesError;

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="config-container max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="config-title text-3xl font-extrabold text-primary whitespace-nowrap">
                    Lista de Mensagens de Clientes
                </h1>
                <Button onClick={handleAddMessage} className="add-message-btn flex-shrink-0 bg-primary text-white hover:bg-primary/90 transition-colors shadow-md">
                    <Plus className="h-5 w-5 mr-2" /> Configurar Nova Mensagem de Cliente
                </Button>
            </div>

            {fetchError && (
                <div className="error-message flex items-center gap-2 p-4 mb-6 bg-red-100 text-red-700 border border-red-300 rounded-md shadow-sm">
                    <TriangleAlert className="h-6 w-6 flex-shrink-0" />
                    <span className="text-lg font-semibold">Erro ao carregar dados: {fetchError.message}</span>
                    <Button variant="outline" size="sm" onClick={() => { refetchMessages(); queryClient.invalidateQueries({ queryKey: ['instancesListMessagesPage', clinicId] }); }} className="ml-auto">
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
                    <p className="text-2xl font-semibold">Nenhuma mensagem automática configurada encontrada para clientes.</p>
                </div>
            ) : (
                <div id="messageListContainer" className="overflow-x-auto rounded-lg border border-gray-300 shadow-md">
                    <Table className="message-table min-w-full">
                        <TableHeader className="bg-gray-100 border-b border-gray-300">
                            <TableRow>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Categoria</TableHead>
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Status</TableHead>
                                <TableHead className="text-left text-lg font-semibold text-gray-700 px-6 py-3">Instância</TableHead>
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Prioridade</TableHead>
                                <TableHead className="text-center text-lg font-semibold text-gray-700 px-6 py-3">Horário Prog.</TableHead>
                                <TableHead className="text-right text-lg font-semibold text-gray-700 px-6 py-3">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody id="messageTableBody" className="divide-y divide-gray-200">
                            {messagesList?.map(message => {
                                // Removed isExpanded variable
                                const instanceIdStr = message.id_instancia !== null && message.id_instancia !== undefined ? String(message.id_instancia) : '';
                                const instance = instanceMap.get(instanceIdStr);
                                const instanceName = instance ? (instance.nome_exibição || `ID ${instance.id}`) : "Não definida";
                                const instanceClass = instance ? '' : 'not-set';

                                // Removed preview related variables and logic


                                return (
                                    <React.Fragment key={message.id}>
                                        <TableRow data-message-id={message.id} data-category={message.categoria} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                            <TableCell className="font-medium text-gray-900 px-6 py-4">{message.categoria || 'N/A'}</TableCell>
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
                                                {(message.categoria === 'Confirmar Agendamento' || message.categoria === 'Aniversário') && message.hora_envio ?
                                                    message.hora_envio : '-'
                                                }
                                            </TableCell>
                                            <TableCell className="text-right px-6 py-4">
                                                <div className="message-item-actions flex gap-2 justify-end">
                                                    <TooltipProvider>
                                                        {/* Removed Preview Toggle Button */}
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
                                        {/* Removed Preview Row */}
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