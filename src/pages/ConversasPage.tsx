import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; // Import Avatar
import { Separator } from "@/components/ui/separator"; // Import Separator
import { Search, Settings, User, Info, TriangleAlert, Loader2, Star } from 'lucide-react'; // Using Lucide icons
import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import { cn } from '@/lib/utils'; // Utility for class names

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for Instance Info from the webhook
interface InstanceInfo {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    // Add other fields if the webhook returns them
}

// Define the structure for Conversation Summary from the webhook
interface ConversationSummary {
    remoteJid: string; // Unique identifier for the conversation (phone number or JID)
    nome: string | null; // Contact name
    mensagem: string | null; // Last message text
    tipo_mensagem: string | null; // Type of last message (e.g., "imageMessage")
    message_timestamp: number | null; // Unix timestamp in seconds
    // Add other fields if the webhook returns them
}

// Define the structure for Message Detail from the webhook
interface Message {
    id: string; // Unique message ID
    remoteJid: string; // Conversation identifier
    nome: string | null; // Contact name (might be redundant if fetched per conversation)
    mensagem: string | null; // Message text
    message_timestamp: number | null; // Unix timestamp in seconds
    from_me: boolean | null; // True if sent by the clinic, false if received
    tipo_mensagem: string | null; // Type of message
    id_whatsapp: string | null; // WhatsApp message ID
    transcrito: boolean | null; // If voice message was transcribed
    id_instancia: number | null; // ID of the instance that sent/received the message
    url_arquivo: string | null; // URL for media files
    // Add other fields if the webhook returns them
}


interface ConversasPageProps {
    clinicData: ClinicData | null;
}

// Webhook URLs
const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const INSTANCE_LIST_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/fb243d03-efc1-48cf-814e-6305f42f632e`; // Webhook para lista de instâncias
const CONVERSATION_SUMMARIES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/351c78d3-178f-4386-8bec-1d7477ee1ab4`; // Webhook para lista de resumos
const MESSAGE_DETAILS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/0cbb12f2-eb68-4f54-a69b-02ef6bbb8084`; // Webhook para detalhes da conversa (mensagens)
const LEAD_DETAILS_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/9c8216dd-f489-464e-8ce4-45c226489f4a'; // Webhook para abrir detalhes do lead

// Required permission level for this page
const REQUIRED_PERMISSION_LEVEL = 2;

// Helper functions (translated from JS)
function formatPhone(phone: number | string | null): string {
    if (!phone) return 'S/ Tel.';
    const s = String(phone).replace(/\D/g, '');
    if (s.length === 11) return `(${s.substring(0, 2)}) ${s.substring(2, 7)}-${s.substring(7)}`;
    if (s.length === 10) return `(${s.substring(0, 2)}) ${s.substring(2, 6)}-${s.substring(6)}`;
    return s;
}

function formatTimestampForList(unixTimestampInSeconds: number | null): string {
    if (!unixTimestampInSeconds && unixTimestampInSeconds !== 0) return '';
    try {
        const timestampNum = parseInt(String(unixTimestampInSeconds), 10);
        if (isNaN(timestampNum)) { return ''; }
        const timestampMs = timestampNum * 1000;
        const date = new Date(timestampMs);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const messageDate = new Date(date);
        messageDate.setHours(0,0,0,0);

        if (messageDate.getTime() === today.getTime()) {
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
    } catch (e) {
        console.error("Error formatting timestamp for list:", unixTimestampInSeconds, e);
        return '';
    }
}

function formatTimestampForBubble(unixTimestampInSeconds: number | null): string {
    if (!unixTimestampInSeconds && unixTimestampInSeconds !== 0) return '';
    try {
        const timestampNum = parseInt(String(unixTimestampInSeconds), 10);
        if (isNaN(timestampNum)) { return ''; }
        const timestampMs = timestampNum * 1000;
        const date = new Date(timestampMs);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
        console.error("Error formatting timestamp for bubble:", unixTimestampInSeconds, e);
        return '';
    }
}

function openLeadDetails(phone: number | string | null) {
    if (!phone) return;
    const clean = String(phone).replace(/\D/g, '');
    if (clean) {
        // Open in a new tab
        window.open(`${LEAD_DETAILS_WEBHOOK_URL}?phone=${clean}`, '_blank');
    }
}

// Helper to get initials for avatar fallback
function getInitials(name: string | null): string {
    if (!name) return '??';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return '??';
}


const ConversasPage: React.FC<ConversasPageProps> = ({ clinicData }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    const clinicId = clinicData?.id;
    const userPermissionLevel = parseInt(String(clinicData?.id_permissao), 10);
    const hasPermission = !isNaN(userPermissionLevel) && userPermissionLevel >= REQUIRED_PERMISSION_LEVEL;

    // --- Fetch Instances List ---
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesList', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log("[ConversasPage] Fetching instance list...");
            const response = await fetch(INSTANCE_LIST_WEBHOOK_URL, {
                method: 'POST', // Assuming POST based on HTML
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ id_clinica: clinicId }) // Sending clinic ID
            });
            console.log(`[ConversasPage] Instance list fetch status: ${response.status}`);
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar instâncias: ${errorText.substring(0, 100)}...`);
            }
            const data = await response.json();
             // Check for { data: [...] } structure as seen in HTML JS
             if (data && data.data && Array.isArray(data.data)) {
                 console.log("[ConversasPage] Instance list data received (nested):", data.data.length, "items");
                 return data.data as InstanceInfo[];
             } else if (Array.isArray(data)) {
                 console.log("[ConversasPage] Instance list data received (array):", data.length, "items");
                 return data as InstanceInfo[];
             } else {
                 console.error("[ConversasPage] Unexpected instance list data format:", data);
                 throw new Error("Formato inesperado da lista de instâncias.");
             }
        },
        enabled: hasPermission && !!clinicId, // Only fetch if user has permission and clinicId is available
        staleTime: 10 * 60 * 1000, // Cache instances for 10 minutes
        refetchOnWindowFocus: false,
    });

    // Map instance IDs to names for quick lookup
    const instanceMap = useMemo(() => {
        const map = new Map<number, InstanceInfo>();
        instancesList?.forEach(instance => map.set(instance.id, instance));
        return map;
    }, [instancesList]);


    // --- Fetch Conversation Summaries ---
    const { data: conversationSummaries, isLoading: isLoadingSummaries, error: summariesError } = useQuery<ConversationSummary[]>({
        queryKey: ['conversationSummaries', clinicId], // Search filtering happens client-side
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log("[ConversasPage] Fetching conversation summaries...");
            const response = await fetch(CONVERSATION_SUMMARIES_WEBHOOK_URL, {
                method: 'POST', // Assuming POST based on HTML
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ id_clinica: clinicId }) // Sending clinic ID
            });
            console.log(`[ConversasPage] Conversation summaries fetch status: ${response.status}`);
             if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar conversas: ${errorText.substring(0, 100)}...`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                 console.error("[ConversasPage] Unexpected conversation summaries data format:", data);
                 throw new Error("Formato inesperado dos resumos de conversa.");
            }
            console.log("[ConversasPage] Conversation summaries received:", data.length, "items");
            return data as ConversationSummary[];
        },
        enabled: hasPermission && !!clinicId, // Only fetch if user has permission and clinicId is available
        staleTime: 60 * 1000, // Cache summaries for 1 minute
        refetchOnWindowFocus: true, // Maybe refetch summaries more often?
    });

    // Filter and sort summaries based on search term and timestamp
    const filteredAndSortedSummaries = useMemo(() => {
        if (!conversationSummaries) return [];
        const lowerSearchTerm = searchTerm.toLowerCase();
        const filtered = conversationSummaries.filter(conv => {
            const name = conv.nome?.toLowerCase() || '';
            const phone = conv.remoteJid?.toLowerCase() || '';
            const preview = conv.mensagem?.toLowerCase() || conv.tipo_mensagem?.toLowerCase() || '';
            return name.includes(lowerSearchTerm) || phone.includes(lowerSearchTerm) || preview.includes(lowerSearchTerm);
        });
        // Sort by timestamp descending
        filtered.sort((a, b) => (parseInt(String(b.message_timestamp || 0), 10) - parseInt(String(a.message_timestamp || 0), 10)));
        return filtered;
    }, [conversationSummaries, searchTerm]);


    // --- Fetch Message Details for Selected Conversation ---
    const { data: messages, isLoading: isLoadingMessages, error: messagesError } = useQuery<Message[]>({
        queryKey: ['conversationMessages', selectedConversationId, clinicId],
        queryFn: async () => {
            if (!selectedConversationId || !clinicId) throw new Error("Conversa ou ID da clínica não selecionados.");
            console.log(`[ConversasPage] Fetching messages for conversation ID: ${selectedConversationId}`);
            const response = await fetch(MESSAGE_DETAILS_WEBHOOK_URL, {
                method: 'POST', // Assuming POST based on HTML
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ remoteJid: selectedConversationId, id_clinica: clinicId }) // Sending conversation ID and clinic ID
            });
            console.log(`[ConversasPage] Message details fetch status: ${response.status}`);
             if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar mensagens: ${errorText.substring(0, 100)}...`);
            }
            const data = await response.json();
             // Check for { messages: [...] } structure as seen in HTML JS
             if (data && data.messages && Array.isArray(data.messages)) {
                 console.log("[ConversasPage] Message details received (nested):", data.messages.length, "items");
                 return data.messages as Message[];
             } else if (Array.isArray(data)) {
                 console.log("[ConversasPage] Message details received (array):", data.length, "items");
                 return data as Message[];
             } else {
                 console.error("[ConversasPage] Unexpected message details data format:", data);
                 throw new Error("Formato inesperado dos detalhes da mensagem.");
             }
        },
        enabled: hasPermission && !!selectedConversationId && !!clinicId, // Only fetch if user has permission, a conversation is selected, and clinicId is available
        staleTime: 10 * 1000, // Cache messages for 10 seconds (conversations update frequently)
        refetchOnWindowFocus: true, // Refetch messages when window is focused
    });

    // Group messages by sequential instance ID for rendering
    const groupedMessages = useMemo(() => {
        if (!messages) return [];

        // Sort messages chronologically first
        const sortedMessages = [...messages].sort((a, b) =>
            (parseInt(String(a.message_timestamp || 0), 10) - parseInt(String(b.message_timestamp || 0), 10))
        );

        const groups: { instanceId: number | null; messages: Message[]; instanceName: string; cssClassIndex: number }[] = [];
        let currentInstanceId: number | null = null;
        let currentGroupIndex = -1;
        const instanceIdToGroupIndexMap: { [key: number | string]: number } = {}; // Map instance ID to a sequential group index

        sortedMessages.forEach(msg => {
            const instanceId = msg.id_instancia;

            if (instanceId !== currentInstanceId) {
                // New instance group
                currentGroupIndex++;
                currentInstanceId = instanceId;

                // Determine instance name
                let instanceName = 'Instância Desconhecida/Indefinida';
                if (instanceId !== null && instanceMap.has(instanceId)) {
                    instanceName = instanceMap.get(instanceId)?.nome_exibição || `ID ${instanceId}`;
                } else if (instanceId !== null) {
                     instanceName = `ID ${instanceId}`; // Fallback if ID exists but not in map
                } else {
                     instanceName = 'Indefinida'; // For null instanceId
                }


                // Map instance ID to a cycling CSS class index (0-3)
                if (instanceId !== null && typeof instanceIdToGroupIndexMap[instanceId] === 'undefined') {
                     instanceIdToGroupIndexMap[instanceId] = Object.keys(instanceIdToGroupIndexMap).length; // Assign a new sequential index
                } else if (instanceId === null && typeof instanceIdToGroupIndexMap['null'] === 'undefined') {
                     instanceIdToGroupIndexMap['null'] = Object.keys(instanceIdToGroupIndexMap).length;
                }
                const cssClassIndex = (instanceId !== null ? instanceIdToGroupIndexMap[instanceId] : instanceIdToGroupIndexMap['null']) % 4;


                groups.push({
                    instanceId: instanceId,
                    messages: [msg],
                    instanceName: instanceName,
                    cssClassIndex: cssClassIndex,
                });
            } else {
                // Add message to the current group
                groups[groups.length - 1].messages.push(msg);
            }
        });

        return groups;
    }, [messages, instanceMap]); // Depend on messages and instanceMap


    // Find the selected conversation summary to display name in detail header
    const selectedConversationSummary = useMemo(() => {
        return conversationSummaries?.find(conv => conv.remoteJid === selectedConversationId);
    }, [conversationSummaries, selectedConversationId]);


    // Scroll to bottom of messages when messages load or change
    useEffect(() => {
        const messagesArea = document.getElementById('messagesArea');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }, [messages]); // Effect runs when messages data changes


    // --- Permission Check ---
    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    if (!hasPermission) {
         console.warn(`[ConversasPage] Access denied for clinic ID ${clinicData.id}. User permission level: ${userPermissionLevel}, Required: ${REQUIRED_PERMISSION_LEVEL}`);
         return (
             <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                 <Card className="w-full max-w-md text-center">
                     <CardHeader>
                         <TriangleAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
                         <CardTitle className="text-2xl font-bold text-destructive">Acesso Negado</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p className="text-gray-700">Você não tem permissão para acessar esta página.</p>
                         <p className="mt-2 text-gray-600 text-sm">Se você acredita que isso é um erro, entre em contato com o administrador.</p>
                     </CardContent>
                 </Card>
             </div>
         );
    }


    return (
        <div className="conversations-container flex flex-grow h-full overflow-hidden bg-white rounded-lg shadow-md border border-gray-200">
            {/* Conversations List Panel */}
            <div className="conversations-list-panel w-[350px] border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
                <div className="list-header p-4 border-b border-gray-200 flex-shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                            type="text"
                            placeholder="Buscar conversas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 w-full"
                        />
                    </div>
                </div>
                <ScrollArea className="conversations-list flex-grow">
                    {isLoadingSummaries ? (
                        <div className="status-message loading-message flex flex-col items-center justify-center p-8 text-primary">
                            <Loader2 className="h-8 w-8 animate-spin mb-4" />
                            <span>Carregando conversas...</span>
                        </div>
                    ) : summariesError ? (
                        <div className="status-message error-message flex flex-col items-center justify-center p-4 text-red-600 bg-red-50 rounded-md m-4">
                            <TriangleAlert className="h-8 w-8 mb-4" />
                            <span>Erro ao carregar conversas: {summariesError.message}</span>
                        </div>
                    ) : filteredAndSortedSummaries.length === 0 ? (
                        <div className="status-message text-gray-700 p-8 text-center">
                            {searchTerm ? 'Nenhuma conversa encontrada com este filtro.' : 'Nenhuma conversa encontrada.'}
                        </div>
                    ) : (
                        filteredAndSortedSummaries.map(conv => {
                            const conversationId = conv.remoteJid;
                            const contactName = conv.nome || formatPhone(conv.remoteJid); // Use phone if name is missing
                            const lastMessageTimestamp = formatTimestampForList(conv.message_timestamp);
                            let lastMessagePreview = '';
                            if (conv.mensagem && typeof conv.mensagem === 'string' && conv.mensagem.trim()) {
                                lastMessagePreview = conv.mensagem.trim().substring(0, 50) + (conv.mensagem.trim().length > 50 ? '...' : '');
                            } else if (conv.tipo_mensagem) {
                                const typeLabel = conv.tipo_mensagem.replace(/Message$/i, '');
                                lastMessagePreview = `<span class="text-gray-500 italic">[${typeLabel || 'Mídia'}]</span>`;
                            } else {
                                lastMessagePreview = '...';
                            }

                            return (
                                <div
                                    key={conversationId}
                                    className={cn(
                                        "conversation-list-item flex items-center p-3 border-b border-gray-100 cursor-pointer transition-colors",
                                        selectedConversationId === conversationId ? 'bg-gray-100' : 'hover:bg-gray-50'
                                    )}
                                    onClick={() => setSelectedConversationId(conversationId)}
                                >
                                    <Avatar className="h-10 w-10 mr-3 flex-shrink-0">
                                        {/* Add AvatarImage if you have URLs */}
                                        <AvatarFallback className="bg-gray-300 text-gray-800 text-sm font-semibold">{getInitials(contactName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="conversation-info flex-grow overflow-hidden">
                                        <span className="contact-name font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{contactName}</span>
                                        <div className="last-message-preview text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" dangerouslySetInnerHTML={{ __html: lastMessagePreview }}></div>
                                    </div>
                                    <div className="conversation-meta ml-3 text-right text-xs text-gray-500 flex flex-col items-end flex-shrink-0">
                                        <span className="timestamp">{lastMessageTimestamp}</span>
                                        {/* Add unread badge logic here if available in summary data */}
                                        {/* <span className="unread-badge">3</span> */}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </ScrollArea>
            </div>

            {/* Conversation Detail Panel */}
            <div className="conversation-detail-panel flex-grow flex flex-col overflow-hidden bg-gray-50">
                <div className="detail-header p-4 border-b border-gray-200 font-semibold flex-shrink-0 min-h-[60px] flex items-center bg-gray-100">
                    <span id="conversationContactName" className="text-primary">
                        {selectedConversationSummary ? (
                            selectedConversationSummary.nome || formatPhone(selectedConversationSummary.remoteJid)
                        ) : (
                            'Selecione uma conversa'
                        )}
                    </span>
                     {selectedConversationSummary && (
                         <Button
                             variant="outline"
                             size="sm"
                             className="ml-auto text-xs h-auto py-1 px-2"
                             onClick={() => openLeadDetails(selectedConversationSummary.remoteJid)}
                         >
                             Ver Detalhes do Lead
                         </Button>
                     )}
                </div>
                <ScrollArea id="messagesArea" className="messages-area flex-grow p-4 flex flex-col">
                    {!selectedConversationId ? (
                        <div className="status-message text-gray-700 text-center">Selecione uma conversa na lista à esquerda.</div>
                    ) : isLoadingMessages ? (
                        <div className="status-message loading-message flex flex-col items-center justify-center p-8 text-primary">
                            <Loader2 className="h-8 w-8 animate-spin mb-4" />
                            <span>Carregando mensagens...</span>
                        </div>
                    ) : messagesError ? (
                        <div className="status-message error-message flex flex-col items-center justify-center p-4 text-red-600 bg-red-100 rounded-md">
                            <TriangleAlert className="h-8 w-8 mb-4" />
                            <span>Erro ao carregar mensagens: {messagesError.message}</span>
                        </div>
                    ) : groupedMessages.length === 0 ? (
                         <div className="status-message text-gray-700 text-center">Nenhuma mensagem nesta conversa.</div>
                    ) : (
                        groupedMessages.map((group, groupIndex) => (
                            <React.Fragment key={`group-${group.instanceId}-${groupIndex}`}>
                                {/* Instance Group Header */}
                                <div className={cn(
                                     "instance-group-header text-center text-xs text-gray-700 px-2 py-1 rounded-md my-3 mx-auto max-w-[80%] font-medium border",
                                     `instance-group-${group.cssClassIndex}`, // Apply cycling color class
                                     group.cssClassIndex === 0 && 'bg-blue-100 border-blue-200',
                                     group.cssClassIndex === 1 && 'bg-green-100 border-green-200',
                                     group.cssClassIndex === 2 && 'bg-orange-100 border-orange-200',
                                     group.cssClassIndex === 3 && 'bg-purple-100 border-purple-200',
                                )}>
                                    Conversa via: {group.instanceName}
                                </div>
                                {/* Messages within the group */}
                                {group.messages.map(msg => {
                                    const isSent = msg.from_me === true;
                                    const bubbleClass = isSent ? 'sent' : 'received';
                                    let messageContent = '';
                                    if (msg.mensagem?.trim()) {
                                        // Basic formatting for bold/italic and newlines
                                        messageContent = msg.mensagem.trim()
                                            .replace(/\*(.*?)\*/g, '<strong>$1</strong>') // Bold
                                            .replace(/_(.*?)_/g, '<em>$1</em>') // Italic
                                            .replace(/\\n|\n/g, '<br>'); // Newlines
                                    } else if (msg.tipo_mensagem) {
                                        const typeLabel = msg.tipo_mensagem.replace(/Message$/i, '');
                                        messageContent = `<span class="text-gray-500 italic">[${typeLabel || 'Mídia'}]</span>`;
                                    } else {
                                        messageContent = '...';
                                    }

                                    // Add media link if available
                                    if (msg.url_arquivo) {
                                         messageContent += `<br/><a href="${msg.url_arquivo}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline text-xs">[Ver Arquivo]</a>`;
                                    }


                                    const time = formatTimestampForBubble(msg.message_timestamp);

                                    return (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "message-bubble max-w-[75%] p-3 rounded-xl mb-2 text-sm leading-tight break-words relative",
                                                bubbleClass === 'sent' ? 'bg-green-200 ml-auto rounded-br-md' : 'bg-white mr-auto rounded-bl-md border border-gray-200',
                                                // Apply instance group border color
                                                group.cssClassIndex === 0 && (bubbleClass === 'received' ? 'border-l-blue-400 border-l-2' : 'border-r-blue-400 border-r-2'),
                                                group.cssClassIndex === 1 && (bubbleClass === 'received' ? 'border-l-green-400 border-l-2' : 'border-r-green-400 border-r-2'),
                                                group.cssClassIndex === 2 && (bubbleClass === 'received' ? 'border-l-orange-400 border-l-2' : 'border-r-orange-400 border-r-2'),
                                                group.cssClassIndex === 3 && (bubbleClass === 'received' ? 'border-l-purple-400 border-l-2' : 'border-r-purple-400 border-r-2'),
                                            )}
                                        >
                                            <div dangerouslySetInnerHTML={{ __html: messageContent }}></div>
                                            <span className="message-timestamp text-xs text-gray-500 mt-1 block text-right">{time}</span>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))
                    )}
                </ScrollArea>
                <div className="message-input-area p-4 border-t border-gray-200 flex-shrink-0 bg-gray-100">
                    <Input type="text" placeholder="Digite sua mensagem aqui..." disabled={!selectedConversationId} />
                </div>
            </div>
        </div>
    );
};

export default ConversasPage;