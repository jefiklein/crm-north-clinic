import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, TriangleAlert, Loader2, Smile, Send, Clock, XCircle, MessagesSquare } from 'lucide-react'; // Changed ExternalLink to MessagesSquare
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation and useQueryClient
import { format, isToday } from 'date-fns'; // Import format and isToday
import { ptBR } from 'date-fns/locale'; // Import locale
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { EmojiPicker } from "emoji-picker-element"; // Import EmojiPicker
import { showSuccess, showError } from '@/utils/toast'; // Import toast utilities
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
// Removed Collapsible imports
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Import Dialog components
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Import RadioGroup components
import { Label } from "@/components/ui/label"; // Import Label for RadioGroup
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { cn, formatPhone } from '@/lib/utils'; // Utility for class names - Explicitly re-adding formatPhone import
import { useLocation } from 'react-router-dom'; // Import useLocation
import LeadTagManager from '@/components/LeadTagManager'; // Import the new component

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

// Conversation summary (grouped by remoteJid) - UPDATED to use nome_lead
interface ConversationSummary {
  remoteJid: string;
  nome_lead: string | null; // Use nome_lead
  lastMessage: string | null;
  lastTimestamp: number | null;
}

// Message detail - UPDATED to use nome_lead
interface Message {
  id: number | string; // Allow string for temporary client-side IDs
  remoteJid: string;
  nome_lead: string | null; // Use nome_lead
  mensagem: string | null;
  message_timestamp: number | null; // Unix timestamp in seconds
  from_me: boolean | null;
  tipo_mensagem: string | null; // e.g., 'text', 'image', 'audio', 'video', 'imageMessage', etc.
  id_whatsapp: string | null;
  transcrito: boolean | null;
  id_instancia: number | null; // This links to north_clinic_config_instancias.id
  url_arquivo: string | null; // This is the file key for the webhook
  status?: 'pending' | 'failed'; // Added status for optimistic updates
}

// Structure for Lead data fetched for the selected conversation - UPDATED
interface ConversationLeadDetails {
    id: number;
    id_etapa: number | null;
    origem: string | null; // Added origem
    sourceUrl: string | null; // Added sourceUrl
    // Add other lead fields if needed in the future
}

// Structure for Funnel Stages (from Supabase)
interface FunnelStage {
    id: number;
    nome_etapa: string;
    id_funil: number;
}

// Structure for Funnel Details (from Supabase)
interface FunnelDetails {
    id: number;
    nome_funil: string;
}

// Interface for Tag (from LeadTagManager)
interface Tag {
  id: number;
  name: string;
}


interface ConversasPageProps {
  clinicData: ClinicData | null;
}

// Helper functions
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
      return `Hoje ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) {
    console.error("Error formatting timestamp for list:", unixTimestampInSeconds, e);
    return 'Erro';
  }
}

function formatTimestampForBubble(unixTimestampInSeconds: number | null): string {
  if (!unixTimestampInSeconds && unixTimestampInSeconds !== 0) return '';
  try {
    const timestampNum = parseInt(String(unixTimestampInSeconds), 10);
    if (isNaN(timestampNum)) { return ''; }
    const timestampMs = timestampNum * 1000;
    const date = new Date(timestampMs);

    if (isToday(date)) {
      // Correct format for 'Hoje HH:mm' - Escape 'Hoje'
      return format(date, "'Hoje' HH:mm", { locale: ptBR });
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    }
  } catch (e) {
    console.error("Error formatting timestamp for bubble:", unixTimestampInSeconds, e);
    return 'Erro'; // Return 'Erro' on failure
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
const MEDIA_WEBHOOK_URL = 'https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo';
const SEND_MESSAGE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/enviar-para-fila'; // Webhook para enviar mensagem
const LEAD_DETAILS_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/9c8216dd-f489-464e-8ce4-45c226489fa'; // Keep this for opening lead details

// NEW: Webhook URLs for tag management (copied from LeadDetailPage)
const CREATE_TAG_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/86305271-8e6f-416a-9972-feb34aa63ee7"; // Updated
const LINK_LEAD_TAG_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/a663d7d8-1d28-4b27-8b92-f456e69a3ccc"; // Updated to new webhook
const UNLINK_LEAD_TAG_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/a663d7d8-1d28-4b27-8b92-f456e69a3ccc"; // Updated to new webhook


const ConversasPage: React.FC<ConversasPageProps> = ({ clinicData }) => {
  console.log("[ConversasPage] Component Rendered. clinicData:", clinicData); // Log clinicData on render
  const queryClient = useQueryClient(); // Get query client instance
  const location = useLocation(); // Hook to get current location

  const [searchTerm, setSearchTerm] = useState('');
  // Initialize selectedConversationId from URL parameter
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('remoteJid');
  });
  const [messageInput, setMessageInput] = useState(''); // State for the message input
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // State for emoji picker visibility
  // Removed selectedInstanceEvolutionName state

  // State to hold media URLs and loading/error status for each message
  const [mediaUrls, setMediaUrls] = useState<Record<number, string | null>>({});
  const [mediaStatus, setMediaStatus] = useState<Record<number, { isLoading: boolean, error: string | null }>>({});

  // State for optimistic updates - holds messages sent but not yet confirmed in history
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);

  // New state for the selected sending instance ID
  const [sendingInstanceId, setSendingInstanceId] = useState<number | null>(null);

  // State to hold the URL of the image to be enlarged in the modal
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);


  // Removed state to toggle visibility of temporary lead details
  // const [showTemporaryLeadDetails, setShowTemporaryLeadDetails] = useState(false);


  const clinicId = clinicData?.id;
  const userPermissionLevel = parseInt(String(clinicData?.id_permissao), 10);
  const hasPermission = !isNaN(userPermissionLevel) && userPermissionLevel >= REQUIRED_PERMISSION_LEVEL;

  console.log("[ConversasPage] hasPermission:", hasPermission); // Log permission status


  // Ref for the ScrollArea wrapper
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  // Ref for the sentinel div at the end of messages
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  // Ref for the message textarea
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Ref for the emoji picker element
  const emojiPickerRef = useRef<HTMLElement | null>(null);


  // Fetch Instances from Supabase
  const { data: instancesList, isLoading: isLoadingInstances, error: instancesError, refetch: refetchInstances } = useQuery<InstanceInfo[]>({
    queryKey: ['instancesList', clinicId],
    queryFn: async () => {
      // Explicitly reference supabase here
      const currentSupabase = supabase;

      console.log("[ConversasPage] instancesList queryFn started. clinicId:", clinicId); // Add this log
      if (!clinicId) {
          console.error("[ConversasPage] instancesList queryFn: clinicId is null."); // Add this log
          throw new Error("ID da clínica não disponível.");
      }
      console.log(`[ConversasPage] Fetching instance list for clinic ${clinicId}...`);
      const { data, error } = await currentSupabase // Use currentSupabase here
        .from('north_clinic_config_instancias')
        .select('id, nome_exibição, telefone, nome_instancia_evolution')
        .eq('id_clinica', clinicId)
        .eq('historico', true) // <-- Added filter for historico = true
        .order('nome_exibição', { ascending: true });
      if (error) {
          console.error("[ConversasPage] Supabase instances fetch error:", error); // Log fetch error
          throw new Error(error.message);
      }
      console.log("[ConversasPage] Fetched instances list:", data?.length, "items"); // Log fetched instances count
      return data || [];
    },
    enabled: hasPermission && !!clinicId, // Only fetch if user has permission and clinicId is available
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Log the state of the instancesList query
  useEffect(() => {
      console.log("[ConversasPage] instancesList query state updated. isLoadingInstances:", isLoadingInstances, "instancesError:", instancesError, "instancesList:", instancesList ? instancesList.length + ' items' : 'null/undefined'); // Add this log
  }, [isLoadingInstances, instancesError, instancesList]);


  // Extract instance IDs for filtering messages
  const instanceIds = useMemo(() => {
    if (!instancesList) return [];
    return instancesList.map(inst => inst.id);
  }, [instancesList]);

  // Map instance IDs to names for quick lookup
  const instanceMap = useMemo(() => {
    const map = new Map<number, InstanceInfo>();
    instancesList?.forEach(instance => map.set(instance.id, instance));
    console.log("[ConversasPage] Created instance map:", map); // Log the created map
    return map;
  }, [instancesList]);

  // Fetch conversation summaries by grouping messages by remoteJid, filtered by instance IDs
  const { data: conversationSummaries, isLoading: isLoadingSummaries, error: summariesError } = useQuery<ConversationSummary[]>({
    queryKey: ['conversationSummaries', clinicId, instanceIds],
    queryFn: async () => {
      // Explicitly reference supabase here
      const currentSupabase = supabase;

      console.log("[ConversasPage] conversationSummaries queryFn started. clinicId:", clinicId, "instanceIds:", instanceIds); // Add this log
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      if (!instanceIds || instanceIds.length === 0) {
          console.log("[ConversasPage] conversationSummaries queryFn: No instance IDs available. Returning empty."); // Add this log
          return [];
      }

      // Fetch messages with id_instancia in instanceIds - UPDATED SELECT TO INCLUDE nome_lead
      const { data, error } = await currentSupabase // Use currentSupabase here
        .from('whatsapp_historico')
        .select('remoteJid, nome_lead, mensagem, message_timestamp, tipo_mensagem, from_me, id_instancia, url_arquivo') // Select nome_lead here
        .in('id_instancia', instanceIds)
        .order('message_timestamp', { ascending: false }); // Decrescente

      if (error) {
          console.error("[ConversasPage] Supabase conversation summaries fetch error:", error); // Log fetch error
          throw new Error(error.message);
      }
      if (!data) {
          console.log("[ConversasPage] Supabase conversation summaries fetch returned null data."); // Log null data
          return [];
      }

      // Group by remoteJid to get last message and timestamp per conversation
      const groupedMap = new Map<string, ConversationSummary>();
      for (const msg of data) {
        const existing = groupedMap.get(msg.remoteJid);
        if (!existing || (msg.message_timestamp && msg.message_timestamp > (existing.lastTimestamp || 0))) {
          groupedMap.set(msg.remoteJid, {
            remoteJid: msg.remoteJid,
            nome_lead: msg.nome_lead, // Use nome_lead here
            lastMessage: msg.mensagem,
            lastTimestamp: msg.message_timestamp,
          });
        }
      }
      const summaries = Array.from(groupedMap.values());
      console.log("[ConversasPage] Fetched conversation summaries:", summaries.length, "items"); // Log summaries count
      return summaries;
    },
    enabled: hasPermission && !!clinicId && instanceIds.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Log the state of the conversationSummaries query
  useEffect(() => {
      console.log("[ConversasPage] conversationSummaries query state updated. isLoadingSummaries:", isLoadingSummaries, "summariesError:", summariesError, "conversationSummaries:", conversationSummaries ? conversationSummaries.length + ' items' : 'null/undefined'); // Add this log
  }, [isLoadingSummaries, summariesError, conversationSummaries]);


  // Filter and sort summaries based on search term and timestamp
  const filteredAndSortedSummaries = useMemo(() => {
    if (!conversationSummaries) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = conversationSummaries.filter(conv => {
      const name = conv.nome_lead?.toLowerCase() || ''; // Use nome_lead for filtering
      const phone = conv.remoteJid?.toLowerCase() || '';
      const preview = conv.lastMessage?.toLowerCase() || '';
      return name.includes(lowerSearchTerm) || phone.includes(lowerSearchTerm) || preview.includes(lowerSearchTerm);
    });
    // Already ordered by message_timestamp desc from query, but sort again to be safe
    filtered.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
    console.log("[ConversasPage] Filtered and sorted summaries:", filtered.length, "items"); // Log filtered summaries count
    return filtered;
  }, [conversationSummaries, searchTerm]);

  // Fetch messages for selected conversation
  const { data: messages, isLoading: isLoadingMessages, error: messagesError } = useQuery<Message[]>({
    queryKey: ['conversationMessages', selectedConversationId, clinicId, instanceIds], // Add instanceIds to query key
    queryFn: async () => {
      // Explicitly reference supabase here
      const currentSupabase = supabase;

      console.log("[ConversasPage] conversationMessages queryFn started. selectedConversationId:", selectedConversationId, "clinicId:", clinicId, "instanceIds:", instanceIds); // Add this log
      if (!selectedConversationId) throw new Error("Conversa não selecionada.");
      if (!clinicId) throw new Error("ID da clínica não disponível."); // Ensure clinicId is available
      if (!instanceIds || instanceIds.length === 0) {
          console.log("[ConversasPage] conversationMessages queryFn: No instance IDs available for filtering. Returning empty.");
          return [];
      }

      // Fetch messages in DESCENDING order
      const { data, error } = await currentSupabase // Use currentSupabase here
        .from('whatsapp_historico')
        .select('id, remoteJid, nome_lead, mensagem, message_timestamp, from_me, tipo_mensagem, id_whatsapp, transcrito, id_instancia, url_arquivo') // Select nome_lead here
        .eq('remoteJid', selectedConversationId)
        .in('id_instancia', instanceIds) // <-- CORRECTED FILTER: Use id_instancia and instanceIds
        .order('message_timestamp', { ascending: false }); // <-- Changed to DESCENDING
      if (error) {
          console.error("[ConversasPage] Supabase messages fetch error:", error); // Log fetch error
          throw new Error(error.message);
      }
      console.log(`[ConversasPage] Fetched messages for ${selectedConversationId} (clinic ${clinicId}):`, data?.length, "items"); // Log messages count
      return data || [];
    },
    enabled: hasPermission && !!selectedConversationId && !!clinicId && instanceIds.length > 0, // Enable only if user has permission, conversation selected, clinicId available, AND instanceIds are loaded
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  // Log the state of the messages query
  useEffect(() => {
      console.log("[ConversasPage] messages query state updated. isLoadingMessages:", isLoadingMessages, "messagesError:", messagesError, "messages:", messages ? messages.length + ' items' : 'null/undefined'); // Add this log
  }, [isLoadingMessages, messagesError, messages]);


  // --- New Queries for Funnel/Stage/Origem/SourceUrl in Header ---

  // Fetch all stages (needed for mapping id_etapa to name)
  const { data: allStages, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
      queryKey: ['allStagesConversations'],
      queryFn: async () => {
          // Explicitly reference supabase here
          const currentSupabase = supabase;

          console.log(`[ConversasPage] Fetching all stages from Supabase...`);
          const { data, error } = await currentSupabase // Use currentSupabase here
              .from('north_clinic_crm_etapa')
              .select('id, nome_etapa, id_funil')
              .order('ordem', { ascending: true });
          if (error) {
              console.error("[ConversasPage] Supabase all stages fetch error:", error);
              throw new Error(`Erro ao buscar etapas: ${error.message}`);
          }
          return data || [];
      },
      enabled: hasPermission, // Enabled if user has permission
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
  });

  // Fetch all funnels (needed for mapping id_funil to name)
  const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
      queryKey: ['allFunnelsConversations'],
      queryFn: async () => {
          // Explicitly reference supabase here
          const currentSupabase = supabase;

          console.log(`[ConversasPage] Fetching all funnels from Supabase...`);
          const { data, error } = await currentSupabase // Use currentSupabase here
              .from('north_clinic_crm_funil')
              .select('id, nome_funil')
              .order('nome_funil', { ascending: true });
          if (error) {
              console.error("[ConversasPage] Supabase all funnels fetch error:", error);
              throw new Error(`Erro ao buscar funis: ${error.message}`);
          }
          return data || [];
      },
      enabled: hasPermission, // Enabled if user has permission
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
  });

  // Fetch lead details (specifically id_etapa, origem, sourceUrl) for the selected conversation - UPDATED SELECT
  const { data: selectedLeadDetails, isLoading: isLoadingSelectedLead, error: selectedLeadError } = useQuery<ConversationLeadDetails | null>({
      queryKey: ['selectedLeadDetails', selectedConversationId, clinicId], // Add clinicId to query key
      queryFn: async () => {
          // Explicitly reference supabase here
          const currentSupabase = supabase;

          console.log("[ConversasPage] selectedLeadDetails queryFn started. selectedConversationId:", selectedConversationId, "clinicId:", clinicId); // Add this log
          if (!selectedConversationId || !clinicId) {
              console.log("[ConversasPage] Skipping selected lead details fetch: No conversation selected or clinicId missing.");
              return null;
          }
          console.log(`[ConversasPage] Fetching lead details for remoteJid: ${selectedConversationId} and clinicId: ${clinicId}`);
          const { data, error } = await currentSupabase // Use currentSupabase here
              .from('north_clinic_leads_API')
              .select('id, id_etapa, origem, sourceUrl') // UPDATED: Select origem and sourceUrl
              .eq('remoteJid', selectedConversationId)
              .eq('id_clinica', clinicId) // Filter by clinic ID
              .limit(1) // <-- Added limit(1)
              .single(); // <-- Kept single() for type safety, combined with limit(1)

          if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
              console.error("[ConversasPage] Supabase selected lead details fetch error:", error); // Log fetch error
              throw new Error(`Erro ao buscar detalhes do lead: ${error.message}`);
          }

          if (!data) {
              console.log(`[ConversasPage] No lead found for remoteJid: ${selectedConversationId} and clinicId: ${clinicId}`);
              return null;
          }

          console.log("[ConversasPage] Fetched selected lead details:", data); // Log fetched data
          return data as ConversationLeadDetails;
      },
      enabled: hasPermission && !!selectedConversationId && !!clinicId, // Enabled if user has permission, conversation selected, and clinicId available
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
  });

  // Log the state of the selectedLeadDetails query
  useEffect(() => {
      console.log("[ConversasPage] selectedLeadDetails query state updated. isLoadingSelectedLead:", isLoadingSelectedLead, "selectedLeadError:", selectedLeadError, "selectedLeadDetails:", selectedLeadDetails); // Add this log
  }, [isLoadingSelectedLead, selectedLeadError, selectedLeadDetails]);


  // NEW: Fetch all available tags for the clinic (copied from LeadDetailPage)
  const { data: allAvailableTags, isLoading: isLoadingAllTags, error: allTagsError, refetch: refetchAllTags } = useQuery<Tag[]>({
    queryKey: ['allAvailableTags', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      // Set the RLS context for the clinic_code
      await supabase.rpc('set_clinic_code_from_clinic_id', { clinic_id_param: clinicId });
      const { data, error } = await supabase
        .from('north_clinic_tags')
        .select('id, name')
        .eq('id_clinica', clinicId) // Explicitly filter by clinicId
        .order('name', { ascending: true });
      if (error) throw new Error(`Erro ao buscar tags disponíveis: ${error.message}`);
      return data || [];
    },
    enabled: !!clinicId && hasPermission,
    staleTime: 5 * 60 * 1000, // Cache tags for 5 minutes
    refetchOnWindowFocus: false,
  });

  // NEW: Fetch tags currently linked to this lead (copied from LeadDetailPage)
  const { data: currentLeadTags, isLoading: isLoadingLeadTags, error: leadTagsError, refetch: refetchLeadTags } = useQuery<Tag[]>({
    queryKey: ['currentLeadTags', selectedLeadDetails?.id, clinicId], // Use selectedLeadDetails.id
    queryFn: async () => {
      console.log(`[ConversasPage] Fetching currentLeadTags for lead ${selectedLeadDetails?.id} and clinic ${clinicId}`);
      if (!selectedLeadDetails?.id || !clinicId) return [];
      // Set the RLS context for the clinic_code (still needed for other RLS policies)
      await supabase.rpc('set_clinic_code_from_clinic_id', { clinic_id_param: clinicId });
      const { data, error } = await supabase
        .from('north_clinic_lead_tags')
        .select('tag_id, north_clinic_tags(id, name, id_clinica)') // Include id_clinica in the join
        .eq('lead_id', selectedLeadDetails.id) // Use selectedLeadDetails.id
        .eq('north_clinic_tags.id_clinica', clinicId); // Explicitly filter the joined table by clinicId
      
      console.log(`[ConversasPage] Raw Supabase response for currentLeadTags:`, data, error);

      if (error) throw new Error(`Erro ao buscar tags do lead: ${error.message}`);
      // Flatten the nested data and ensure id_clinica matches (though the query should handle this now)
      const fetchedTags = data?.map(item => item.north_clinic_tags).filter((tag): tag is Tag => tag !== null && tag.id_clinica === clinicId) || [];
      console.log(`[ConversasPage] Processed currentLeadTags:`, fetchedTags);
      return fetchedTags;
    },
    enabled: !!selectedLeadDetails?.id && !!clinicId && hasPermission, // Enable only if lead ID and clinic ID are available
    staleTime: 0, // Always refetch lead tags
    refetchOnWindowFocus: false,
  });


  // Memoized maps for stages and funnels
  const stageMap = useMemo(() => {
      const map = new Map<number, FunnelStage>();
      allStages?.forEach(stage => map.set(stage.id, stage));
      return map;
  }, [allStages]);

  const funnelMap = useMemo(() => {
      const map = new Map<number, FunnelDetails>();
      allFunnels?.forEach(funnel => map.set(funnel.id, funnel));
      return map;
  }, [allFunnels]);

  // Get Stage and Funnel Info Helper (uses the maps)
  const getStageAndFunnelInfo = (idEtapa: number | null): { etapa: string, funil: string, etapaClass: string, funilClass: string } => {
      let stageName = 'Etapa Desconhecida';
      let funnelName = 'Funil Desconhecido';
      let etapaClass = 'bg-gray-100 text-gray-800 border border-gray-800'; // Default class
      let funilClass = 'bg-gray-100 text-gray-800 border border-gray-800'; // Default class


      if (idEtapa !== null) {
          const stage = stageMap.get(idEtapa);
          if (stage) {
              stageName = stage.nome_etapa || 'Sem nome';
              if (stage.id_funil !== null) {
                  const funnel = funnelMap.get(stage.id_funil);
                  if (funnel) {
                      funnelName = funnel.nome_funil || 'Sem nome';
                  }
              }

              // Determine classes based on names (copied from AllLeadsPage)
              const etapaLower = stageName.toLowerCase();
              if (etapaLower.includes('novo') || etapaLower.includes('lead')) { etapaClass = 'bg-blue-100 text-blue-800 border border-blue-800'; }
              else if (etapaLower.includes('agendado')) { etapaClass = 'bg-purple-100 text-purple-800 border border-purple-800'; } // Using purple for scheduled
              else if (etapaLower.includes('qualificação')) { etapaClass = 'bg-orange-100 text-orange-800 border border-orange-800'; } // Using orange for qualified
              else { etapaClass = 'bg-gray-100 text-gray-800 border border-gray-800'; } // Default

              const funnelLower = funnelName.toLowerCase();
               if (funnelLower.includes('vendas')) { funilClass = 'bg-green-100 text-green-800 border border-green-800'; } // Using green for sales
               else if (funnelLower.includes('recuperação')) { funilClass = 'bg-red-100 text-red-800 border border-red-800'; } // Using red for recovery
               else if (funnelLower.includes('compareceram')) { funilClass = 'bg-yellow-100 text-yellow-800 border border-yellow-800'; } // Using yellow for compareceram
               else { funilClass = 'bg-gray-100 text-gray-800 border border-gray-800'; } // Default
          }
      }
      return { etapa: stageName, funil: funnelName, etapaClass, funilClass };
  };


  // Find the selected conversation summary to display name in detail header
  const selectedConversationSummary = useMemo(() => {
    const summary = conversationSummaries?.find(conv => conv.remoteJid === selectedConversationId);
    console.log("[ConversasPage] Selected conversation summary:", summary ? { remoteJid: summary.remoteJid, nome_lead: summary.nome_lead, lastTimestamp: summary.lastTimestamp, lastMessage: summary.lastMessage?.substring(0, 50) + '...' } : null); // Log selected summary
    return summary;
  }, [conversationSummaries, selectedConversationId]);

  // --- New useEffect to fetch media for messages ---
  useEffect(() => {
      console.log("[ConversasPage] Media fetching useEffect triggered. Messages:", messages?.length); // Log useEffect trigger
      if (!messages || messages.length === 0) {
          setMediaUrls({});
          setMediaStatus({});
          return;
      }

      const fetchAndSetMedia = async (msg: Message) => {
          // Only fetch if there's a file URL and it's a media type we want to display inline
          const isMediaType = msg.tipo_mensagem && (
              msg.tipo_mensagem.includes('image') ||
              msg.tipo_mensagem.includes('audio') ||
              msg.tipo_mensagem.includes('video')
          );

          if (!msg.url_arquivo || !isMediaType) {
              console.log(`[ConversasPage] Message ${msg.id}: No media URL or type for inline display. Skipping fetch.`); // Log skip
              setMediaUrls(prev => ({ ...prev, [msg.id]: null }));
              setMediaStatus(prev => ({ ...prev, [msg.id]: { isLoading: false, error: null } }));
              return;
          }

          // Check if we already have the URL or are already fetching/failed
          if (mediaUrls[msg.id] !== undefined || mediaStatus[msg.id] !== undefined) {
               console.log(`[ConversasPage] Message ${msg.id}: Media already processed or fetching. Skipping fetch.`); // Log skip if already processed
               return;
          }


          // Set loading state for this message
          setMediaStatus(prev => ({ ...prev, [msg.id]: { isLoading: true, error: null } }));
          setMediaUrls(prev => ({ ...prev, [msg.id]: null })); // Clear previous URL

          console.log(`[ConversasPage] Message ${msg.id}: Attempting to fetch media with key: ${msg.url_arquivo}`); // Log fetch attempt
          try {
              const response = await fetch(MEDIA_WEBHOOK_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ arquivo_key: msg.url_arquivo })
              });

              console.log(`[ConversasPage] Message ${msg.id}: Media webhook response status: ${response.status}`); // Log response status

              if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`[ConversasPage] Message ${msg.id}: Failed to fetch media for ${msg.url_arquivo}: ${response.status} - ${errorText}`); // Log fetch failure
                  throw new Error(`Erro ao carregar mídia: ${response.status}`);
              }

              const responseData = await response.json();
              console.log(`[ConversasPage] Message ${msg.id}: Media webhook response data:`, responseData); // Log response data BEFORE format check

              // --- MODIFIED: Check if responseData is an array or a single object ---
              let signedUrl = null;
              if (Array.isArray(responseData) && responseData.length > 0 && responseData[0]?.signedUrl) {
                  signedUrl = responseData[0].signedUrl;
                  console.log(`[ConversasPage] Message ${msg.id}: Signed URL found in array.`);
              } else if (responseData && typeof responseData === 'object' && responseData.signedUrl) {
                   signedUrl = responseData.signedUrl;
                   console.log(`[ConversasPage] Message ${msg.id}: Signed URL found in single object.`);
              } else {
                  console.error(`[ConversasPage] Message ${msg.id}: Unexpected media webhook response format for ${msg.url_arquivo}:`, responseData); // Log format error
                  throw new Error('Formato de resposta da mídia inesperado.');
              }
              // --- END MODIFIED ---


              if (signedUrl) {
                  setMediaUrls(prev => ({ ...prev, [msg.id]: signedUrl })); // Use the signedUrl
                  setMediaStatus(prev => ({ ...prev, [msg.id]: { isLoading: false, error: null } }));
              } else {
                   // This case should ideally be caught by the format check above, but as a fallback:
                   console.error(`[ConversasPage] Message ${msg.id}: Signed URL is null or undefined after processing.`);
                   throw new Error('URL da mídia não encontrada na resposta.');
              }


          } catch (err: any) {
              console.error(`[ConversasPage] Message ${msg.id}: Error fetching media for ${msg.url_arquivo}:`, err); // Log catch error
              setMediaUrls(prev => ({ ...prev, [msg.id]: null }));
              setMediaStatus(prev => ({ ...prev, [msg.id]: { isLoading: false, error: err.message || 'Erro ao carregar mídia.' } }));
          }
      };

      // Iterate through messages and trigger fetch for each
      messages.forEach(msg => {
           // Only trigger fetch if not already processing/loaded
           if (mediaUrls[msg.id] === undefined && mediaStatus[msg.id] === undefined) {
               fetchAndSetMedia(msg);
           } else {
               console.log(`[ConversasPage] Message ${msg.id}: Media state already exists (${mediaUrls[msg.id] ? 'URL' : 'Null'}, ${mediaStatus[msg.id]?.isLoading ? 'Loading' : 'Not Loading'}, ${mediaStatus[msg.id]?.error ? 'Error' : 'No Error'}). Skipping fetch.`);
           }
      });

  }, [messages, MEDIA_WEBHOOK_URL]); // DEPEND ONLY ON MESSAGES AND WEBHOOK URL

  // Scroll to bottom of messages when messages load or change, using scrollIntoView on sentinel div
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, mediaUrls, pendingMessages]); // Also depend on mediaUrls and pendingMessages

  // Effect to set the default sending instance when conversation or instances change
  useEffect(() => {
      console.log("[ConversasPage] Setting default sending instance effect triggered.");
      if (!selectedConversationId || !instancesList || instancesList.length === 0) {
          console.log("[ConversasPage] No conversation selected or no instances available. Clearing sending instance.");
          setSendingInstanceId(null);
          return;
      }

      // Find the instance ID of the last message in the conversation
      const lastMessageInstanceId = messages && messages.length > 0
          ? messages[messages.length - 1].id_instancia
          : null;

      console.log("[ConversasPage] Last message instance ID:", lastMessageInstanceId);

      // Check if the last message's instance is in the available instances list
      const lastMessageInstanceExists = lastMessageInstanceId !== null && instancesList.some(inst => inst.id === lastMessageInstanceId);

      if (lastMessageInstanceExists) {
          console.log("[ConversasPage] Setting sending instance to last message's instance:", lastMessageInstanceId);
          setSendingInstanceId(lastMessageInstanceId);
      } else {
          // If no messages, or last message's instance is not available, default to the first instance
          const firstInstanceId = instancesList[0]?.id || null;
          console.log("[ConversasPage] Last message instance not found or not available. Setting sending instance to first available instance:", firstInstanceId);
          setSendingInstanceId(firstInstanceId);
      }

  }, [selectedConversationId, messages, instancesList]); // Depend on conversation, messages, and instances list


  // Mutation for sending the message
  const sendMessageMutation = useMutation({
      mutationFn: async (messagePayload: {
          mensagem: string;
          recipiente: string;
          instancia: string; // Evolution instance name
          id_clinica: number | string;
          tipo_mensagem: string;
          prioridade: string;
          tipo_evolution: string;
      }) => {
          console.log("[ConversasPage] Sending message payload:", messagePayload);
          const response = await fetch(SEND_MESSAGE_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(messagePayload),
          });

          if (!response.ok) {
              let errorMsg = `Erro ${response.status} ao enviar mensagem`;
              try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
              throw new Error(errorMsg);
          }

          return response.json(); // Assuming webhook returns some confirmation
      },
      onSuccess: (data) => {
          console.log("[ConversasPage] Message sent successfully:", data);
          // showSuccess('Mensagem enviada para a fila!'); // Removed success toast
          setMessageInput(''); // Clear input after sending
          setShowEmojiPicker(false); // Hide emoji picker
          // Force refetch messages for the current conversation
          queryClient.invalidateQueries({ queryKey: ['conversationMessages', selectedConversationId] });
          // DO NOT clear pendingMessages here. The sync effect will handle it.
      },
      onError: (error: Error, variables) => {
          console.error("[ConversasPage] Error sending message:", error);
          showError(`Falha ao enviar mensagem: ${error.message}`);

          // Find the pending message and mark it as failed
          setPendingMessages(prev =>
              prev.map(msg =>
                  msg.mensagem === variables.mensagem && msg.status === 'pending' // Simple match by content and status
                      ? { ...msg, status: 'failed' }
                      : msg
              )
          );
      },
  });

  // Effect to synchronize pending messages with fetched messages
  useEffect(() => {
      if (!messages || pendingMessages.length === 0) {
          return; // Nothing to sync if no fetched messages or no pending messages
      }

      console.log("[ConversasPage] Sync effect running. Pending:", pendingMessages.length, "Fetched:", messages.length);

      const updatedPendingMessages = pendingMessages.filter(pendingMsg => {
          // Keep the pending message if it's marked as failed
          if (pendingMsg.status === 'failed') {
              return true;
          }

          // Check if a matching message exists in the fetched messages
          const isFoundInFetched = messages.some(fetchedMsg =>
              fetchedMsg.from_me === true && // Must be a message sent by me
              fetchedMsg.mensagem === pendingMsg.mensagem && // Content must match
              (fetchedMsg.message_timestamp ?? 0) >= (pendingMsg.message_timestamp ?? 0) // Timestamp must be equal or later
              // Note: Matching by content and timestamp is a heuristic.
              // A more robust approach would involve the webhook returning the DB ID of the created message.
          );

          // Keep the pending message ONLY if it was NOT found in the fetched messages
          return !isFoundInFetched;
      });

      // Update pendingMessages state if anything changed
      if (updatedPendingMessages.length !== pendingMessages.length) {
          console.log("[ConversasPage] Sync effect: Removing", pendingMessages.length - updatedPendingMessages.length, "pending messages.");
          setPendingMessages(updatedPendingMessages);
      } else {
           console.log("[ConversasPage] Sync effect: No pending messages to remove.");
      }

  }, [messages, pendingMessages]); // Depend on fetched messages and pending messages


  // Handle send message
  const handleSendMessage = () => {
      if (!messageInput.trim() || !selectedConversationId || !clinicData?.id || sendingInstanceId === null) {
          console.log("Cannot send message: missing input, conversation, clinic ID, or sending instance.");
          // Optionally show a warning toast
          if (sendingInstanceId === null) {
              showError("Selecione uma instância para enviar a mensagem.");
          }
          return;
      }

      // Find the selected instance details
      const selectedInstance = instanceMap.get(sendingInstanceId);
      if (!selectedInstance?.nome_instancia_evolution) {
          showError("Dados da instância selecionada inválidos.");
          return;
      }
      const instanceEvolutionName = selectedInstance.nome_instancia_evolution;


      // Extract the number part from remoteJid (selectedConversationId)
      const recipientNumber = selectedConversationId.split('@')[0];
      if (!recipientNumber) {
           showError("Não foi possível extrair o número do destinatário.");
           return;
      }

      // Create a temporary message object for optimistic update
      const tempMessage: Message = {
          id: Date.now() + Math.random(), // Unique client-side ID (string or number)
          remoteJid: selectedConversationId,
          nome_lead: selectedConversationSummary?.nome_lead || null, // Use nome_lead from summary
          mensagem: messageInput,
          message_timestamp: Math.floor(Date.now() / 1000), // Client-side timestamp in seconds
          from_me: true,
          tipo_mensagem: 'text', // Assuming text for now
          id_whatsapp: null,
          transcrito: null,
          id_instancia: sendingInstanceId, // Use the selected sending instance ID
          url_arquivo: null,
          status: 'pending', // Mark as pending
      };

      // Add the temporary message to the pending list
      setPendingMessages(prev => [...prev, tempMessage]);

      const messagePayload = {
          mensagem: messageInput,
          recipiente: recipientNumber, // <-- Use only the number part here
          instancia: instanceEvolutionName, // Use the determined evolution instance name from the selected instance
          id_clinica: clinicData.id, // Use clinic ID
          tipo_mensagem: "CRM", // As specified
          prioridade: "0", // <-- Alterado para "0"
          tipo_evolution: "text", // As specified
      };

      sendMessageMutation.mutate(messagePayload); // Trigger the mutation
      // The sync effect will handle clearing pending messages once they appear in fetched messages.
  };

  // Allow sending with Enter key
  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) { // Send on Enter, new line on Shift+Enter
          event.preventDefault(); // Prevent default newline
          handleSendMessage();
      }
  };

  // Log inputs to useMemo
  console.log("[ConversasPage] useMemo inputs: messages =", messages ? messages.length : 'null/undefined', ", pendingMessages =", pendingMessages.length);

  // Combine fetched messages and pending messages for display
  const allMessages = useMemo(() => {
      // Reverse the fetched messages array before combining
      const fetchedMessagesReversed = (messages || []).slice().reverse(); // Use slice() to avoid mutating the original array
      const combined = [...fetchedMessagesReversed, ...pendingMessages];
      // Sort by timestamp (handle null timestamps by putting them at the end)
      combined.sort((a, b) => {
          const tsA = a.message_timestamp ?? 0; // Treat null as 0 for sorting
          const tsB = b.message_timestamp ?? 0;
          return tsA - tsB;
      });
      console.log("[ConversasPage] useMemo computed allMessages (fetched reversed):", combined.length, "items. First:", combined[0]?.mensagem?.substring(0, 30), "Last:", combined[combined.length - 1]?.mensagem?.substring(0, 30)); // Log combined messages
      return combined;
  }, [messages, pendingMessages]);

  // Add a log immediately after useMemo
  console.log("[ConversasPage] After useMemo, allMessages is:", allMessages);


  // Effect to log the last messages for comparison
  useEffect(() => {
      // Add a simple check at the very beginning
      if (!allMessages) {
          console.error("[ConversasPage] useEffect: allMessages is null or undefined!", allMessages);
          return; // Exit early if not available
      }

      // Defensive check: Ensure allMessages is an array before proceeding
      if (!Array.isArray(allMessages)) { // Corrected check here
          console.error("[ConversasPage] useEffect: allMessages is not an array!", allMessages);
          return; // Exit early if not an array
      }

      console.log("--- Last Message Comparison ---");
      if (selectedConversationSummary) {
          console.log("Summary Last Message:", {
              remoteJid: selectedConversationSummary.remoteJid,
              timestamp: selectedConversationSummary.lastTimestamp,
              message: selectedConversationSummary.lastMessage?.substring(0, 50) + '...'
          });
      } else {
          console.log("No conversation summary selected.");
      }

      if (allMessages.length > 0) {
          const lastDetailMessage = allMessages[allMessages.length - 1];
           console.log("Detail Last Message:", {
               id: lastDetailMessage.id,
               remoteJid: lastDetailMessage.remoteJid,
               timestamp: lastDetailMessage.message_timestamp,
               from_me: lastDetailMessage.from_me,
               status: lastDetailMessage.status,
               message: lastDetailMessage.mensagem?.substring(0, 50) + '...'
           });
      } else {
          console.log("No messages in detail view.");
      }
      console.log("-----------------------------");

  }, [selectedConversationSummary, allMessages]); // Re-run when summary or detail messages change


  // Emoji picker integration
  const toggleEmojiPicker = () => setShowEmojiPicker((v) => !v);

  const onEmojiSelect = (event: CustomEvent) => {
    const emoji = event.detail.unicode;
    console.log("ConversasPage: Emoji selected:", emoji); // Log selected emoji
    if (messageTextareaRef.current) {
      const el = messageTextareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = messageInput; // Use state value
      const newText = text.slice(0, start) + emoji + text.slice(end);

      setMessageInput(newText); // Update state
      // Restore cursor position after state update (requires a slight delay or nextTick)
      // A common pattern is to manage cursor position in state, but for simplicity,
      // we can try setting it directly after the state update, though it might not be perfect.
      // Let's try setting it directly first.
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus(); // Keep focus on the textarea
    }
    // Optionally close picker after selection
    // setShowEmojiPicker(false);
  };

  // Attach emoji picker event listener
  useEffect(() => {
    const picker = emojiPickerRef.current;
    console.log("ConversasPage: Emoji picker useEffect triggered. Picker:", picker); // Debug log
    if (!picker) {
        console.log("ConversasPage: Emoji picker element not found yet."); // Debug log
        return;
    }

    console.log("ConversasPage: Waiting for emoji-picker custom element definition."); // Debug log
    customElements.whenDefined('emoji-picker').then(() => {
        console.log("ConversasPage: Emoji picker custom element defined. Attaching listener directly."); // Debug log
        picker.addEventListener("emoji-click", onEmojiSelect as EventListener);
    }).catch(err => {
        console.error("ConversasPage: Error waiting for emoji-picker definition:", err); // Debug log
    });


    return () => {
      console.log("ConversasPage: Removing emoji-click listener."); // Debug log
      if (picker) {
        picker.removeEventListener("emoji-click", onEmojiSelect as EventListener);
      }
    };
  }, [emojiPickerRef.current]); // Removed messageInput from dependencies


  // NEW: Mutations for tag management (copied from LeadDetailPage)
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const payload = { name: tagName, id_clinica: clinicId };
      const response = await fetch(CREATE_TAG_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar tag: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      const data = await response.json();
      if (!data?.id) throw new Error("ID da nova tag não retornado.");
      return { id: data.id, name: tagName } as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAvailableTags', clinicId] });
      showSuccess("Tag criada com sucesso!");
    },
    onError: (err: Error) => {
      showError(`Erro ao criar tag: ${err.message}`);
    }
  });

  const linkTagMutation = useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: number; tagId: number }) => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const payload = { lead_id: leadId, tag_id: tagId, id_clinica: clinicId };
      console.log(`[ConversasPage] Calling LINK_LEAD_TAG_WEBHOOK_URL with payload:`, payload);
      const response = await fetch(LINK_LEAD_TAG_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao vincular tag: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      return true;
    },
    onSuccess: (_, variables) => {
      showSuccess("Tag vinculada com sucesso!");
      console.log(`[ConversasPage] Invalidating currentLeadTags query for lead ${variables.leadId} and clinic ${clinicId}`);
      setTimeout(() => { // Add a small delay
        queryClient.invalidateQueries({ queryKey: ['currentLeadTags', variables.leadId, clinicId] });
      }, 500);
    },
    onError: (err: Error) => {
      showError(`Erro ao vincular tag: ${err.message}`);
    }
  });

  const unlinkTagMutation = useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: number; tagId: number }) => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const payload = { lead_id: leadId, tag_id: tagId, id_clinica: clinicId };
      console.log(`[ConversasPage] Calling UNLINK_LEAD_TAG_WEBHOOK_URL with payload:`, payload);
      const response = await fetch(UNLINK_LEAD_TAG_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao desvincular tag: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      return true;
    },
    onSuccess: (_, variables) => {
      showSuccess("Tag desvinculada com sucesso!");
      console.log(`[ConversasPage] Invalidating currentLeadTags query for lead ${variables.leadId} and clinic ${clinicId}`);
      setTimeout(() => { // Add a small delay
        queryClient.invalidateQueries({ queryKey: ['currentLeadTags', variables.leadId, clinicId] });
      }, 500);
    },
    onError: (err: Error) => {
      showError(`Erro ao desvincular tag: ${err.message}`);
    }
  });


  // --- Permission Check ---
  if (!clinicData) {
    console.log("[ConversasPage] Rendering: clinicData is null."); // Log permission check state
    return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
  }

  if (!hasPermission) {
    console.log("[ConversasPage] Rendering: User does not have required permission."); // Log permission check state
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

  // Determine if sending is possible (conversation selected, instances loaded, an instance is selected)
  const canSend = !!selectedConversationId && !sendMessageMutation.isLoading && !!instancesList && instancesList.length > 0 && sendingInstanceId !== null;

  // Get Funnel and Stage info for the header (now includes classes)
  const { etapa: leadStageName, funil: leadFunnelName, etapaClass, funilClass } = getStageAndFunnelInfo(selectedLeadDetails?.id_etapa ?? null);
  const isLoadingLeadInfo = isLoadingSelectedLead || isLoadingStages || isLoadingFunnels;
  const leadInfoError = selectedLeadError || stagesError || funnelsError;

  // Function to open WhatsApp chat
  const handleOpenInWhatsapp = () => {
    if (selectedConversationId) {
      const phoneNumber = selectedConversationId.split('@')[0];
      if (phoneNumber) {
        window.open(`https://wa.me/${phoneNumber}`, '_blank');
      } else {
        showError("Número de telefone inválido para abrir no WhatsApp.");
      }
    }
  };

  return (
    <TooltipProvider>
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
                  const contactName = conv.nome_lead || ''; // Use nome_lead here
                  const lastMessageTimestamp = formatTimestampForList(conv.lastTimestamp);
                  const lastMessagePreview = conv.lastMessage || '';

                  return (
                    <Tooltip key={conversationId}> {/* Keep Tooltip */}
                        <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "conversation-list-item flex flex-col p-3 border-b border-gray-100 cursor-pointer transition-colors",
                                selectedConversationId === conversationId ? 'bg-gray-100' : 'hover:bg-gray-50'
                              )}
                              onClick={() => setSelectedConversationId(conversationId)}
                            >
                              <div className="flex items-center justify-between"> {/* This is the row with avatar/info and timestamp */}
                                <div className="flex items-center flex-grow"> {/* Added flex-grow here */}
                                  <Avatar className="h-10 w-10 mr-3 flex-shrink-0">
                                    <AvatarFallback className="bg-gray-300 text-gray-800 text-sm font-semibold">{getInitials(contactName)}</AvatarFallback>
                                  </Avatar>
                                  {/* Added max-w-[180px] here */}
                                  <div className="flex flex-col min-w-0 max-w-[180px]"> {/* Use flex-col here */}
                                    {/* Display nome_lead if available, otherwise formatted phone */}
                                    <span className="contact-name font-semibold text-sm truncate whitespace-nowrap">
                                        {contactName || formatPhone(conversationId.split('@')[0]) || 'Sem Nome'}
                                    </span>
                                    {/* Display formatted phone below the name/fallback */}
                                    {contactName && ( // Only show phone explicitly if name is present
                                        <span className="contact-phone text-xs text-gray-600 truncate whitespace-nowrap">
                                            {formatPhone(conversationId.split('@')[0])}
                                        </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-gray-500 ml-2 whitespace-nowrap flex-shrink-0"> {/* Added flex-shrink-0 here */}
                                    {lastMessageTimestamp}
                                </span>
                              </div>
                              <div className="last-message-preview text-xs text-gray-600 mt-1 truncate max-w-[150px] whitespace-nowrap">{lastMessagePreview}</div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>RemoteJid: {conv.remoteJid}</p>
                            <p>Nome Lead no DB: {conv.nome_lead || 'Nulo/Vazio'}</p> {/* Show nome_lead in tooltip */}
                        </TooltipContent>
                    </Tooltip>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Conversation Detail Panel */}
          <div className="conversation-detail-panel flex-grow flex flex-col overflow-hidden bg-gray-50">
            <div className="detail-header p-4 border-b border-gray-200 font-semibold flex-shrink-0 min-h-[60px] flex items-center justify-between bg-gray-100"> {/* Added justify-between */}
              {selectedConversationSummary ? (
                <div className="flex flex-col">
                    {/* Display nome_lead or formatted phone */}
                    <span id="conversationContactName" className="text-primary text-lg font-bold">
                        {selectedConversationSummary.nome_lead || formatPhone(selectedConversationSummary.remoteJid.split('@')[0]) || 'Selecione uma conversa'}
                    </span>
                    {/* Display Funnel and Stage */}
                    {isLoadingLeadInfo ? (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Carregando info do lead...
                        </span>
                    ) : leadInfoError ? (
                         <span className="text-sm text-red-600 flex items-center gap-1">
                             <TriangleAlert className="h-3 w-3" /> Erro ao carregar info do lead.
                         </span>
                    ) : selectedLeadDetails ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold mt-1"> {/* Use flex and gap for badges */}
                            <span className={cn("funnel px-2 py-1 rounded-md", funilClass)}>{leadFunnelName}</span>
                            <span className={cn("stage px-2 py-1 rounded-md", etapaClass)}>{leadStageName}</span>
                            {/* Display Origem */}
                            {selectedLeadDetails.origem && (
                                <span className="origem px-2 py-1 rounded-md bg-gray-100 text-gray-800 border border-gray-800">
                                    Origem: {selectedLeadDetails.origem}
                                </span>
                            )}
                            {/* Display SourceUrl as a link */}
                            {selectedLeadDetails.sourceUrl && (
                                <a
                                    href={selectedLeadDetails.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="source-url px-2 py-1 rounded-md bg-gray-100 text-blue-600 border border-gray-800 hover:underline truncate max-w-[200px]" // Added truncate and max-width
                                    title={`Anúncio: ${selectedLeadDetails.sourceUrl}`} // Add tooltip for full URL
                                >
                                    Anúncio: {selectedLeadDetails.sourceUrl}
                                </a>
                            )}
                        </div>
                    ) : (
                         <span className="text-sm text-gray-600">Lead não encontrado no CRM.</span>
                    )}
                </div>
              ) : (
                <span className="text-primary text-lg font-bold">Selecione uma conversa</span>
              )}
              {/* NEW: Open in WhatsApp Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleOpenInWhatsapp}
                disabled={!selectedConversationId}
                title="Abrir no WhatsApp"
                className="ml-auto flex-shrink-0"
              >
                <MessagesSquare className="h-5 w-5" /> {/* Changed icon to MessagesSquare */}
              </Button>
            </div>

            {/* NEW: Lead Tag Manager Section */}
            {selectedLeadDetails && clinicId && (
                <div className="p-4 border-b border-gray-200 bg-gray-100 flex-shrink-0">
                    <LeadTagManager
                        clinicId={clinicId}
                        leadId={selectedLeadDetails.id}
                        availableTags={allAvailableTags || []}
                        currentLeadTags={currentLeadTags || []}
                        isLoadingTags={isLoadingAllTags || isLoadingLeadTags}
                        isSavingTags={linkTagMutation.isLoading || unlinkTagMutation.isLoading || createTagMutation.isLoading}
                        onTagAdd={(leadId, tagId) => linkTagMutation.mutate({ leadId, tagId })}
                        onTagRemove={(leadId, tagId) => unlinkTagMutation.mutate({ leadId, tagId })}
                        onNewTagCreate={createTagMutation.mutateAsync}
                    />
                </div>
            )}

            <ScrollArea className="messages-area flex-grow p-4 flex flex-col">
              {!selectedConversationId ? (
                <div className="status-message text-gray-700 text-center">Selecione uma conversa na lista à esquerda.</div>
              ) : isLoadingMessages && allMessages.length === 0 ? ( // Show loading only if no messages (initial load)
                <div className="status-message loading-message flex flex-col items-center justify-center p-8 text-primary">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <span>Carregando mensagens...</span>
                </div>
              ) : messagesError && allMessages.length === 0 ? ( // Show error only if no messages (initial load)
                <div className="status-message error-message flex flex-col items-center justify-center p-4 text-red-600 bg-red-100 rounded-md">
                  <TriangleAlert className="h-8 w-8 mb-4" />
                  <span>Erro ao carregar mensagens: {messagesError.message}</span>
                </div>
              ) : allMessages.length === 0 ? ( // Show no messages found if combined list is empty
                <div className="status-message text-gray-700 text-center">Nenhuma mensagem nesta conversa.</div>
              ) : (
                <>
                  {allMessages.map(msg => { // Use allMessages (fetched + pending)
                    // Find the instance name using the instanceMap
                    const instance = msg.id_instancia !== null && msg.id_instancia !== undefined
                        ? instanceMap.get(msg.id_instancia)
                        : null;
                    const instanceName = instance?.nome_exibição || 'Instância Desconhecida';

                    // Determine the name to display based on from_me - Use nome_lead here
                    const displayName = msg.from_me ? instanceName : (msg.nome_lead || formatPhone(msg.remoteJid.split('@')[0]) || 'Contato Desconhecido'); // Fallback to formatted phone if nome_lead is empty

                    // Get media status and URL from component state
                    const mediaStatusForMsg = mediaStatus[msg.id];
                    const mediaUrlForMsg = mediaUrls[msg.id];
                    const isLoadingMedia = mediaStatusForMsg?.isLoading ?? false;
                    const mediaError = mediaStatusForMsg?.error ?? null;

                    // Log the media state for this specific message during render
                    console.log(`[ConversasPage] Rendering message ${msg.id}: isLoadingMedia=${isLoadingMedia}, mediaError=${mediaError}, mediaUrlForMsg=${mediaUrlForMsg ? 'Exists' : 'Null'}`);


                    return (
                      <div key={msg.id} className={cn(
                        "message-bubble max-w-[75%] p-3 rounded-xl mb-2 text-sm leading-tight break-words relative",
                        msg.from_me ? 'bg-green-200 ml-auto rounded-br-md' : 'bg-white mr-auto rounded-bl-md border border-gray-200',
                        msg.status === 'pending' && 'opacity-70', // Dim pending messages
                        msg.status === 'failed' && 'border-red-500 border-2' // Highlight failed messages
                      )}>
                        {/* Add instance/contact name label */}
                        <div className={cn(
                            "text-xs text-gray-500 mb-1",
                            msg.from_me ? 'text-right' : 'text-left' // Align label with bubble
                        )}>
                            {displayName}
                        </div>

                        {/* Render media if available */}
                        {isLoadingMedia && (
                            <div className="flex items-center justify-center text-primary mb-2">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando mídia...
                            </div>
                        )}
                        {mediaError && (
                             <div className="text-red-600 text-xs mb-2">
                                 <TriangleAlert className="h-3 w-3 inline-block mr-1" /> {mediaError}
                             </div>
                        )}
                        {mediaUrlForMsg && msg.tipo_mensagem && msg.tipo_mensagem.includes('image') && (
                            // Wrap image in a clickable div and make it smaller
                            <div className="cursor-pointer" onClick={() => setEnlargedImageUrl(mediaUrlForMsg)}>
                                <img
                                    src={mediaUrlForMsg}
                                    alt="Anexo de imagem"
                                    className="max-w-[200px] h-auto rounded-md mb-2" // Adjusted size
                                />
                            </div>
                        )}
                        {mediaUrlForMsg && msg.tipo_mensagem && msg.tipo_mensagem.includes('audio') && (
                            <audio src={mediaUrlForMsg} controls className="w-full mb-2" />
                        )}
                         {mediaUrlForMsg && msg.tipo_mensagem && msg.tipo_mensagem.includes('video') && ( // Added video support
                            <video src={mediaUrlForMsg} controls className="max-w-full h-auto rounded-md mb-2" />
                        )}

                        {/* Render message text */}
                        {/* Only render text if it exists OR if there's no media being loaded/displayed */}
                        {(msg.mensagem || (!mediaUrlForMsg && !isLoadingMedia && !mediaError)) && (
                             <div dangerouslySetInnerHTML={{ __html: (msg.mensagem || '').replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>').replace(/\\n|\n/g, '<br>') }}></div>
                        )}


                        <span className="message-timestamp text-xs text-gray-500 mt-1 block text-right">
                            {formatTimestampForBubble(msg.message_timestamp)}
                            {msg.status === 'pending' && <Clock className="h-3 w-3 inline-block ml-1 text-gray-500" title="Pendente" />}
                            {msg.status === 'failed' && <XCircle className="h-3 w-3 inline-block ml-1 text-red-500" title="Falhou" />}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={endOfMessagesRef} />
                </>
              )}
            </ScrollArea>
            {/* Message Input Area */}
            <div className="message-input-area p-4 border-t border-gray-200 flex-shrink-0 bg-gray-100 relative"> {/* Added relative for emoji picker positioning */}
                {/* Instance Selection */}
                <div className="mb-2">
                     <Label className="block mb-1 text-sm font-medium text-gray-700">Enviar de:</Label> {/* Added Label */}
                     {isLoadingInstances ? (
                         <div className="flex items-center text-gray-500 text-sm">
                             <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando instâncias...
                         </div>
                     ) : (instancesList?.length ?? 0) === 0 ? (
                         <p className="text-sm text-red-600">Nenhuma instância de WhatsApp configurada para esta clínica. Não é possível enviar mensagens.</p>
                     ) : (
                         <RadioGroup
                             value={sendingInstanceId?.toString() || ''}
                             onValueChange={(value) => setSendingInstanceId(value ? parseInt(value, 10) : null)}
                             disabled={!selectedConversationId || sendMessageMutation.isLoading} // Disable based on conversation selected and sending state
                             className="flex flex-wrap gap-4" // Arrange radio buttons side-by-side with gap
                         >
                             {instancesList?.map(instance => (
                                 <div key={instance.id} className="flex items-center space-x-2"> {/* Container for radio item and label */}
                                     <RadioGroupItem
                                         value={instance.id.toString()}
                                         id={`instance-${instance.id}`}
                                         disabled={!selectedConversationId || sendMessageMutation.isLoading}
                                     />
                                     <Label htmlFor={`instance-${instance.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                                         {instance.nome_exibição} ({formatPhone(instance.telefone)})
                                     </Label>
                                 </div>
                             ))}
                         </RadioGroup>
                     )}
                     {selectedConversationId && sendingInstanceId === null && !isLoadingInstances && (instancesList?.length ?? 0) > 0 && (
                          <p className="text-sm text-orange-600 mt-1">Selecione uma instância para enviar a mensagem.</p>
                     )}
                </div>

                <div className="flex items-end gap-2"> {/* Use flex items-end to align items at the bottom */}
                    <Textarea
                        ref={messageTextareaRef}
                        placeholder="Digite sua mensagem aqui..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={handleKeyPress} // Handle Enter key press
                        disabled={!canSend || sendMessageMutation.isLoading} // Disable based on canSend
                        rows={4} // Start with 4 rows
                        className="flex-grow min-h-[40px] max-h-[150px] resize-none overflow-y-auto pr-10" // Added pr-10 for emoji button space
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleEmojiPicker}
                        disabled={!canSend || sendMessageMutation.isLoading} // Disable based on canSend
                        className="flex-shrink-0 h-10 w-10" // Fixed size for button
                        aria-label="Inserir emoji"
                    >
                        <Smile className="h-5 w-5" />
                    </Button>
                    {/* Render emoji picker always, but control visibility with 'hidden' */}
                    <div className="absolute z-50 bottom-[calc(100%+10px)] right-4" hidden={!showEmojiPicker}>
                        <emoji-picker
                            ref={emojiPickerRef}
                            style={{ width: "300px", height: "300px" }}
                        />
                    </div>
                    <Button
                        onClick={handleSendMessage}
                        disabled={!canSend || !messageInput.trim() || sendMessageMutation.isLoading} // Disable based on canSend and message input
                        className="flex-shrink-0 h-10 w-10 p-0" // Fixed size, no padding
                        aria-label="Enviar mensagem"
                    >
                        {sendMessageMutation.isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </Button>
                </div>
            </div>
          </div>
        </div>

        {/* Image Enlargement Dialog */}
        <Dialog open={!!enlargedImageUrl} onOpenChange={(open) => { if (!open) setEnlargedImageUrl(null); }}>
            <DialogContent className="sm:max-w-[800px] w-[95vw] h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle>Visualizar Imagem</DialogTitle>
                </DialogHeader>
                <div className="flex-grow flex items-center justify-center overflow-hidden p-4">
                    {enlargedImageUrl && (
                        <img
                            src={enlargedImageUrl}
                            alt="Imagem ampliada"
                            className="max-w-full max-h-full object-contain" // Ensure image fits within the dialog
                        />
                    )}
                </div>
                <DialogFooter className="p-4 pt-0">
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

export default ConversasPage;