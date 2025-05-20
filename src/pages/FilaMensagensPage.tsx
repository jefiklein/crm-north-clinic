import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, addDays, isToday, isAfter, startOfDay } from 'date-fns';
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

// Define the structure for a message queue item from the webhook
interface QueueItem {
    id: string | number;
    created_at: string;
    updated_at: string;
    status: string;
    prioridade: number;
    agendado_para: string; // ISO timestamp
    numero_tentativas: number | null;
    erro: string | null;
    mensagem: string;
    recipiente: string; // Phone number or JID
    instancia: string; // Original instance name
    tipo_mensagem: string | null;
    data_enviado: string | null; // ISO timestamp
    marcar_contato: string | null;
    id_clinica: number | null;
    id_mensagem_enviada: string | null;
    hash: string | null;
    tipo_evolution: string;
    id_server_evolution: number;
    url_arquivo: string | null; // Assuming this might be a string URL
}

// Define the structure for instance details
interface InstanceDetails {
    nome: string; // nome_exibição
    telefone: number | null; // telefone
}

// Define the structure for the data returned by the queue webhook query
interface QueueDataWithInstanceDetails {
    queueItems: QueueItem[];
    instanceDetailsMap: Map<string, InstanceDetails>;
}


interface FilaMensagensPageProps {
    clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const QUEUE_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/1972fe9f-85e9-4f53-9846-8df9c2012cec`;
const INSTANCE_DETAILS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/38785029-5651-4e3b-8508-af69bf38f28e`;


// Helper function to format timestamp
function formatQueueTimestamp(isoTimestamp: string | null): string {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        const today = startOfDay(new Date());
        const dateOnly = startOfDay(date);

        const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const timeString = date.toLocaleTimeString('pt-BR', optionsTime);

        if (dateOnly.getTime() === today.getTime()) {
            return timeString; // Just time if today
        } else {
            const optionsDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
            const dateString = date.toLocaleDateString('pt-BR', optionsDate);
            return `${dateString} ${timeString}`; // Date and time if not today
        }
    } catch (e) {
        console.error("Error formatting timestamp:", isoTimestamp, e);
        return 'Data inválida';
    }
}

// Helper function to get status class
function getStatusClass(status: string | null): string {
    if (!status) return 'bg-orange-100 text-orange-800'; // Unknown status
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'enviado') return 'bg-green-100 text-green-800';
    if (lowerStatus === 'pendente') return 'bg-gray-100 text-gray-800';
    if (lowerStatus === 'erro') return 'bg-red-100 text-red-800';
    if (lowerStatus === 'agendado') return 'bg-blue-100 text-blue-800';
    return 'bg-orange-100 text-orange-800'; // Default unknown
}

// Helper function to format message text (bold, italic, newlines)
function formatFinalMessage(messageText: string | null): string {
    if (!messageText) return '';
    let formatted = messageText;
    // Replace *text* with <em>text</em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Replace newlines with <br>
    formatted = formatted.replace(/\\n|\n/g, '<br>');
    return formatted;
}


const FilaMensagensPage: React.FC<FilaMensagensPageProps> = ({ clinicData }) => {
    const [currentQueueDate, setCurrentQueueDate] = useState<Date>(startOfDay(new Date()));
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set()); // State to track expanded messages

    const clinicId = clinicData?.id;
    const dateString = format(currentQueueDate, 'yyyy-MM-dd');

    // Fetch message queue data and instance details using react-query
    const { data, isLoading, error, refetch } = useQuery<QueueDataWithInstanceDetails | null>({
        queryKey: ['messageQueue', clinicId, dateString],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }

            console.log(`Fetching message queue for clinic ${clinicId} on date ${dateString}`);

            // 1. Fetch Queue Data
            const payloadQueue = { id_clinica: clinicId, data: dateString };
            const responseQueue = await fetch(QUEUE_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify(payloadQueue)
            });

            console.log('Queue webhook response:', { status: responseQueue.status, statusText: responseQueue.statusText });

            if (!responseQueue.ok) {
                let errorDetail = responseQueue.statusText;
                 try {
                    const errorBody = await responseQueue.text();
                    errorDetail = errorBody.substring(0, 200) + (errorBody.length > 200 ? '...' : '');
                    try {
                        const errorJson = JSON.parse(errorBody);
                        errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                    } catch(e) { /* ignore parse error */ }
                } catch(readError) { /* ignore read error */ }
                throw new Error(`Falha API Fila (${responseQueue.status}): ${errorDetail}`);
            }

            const queueData: QueueItem[] = await responseQueue.json();
            if (!Array.isArray(queueData)) {
                 console.warn("API Fila não retornou array:", queueData);
                 throw new Error("Resposta inesperada API Fila.");
            }
            console.log("Message queue list received:", queueData.length, "items");

            // 2. Fetch Instance Details for unique instances
            const instanceDetailsMap = new Map<string, InstanceDetails>();
            if (queueData.length > 0) {
                const uniqueInstanceNames = [...new Set(queueData.map(item => item.instancia).filter(name => name))];
                console.log("Unique instance names from queue:", uniqueInstanceNames); // Added log

                if (uniqueInstanceNames.length > 0) {
                    const detailPromises = uniqueInstanceNames.map(async (name) => {
                        console.log(`Fetching details for instance: ${name}`); // Added log
                        // Call the instance details webhook for each unique name
                        const payloadInstance = { "nome_instancia": name };
                        try {
                            const responseInstance = await fetch(INSTANCE_DETAILS_WEBHOOK_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', "Accept": "application/json" },
                                body: JSON.stringify(payloadInstance)
                            });

                            console.log(`Response status for instance ${name}:`, responseInstance.status); // Added log

                            if (!responseInstance.ok) {
                                console.warn(`API Error ${responseInstance.status} fetching details for instance ${name}`);
                                return null; // Return null for failed fetches
                            }
                            const detailsArray = await responseInstance.json();
                            console.log(`Raw details response for instance ${name}:`, detailsArray); // Added log

                             if (Array.isArray(detailsArray) && detailsArray.length > 0 && detailsArray[0] && typeof detailsArray[0] === 'object') {
                                const details = detailsArray[0];
                                console.log(`Parsed details for instance ${name}:`, details); // Added log
                                if (details.nome_exibição && details.telefone) {
                                    console.log(`Valid details found for ${name}:`, { nome: details.nome_exibição, telefone: Number(details.telefone) }); // Added log
                                    return { originalName: name, details: { nome: details.nome_exibição, telefone: Number(details.telefone) } as InstanceDetails };
                                } else {
                                    console.warn(`Instance details response for '${name}' missing nome_exibição or telefone:`, details);
                                    return null;
                                }
                            } else {
                                console.warn(`Unexpected instance details response format for '${name}':`, detailsArray);
                                return null;
                            }
                        } catch (instanceError) {
                            console.error(`Failed to fetch details for instance '${name}':`, instanceError);
                            return null; // Return null on error
                        }
                    });

                    const detailResults = await Promise.all(detailPromises); // Use Promise.all to wait for all fetches
                    console.log("All instance detail fetch results:", detailResults); // Added log
                    detailResults.forEach(result => {
                        if (result.status === 'fulfilled' && result.value && result.value.originalName && result.value.details) {
                            instanceDetailsMap.set(result.value.originalName, result.value.details);
                        } else if (result.status === 'rejected') {
                             console.warn(`Falha detalhes instância. Razão:`, result.reason); // Added log
                        } else {
                             console.warn(`Skipping mapping for instance result (null/undefined value):`, result); // Added log
                        }
                    });
                     console.log("Instance details map built:", instanceDetailsMap);
                } else {
                    console.log("No unique instance names found in queue data."); // Added log
                }
            } else {
                 console.log("No queue data received, skipping instance details fetch."); // Added log
            }

            // Return both queue items and the instance details map
            return { queueItems: queueData, instanceDetailsMap: instanceDetailsMap };

        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes
        refetchOnWindowFocus: false,
    });

    // Function to navigate dates
    const goToPreviousDay = () => {
        setCurrentQueueDate(startOfDay(subDays(currentQueueDate, 1)));
        setExpandedMessages(new Set()); // Collapse all messages on date change
    };

    const goToNextDay = () => {
        const today = startOfDay(new Date());
        const nextDay = startOfDay(addDays(currentQueueDate, 1));
        if (!isAfter(nextDay, today)) { // Only navigate to next day if it's not in the future
            setCurrentQueueDate(nextDay);
            setExpandedMessages(new Set()); // Collapse all messages on date change
        }
    };

    // Check if the next day button should be disabled
    const isNextDayDisabled = isAfter(startOfDay(addDays(currentQueueDate, 1)), startOfDay(new Date()));

    // Toggle message expansion
    const toggleExpandMessage = (itemId: string | number) => {
        setExpandedMessages(prev => {
            const newSet = new Set(prev);
            const itemIdString = String(itemId); // Ensure consistent key type
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
        <div className="fila-mensagens-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="page-title text-2xl font-bold text-primary">Fila de Mensagens</h1>
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
                    ) : (data?.queueItems?.length ?? 0) === 0 ? (
                        <div className="status-message text-gray-700 p-8 text-center">
                            Nenhuma mensagem na fila para esta data.
                        </div>
                    ) : (
                        data?.queueItems.map(item => {
                            const statusClass = getStatusClass(item.status);
                            const scheduledTime = formatQueueTimestamp(item.agendado_para);
                            const sentTime = formatQueueTimestamp(item.data_enviado);
                            const formattedMessage = formatFinalMessage(item.mensagem);
                            const itemIdString = String(item.id); // Use string ID for Set
                            const isExpanded = expandedMessages.has(itemIdString);

                            // Create a short preview, handling HTML tags from formatting
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = formattedMessage;
                            const plainText = tempDiv.textContent || tempDiv.innerText || '';
                            const messagePreview = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : ''); // Increased preview length

                            const needsExpansion = plainText.length > 150 || formattedMessage.includes('<br>') || formattedMessage.includes('<em>') || formattedMessage.includes('<strong>'); // Check for length or formatting tags

                            const instanceOriginalName = item.instancia || 'N/A';
                            const instanceDetails = data?.instanceDetailsMap.get(instanceOriginalName);

                            // Determine the name to display: nome_exibição if available, otherwise original name
                            const instanceNameToDisplay = instanceDetails?.nome || instanceOriginalName;

                            return (
                                <div key={itemIdString} className="queue-item p-4 border-b last:border-b-0 border-gray-200">
                                    <div className="queue-item-header flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                                        <span className={`queue-item-status text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass}`}>
                                            {item.status || 'Desconhecido'}
                                        </span>
                                        {/* Adjusted queue-item-details to use flex column and gap */}
                                        <div className="queue-item-details text-xs text-gray-600 text-left sm:text-right flex flex-col gap-1">
                                            <span><strong>Agendado:</strong> {scheduledTime}</span>
                                            {/* Render instance details if found, otherwise just the original name */}
                                            {instanceDetails ? (
                                                <div className="instance-details">
                                                    <span className="instance-name font-medium" title={`Nome original: ${instanceOriginalName}`}>{instanceNameToDisplay}</span> {/* Use the determined name */}
                                                    <span className="instance-phone text-gray-500">{instanceDetails.telefone || 'Telefone N/A'}</span>
                                                </div>
                                            ) : (
                                                <span><strong>Instância:</strong> {instanceNameToDisplay}</span> {/* Use the determined name */}
                                            )}
                                            {item.status === 'Enviado' && <span><strong>Enviado:</strong> {sentTime}</span>}
                                            {item.erro && <span className="text-red-500"><strong>Erro:</strong> {item.erro}</span>}
                                        </div>
                                    </div>
                                    <div className="queue-item-message bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-800">
                                        {needsExpansion ? (
                                            <>
                                                <div
                                                    className={`message-preview ${isExpanded ? 'hidden' : 'block'}`}
                                                    dangerouslySetInnerHTML={{ __html: messagePreview }}
                                                ></div>
                                                <div
                                                    className={`message-full ${isExpanded ? 'block' : 'hidden'}`}
                                                    dangerouslySetInnerHTML={{ __html: formattedMessage }}
                                                ></div>
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    onClick={() => toggleExpandMessage(item.id)}
                                                    className="p-0 h-auto text-primary hover:no-underline"
                                                >
                                                    {isExpanded ? 'Recolher [-]' : 'Expandir [+]'}
                                                </Button>
                                            </>
                                        ) : (
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