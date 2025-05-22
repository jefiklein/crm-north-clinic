import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, TriangleAlert, Loader2 } from 'lucide-react';
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

// Helper to format total messages in compact form (e.g., 1200 -> 1.2k)
function formatTotalMessages(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

// Simplified helper to format timestamp as dd/MM hh:mm or 'Hoje hh:mm'
function formatTimestampSimple(unixTimestampInSeconds: number | null): string {
  if (!unixTimestampInSeconds && unixTimestampInSeconds !== 0) return 'Sem data';
  try {
    const timestampNum = Number(unixTimestampInSeconds);
    if (isNaN(timestampNum)) return 'Sem data';
    const date = new Date(timestampNum * 1000);
    const today = new Date();
    today.setHours(0,0,0,0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0,0,0,0);
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (dateOnly.getTime() === today.getTime()) {
      return `Hoje ${timeStr}`;
    }
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${dateStr} ${timeStr}`;
  } catch (e) {
    console.error("Error formatting timestamp:", unixTimestampInSeconds, e);
    return 'Sem data';
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

  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);

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

  // Extract instance IDs for filtering messages
  const instanceIds = useMemo(() => {
    if (!instancesList) return [];
    return instancesList.map(inst => inst.id);
  }, [instancesList]);

  // Map instance IDs to names for quick lookup
  const instanceMap = useMemo(() => {
    const map = new Map<number, InstanceInfo>();
    instancesList?.forEach(instance => map.set(instance.id, instance));
    return map;
  }, [instancesList]);

  // Fetch conversation summaries by grouping messages by remoteJid, filtered by instance IDs
  const { data: conversationSummaries, isLoading: isLoadingSummaries, error: summariesError } = useQuery<ConversationSummary[]>({
    queryKey: ['conversationSummaries', clinicId, instanceIds],
    queryFn: async () => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      if (!instanceIds || instanceIds.length === 0) return [];

      const { data, error } = await supabase
        .from('whatsapp_historico')
        .select('remoteJid, nome, mensagem, message_timestamp')
        .in('id_instancia', instanceIds)
        .order('message_timestamp', { ascending: false });

      if (error) throw new Error(error.message);
      if (!data) return [];

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
    enabled: hasPermission && !!clinicId && instanceIds.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Fetch total message counts per conversation (remoteJid)
  const { data: messageCountsData, isLoading: isLoadingCounts, error: countsError } = useQuery<Record<string, number>>({
    queryKey: ['messageCounts', clinicId, instanceIds],
    queryFn: async () => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      if (!instanceIds || instanceIds.length === 0) return {};

      const { data, error } = await supabase
        .from('whatsapp_historico')
        .select('remoteJid, count:remoteJid', { count: 'exact' })
        .in('id_instancia', instanceIds)
        .group('remoteJid');

      if (error) {
        console.error("Error fetching message counts:", error);
        throw new Error(error.message);
      }

      if (!data) return {};

      const countsMap: Record<string, number> = {};
      data.forEach((item: any) => {
        if (item.remoteJid && typeof item.count === 'number') {
          countsMap[item.remoteJid] = item.count;
        }
      });

      return countsMap;
    },
    enabled: hasPermission && !!clinicId && instanceIds.length > 0,
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
    filtered.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
    return filtered;
  }, [conversationSummaries, searchTerm]);

  // Fetch messages for selected conversation
  const { data: messages, isLoading: isLoadingMessages, error: messagesError } = useQuery<Message[]>({
    queryKey: ['conversationMessages', selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) throw new Error("Conversa não selecionada.");
      const { data, error } = await supabase
        .from('whatsapp_historico')
        .select('*')
        .eq('remoteJid', selectedConversationId)
        .order('message_timestamp', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: hasPermission && !!selectedConversationId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  // Find the selected conversation summary to display name in detail header
  const selectedConversationSummary = useMemo(() => {
    if (!conversationSummaries || !selectedConversationId) return null;
    return conversationSummaries.find(conv => conv.remoteJid === selectedConversationId) || null;
  }, [conversationSummaries, selectedConversationId]);

  // Scroll to bottom of messages when messages load or when conversation changes
  useEffect(() => {
    if (scrollSentinelRef.current) {
      scrollSentinelRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedConversationId]);

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

  // Debug log for lastTimestamp and formatted date
  useEffect(() => {
    if (filteredAndSortedSummaries.length > 0) {
      filteredAndSortedSummaries.forEach(item => {
        console.log(`Conversation ${item.remoteJid} lastTimestamp:`, item.lastTimestamp, 'formatted:', formatTimestampSimple(item.lastTimestamp));
      });
    }
  }, [filteredAndSortedSummaries]);

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
              const contactName = conv.nome || ''; // Show nome_lead or empty string
              const lastMessageTimestamp = formatTimestampSimple(conv.lastTimestamp);
              const totalMessages = messageCountsData?.[conversationId] ?? 0;

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
                    "conversation-list-item flex flex-col p-3 border-b border-gray-100 cursor-pointer transition-colors",
                    selectedConversationId === conversationId ? 'bg-gray-100' : 'hover:bg-gray-50'
                  )}
                  onClick={() => setSelectedConversationId(conversationId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-gray-300 text-gray-800 text-sm font-semibold">{getInitials(contactName)}</AvatarFallback>
                      </Avatar>
                      <span className="contact-name font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{contactName}</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2" style={{ minWidth: '110px' }}>
                      <span
                        className="text-xs text-gray-500 whitespace-nowrap"
                        title={lastMessageTimestamp || 'Sem data'}
                      >
                        {lastMessageTimestamp || 'Sem data'}
                      </span>
                      <span
                        className="text-xs text-gray-400 whitespace-nowrap"
                        title={`Total de mensagens: ${totalMessages}`}
                      >
                        Total: {formatTotalMessages(totalMessages)}
                      </span>
                    </div>
                  </div>
                  <div className="last-message-preview text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis mt-1">{lastMessagePreview}</div>
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
              selectedConversationSummary.nome || ''
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
          {(!selectedConversationId) ? (
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
            <>
              {messages.map(msg => (
                <div key={msg.id} className={cn(
                  "message-bubble max-w-[75%] p-3 rounded-xl mb-2 text-sm leading-tight break-words relative",
                  msg.from_me ? 'bg-green-200 ml-auto rounded-br-md' : 'bg-white mr-auto rounded-bl-md border border-gray-200'
                )}>
                  <div dangerouslySetInnerHTML={{ __html: (msg.mensagem || '').replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>').replace(/\\n|\n/g, '<br>') }}></div>
                  <span className="message-timestamp text-xs text-gray-500 mt-1 block text-right">{formatTimestampSimple(msg.message_timestamp)}</span>
                </div>
              ))}
              <div ref={scrollSentinelRef} />
            </>
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