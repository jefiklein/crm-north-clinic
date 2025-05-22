import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Search, TriangleAlert, Loader2, Star } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
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

// Instance info from Supabase
interface InstanceInfo {
  id: number;
  nome_exibição: string;
  telefone: number | null;
  nome_instancia_evolution: string | null;
}

// Conversation summary (grouped by remoteJid)
interface ConversationSummary {
  remoteJid: string;
  nome: string | null;
  lastMessage: string | null;
  lastTimestamp: number | null;
}

// Message detail
interface Message {
  id: number;
  remoteJid: string;
  nome: string | null;
  mensagem: string | null;
  message_timestamp: number | null;
  from_me: boolean | null;
  tipo_mensagem: string | null;
  id_whatsapp: string | null;
  transcrito: boolean | null;
  id_instancia: number | null;
  url_arquivo: string | null;
}

interface ConversasPageProps {
  clinicData: ClinicData | null;
}

// Helper functions
function formatPhone(phone: string | null): string {
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

const REQUIRED_PERMISSION_LEVEL = 2;

const ConversasPage: React.FC<ConversasPageProps> = ({ clinicData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const clinicId = clinicData?.id;
  const userPermissionLevel = parseInt(String(clinicData?.id_permissao), 10);
  const hasPermission = !isNaN(userPermissionLevel) && userPermissionLevel >= REQUIRED_PERMISSION_LEVEL;

  // Fetch Instances from Supabase
  const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
    queryKey: ['instancesList', clinicId],
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
    enabled: hasPermission && !!clinicId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Map instance IDs to names for quick lookup
  const instanceMap = useMemo(() => {
    const map = new Map<number, InstanceInfo>();
    instancesList?.forEach(instance => map.set(instance.id, instance));
    return map;
  }, [instancesList]);

  // Fetch conversation summaries by grouping messages by remoteJid
  const { data: conversationSummaries, isLoading: isLoadingSummaries, error: summariesError } = useQuery<ConversationSummary[]>({
    queryKey: ['conversationSummaries', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      // Select distinct remoteJid with last message and timestamp
      const { data, error } = await supabase
        .from('whatsapp_historico')
        .select('remoteJid, nome, mensagem, message_timestamp')
        .eq('id_clinica', clinicId)
        .order('message_timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      if (!data) return [];

      // Group by remoteJid to get last message and timestamp per conversation
      const groupedMap = new Map<string, ConversationSummary>();
      for (const msg of data) {
        const existing = groupedMap.get(msg.remoteJid);
        if (!existing || (msg.message_timestamp && msg.message_timestamp > (existing.lastTimestamp || 0))) {
          groupedMap.set(msg.remoteJid, {
            remoteJid: msg.remoteJid,
            nome: msg.nome,
            lastMessage: msg.mensagem,
            lastTimestamp: msg.message_timestamp,
          });
        }
      }
      return Array.from(groupedMap.values());
    },
    enabled: hasPermission && !!clinicId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Filter and sort summaries based on search term and timestamp
  const filteredAndSortedSummaries = useMemo(() => {
    if (!conversationSummaries) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = conversationSummaries.filter(conv => {
      const name = conv.nome?.toLowerCase() || '';
      const phone = conv.remoteJid?.toLowerCase() || '';
      const preview = conv.lastMessage?.toLowerCase() || '';
      return name.includes(lowerSearchTerm) || phone.includes(lowerSearchTerm) || preview.includes(lowerSearchTerm);
    });
    // Sort by lastTimestamp descending
    filtered.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
    return filtered;
  }, [conversationSummaries, searchTerm]);

  // Fetch messages for selected conversation
  const { data: messages, isLoading: isLoadingMessages, error: messagesError } = useQuery<Message[]>({
    queryKey: ['conversationMessages', selectedConversationId, clinicId],
    queryFn: async () => {
      if (!selectedConversationId || !clinicId) throw new Error("Conversa ou ID da clínica não selecionados.");
      const { data, error } = await supabase
        .from('whatsapp_historico')
        .select('*')
        .eq('remoteJid', selectedConversationId)
        .eq('id_clinica', clinicId)
        .order('message_timestamp', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: hasPermission && !!selectedConversationId && !!clinicId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  // Group messages by sequential instance ID for rendering
  const groupedMessages = useMemo(() => {
    if (!messages) return [];

    // Sort messages chronologically first
    const sortedMessages = [...messages].sort((a, b) =>
      (a.message_timestamp || 0) - (b.message_timestamp || 0)
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
  }, [messages, instanceMap]);

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
  }, [messages]);

  // --- Permission Check ---
  if (!clinicData) {
    return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
  }

  if (!hasPermission) {
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
              const lastMessageTimestamp = formatTimestampForList(conv.lastTimestamp);
              let lastMessagePreview = '';
              if (conv.lastMessage && typeof conv.lastMessage === 'string' && conv.lastMessage.trim()) {
                lastMessagePreview = conv.lastMessage.trim().substring(0, 50) + (conv.lastMessage.trim().length > 50 ? '...' : '');
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
                    <AvatarFallback className="bg-gray-300 text-gray-800 text-sm font-semibold">{getInitials(contactName)}</AvatarFallback>
                  </Avatar>
                  <div className="conversation-info flex-grow overflow-hidden">
                    <span className="contact-name font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{contactName}</span>
                    <div className="last-message-preview text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">{lastMessagePreview}</div>
                  </div>
                  <div className="conversation-meta ml-3 text-right text-xs text-gray-500 flex flex-col items-end flex-shrink-0">
                    <span className="timestamp">{lastMessageTimestamp}</span>
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
              onClick={() => {
                const phone = selectedConversationSummary.remoteJid;
                if (!phone) return;
                const clean = String(phone).replace(/\D/g, '');
                if (clean) {
                  window.open(`https://n8n-n8n.sbw0pc.easypanel.host/webhook/9c8216dd-f489-464e-8ce4-45c226489f4a?phone=${clean}`, '_blank');
                }
              }}
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
          ) : messages.length === 0 ? (
            <div className="status-message text-gray-700 text-center">Nenhuma mensagem nesta conversa.</div>
          ) : (
            groupedMessages.map((group, groupIndex) => (
              <React.Fragment key={`group-${group.instanceId}-${groupIndex}`}>
                {/* Instance Group Header */}
                <div className={cn(
                  "instance-group-header text-center text-xs text-gray-700 px-2 py-1 rounded-md my-3 mx-auto max-w-[80%] font-medium border",
                  `instance-group-${group.cssClassIndex}`,
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
                    messageContent = msg.mensagem.trim()
                      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                      .replace(/_(.*?)_/g, '<em>$1</em>')
                      .replace(/\\n|\n/g, '<br>');
                  } else if (msg.tipo_mensagem) {
                    const typeLabel = msg.tipo_mensagem.replace(/Message$/i, '');
                    messageContent = `<span class="text-gray-500 italic">[${typeLabel || 'Mídia'}]</span>`;
                  } else {
                    messageContent = '...';
                  }

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