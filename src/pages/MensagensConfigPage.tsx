"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmojiPicker } from "emoji-picker-element";
import { Loader2, Smile, TriangleAlert } from "lucide-react";
import MultiSelectServices from "@/components/MultiSelectServices";
import { useLocation } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';
import { useQuery } from "@tanstack/react-query";

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface Instance {
  id: number;
  nome_exibição: string;
  nome_instancia_evolution: string | null;
}

interface Service {
  id: number;
  nome: string;
}

interface Group {
  id_grupo: number;
  nome_grupo: string;
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
    ordem: number | null;
}


// Updated interface to match Supabase join structure and new column names
interface FetchedMessageData {
  id: number;
  categoria: string | null;
  id_instancia: number | null;
  modelo_mensagem: string;
  ativo: boolean;
  hora_envio: string | null;
  grupo: number | null;
  url_arquivo: string | null;
  variacao_1: string | null;
  variacao_2: string | null;
  variacao_3: string | null;
  variacao_4: string | null;
  variacao_5: string | null;
  para_cliente: boolean;
  para_funcionario: boolean;
  context: string | null;
  dias_mensagem_cashback: number | null;
  tipo_mensagem_cashback: string | null;
  id_funil?: number | null;
  id_etapa?: number | null;
  sending_order: string | null; // <-- Added new column
  north_clinic_mensagens_servicos: { id_servico: number }[];
}

// Interface for webhook response (assuming it might return success/error flags)
interface WebhookResponse {
    success?: boolean;
    error?: string;
    message?: string;
    // Add other expected fields from webhook response if any
}


const orderedCategoriesGeneral = [
  "Agendou",
  "Confirmar Agendamento",
  "Responder Confirmar Agendamento",
  "Faltou",
  "Finalizou Atendimento",
  "Aniversário",
  "Chegou",
  "Liberado",
];

const orderedCategoriesCashback = [
    "Aniversário",
    "Cashback Concedido",
    "Cashback Próximo a Expirar",
];


const defaultTemplates: Record<string, string> = {
  Agendou:
    "Olá {primeiro_nome_cliente}!\n\nSeu agendamento de *{lista_servicos}* foi realizado para o dia *{dia_agendamento_num} de {mes_agendamento_extenso} ({dia_semana_relativo_extenso}) às {hora_agendamento}h* com {nome_completo_funcionario}.\n\nNossa equipe estará lhe esperando.\nSe precisar reagendar ou tiver alguma dúvida, é só nos chamar por aqui.",
  "Confirmar Agendamento":
    "Olá {primeiro_nome_cliente}, passando para lembrar do seu agendamento de *{nome_servico_principal}* {dia_semana_relativo_extenso} ({data_agendamento}) às *{hora_agendamento}h*. Confirma sua presença? (Responda SIM ou NAO)",
  "Responder Confirmar Agendamento":
    "Obrigado por confirmar, {primeiro_nome_cliente}! Seu horário das *{hora_agendamento}h* para *{nome_servico_principal}* está garantido.",
  Faltou:
    "Olá {primeiro_nome_cliente}, notamos que você não pôde comparecer ao seu agendamento de *{nome_servico_principal}* hoje. Gostaríamos de remarcar, qual o melhor horário para você?",
  "Finalizou Atendimento":
    "Olá {primeiro_nome_cliente}, seu atendimento de *{nome_servico_principal}* com {nome_completo_funcionario} foi finalizado. Esperamos que tenha sido ótimo! Se precisar de algo mais, estamos à disposição.",
  Aniversário:
    "Feliz aniversário, {primeiro_nome_cliente}! 🎉 Desejamos a você um dia maravilhoso cheio de alegria e saúde! Equipe North Clinic.",
  Chegou:
    "Olá {primeiro_nome_cliente}, que bom que você chegou! Por favor, aguarde um momento, em breve {primeiro_nome_funcionario} irá te chamar.",
  Liberado:
    "{primeiro_nome_cliente}, sua sessão de *{nome_servico_principal}* foi concluída. Se tiver uma próxima etapa, informaremos em breve. Obrigado!",
  "Cashback Concedido":
    "Olá {primeiro_nome_cliente}! Você recebeu R$ {valor_cashback} de cashback na sua última compra! Use até {validade_cashback}. Aproveite!",
  "Cashback Próximo a Expirar":
    "Olá {primeiro_nome_cliente}! Seu cashback de R$ {valor_cashback} está perto de expirar ({validade_cashback}). Não perca a chance de usar!",
};

// Placeholder data for message preview (updated for cashback)
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
    valor_cashback: "R$ 50,00",
    validade_cashback: "20/05/2025"
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


const MensagensConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
  clinicData,
}) => {
  const { toast } = useToast();
  const location = useLocation();

  // Form state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messageId, setMessageId] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("");
  const [instanceId, setInstanceId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState<string>("");
  const [active, setActive] = useState<boolean>(true); // Always starts active for new messages
  const [services, setServices] = useState<Service[]>([]);
  const [linkedServices, setLinkedServices] = useState<number[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [targetType, setTargetType] = useState<"Grupo" | "Cliente" | "Funcionário">(
    "Grupo"
  );
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaSavedUrl, setMediaSavedUrl] = useState<string | null>(null);
  const [messageContext, setMessageContext] = useState<string | null>(null); // State for message context

  // State for cashback timing (using correct column names)
  const [diasMensagemCashback, setDiasMensagemCashback] = useState<string>(''); // Use string for input
  const [tipoMensagemCashback, setTipoMensagemCashback] = useState<string>(''); // 'apos_venda' or 'antes_validade'

  // State for Leads context - Funnel and Stage
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  // NEW: State for sending order
  const [sendingOrder, setSendingOrder] = useState<string>('both'); // Default to 'both'


  // Removed variations state

  // Emoji picker ref
  const emojiPickerRef = useRef<HTMLElement | null>(null);
  // Corrected ref initialization
  const messageTextRef = useRef<HTMLTextAreaElement | null>(null);

  // Determine context based on URL parameter
  const urlParams = new URLSearchParams(location.search); // Use useLocation hook
  const contextParam = urlParams.get("context");
  const isGeneralContext = messageContext === 'clientes'; // Renamed from 'general' to 'clientes'
  const isCashbackContext = messageContext === 'cashback';
  const isLeadsContext = messageContext === 'leads';


  // Fetch All Funnels (for Leads context filter)
  const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
      queryKey: ['allFunnelsConfigPage', clinicData?.id],
      queryFn: async () => {
          const currentClinicId = clinicData?.id; // Capture clinicId
          if (!currentClinicId) return [];
          console.log(`[MensagensConfigPage] Fetching all funnels from Supabase...`);
          const { data, error } = await supabase
              .from('north_clinic_crm_funil')
              .select('id, nome_funil')
              .order('nome_funil', { ascending: true });
          if (error) {
              console.error("[MensagensConfigPage] Supabase all funnels fetch error:", error);
              throw new Error(`Erro ao buscar funis: ${error.message}`);
          }
          return data || [];
      },
      enabled: !!clinicData?.id && isLeadsContext, // Enabled only if clinicId is available AND context is 'leads'
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
  });

  // Fetch Stages for the selected funnel (for Leads context filter)
  const { data: stagesForSelectedFunnel, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
      queryKey: ['stagesForFunnelConfigPage', clinicData?.id, selectedFunnelId],
      queryFn: async () => {
          const currentClinicId = clinicData?.id; // Capture clinicId
          if (!currentClinicId || selectedFunnelId === null) return [];
          console.log(`[MensagensConfigPage] Fetching stages for funnel ${selectedFunnelId} from Supabase...`);
          const { data, error } = await supabase
              .from('north_clinic_crm_etapa')
              .select('id, nome_etapa, id_funil, ordem') // Select ordem for sorting
              .eq('id_funil', selectedFunnelId)
              .order('ordem', { ascending: true }); // Order by ordem
          if (error) {
              console.error("[MensagensConfigPage] Supabase stages fetch error:", error);
              throw new Error(`Erro ao buscar etapas: ${error.message}`);
          }
          return data || [];
      },
      enabled: !!clinicData?.id && isLeadsContext && selectedFunnelId !== null, // Enabled only if clinicId, context is 'leads', and a funnel is selected
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
  });


  // Load initial data: instances, services, message details if editing
  useEffect(() => {
    // Capture clinicData at the start of the effect
    const currentClinicData = clinicData;

    if (!currentClinicData?.id) { // Use captured clinicData
      setError("ID da clínica não disponível.");
      setLoading(false);
      return;
    }

    const idParam = urlParams.get("id");
    const isEditing = !!idParam;
    const messageIdToEdit = idParam ? parseInt(idParam, 10) : null;

    // Set context from URL if creating a new message, or it will be loaded if editing
    // Only set if messageContext is currently null (initial load)
    if (messageContext === null && contextParam) {
        setMessageContext(contextParam);
    }


    async function fetchData() {
      // Capture clinicData again inside the async function for safety
      const clinicDataInFetch = currentClinicData;
      if (!clinicDataInFetch?.id) { // Use captured clinicData
           console.error("[MensagensConfigPage] fetchData: clinicDataInFetch is null or undefined.");
           setError("ID da clínica não disponível.");
           setLoading(false);
           return;
      }


      setLoading(true);
      setError(null);
      try {
        // Fetch instances
        const { data: instancesData, error: instancesError } = await supabase
          .from("north_clinic_config_instancias")
          .select("id, nome_exibição, nome_instancia_evolution") // Select only necessary fields
          .eq("id_clinica", clinicDataInFetch.id); // Filter by clinic ID - Use captured clinicData

        if (instancesError) throw instancesError;
        setInstances(instancesData || []);

        // Fetch services directly from Supabase (only needed for general context)
        let servicesData: Service[] = [];
        if (contextParam !== 'cashback' && contextParam !== 'leads') { // Only fetch services if not cashback or leads context
             const { data: fetchedServicesData, error: servicesError } = await supabase
               .from("north_clinic_servicos")
               .select("id, nome") // Select only necessary fields
               .eq("id_clinica", clinicDataInFetch.id) // Filter by clinic ID - Use captured clinicData
               .order("nome", { ascending: true }); // <-- Line 275:17 is here

             if (servicesError) throw servicesError;
             servicesData = fetchedServicesData || [];
        }
        setServices(servicesData);


        if (isEditing && messageIdToEdit !== null) {
          // Fetch message details and linked services from Supabase
          const { data: messageDataArray, error: messageError } = await supabase
            .from('north_clinic_config_mensagens')
            .select('*, north_clinic_mensagens_servicos(id_servico)') // Select message fields and join linked service IDs
            .eq('id', messageIdToEdit) // Filter by message ID
            .eq('id_clinica', clinicDataInFetch.id) // Filter by clinic ID - Use captured clinicData
            .single(); // Expecting a single message

          if (messageError && messageError.code !== 'PGRST116') { // PGRST116 is "No rows found"
              throw messageError;
          }

          if (messageDataArray) {
            const messageData: FetchedMessageData = messageDataArray; // Cast to the defined structure

            // Extract linked service IDs from the nested array (only relevant for general context)
            const fetchedLinkedServices = messageData.context === 'clientes' // Only for 'clientes' context
                ? messageData.north_clinic_mensagens_servicos
                    .map(link => link.id_servico)
                    .filter((id): id is number => id !== null) // Ensure IDs are numbers and not null
                : []; // Empty array if other context

            console.log("Fetched message data from Supabase:", messageData);
            console.log("Extracted linkedServices from Supabase:", fetchedLinkedServices);


            setMessageId(messageData.id);
            setCategory(messageData.categoria || ""); // Handle null category
            setInstanceId(messageData.id_instancia);
            setMessageText(messageData.modelo_mensagem);
            setActive(messageData.ativo ?? true);
            setLinkedServices(fetchedLinkedServices); // Set the extracted linked services
            setMessageContext(messageData.context); // Set context from fetched data

            // --- FIX: Format hora_envio to HH:mm ---
            const fetchedScheduledTime = messageData.hora_envio;
            let formattedScheduledTime = "";
            if (fetchedScheduledTime) {
                try {
                    // Assuming format is HH:mm:ss or HH:mm
                    const parts = fetchedScheduledTime.split(':');
                    if (parts.length >= 2) {
                        formattedScheduledTime = `${parts[0]}:${parts[1]}`;
                    } else {
                         console.warn("Unexpected hora_envio format:", fetchedScheduledTime);
                         formattedScheduledTime = fetchedScheduledTime; // Use as is if unexpected
                    }
                } catch (e) {
                    console.error("Error formatting hora_envio:", fetchedScheduledTime, e);
                    formattedScheduledTime = fetchedScheduledTime; // Use as is on error
                }
            }
            setScheduledTime(formattedScheduledTime); // Set the formatted time
            // --- END FIX ---


            setSelectedGroup(messageData.grupo ?? null);
            setMediaSavedUrl(messageData.url_arquivo ?? null);
            // Removed variations state setting
            setTargetType(
              messageData.para_cliente ? "Cliente" : messageData.para_funcionario ? "Funcionário" : "Grupo"
            );

            // Set cashback timing state (using correct column names)
            setDiasMensagemCashback(messageData.dias_mensagem_cashback?.toString() || '');
            setTipoMensagemCashback(messageData.tipo_mensagem_cashback || '');

            // Set Leads context state (assuming columns exist)
            if (messageData.context === 'leads') {
                 setSelectedFunnelId(messageData.id_funil ?? null);
                 setSelectedStageId(messageData.id_etapa ?? null);
            }

            // NEW: Set sending order state
            setSendingOrder(messageData.sending_order || 'both');


          } else {
              // Message not found for this clinic/ID
              setError("Mensagem não encontrada ou você não tem permissão para editá-la.");
              setMessageId(null); // Ensure messageId is null if not found
              // If message not found, but context was in URL, keep the context
              if (contextParam) {
                  setMessageContext(contextParam);
              } else {
                  setMessageContext(null); // Clear context if not found and not in URL
              }
          }

        } else {
          // New message defaults
          setMessageId(null);
          // Category might be pre-filled by context later if needed
          setCategory("");
          setInstanceId(null);
          setMessageText("");
          setActive(true); // New messages start active
          setLinkedServices([]);
          setScheduledTime("");
          setSelectedGroup(null);
          setMediaSavedUrl(null);
          // Removed variations default state
          // Default target type based on context
          setTargetType(contextParam === 'cashback' ? 'Cliente' : contextParam === 'leads' ? 'Cliente' : 'Grupo'); // Default to Cliente for leads

          // Default cashback timing
          setDiasMensagemCashback('');
          setTipoMensagemCashback('');

          // Default Leads context state
          setSelectedFunnelId(null);
          setSelectedStageId(null);

          // NEW: Default sending order
          setSendingOrder('both');

          // Context is already set from URL parameter above
        }
      } catch (e: any) {
        console.error("Error fetching initial data:", e);
        setError(e.message || "Erro ao carregar dados iniciais");
        setMessageContext(contextParam); // Ensure context is kept on error if present in URL
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clinicData?.id, location.search]); // Depend on clinicData.id and location.search to re-fetch on URL changes

  // Log the messageContext state whenever it changes
  useEffect(() => {
      console.log("MensagensConfigPage: messageContext state changed to:", messageContext);
  }, [messageContext]);

  // Effect to reset stage when funnel changes
  useEffect(() => {
      console.log("MensagensConfigPage: selectedFunnelId changed. Resetting selectedStageId.");
      setSelectedStageId(null);
  }, [selectedFunnelId]);


  // Load groups when instance or targetType changes and targetType is 'Grupo'
  useEffect(() => {
    async function fetchGroups() {
      const currentClinicId = clinicData?.id; // Capture clinicId
      if (!instanceId || targetType !== "Grupo" || !currentClinicId) { // Add clinicId check
        setGroups([]);
        setSelectedGroup(null);
        return;
      }
      try {
        const instance = instances.find((i) => i.id === instanceId);
        if (!instance?.nome_instancia_evolution) {
          setGroups([]);
          setSelectedGroup(null);
          return;
        }
        // Fetch groups using the webhook (assuming this webhook is correct for groups)
        const res = await fetch(
          `https://n8n-n8n.sbw0pc.easypanel.host/webhook/29203acf-7751-4b18-8d69-d4bdb380810e`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome_instancia_evolution: instance.nome_instancia_evolution }),
          }
        );
        if (!res.ok) throw new Error("Falha ao carregar grupos");
        const groupsData: Group[] = await res.json();
        setGroups(groupsData);
        // If current selectedGroup is not in new groups, reset
        if (selectedGroup !== null && !groupsData.find((g) => g.id_grupo === selectedGroup)) {
          setSelectedGroup(null);
        }
      } catch(e: any) {
        console.error("Error fetching groups:", e);
        setGroups([]);
        setSelectedGroup(null);
        // Optionally set an error state specific to groups if needed
      }
    }
    fetchGroups();
  }, [instanceId, targetType, instances, clinicData?.id]); // Depend on instanceId, targetType, instances, and clinicData.id

  // Handle media file selection and preview
  useEffect(() => {
    if (!mediaFile) {
      setMediaPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(mediaFile);
    setMediaPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [mediaFile]);

  // Emoji picker integration
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const toggleEmojiPicker = () => setShowEmojiPicker((v) => !v);
  const onEmojiSelect = (event: CustomEvent) => {
    const emoji = event.detail.unicode;
    console.log("MensagensConfigPage: Emoji selected:", emoji); // Log selected emoji
    if (messageTextRef.current) {
      const el = messageTextRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = messageText; // Use state value
      const newText = text.slice(0, start) + emoji + text.slice(end);

      setMessageText(newText); // Update state
      // Restore cursor position after state update (requires a slight delay or nextTick)
      // A common pattern is to manage cursor position in state, but for simplicity,
      // we can try setting it directly after the state update, though it might not be perfect.
      // Let's try setting it directly first.
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus(); // Keep focus on the textarea
    }
    // Keep picker open for multiple selections
    // setShowEmojiPicker(false);
  };

  // Attach emoji picker event listener
  useEffect(() => {
    const picker = emojiPickerRef.current;
    console.log("MensagensConfigPage: Emoji picker useEffect triggered. Picker:", picker); // Debug log
    if (!picker) {
        console.log("MensagensConfigPage: Emoji picker element not found yet."); // Debug log
        return;
    }

    console.log("MensagensConfigPage: Waiting for emoji-picker custom element definition."); // Debug log
    customElements.whenDefined('emoji-picker').then(() => {
        console.log("MensagensConfigPage: Emoji picker custom element defined. Attaching listener directly."); // Debug log
        picker.addEventListener("emoji-click", onEmojiSelect as EventListener);
    }).catch(err => {
        console.error("MensagensConfigPage: Error waiting for emoji-picker definition:", err); // Debug log
    });


    return () => {
      console.log("MensagensConfigPage: Removing emoji-click listener."); // Debug log
      if (picker) {
        picker.removeEventListener("emoji-click", onEmojiSelect as EventListener);
      }
    };
  }, [emojiPickerRef.current]); // Removed messageText from dependencies


  // Handle form submission
  const handleSave = async () => {
    // Capture clinicCode and clinicId at the start
    const currentClinicCode = clinicData?.code;
    const currentClinicId = clinicData?.id;

    if (!currentClinicCode || !currentClinicId) {
      toast({
        title: "Erro",
        description: "Dados da clínica não disponíveis.",
        variant: "destructive",
      });
      return;
    }

    if (!instanceId) {
      toast({
        title: "Erro",
        description: "Selecione uma instância.",
        variant: "destructive",
      });
      return;
    }
    if (!messageText.trim()) {
      toast({
        title: "Erro",
        description: "Digite o texto da mensagem.",
        variant: "destructive",
      });
      return;
    }

    // Validation specific to General context
    if (isGeneralContext) {
        if (!category) { // Category is required for General context
          toast({
            title: "Erro",
            description: "Selecione uma categoria.",
            variant: "destructive",
          });
          return;
        }
        if (
          category !== "Aniversário" &&
          linkedServices.length === 0 &&
          category !== "Chegou" &&
          category !== "Liberado"
        ) {
          toast({
            title: "Erro",
            description: "Selecione pelo menos um serviço vinculado.",
            variant: "destructive",
          });
          return;
        }
        if (
          (category === "Confirmar Agendamento" || category === "Aniversário") &&
          !scheduledTime
        ) {
          toast({
            title: "Erro",
            description: "Selecione a hora programada.",
            variant: "destructive",
          });
          return;
        }
        if (
          (category === "Chegou" || category === "Liberado") &&
          targetType === "Grupo" &&
          !selectedGroup
        ) {
          toast({
            title: "Erro",
            description: "Selecione o grupo alvo.",
            variant: "destructive",
          });
          return;
        }
    }

    // Validation specific to Cashback context
    if (isCashbackContext) {
        const offsetNum = parseInt(diasMensagemCashback, 10); // Use correct state name
        if (diasMensagemCashback.trim() === '' || isNaN(offsetNum) || offsetNum < 0) {
             toast({
                 title: "Erro",
                 description: "Informe um número válido de dias (>= 0).",
                 variant: "destructive",
             });
             return;
        }
        if (!tipoMensagemCashback) { // Use correct state name
             toast({
                 title: "Erro",
                 description: "Selecione o tipo de agendamento (Após Venda ou Antes da Validade).",
                 variant: "destructive",
             });
             return;
        }
         // scheduledTime might still be relevant for time of day, so validate if needed
         if (showScheduledTimeCashback && !scheduledTime) { // Use correct conditional
              toast({
                 title: "Erro",
                 description: "Selecione a hora programada.",
                 variant: "destructive",
             });
             return;
         }
    }

    // Validation specific to Leads context
    if (isLeadsContext) {
        if (selectedFunnelId === null) {
             toast({
                 title: "Erro",
                 description: "Selecione um Funil.",
                 variant: "destructive",
             });
             return;
        }
         if (selectedStageId === null) {
             toast({
                 title: "Erro",
                 description: "Selecione uma Etapa.",
                 variant: "destructive",
             });
             return;
         }
         // For leads, targetType is always Cliente and group/services are not used, no need to validate them
         // scheduledTime might still be relevant for time of day, so validate if needed
         if (showScheduledTimeLeads && !scheduledTime) { // Use correct conditional
              toast({
                 title: "Erro",
                 description: "Selecione a hora programada.",
                 variant: "destructive",
             });
             return;
         }
    }


    if (!messageContext) { // Validate that context is set (should be set from URL or fetched)
         toast({
             title: "Erro",
             description: "Contexto da mensagem não definido.",
             variant: "destructive",
         });
         return;
    }

    // NEW: Validate sending order if media is attached
    if ((mediaFile || mediaSavedUrl) && sendingOrder === 'none') {
         toast({
             title: "Erro",
             description: "Selecione a ordem de envio para a mensagem com anexo.",
             variant: "destructive",
         });
         return;
    }


    setSaving(true);
    setError(null);

    try {
      // Upload media if new file selected
      let url_arquivo = mediaSavedUrl;
      if (mediaFile) {
        const formData = new FormData();
        formData.append("data", mediaFile, mediaFile.name);
        formData.append("fileName", mediaFile.name);
        formData.append("clinicId", currentClinicCode); // Use captured clinic code for upload webhook
        const uploadRes = await fetch(
          "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase",
          {
            method: "POST",
            body: formData,
          }
        );
        if (!uploadRes.ok) {
          throw new Error("Falha ao enviar mídia");
        }
        const uploadData = await uploadRes.json();
        url_arquivo =
          (Array.isArray(uploadData) && uploadData[0]?.Key) ||
          uploadData.Key ||
          uploadData.key ||
          null;
      }

      // Prepare data for save webhook
      const saveData: any = { // Use any for now to easily add conditional fields
        id_clinica: currentClinicCode, // Use captured clinic code for save webhook
        id: messageId, // null for new, number for edit
        categoria: category || null, // Send category, allow null
        id_instancia: instanceId,
        modelo_mensagem: messageText,
        ativo: active, // Keep active status editable
        hora_envio: scheduledTime || null,
        url_arquivo: url_arquivo || null,
        prioridade: 1, // Default priority for now, can be added later
        context: messageContext, // Include context in save data
        // Removed variations from save data

        // Default values for fields not used in the current context
        servicos_vinculados: [],
        para_cliente: false,
        para_funcionario: false,
        para_grupo: false,
        grupo: null,
        dias_mensagem_cashback: null,
        tipo_mensagem_cashback: null,
        id_funil: null, // Default to null
        id_etapa: null, // Default to null
        sending_order: sendingOrder, // <-- Include sending order
      };

      // Add context-specific fields
      if (isGeneralContext) {
          saveData.servicos_vinculados = linkedServices; // Send the array of IDs
          saveData.para_cliente = targetType === "Cliente";
          saveData.para_funcionario = targetType === "Funcionário";
          saveData.para_grupo = targetType === "Grupo"; // Corrected logic
          saveData.grupo = selectedGroup || null;
          // Ensure cashback and leads fields are null for general messages
          saveData.dias_mensagem_cashback = null;
          saveData.tipo_mensagem_cashback = null;
          saveData.id_funil = null;
          saveData.id_etapa = null;
      } else if (isCashbackContext) {
          saveData.dias_mensagem_cashback = parseInt(diasMensagemCashback, 10); // Use correct state name
          saveData.tipo_mensagem_cashback = tipoMensagemCashback; // Use correct state name
          saveData.para_cliente = true; // Always send to client for cashback
          saveData.para_funcionario = false;
          saveData.para_grupo = false;
          saveData.grupo = null; // Group is not used for cashback
          saveData.servicos_vinculados = []; // Services are not linked for cashback
          // Ensure leads fields are null for cashback messages
          saveData.id_funil = null;
          saveData.id_etapa = null;
      } else if (isLeadsContext) { // Add Leads context fields
          saveData.id_funil = selectedFunnelId;
          saveData.id_etapa = selectedStageId;
          saveData.para_cliente = true; // Assuming leads messages are always to clients
          saveData.para_funcionario = false;
          saveData.para_grupo = false;
          saveData.grupo = null; // Group is not used for leads
          saveData.servicos_vinculados = []; // Services are not linked for leads
          // Ensure cashback fields are null for leads messages
          saveData.dias_mensagem_cashback = null;
          saveData.tipo_mensagem_cashback = null;
          // Category is not used for leads context, send null or default if needed by backend
          saveData.categoria = null; // Or a default like "Lead" if backend requires non-null
      }


      const saveUrl = messageId
        ? "https://n8n-n8n.sbw0pc.easypanel.host/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4" // Update webhook
        : "https://n8n-n8n.sbw0pc.easypanel.host/webhook/542ce8db-6b1d-40f5-b58b-23c9154c424d"; // Create webhook

      const saveRes = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, // Send as JSON
        body: JSON.stringify(saveData),
      });

      // Check response status AND body for errors
      const responseData: WebhookResponse = await saveRes.json(); // Always read the JSON response

      if (!saveRes.ok || responseData.error || (responseData.success === false)) {
          // If HTTP status is not OK, OR if the JSON body contains an error/success: false
          const errorMessage = responseData.error || responseData.message || `Erro desconhecido (Status: ${saveRes.status})`;
          console.error("Webhook save error:", responseData); // Log the full response data
          throw new Error(errorMessage);
      }
      // --- END MODIFIED ---


      toast({
        title: "Sucesso",
        description: "Mensagem salva com sucesso.",
      });

      // Redirect or reset form after save
      setTimeout(() => {
        // Redirect back to the correct list page based on context
        let redirectPath = '/dashboard'; // Default fallback
        if (messageContext === 'clientes') redirectPath = '/dashboard/11';
        else if (messageContext === 'cashback') redirectPath = '/dashboard/14/messages';
        else if (messageContext === 'leads') redirectPath = '/dashboard/9'; // Redirect to Leads Messages page

        window.location.href = `${redirectPath}?clinic_code=${encodeURIComponent(
          currentClinicCode
        )}&status=${messageId ? "updated" : "created"}`;
      }, 1500);
    } catch (e: any) {
      console.error("Error saving message:", e);
      setError(e.message || "Erro ao salvar mensagem");
      toast({
        title: "Erro",
        description: e.message || "Erro ao salvar mensagem",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handlers for form fields
  const handleCategoryChange = (value: string) => {
    setCategory(value);
    // Apply default template based on context and category
    if (messageId === null) { // Only apply default template when creating
        if (isGeneralContext) {
            setMessageText(defaultTemplates[value] || "");
        } else if (isCashbackContext) {
             setMessageText(defaultTemplates[value] || ""); // Use cashback templates if available
        }
        // No default template logic for Leads context based on category
    }
  };

  // Show/hide fields based on context and category
  // isGeneralContext and isCashbackContext are defined above
  const showCategoryGeneral = isGeneralContext;
  const showTargetTypeSelectGeneral = isGeneralContext && (category === "Chegou" || category === "Liberado");
  const showGroupSelectGeneral = isGeneralContext && (category === "Chegou" || category === "Liberado") && targetType === "Grupo";
  const showServicesLinkedGeneral = isGeneralContext && category !== "Aniversário" && category !== "Chegou" && category !== "Liberado";
  const showScheduledTimeGeneral = isGeneralContext && (category === "Confirmar Agendamento" || category === "Aniversário");

  // Cashback context fields visibility
  const showCashbackTiming = isCashbackContext;
  const showScheduledTimeCashback = isCashbackContext; // Show scheduled time for all cashback messages

  // Leads context fields visibility
  const showFunnelStageSelectLeads = isLeadsContext;
  // Corrected condition: Hora Programada is NOT shown for Leads context
  const showScheduledTimeLeads = false; // Always false for Leads context

  // Show sending order field only if there is a media file attached or saved
  const showSendingOrder = !!mediaFile || !!mediaSavedUrl;


  // Removed variations count

  // Handle variation change - Removed function

  // Cancel action: redirect back to list
  const handleCancel = () => {
    if (!clinicData?.code) return;
    // Redirect back to the correct list page based on context
    let redirectPath = '/dashboard'; // Default fallback
    if (messageContext === 'clientes') redirectPath = '/dashboard/11';
    else if (messageContext === 'cashback') redirectPath = '/dashboard/14/messages';
    else if (messageContext === 'leads') redirectPath = '/dashboard/9'; // Redirect to Leads Messages page

    window.location.href = `${redirectPath}?clinic_code=${encodeURIComponent(
      clinicData.code
    )}`;
  };

  // Determine page title based on context and whether editing or creating
  const pageTitle = messageId
    ? `Editar Mensagem (${messageContext === 'clientes' ? 'Clientes' : messageContext === 'cashback' ? 'Cashback' : messageContext === 'leads' ? 'Leads' : 'Geral'})`
    : `Configurar Nova Mensagem (${messageContext === 'clientes' ? 'Clientes' : messageContext === 'cashback' ? 'Cashback' : messageContext === 'leads' ? 'Leads' : 'Geral'})`;

  // Determine if data is ready to render the form (include funnel/stage loading for leads context)
  const isDataReady = !loading && !error &&
                      (!isLeadsContext || (!isLoadingFunnels && !funnelsError && !isLoadingStages && !stagesError));


  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-6 overflow-auto">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {loading || (isLeadsContext && (isLoadingFunnels || isLoadingStages)) ? ( // Show loading if initial load or funnel/stage data is loading for leads context
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="animate-spin" />
              Carregando dados...
            </div>
          ) : error || (isLeadsContext && (funnelsError || stagesError)) ? ( // Show error if initial load error or funnel/stage error for leads context
            <div className="text-red-600 font-semibold flex items-center gap-2">
                <TriangleAlert className="h-5 w-5" />
                {error || funnelsError?.message || stagesError?.message || "Erro ao carregar dados."}
            </div>
          ) : (
            <>
              {/* Category field (Conditional based on context) */}
              {/* Only show Category for General context */}
              {showCategoryGeneral && (
                  <div>
                    <label
                      htmlFor="category"
                      className="block mb-1 font-medium text-gray-700"
                    >
                      Categoria *
                    </label>
                    <Select
                      value={category}
                      onValueChange={handleCategoryChange}
                      id="category"
                      disabled={messageId !== null} // Disable category change when editing
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Filter categories based on context */}
                        {orderedCategoriesGeneral.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                     {messageId !== null && (
                         <p className="text-sm text-gray-500 mt-1">A categoria não pode ser alterada após a criação.</p>
                     )}
                  </div>
              )}

              {/* Funnel and Stage fields (only for Leads context) */}
              {showFunnelStageSelectLeads && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label
                            htmlFor="funnel"
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Funil *
                          </label>
                          <Select
                            value={selectedFunnelId?.toString() || ''}
                            onValueChange={(value) => setSelectedFunnelId(value ? parseInt(value, 10) : null)}
                            id="funnel"
                            disabled={isLoadingFunnels || !!funnelsError}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o funil" />
                            </SelectTrigger>
                            <SelectContent>
                              {allFunnels?.map(funnel => (
                                  <SelectItem key={funnel.id} value={funnel.id.toString()}>{funnel.nome_funil}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                           {funnelsError && <p className="text-sm text-red-600 mt-1">Erro ao carregar funis.</p>}
                      </div>
                      <div>
                          <label
                            htmlFor="stage"
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Etapa *
                          </label>
                          <Select
                            value={selectedStageId?.toString() || ''}
                            onValueChange={(value) => setSelectedStageId(value ? parseInt(value, 10) : null)}
                            id="stage"
                            disabled={selectedFunnelId === null || isLoadingStages || !!stagesError || (stagesForSelectedFunnel?.length ?? 0) === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a etapa" />
                            </SelectTrigger>
                            <SelectContent>
                               {(stagesForSelectedFunnel?.length ?? 0) === 0 && !isLoadingStages && !stagesError ? (
                                   <SelectItem value="none" disabled>Nenhuma etapa disponível</SelectItem>
                               ) : (
                                   stagesForSelectedFunnel?.map(stage => (
                                       <SelectItem key={stage.id} value={stage.id.toString()}>{stage.nome_etapa}</SelectItem>
                                   ))
                               )}
                            </SelectContent>
                          </Select>
                           {stagesError && <p className="text-sm text-red-600 mt-1">Erro ao carregar etapas.</p>}
                           {selectedFunnelId !== null && (stagesForSelectedFunnel?.length ?? 0) === 0 && !isLoadingStages && !stagesError && (
                                <p className="text-sm text-orange-600 mt-1">Nenhuma etapa encontrada para este funil.</p>
                           )}
                      </div>
                  </div>
              )}


              <div>
                <label
                  htmlFor="instance"
                  className="block mb-1 font-medium text-gray-700"
                >
                  Instância (Número Enviador) *
                </label>
                <Select
                  value={instanceId?.toString() || ""}
                  onValueChange={(v) => setInstanceId(v ? parseInt(v, 10) : null)}
                  id="instance"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id.toString()}>
                        {inst.nome_exibição}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Type field (only for General context) */}
              {showTargetTypeSelectGeneral && (
                <div>
                  <label
                    htmlFor="targetType"
                    className="block mb-1 font-medium text-gray-700"
                  >
                    Enviar Para *
                  </label>
                  <Select
                    value={targetType}
                    onValueChange={(v) =>
                      setTargetType(v as "Grupo" | "Cliente" | "Funcionário")
                    }
                    id="targetType"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Grupo">Grupo do WhatsApp</SelectItem>
                      <SelectItem value="Cliente">Cliente (Mensagem Direta)</SelectItem>
                      <SelectItem value="Funcionário">Funcionário (Mensagem Direta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Group Select field (only for General context, when target is Grupo) */}
              {showGroupSelectGeneral && (
                <div>
                  <label
                    htmlFor="group"
                    className="block mb-1 font-medium text-gray-700"
                  >
                    Grupo Alvo *
                  </label>
                  <Select
                    value={selectedGroup?.toString() || ""}
                    onValueChange={(v) =>
                      setSelectedGroup(v ? parseInt(v, 10) : null)
                    }
                    id="group"
                    disabled={groups.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id_grupo} value={g.id_grupo.toString()}>
                          {g.nome_grupo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Scheduled Time field (for specific categories in General, or maybe Aniversário in Cashback) */}
              {(showScheduledTimeGeneral || showScheduledTimeCashback) && ( // Show only for General and Cashback contexts
                <div>
                  <label
                    htmlFor="scheduledTime"
                    className="block mb-1 font-medium text-gray-700"
                  >
                    Hora Programada *
                  </label>
                  <Select
                    value={scheduledTime}
                    onValueChange={setScheduledTime}
                    id="scheduledTime"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "08:00",
                        "09:00",
                        "10:00",
                        "11:00",
                        "12:00",
                        "13:00",
                        "14:00",
                        "15:00",
                        "16:00",
                        "17:00",
                      ].map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Cashback Timing fields (only for Cashback context) */}
              {showCashbackTiming && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label
                            htmlFor="diasMensagemCashback"
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Dias *
                          </label>
                          <Input
                              id="diasMensagemCashback"
                              type="number"
                              placeholder="Ex: 3"
                              value={diasMensagemCashback}
                              onChange={(e) => setDiasMensagemCashback(e.target.value)}
                              min="0"
                          />
                          <p className="text-sm text-gray-500 mt-1">Número de dias para o agendamento.</p>
                      </div>
                      <div>
                          <Label
                            htmlFor="tipoMensagemCashback"
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Agendar Para *
                          </Label>
                          <RadioGroup
                              value={tipoMensagemCashback}
                              onValueChange={setTipoMensagemCashback}
                              id="tipoMensagemCashback"
                              className="flex flex-col space-y-1"
                          >
                              <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="apos_venda" id="apos_venda" />
                                  <Label htmlFor="apos_venda">Dias após a venda</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="antes_validade" id="antes_validade" />
                                  <Label htmlFor="antes_validade">Dias antes da validade do cashback</Label>
                              </div>
                          </RadioGroup>
                          <p className="text-sm text-gray-500 mt-1">Referência para o cálculo da data de envio.</p>
                      </div>
                  </div>
              )}


              <div>
                <label
                  htmlFor="messageText"
                  className="block mb-1 font-medium text-gray-700"
                >
                  Texto da Mensagem Principal *
                </label>
                <div className="relative">
                  <Textarea
                    id="messageText"
                    rows={6}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    ref={messageTextRef}
                    placeholder="Digite a mensagem principal. Use {variaveis}, *para negrito*, _para itálico_..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={toggleEmojiPicker}
                    type="button"
                    aria-label="Inserir emoji"
                  >
                    <Smile />
                  </Button>
                  {/* Render emoji picker always, but control visibility with 'hidden' */}
                  <div className="absolute z-50 top-full right-0 mt-1" hidden={!showEmojiPicker}>
                      <emoji-picker
                        ref={emojiPickerRef}
                        style={{ width: "300px", height: "300px" }}
                      />
                    </div>
                </div>
              </div>

              {/* Services Vinculados (only for General context) */}
              {showServicesLinkedGeneral && (
                <div>
                  <label
                    htmlFor="services"
                    className="block mb-1 font-medium text-gray-700"
                  >
                    Serviços Vinculados *
                  </label>
                  <MultiSelectServices
                    options={services}
                    selectedIds={linkedServices}
                    onChange={setLinkedServices}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Quais agendamentos de serviço ativarão esta mensagem.
                  </p>
                </div>
              )}


              <div>
                <label
                  htmlFor="mediaFile"
                  className="block mb-1 font-medium text-gray-700"
                >
                  Anexar Mídia (Opcional)
                </label>
                <Input
                  type="file"
                  id="mediaFile"
                  accept="image/*,video/*,audio/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setMediaFile(e.target.files[0]);
                    } else {
                      setMediaFile(null);
                    }
                  }}
                />
                {mediaPreviewUrl && (
                  <div className="mt-2">
                    {mediaFile?.type.startsWith("image/") && (
                      <img
                        src={mediaPreviewUrl}
                        alt="Preview da mídia"
                        className="max-w-xs rounded"
                      />
                    )}
                    {mediaFile?.type.startsWith("video/") && (
                      <video
                        src={mediaPreviewUrl}
                        controls
                        className="max-w-xs rounded"
                      />
                    )}
                    {mediaFile?.type.startsWith("audio/") && (
                      <audio src={mediaPreviewUrl} controls />
                    )}
                  </div>
                )}
                {!mediaPreviewUrl && mediaSavedUrl && (
                  <p className="text-sm text-gray-600 mt-1">
                    Mídia salva: {mediaSavedUrl}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Imagem (JPG, PNG, GIF, WEBP - máx 5MB), Vídeo (MP4, WEBM, MOV -
                  máx 10MB), Áudio (MP3, OGG, WAV - máx 10MB).
                </p>
              </div>

              {/* NEW: Sending Order field (Conditional) */}
              {showSendingOrder && (
                  <div>
                      <label
                        htmlFor="sendingOrder"
                        className="block mb-1 font-medium text-gray-700"
                      >
                        Ordem de Envio (Texto e Mídia) *
                      </label>
                      <Select
                          value={sendingOrder}
                          onValueChange={setSendingOrder}
                          id="sendingOrder"
                      >
                          <SelectTrigger>
                              <SelectValue placeholder="Selecione a ordem" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="both">Texto e Mídia Juntos</SelectItem>
                              <SelectItem value="text_first">Texto Primeiro, Depois Mídia</SelectItem>
                              <SelectItem value="media_first">Mídia Primeiro, Depois Texto</SelectItem>
                          </SelectContent>
                      </Select>
                       <p className="text-sm text-gray-500 mt-1">Define a ordem em que o texto e o anexo serão enviados.</p>
                  </div>
              )}


              {/* Removed Variations section */}

              {/* Status field (always starts active for new, but editable) */}
              {/* Show Status for General and Leads context */}
              {(isGeneralContext || isLeadsContext) && (
                  <div>
                    <label
                      htmlFor="active"
                      className="block mb-1 font-medium text-gray-700"
                    >
                      Status da Mensagem
                    </label>
                    <Select
                      value={active ? "true" : "false"}
                      onValueChange={(v) => setActive(v === "true")}
                      id="active"
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Ativo (Habilitado)</SelectItem>
                        <SelectItem value="false">Inativo (Desabilitado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
              )}

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving || isLoadingData || !!error || (isLeadsContext && (isLoadingFunnels || !!funnelsError || isLoadingStages || !!stagesError))}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensConfigPage;