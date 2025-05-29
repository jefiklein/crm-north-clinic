import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, Filter, ChevronDown, ChevronUp } from "lucide-react"; 
import { useQuery } from "@tanstack/react-query";
import { format, subDays, addDays, isAfter, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import { Label } from "@/components/ui/label"; 

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface QueueItem {
    id: number;
    created_at: string;
    updated_at: string;
    status: string;
    prioridade: number;
    agendado_para: string; 
    numero_tentativas: number | null;
    erro: string | null;
    mensagem: string;
    recipiente: string; 
    instancia: string; 
    tipo_mensagem: string | null;
    data_enviado: string | null; 
    marcar_contato: string | null;
    id_clinica: number | null;
    id_mensagem_enviada: string | null;
    hash: string | null;
    tipo_evolution: string;
    id_server_evolution: number;
    url_arquivo: string | null;
    nome_grupo?: string | null;
    nome_instancia_enviado?: string | null;
}

interface InstanceDetails {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

interface FilaMensagensPageProps {
    clinicData: ClinicData | null;
}

function formatQueueTimestamp(isoTimestamp: string | null): string {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        const today = startOfDay(new Date());
        const dateOnly = startOfDay(date);

        const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const timeString = date.toLocaleTimeString('pt-BR', optionsTime);

        if (dateOnly.getTime() === today.getTime()) {
            return timeString; 
        } else {
            const optionsDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
            const dateString = date.toLocaleDateString('pt-BR', optionsDate);
            return `${dateString} ${timeString}`; 
        }
    } catch (e) {
        console.error("Error formatting timestamp:", isoTimestamp, e);
        return 'Data inválida';
    }
}

function getStatusClass(status: string | null): string {
    if (!status) return 'bg-orange-100 text-orange-800'; 
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'enviado') return 'bg-green-100 text-green-800';
    if (lowerStatus === 'pendente') return 'bg-gray-100 text-gray-800';
    if (lowerStatus === 'erro') return 'bg-red-100 text-red-800';
    if (lowerStatus === 'agendado') return 'bg-blue-100 text-blue-800';
    return 'bg-orange-100 text-orange-800'; 
}

function formatFinalMessage(messageText: string | null): string {
    if (!messageText) return '';
    let formatted = messageText;
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\\n|\n/g, '<br>');
    return formatted;
}

const FilaMensagensPage: React.FC<FilaMensagensPageProps> = ({ clinicData }) => {
    const [currentQueueDate, setCurrentQueueDate] = useState<Date>(startOfDay(new Date()));
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set()); 
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null); 

    const clinicId = clinicData?.id;
    const dateString = format(currentQueueDate, 'yyyy-MM-dd');

    const { data: queueItems, isLoading, error, refetch } = useQuery<QueueItem[]>({
        queryKey: ['messageQueue', clinicId, dateString, selectedStatus], 
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }
            console.log(`Fetching message queue for clinic ${clinicId} on date ${dateString} with status ${selectedStatus} from Supabase`);

            let query = supabase
                .from('north_clinic_fila_mensagens')
                .select('*, nome_grupo, nome_instancia_enviado')
                .eq('id_clinica', clinicId)
                .gte('agendado_para', `${dateString}T00:00:00Z`)
                .lte('agendado_para', `${dateString}T23:59:59Z`);

            if (selectedStatus !== null) {
                query = query.eq('status', selectedStatus);
            }

            query = query.order('agendado_para', { ascending: false }); 

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching queue items from Supabase:", error);
                throw new Error(error.message);
            }
            console.log("Fetched queue items:", data);
            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: instancesList } = useQuery<InstanceDetails[]>({
        queryKey: ['instancesList', clinicId],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }
            console.log(`Fetching instance details for clinic ${clinicId} from Supabase`);

            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId);

            if (error) {
                console.error("Error fetching instances from Supabase:", error);
                throw new Error(error.message);
            }

            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const instanceDetailsMap = React.useMemo(() => {
        const map = new Map<string, InstanceDetails>();
        instancesList?.forEach(instance => {
            if (instance.nome_exibição) {
                map.set(instance.nome_exibição, instance);
            }
        });
        return map;
    }, [instancesList]);

    const goToPreviousDay = () => {
        setCurrentQueueDate(startOfDay(subDays(currentQueueDate, 1)));
        setExpandedMessages(new Set()); 
    };

    const goToNextDay = () => {
        const today = startOfDay(new Date());
        const nextDay = startOfDay(addDays(currentQueueDate, 1));
        if (!isAfter(nextDay, today)) { 
            setCurrentQueueDate(nextDay);
            setExpandedMessages(new Set()); 
        }
    };

    const isNextDayDisabled = isAfter(startOfDay(addDays(currentQueueDate, 1)), startOfDay(new Date()));

    const toggleExpandMessage = (itemId: string | number) => {
        setExpandedMessages(prev => {
            const newSet = new Set(prev);
            const itemIdString = String(itemId); 
            if (newSet.has(itemIdString)) {
                newSet.delete(itemIdString);
            } else {
                newSet.add(itemIdString);
            }
            return newSet;
        });
    };

    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="fila-mensagens-container bg-gray-100 p-6">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="page-title text-2xl font-bold text-primary">Fila de Mensagens</h1>
                <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end"> 
                    <div className="date-navigation flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={goToPreviousDay} title="Dia Anterior">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <strong id="queueDateDisplay" className="text-lg font-bold text-primary whitespace-nowrap">
                            {format(currentQueueDate, 'dd/MM/yyyy')}
                        </strong>
                        <Button variant="outline" size="icon" onClick={goToNextDay} disabled={isNextDayDisabled} title="Próximo Dia">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="filter-section flex items-center gap-2">
                         <Filter className="h-5 w-5 text-gray-600 flex-shrink-0" />
                         <Label htmlFor="statusFilter" className="sr-only">Filtrar por Status</Label>
                         <Select
                             value={selectedStatus || 'all'} 
                             onValueChange={(value) => setSelectedStatus(value === 'all' ? null : value)} 
                             disabled={isLoading}
                         >
                             <SelectTrigger id="statusFilter" className="w-[150px]">
                                 <SelectValue placeholder="Todos os Status" />
                             </SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="all">Todos os Status</SelectItem> 
                                 <SelectItem value="Enviado">Enviado</SelectItem>
                                 <SelectItem value="Pendente">Pendente</SelectItem>
                                 <SelectItem value="Erro">Erro</SelectItem>
                                 <SelectItem value="Agendado">Agendado</SelectItem> 
                             </SelectContent>
                         </Select>
                    </div>
                </div>
            </div>

            <Card className="queue-list-container">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="status-message loading-message flex flex-col items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <span className="text-gray-700">Carregando fila para {format(currentQueueDate, 'dd/MM/yyyy')}...</span>
                        </div>
                    ) : error ? (
                        <div className="status-message error-message flex flex-col items-center justify-center p-8 text-red-600">
                            <TriangleAlert className="h-8 w-8 mb-4" />
                            <span>Erro ao carregar fila: {error.message}</span>
                            <Button variant="outline" onClick={() => refetch()} className="mt-4">Tentar Novamente</Button>
                        </div>
                    ) : (queueItems?.length ?? 0) === 0 ? (
                        <div className="status-message text-gray-700 p-8 text-center">
                            Nenhuma mensagem na fila para esta data{selectedStatus ? ` com status "${selectedStatus}"` : ''}.
                        </div>
                    ) : (
                        queueItems?.map(item => {
                            const statusClass = getStatusClass(item.status);
                            const scheduledTime = formatQueueTimestamp(item.agendado_para);
                            const sentTime = formatQueueTimestamp(item.data_enviado);
                            const formattedMessage = formatFinalMessage(item.mensagem);
                            const itemIdString = String(item.id); 
                            const isExpanded = expandedMessages.has(itemIdString);

                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = formattedMessage;
                            const plainText = tempDiv.textContent || tempDiv.innerText || '';
                            const messagePreviewHTML = plainText.substring(0, 100) + (plainText.length > 100 ? '...' : ''); 
                            
                            const needsExpansion = plainText.length > 100 || formattedMessage.includes('<br>') || formattedMessage.includes('<em>') || formattedMessage.includes('<strong>');

                            const instanceNameFromQueue = item.nome_instancia_enviado;
                            const instanceDetailsFromConfig = instanceDetailsMap.get(item.instancia);
                            const instanceNameFromConfig = instanceDetailsFromConfig?.nome_exibição;
                            
                            const finalDisplayInstanceName = instanceNameFromQueue || instanceNameFromConfig || item.instancia || 'N/A'; 
                            const displayRecipient = item.nome_grupo || item.recipiente || 'N/D'; 


                            return (
                                <div key={itemIdString} className="queue-item p-4 border-b last:border-b-0 border-gray-200">
                                    <div className="queue-item-header flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                                        <span className={`queue-item-status text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass}`}>
                                            {item.status || 'Desconhecido'}
                                        </span>
                                        <div className="queue-item-details text-xs text-gray-600 text-left sm:text-right flex flex-col gap-1">
                                            {item.status?.toLowerCase() === 'enviado' && item.data_enviado ? (
                                                <span><strong>Enviado:</strong> {sentTime}</span>
                                            ) : (
                                                <span><strong>Agendado:</strong> {scheduledTime}</span>
                                            )}
                                            <span><strong>Instância:</strong> {finalDisplayInstanceName}</span> 
                                            <span><strong>Recipiente:</strong> {displayRecipient}</span> 
                                            {item.erro && <span className="text-red-500"><strong>Erro:</strong> {item.erro}</span>}
                                        </div>
                                    </div>
                                    <div className="queue-item-message bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-800">
                                        <div 
                                            className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-[60px] opacity-80'}`} 
                                            dangerouslySetInnerHTML={{ __html: isExpanded ? formattedMessage : messagePreviewHTML }}
                                        />
                                        {needsExpansion && ( 
                                            <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() => toggleExpandMessage(item.id)}
                                                className="p-0 h-auto text-primary hover:no-underline flex items-center mt-1 text-xs"
                                            >
                                                {isExpanded ? (
                                                    <>Ver menos <ChevronUp className="ml-1 h-3 w-3" /></>
                                                ) : (
                                                    <>Ver mais <ChevronDown className="ml-1 h-3 w-3" /></>
                                                )}
                                            </Button>
                                        )}
                                        {!needsExpansion && !isExpanded && ( 
                                             <div dangerouslySetInnerHTML={{ __html: formattedMessage }}></div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default FilaMensagensPage;