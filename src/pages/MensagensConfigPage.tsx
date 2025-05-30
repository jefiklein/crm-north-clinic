"use client";

import React, { useEffect, useState, useRef, useMemo } from "react"; 
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
  id_grupo: string; 
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
  grupo: string | null; 
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
  timing_type?: string | null; 
  delay_value?: number | null; 
  delay_unit?: string | null; 
  sending_order: string | null; 
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
  const [active, setActive] = useState<boolean>(true); 
  const [services, setServices] = useState<Service[]>([]);
  const [linkedServices, setLinkedServices] = useState<number[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null); 
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [targetType, setTargetType] = useState<"Grupo" | "Cliente" | "Funcionário">(
    "Grupo"
  );
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaSavedUrl, setMediaSavedUrl] = useState<string | null>(null);
  const [messageContext, setMessageContext] = useState<string | null>(null); 

  // State for cashback timing 
  const [diasMensagemCashback, setDiasMensagemCashback] = useState<string>(''); 
  const [tipoMensagemCashback, setTipoMensagemCashback] = useState<string>(''); 

  // State for Leads context - Funnel and Stage
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  // NEW: State for timing configuration for Leads context
  const [timingType, setTimingType] = useState<string>('immediate'); 
  const [delayValue, setDelayValue] = useState<string>(''); 
  const [delayUnit, setDelayUnit] = useState<string>('hours'); 


  // NEW: State for sending order
  const [sendingOrder, setSendingOrder] = useState<string>('both'); 


  // Emoji picker ref
  const emojiPickerRef = useRef<HTMLElement | null>(null);
  const messageTextRef = useRef<HTMLTextAreaElement | null>(null);

  // Determine context based on URL parameter
  const urlParams = new URLSearchParams(location.search); 
  const contextParam = urlParams.get("context");
  const isGeneralContext = messageContext === 'clientes'; 
  const isCashbackContext = messageContext === 'cashback';
  const isLeadsContext = messageContext === 'leads';


  // Fetch All Funnels (for Leads context filter)
  const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
      queryKey: ['allFunnelsConfigPage', clinicData?.id],
      queryFn: async () => {
          const currentClinicId = clinicData?.id; 
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
      enabled: !!clinicData?.id && isLeadsContext, 
      staleTime: 5 * 60 * 1000, 
      refetchOnWindowFocus: false,
  });

  // Fetch Stages for the selected funnel (for Leads context filter)
  const { data: stagesForSelectedFunnel, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
      queryKey: ['stagesForFunnelConfigPage', clinicData?.id, selectedFunnelId],
      queryFn: async () => {
          const currentClinicId = clinicData?.id; 
          if (!currentClinicId || selectedFunnelId === null) return [];
          console.log(`[MensagensConfigPage] Fetching stages for funnel ${selectedFunnelId} from Supabase...`);
          const { data, error } = await supabase
              .from('north_clinic_crm_etapa')
              .select('id, nome_etapa, id_funil, ordem') 
              .eq('id_funil', selectedFunnelId)
              .order('ordem', { ascending: true }); 
          if (error) {
              console.error("[MensagensConfigPage] Supabase stages fetch error:", error);
              throw new Error(`Erro ao buscar etapas: ${error.message}`);
          }
          return data || [];
      },
      enabled: !!clinicData?.id && isLeadsContext && selectedFunnelId !== null, 
      staleTime: 5 * 60 * 1000, 
      refetchOnWindowFocus: false,
  });


  // Load initial data: instances, services, message details if editing
  useEffect(() => {
    const currentClinicData = clinicData;

    if (!currentClinicData?.id) { 
      setError("ID da clínica não disponível.");
      setLoading(false);
      return;
    }

    const idParam = urlParams.get("id");
    const isEditing = !!idParam;
    const messageIdToEdit = idParam ? parseInt(idParam, 10) : null;

    async function fetchData() {
      const clinicDataInFetch = currentClinicData;
      if (!clinicDataInFetch?.id) { 
           console.error("[MensagensConfigPage] fetchData: clinicDataInFetch is null or undefined.");
           setError("ID da clínica não disponível.");
           setLoading(false);
           return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data: instancesData, error: instancesError } = await supabase
          .from("north_clinic_config_instancias")
          .select("id, nome_exibição, nome_instancia_evolution") 
          .eq("id_clinica", clinicDataInFetch.id); 

        if (instancesError) throw instancesError;
        setInstances(instancesData || []);

        let servicesData: Service[] = [];
        if (contextParam !== 'cashback' && contextParam !== 'leads') { 
             const { data: fetchedServicesData, error: servicesError } = await supabase
               .from("north_clinic_servicos")
               .select("id, nome") 
               .eq("id_clinica", clinicDataInFetch.id) 
               .order("nome", { ascending: true });

             if (servicesError) throw servicesError;
             servicesData = fetchedServicesData || [];
        }
        setServices(servicesData);

        if (isEditing && messageIdToEdit !== null) {
          const { data: messageDataArray, error: messageError } = await supabase
            .from('north_clinic_config_mensagens')
            .select('*, north_clinic_mensagens_servicos(id_servico)') 
            .eq('id', messageIdToEdit) 
            .eq('id_clinica', clinicDataInFetch.id) 
            .single(); 

          if (messageError && messageError.code !== 'PGRST116') { 
              throw messageError;
          }

          if (messageDataArray) {
            const messageData: FetchedMessageData = messageDataArray; 

            const fetchedLinkedServices = messageData.context === 'clientes' 
                ? messageData.north_clinic_mensagens_servicos
                    .map(link => link.id_servico)
                    .filter((id): id is number => id !== null) 
                : []; 

            console.log("[MensagensConfigPage] Fetched message data from Supabase:", messageData);
            console.log("[MensagensConfigPage] Extracted linkedServices from Supabase:", fetchedLinkedServices);

            setMessageId(messageData.id);
            setCategory(messageData.categoria || ""); 
            setInstanceId(messageData.id_instancia);
            setMessageText(messageData.modelo_mensagem);
            setActive(messageData.ativo ?? true);
            setLinkedServices(fetchedLinkedServices); 
            setMessageContext(messageData.context); 

            const fetchedScheduledTime = messageData.hora_envio;
            let formattedScheduledTime = "";
            if (fetchedScheduledTime) {
                try {
                    const parts = fetchedScheduledTime.split(':');
                    if (parts.length >= 2) {
                        formattedScheduledTime = `${parts[0]}:${parts[1]}`;
                    } else {
                         console.warn("[MensagensConfigPage] Unexpected hora_envio format:", fetchedScheduledTime);
                         formattedScheduledTime = fetchedScheduledTime; 
                    }
                } catch (e) {
                    console.error("[MensagensConfigPage] Error formatting hora_envio:", fetchedScheduledTime, e);
                    formattedScheduledTime = fetchedScheduledTime; 
                }
            }
            setScheduledTime(formattedScheduledTime); 

            setSelectedGroup(messageData.grupo ?? null); 
            setMediaSavedUrl(messageData.url_arquivo ?? null);

            setTargetType(
              messageData.para_cliente ? "Cliente" : messageData.para_funcionario ? "Funcionário" : "Grupo"
            );

            setDiasMensagemCashback(messageData.dias_mensagem_cashback?.toString() || '');
            setTipoMensagemCashback(messageData.tipo_mensagem_cashback || '');

            if (messageData.context === 'leads') {
                 setSelectedFunnelId(messageData.id_funil ?? null);
                 setSelectedStageId(messageData.id_etapa ?? null);
                 setTimingType(messageData.timing_type || 'immediate');
                 setDelayValue(messageData.delay_value?.toString() || '');
                 setDelayUnit(messageData.delay_unit || 'hours');
            }

            setSendingOrder(messageData.sending_order || 'both');

          } else {
              setError("Mensagem não encontrada ou você não tem permissão para editá-la.");
              setMessageId(null); 
              if (contextParam) {
                  setMessageContext(contextParam);
              } else {
                  setMessageContext(null); 
              }
          }

        } else {
          setMessageId(null);
          setCategory("");
          setInstanceId(null);
          setMessageText("");
          setActive(true); 
          setLinkedServices([]);
          setScheduledTime("");
          setSelectedGroup(null); 
          setMediaSavedUrl(null);

          setTargetType(contextParam === 'cashback' ? 'Cliente' : contextParam === 'leads' ? 'Cliente' : 'Grupo'); 

          setDiasMensagemCashback('');
          setTipoMensagemCashback('');

          setSelectedFunnelId(urlParams.get('funnelId') ? parseInt(urlParams.get('funnelId')!, 10) : null); 
          setSelectedStageId(urlParams.get('stageId') ? parseInt(urlParams.get('stageId')!, 10) : null); 

          setTimingType('immediate');
          setDelayValue('');
          setDelayUnit('hours');

          setSendingOrder('both');

          if (contextParam) {
              setMessageContext(contextParam);
          } else {
              setMessageContext(null); 
          }
        }
      } catch (e: any) {
        console.error("[MensagensConfigPage] Error fetching initial data:", e);
        setError(e.message || "Erro ao carregar dados iniciais");
        if (contextParam) {
            setMessageContext(contextParam);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clinicData?.id, location.search]); 

  useEffect(() => {
      console.log("[MensagensConfigPage] messageContext state changed to:", messageContext);
  }, [messageContext]);

  useEffect(() => {
      console.log("[MensagensConfigPage] selectedFunnelId changed. Resetting selectedStageId.");
      setSelectedStageId(null);
  }, [selectedFunnelId]);


  useEffect(() => {
    async function fetchGroups() {
      const currentClinicId = clinicData?.id; 
      console.log("[MensagensConfigPage] fetchGroups useEffect triggered. instanceId:", instanceId, "targetType:", targetType, "clinicId:", currentClinicId); 
      if (!instanceId || targetType !== "Grupo" || !currentClinicId) { 
        console.log("[MensagensConfigPage] fetchGroups: Conditions not met. Clearing groups."); 
        setGroups([]);
        setSelectedGroup(null); 
        return;
      }
      try {
        const instance = instances.find((i) => i.id === instanceId);
        if (!instance?.nome_instancia_evolution) {
          console.log("[MensagensConfigPage] fetchGroups: Instance not found or missing nome_instancia_evolution. Clearing groups."); 
          setGroups([]);
          setSelectedGroup(null); 
          return;
        }
        console.log(`[MensagensConfigPage] fetchGroups: Fetching groups for instance ${instance.nome_instancia_evolution}...`); 
        const res = await fetch(
          `https://n8n-n8n.sbw0pc.easypanel.host/webhook/29203acf-7751-4b18-8d69-d4bdb380810e`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome_instancia_evolution: instance.nome_instancia_evolution }),
          }
        );
        if (!res.ok) {
            const errorText = await res.text();
            console.error("[MensagensConfigPage] fetchGroups: Webhook failed:", res.status, errorText); 
            throw new Error("Falha ao carregar grupos");
        }
        const groupsData: Group[] = await res.json();
        console.log("[MensagensConfigPage] fetchGroups: Webhook returned groupsData:", groupsData); 
        setGroups(groupsData);
        if (selectedGroup !== null && !groupsData.find((g) => g.id_grupo === selectedGroup)) {
          console.log("[MensagensConfigPage] fetchGroups: Selected group not found in new list. Resetting selectedGroup."); 
          setSelectedGroup(null); 
        }
      } catch(e: any) {
        console.error("[MensagensConfigPage] fetchGroups: Error fetching groups:", e); 
        setGroups([]);
        setSelectedGroup(null); 
      }
    }
    fetchGroups();
  }, [instanceId, targetType, instances, clinicData?.id, selectedGroup]); 

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

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const toggleEmojiPicker = () => setShowEmojiPicker((v) => !v);
  const onEmojiSelect = (event: CustomEvent) => {
    const emoji = event.detail.unicode;
    console.log("MensagensConfigPage: Emoji selected:", emoji); 
    if (messageTextRef.current) {
      const el = messageTextRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = messageText; 
      const newText = text.slice(0, start) + emoji + text.slice(end);

      setMessageText(newText); 

      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus(); 
    }
  };

  useEffect(() => {
    const picker = emojiPickerRef.current;
    console.log("MensagensConfigPage: Emoji picker useEffect triggered. Picker:", picker); 
    if (!picker) {
        console.log("MensagensConfigPage: Emoji picker element not found yet."); 
        return;
    }

    customElements.whenDefined('emoji-picker').then(() => {
        console.log("MensagensConfigPage: Emoji picker custom element defined. Attaching listener directly."); 
        picker.addEventListener("emoji-click", onEmojiSelect as EventListener);
    }).catch(err => {
        console.error("MensagensConfigPage: Error waiting for emoji-picker definition:", err); 
    });


    return () => {
      console.log("MensagensConfigPage: Removing emoji-click listener."); 
      if (picker) {
        picker.removeEventListener("emoji-click", onEmojiSelect as EventListener);
      }
    };
  }, [emojiPickerRef.current]); 


  const handleSave = async () => {
    const currentClinicCode = clinicData?.code; // This is the authentication string
    const currentClinicId = clinicData?.id; // This is the numeric ID

    if (!currentClinicId || !currentClinicCode) { // Use currentClinicId for validation
      toast({
        title: "Erro",
        description: "Dados da clínica não disponíveis.",
      });
      return;
    }

    if (!instanceId) {
      toast({
        title: "Erro",
        description: "Selecione uma instância.",
      });
      return;
    }
    if (!messageText.trim()) {
      toast({
        title: "Erro",
        description: "Digite o texto da mensagem.",
      });
      return;
    }

    if (isGeneralContext) {
        if (!category) { 
          toast({
            title: "Erro",
            description: "Selecione uma categoria.",
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
          });
          return;
        }
        if (
          (category === "Chegou" || category === "Liberado") &&
          targetType === "Grupo" &&
          selectedGroup === null 
        ) {
          toast({
            title: "Erro",
            description: "Selecione o grupo alvo.",
          });
          return;
        }
    }

    if (isCashbackContext) {
        const offsetNum = parseInt(diasMensagemCashback, 10); 
        if (diasMensagemCashback.trim() === '' || isNaN(offsetNum) || offsetNum < 0) {
             toast({
                 title: "Erro",
                 description: "Informe um número válido de dias (>= 0).",
             });
             return;
        }
        if (!tipoMensagemCashback) { 
             toast({
                 title: "Erro",
                 description: "Selecione o tipo de agendamento (Após Venda ou Antes da Validade).",
             });
             return;
        }
         if (showScheduledTimeCashback && !scheduledTime) { 
              toast({
                 title: "Erro",
                 description: "Selecione a hora programada.",
             });
             return;
         }
    }

    if (isLeadsContext) {
        if (selectedFunnelId === null) {
             toast({
                 title: "Erro",
                 description: "Selecione um Funil.",
             });
             return;
        }
         if (selectedStageId === null) {
             toast({
                 title: "Erro",
                 description: "Selecione uma Etapa.",
             });
             return;
         }
         if (!timingType) {
              toast({ title: "Erro", description: "Selecione o tipo de agendamento.", variant: "destructive" });
              return;
         }
         if (timingType === 'delay') {
             const delayNum = parseInt(delayValue, 10);
             if (delayValue.trim() === '' || isNaN(delayNum) || delayNum < 0) {
                  toast({ title: "Erro", description: "Informe um valor de atraso válido (número >= 0).", variant: "destructive" });
                  return;
             }
             if (!delayUnit) {
                  toast({ title: "Erro", description: "Selecione a unidade do atraso (minutos, horas, dias).", variant: "destructive" });
                  return;
             }
         }
    }

    if (!messageContext) { 
         toast({
             title: "Erro",
             description: "Contexto da mensagem não definido.",
         });
         return;
    }

    if ((mediaFile || mediaSavedUrl) && sendingOrder === 'none') {
         toast({
             title: "Erro",
             description: "Selecione a ordem de envio para a mensagem com anexo.",
         });
         return;
    }

    setSaving(true);
    setError(null);

    try {
      let url_arquivo = mediaSavedUrl;
      if (mediaFile) {
        const formData = new FormData();
        formData.append("data", mediaFile, mediaFile.name);
        formData.append("fileName", mediaFile.name);
        formData.append("clinicId", currentClinicId.toString()); // Use currentClinicId (numeric)
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

      const saveData: any = {
        id_clinica: currentClinicId, // Use currentClinicId (numeric)
        id: messageId,
        categoria: category || null,
        id_instancia: instanceId,
        modelo_mensagem: messageText,
        ativo: active,
        hora_envio: scheduledTime || null,
        url_arquivo: url_arquivo || null,
        prioridade: 1,
        context: messageContext,
        servicos_vinculados: [],
        para_cliente: false,
        para_funcionario: false,
        para_grupo: false,
        grupo: null, 
        nome_grupo: null, 
        dias_mensagem_cashback: null,
        tipo_mensagem_cashback: null,
        id_funil: null,
        id_etapa: null,
        timing_type: null,
        delay_value: null,
        delay_unit: null,
        sending_order: sendingOrder,
      };

      if (isGeneralContext) {
          saveData.servicos_vinculados = linkedServices;
          saveData.para_cliente = targetType === "Cliente";
          saveData.para_funcionario = targetType === "Funcionário";
          saveData.para_grupo = targetType === "Grupo";
          saveData.grupo = selectedGroup || null; 
          if (targetType === "Grupo" && selectedGroup) {
              const groupObject = groups.find(g => g.id_grupo === selectedGroup);
              saveData.nome_grupo = groupObject ? groupObject.nome_grupo : null;
          } else {
              saveData.nome_grupo = null;
          }
      } else if (isCashbackContext) {
          saveData.dias_mensagem_cashback = parseInt(diasMensagemCashback, 10); 
          saveData.tipo_mensagem_cashback = tipoMensagemCashback; 
          saveData.para_cliente = true; 
          saveData.para_funcionario = false;
          saveData.para_grupo = false;
          saveData.grupo = null; 
          saveData.nome_grupo = null; 
      } else if (isLeadsContext) { 
          saveData.id_funil = selectedFunnelId;
          saveData.id_etapa = selectedStageId;
          saveData.para_cliente = true; 
          saveData.para_funcionario = false;
          saveData.para_grupo = false;
          saveData.grupo = null; 
          saveData.nome_grupo = null; 
          saveData.timing_type = timingType;
          saveData.delay_value = timingType === 'delay' ? parseInt(delayValue, 10) : null;
          saveData.delay_unit = timingType === 'delay' ? delayUnit : null;
          saveData.hora_envio = null; 
      }

      const saveUrl = messageId
        ? "https://n8n-n8n.sbw0pc.easypanel.host/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4" 
        : "https://n8n-n8n.sbw0pc.easypanel.host/webhook/542ce8db-6b1d-40f5-b58b-23c9154c424d"; 

      const saveRes = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(saveData),
      });

      const responseData: WebhookResponse = await saveRes.json(); 

      if (!saveRes.ok || responseData.error || (responseData.success === false)) {
          const errorMessage = responseData.error || responseData.message || `Erro desconhecido (Status: ${saveRes.status})`;
          console.error("[MensagensConfigPage] Webhook save error:", responseData); 
          throw new Error(errorMessage);
      }

      toast({
        title: "Sucesso",
        description: "Mensagem salva com sucesso.",
      });

      setTimeout(() => {
        let redirectPath = '/dashboard'; 
        if (messageContext === 'clientes') redirectPath = '/dashboard/11';
        else if (messageContext === 'cashback') redirectPath = '/dashboard/14/messages';
        else if (messageContext === 'leads') redirectPath = '/dashboard/9'; 

        window.location.href = `${redirectPath}?clinic_code=${encodeURIComponent(
          currentClinicCode
        )}&status=${messageId ? "updated" : "created"}`;
      }, 1500);
    } catch (e: any) {
      console.error("[MensagensConfigPage] Error saving message:", e);
      setError(e.message || "Erro ao salvar sequência");
      toast({
        title: "Erro",
        description: e.message || "Erro ao salvar sequência",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    if (isGeneralContext) {
        setMessageText(defaultTemplates[value] || "");
    } else if (isCashbackContext) {
         setMessageText(defaultTemplates[value] || ""); 
    }
  };

  const showCategoryGeneral = isGeneralContext;
  const showTargetTypeSelectGeneral = isGeneralContext && (category === "Chegou" || category === "Liberado");
  const showGroupSelectGeneral = isGeneralContext && (category === "Chegou" || category === "Liberado") && targetType === "Grupo";
  const showServicesLinkedGeneral = isGeneralContext && category !== "Aniversário" && category !== "Chegou" && category !== "Liberado";
  const showScheduledTimeGeneral = isGeneralContext && (category === "Confirmar Agendamento" || category === "Aniversário");

  const showCashbackTiming = isCashbackContext;
  const showScheduledTimeCashback = isCashbackContext; 

  const showFunnelStageSelectLeads = isLeadsContext;
  const showTimingFieldsLeads = isLeadsContext; 
  const showScheduledTimeLeads = false; 

  const showSendingOrder = !!mediaFile || !!mediaSavedUrl;

  const handleCancel = () => {
    if (!clinicData?.code) return;
    let redirectPath = '/dashboard'; 
    if (messageContext === 'clientes') redirectPath = '/dashboard/11';
    else if (messageContext === 'cashback') redirectPath = '/dashboard/14/messages';
    else if (messageContext === 'leads') redirectPath = '/dashboard/9'; 

    window.location.href = `${redirectPath}?clinic_code=${encodeURIComponent(
      clinicData.code
    )}`;
  };

  const pageTitle = messageId
    ? `Editar Mensagem (${messageContext === 'clientes' ? 'Clientes' : messageContext === 'cashback' ? 'Cashback' : messageContext === 'leads' ? 'Leads' : 'Geral'})`
    : `Configurar Nova Mensagem (${messageContext === 'clientes' ? 'Clientes' : messageContext === 'cashback' ? 'Cashback' : messageContext === 'leads' ? 'Leads' : 'Geral'})`;

  const isLoadingData = loading || (isLeadsContext && (isLoadingFunnels || isLoadingStages));
  const fetchError = error || (isLeadsContext && (funnelsError || stagesError));

  const availablePlaceholders = useMemo(() => {
      const allKeys = Object.keys(placeholderData);
      if (isCashbackContext) {
          return allKeys.filter(key => key.startsWith('primeiro_nome_cliente') || key.startsWith('nome_completo_cliente') || key.startsWith('valor_cashback') || key.startsWith('validade_cashback'));
      }
      if (isLeadsContext) {
          return allKeys.filter(key =>
              key.startsWith('primeiro_nome_cliente') ||
              key.startsWith('nome_completo_cliente') ||
              key.startsWith('primeiro_nome_funcionario') || 
              key.startsWith('nome_completo_funcionario') ||
              key.startsWith('nome_servico_principal') || 
              key.startsWith('lista_servicos') ||
              key.startsWith('data_agendamento') || 
              key.startsWith('dia_agendamento_num') ||
              key.startsWith('dia_semana_relativo_extenso') ||
              key.startsWith('mes_agendamento_num') ||
              key.startsWith('mes_agendamento_extenso') ||
              key.startsWith('hora_agendamento')
          );
      }
      return allKeys; 
  }, [messageContext]); 

  const handlePlaceholderClick = (placeholder: string) => {
      const placeholderText = `{${placeholder}}`;
      const textarea = messageTextRef.current;
      if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText = messageText.slice(0, start) + placeholderText + messageText.slice(end);

          setMessageText(newText);

          setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = start + placeholderText.length;
              textarea.focus(); 
          }, 0); 
      }
  };

  console.log("[MensagensConfigPage] Rendering. selectedGroup:", selectedGroup, "groups:", groups.length, "value prop for Select:", selectedGroup === null ? undefined : selectedGroup.toString()); 

  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-6 overflow-auto">
      <Card className="w-full"> 
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isLoadingData ? ( 
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="animate-spin" />
              Carregando dados...
            </div>
          ) : fetchError ? ( 
            <div className="text-red-600 font-semibold flex items-center gap-2">
                <TriangleAlert className="h-5 w-5" />
                {fetchError.message || funnelsError?.message || stagesError?.message || "Erro ao carregar dados."}
            </div>
          ) : (
            <>
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
                      disabled={messageId !== null} 
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
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

              {showGroupSelectGeneral && (
                <div>
                  <label
                    htmlFor="group"
                    className="block mb-1 font-medium text-gray-700"
                  >
                    Grupo Alvo *
                  </label>
                  <Select
                    value={selectedGroup ?? undefined} 
                    onValueChange={(v) => {
                        console.log("[MensagensConfigPage] Group Select onValueChange:", v); 
                        setSelectedGroup(v || null); 
                    }}
                    id="group"
                    disabled={groups.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => {
                          console.log("[MensagensConfigPage] Group SelectItem value:", g.id_grupo, "name:", g.nome_grupo); 
                          return (
                            <SelectItem key={g.id_grupo} value={g.id_grupo}> 
                              {g.nome_grupo}
                            </SelectItem>
                          );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(showScheduledTimeGeneral || showScheduledTimeCashback) && ( 
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

              {showTimingFieldsLeads && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                          <label
                            htmlFor="timingType"
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Agendar Envio *
                          </label>
                          <Select
                              value={timingType}
                              onValueChange={setTimingType}
                              id="timingType"
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="immediate">Imediatamente ao entrar na etapa</SelectItem>
                                  <SelectItem value="delay">Com atraso após entrar na etapa</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      {timingType === 'delay' && (
                          <>
                              <div>
                                  <label
                                    htmlFor="delayValue"
                                    className="block mb-1 font-medium text-gray-700"
                                  >
                                    Valor do Atraso *
                                  </label>
                                  <Input
                                      id="delayValue"
                                      type="number"
                                      placeholder="Ex: 2"
                                      value={delayValue}
                                      onChange={(e) => setDelayValue(e.target.value)}
                                      min="0"
                                  />
                              </div>
                              <div>
                                  <label
                                    htmlFor="delayUnit"
                                    className="block mb-1 font-medium text-gray-700"
                                  >
                                    Unidade do Atraso *
                                  </label>
                                  <Select
                                      value={delayUnit}
                                      onValueChange={setDelayUnit}
                                      id="delayUnit"
                                  >
                                      <SelectTrigger>
                                          <SelectValue placeholder="Selecione a unidade" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="minutes">Minutos</SelectItem>
                                          <SelectItem value="hours">Horas</SelectItem>
                                          <SelectItem value="days">Dias</SelectItem>
                                      </SelectContent>
                                  </Select>
                              </div>
                          </>
                      )}
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
                  <div className="absolute z-50 top-full right-0 mt-1" hidden={!showEmojiPicker}>
                      <emoji-picker
                        ref={emojiPickerRef}
                        style={{ width: "300px", height: "300px" }}
                      />
                    </div>
                </div>
              </div>

              {availablePlaceholders.length > 0 && (
                  <div className="placeholder-list mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Placeholders disponíveis (clique para inserir):</p> 
                      <div className="flex flex-wrap gap-2 text-sm text-gray-800">
                          {availablePlaceholders.map(placeholder => (
                              <span
                                  key={placeholder}
                                  className="bg-gray-200 px-2 py-1 rounded font-mono text-xs cursor-pointer hover:bg-gray-300 transition-colors" 
                                  onClick={() => handlePlaceholderClick(placeholder)} 
                               >
                                  {"{"}{placeholder}{"}"}
                              </span>
                          ))}
                      </div>
                       {isLeadsContext && (
                           <p className="text-xs text-gray-500 mt-2">
                               *A disponibilidade de alguns placeholders (como dados de agendamento ou funcionário) pode depender da configuração da etapa e dos dados do lead.
                           </p>
                       )}
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


              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving || isLoadingData || !!fetchError}>
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