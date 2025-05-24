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
import { Loader2, Smile } from "lucide-react";
import MultiSelectServices from "@/components/MultiSelectServices";
import { useLocation } from "react-router-dom"; // Import useLocation

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

// Updated interface to match Supabase join structure and new column names
interface FetchedMessageData {
  id: number;
  categoria: string;
  id_instancia: number | null;
  modelo_mensagem: string;
  ativo: boolean;
  hora_envio: string | null; // Can be null
  grupo: number | null;
  url_arquivo: string | null;
  variacao_1: string | null;
  variacao_2: string | null;
  variacao_3: string | null;
  variacao_4: string | null;
  variacao_5: string | null;
  para_cliente: boolean;
  para_funcionario: boolean;
  context: string | null; // Added new column
  dias_mensagem_cashback: number | null; // Added new column (renamed)
  tipo_mensagem_cashback: string | null; // Added new column (renamed)
  // This will be an array of objects from the join table
  north_clinic_mensagens_servicos: { id_servico: number }[];
}

// Interface for webhook response (assuming it might return success/error flags)
interface WebhookResponse {
    success?: boolean;
    error?: string;
    message?: string; // Common field for success or error messages
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
    "Aniversário", // Aniversário can also be a cashback message
    "Cashback Concedido",
    "Cashback Próximo a Expirar",
    // Add other cashback categories as needed
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
    "Olá {primeiro_nome_cliente}! Você recebeu R$ {valor_cashback} de cashback na sua última compra! Use até {validade_cashback}. Aproveite!", // Example cashback template
  "Cashback Próximo a Expirar":
    "Olá {primeiro_nome_cliente}! Seu cashback de R$ {valor_cashback} está perto de expirar ({validade_cashback}). Não perca a chance de usar!", // Example cashback template
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
    valor_cashback: "R$ 50,00", // Added cashback placeholder
    validade_cashback: "20/05/2025" // Added cashback placeholder
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
  const location = useLocation(); // Hook to get URL parameters

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

  // NEW: State for cashback timing (using correct column names)
  const [diasMensagemCashback, setDiasMensagemCashback] = useState<string>(''); // Use string for input
  const [tipoMensagemCashback, setTipoMensagemCashback] = useState<string>(''); // 'apos_venda' or 'antes_validade'

  // Removed variations state

  // Emoji picker ref
  const emojiPickerRef = useRef<HTMLElement | null>(null);
  const messageTextRef = useRef<HTMLTextAreaElement | null>(null);

  // Load initial data: instances, services, message details if editing
  useEffect(() => {
    if (!clinicData?.id) { // Use clinicData.id for Supabase queries
      setError("ID da clínica não disponível.");
      setLoading(false);
      return;
    }

    const urlParams = new URLSearchParams(location.search); // Use useLocation hook
    const idParam = urlParams.get("id");
    const contextParam = urlParams.get("context"); // Read context from URL

    const isEditing = !!idParam;
    const messageIdToEdit = idParam ? parseInt(idParam, 10) : null;

    // Set context from URL if creating a new message, or it will be loaded if editing
    if (!isEditing && contextParam) {
        setMessageContext(contextParam);
    }


    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch instances
        const { data: instancesData, error: instancesError } = await supabase
          .from("north_clinic_config_instancias")
          .select("id, nome_exibição, nome_instancia_evolution") // Select only necessary fields
          .eq("id_clinica", clinicData.id); // Filter by clinic ID

        if (instancesError) throw instancesError;
        setInstances(instancesData || []);

        // Fetch services directly from Supabase (only needed for general context)
        let servicesData: Service[] = [];
        if (contextParam !== 'cashback') { // Only fetch services if not cashback context
             const { data: fetchedServicesData, error: servicesError } = await supabase
               .from("north_clinic_servicos")
               .select("id, nome") // Select only necessary fields
               .eq("id_clinica", clinicData.id) // Filter by clinic ID
               .order("nome", { ascending: true });

             if (servicesError) throw servicesError;
             servicesData = fetchedServicesData || [];
        }
        setServices(servicesData);


        if (isEditing && messageIdToEdit !== null) {
          // Fetch message details and linked services from Supabase
          const { data: messageDataArray, error: messageError } = await supabase
            .from('north_clinic_config_mensagens')
            .select('*, north_clinic_mensagens_servicos(id_servico)') // Select message fields and linked service IDs
            .eq('id', messageIdToEdit) // Filter by message ID
            .eq('id_clinica', clinicData.id) // Filter by clinic ID
            .single(); // Expecting a single message

          if (messageError && messageError.code !== 'PGRST116') { // PGRST116 is "No rows found"
              throw messageError;
          }

          if (messageDataArray) {
            const messageData: FetchedMessageData = messageDataArray; // Cast to the fetched structure

            // Extract linked service IDs from the nested array (only relevant for general context)
            const fetchedLinkedServices = messageData.context !== 'cashback'
                ? messageData.north_clinic_mensagens_servicos
                    .map(link => link.id_servico)
                    .filter((id): id is number => id !== null) // Ensure IDs are numbers and not null
                : []; // Empty array if cashback context

            console.log("Fetched message data from Supabase:", messageData);
            console.log("Extracted linkedServices from Supabase:", fetchedLinkedServices);


            setMessageId(messageData.id);
            setCategory(messageData.categoria);
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

            // NEW: Set cashback timing state (using correct column names)
            setDiasMensagemCashback(messageData.dias_mensagem_cashback?.toString() || '');
            setTipoMensagemCashback(messageData.tipo_mensagem_cashback || '');


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
          setTargetType(contextParam === 'cashback' ? 'Cliente' : 'Grupo'); // Default target type based on context

          // NEW: Default cashback timing
          setDiasMensagemCashback('');
          setTipoMensagemCashback('');

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


  // Load groups when instance or targetType changes and targetType is 'Grupo'
  useEffect(() => {
    async function fetchGroups() {
      if (!instanceId || targetType !== "Grupo") {
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
  }, [instanceId, targetType, instances]); // Depend on instanceId, targetType, and instances

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
    if (!clinicData?.code || !clinicData?.id) {
      toast({
        title: "Erro",
        description: "Dados da clínica não disponíveis.",
        variant: "destructive",
      });
      return;
    }
    // Category is required for General context, but not for Cashback
    if (isGeneralContext && !category) {
      toast({
        title: "Erro",
        description: "Selecione uma categoria.",
        variant: "destructive",
      });
      return;
    }
     // For Cashback, category is selected but might not be required for save payload depending on backend
     // Let's keep it required for now based on the select input being present

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
         // For cashback, targetType is always Cliente and group is not used, no need to validate them
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


    if (!messageContext) { // Validate that context is set (should be set from URL or fetched)
         toast({
             title: "Erro",
             description: "Contexto da mensagem não definido.",
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
        formData.append("clinicId", clinicData.code); // Use clinic code for upload webhook
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
        id_clinica: clinicData.code, // Use clinic code for save webhook
        id: messageId, // null for new, number for edit
        categoria: category,
        id_instancia: instanceId,
        modelo_mensagem: messageText,
        ativo: active, // Keep active status editable
        hora_envio: scheduledTime || null,
        url_arquivo: url_arquivo || null,
        prioridade: 1, // Default priority for now, can be added later
        context: messageContext, // Include context in save data
        // Removed variations from save data
      };

      // Add context-specific fields
      if (isGeneralContext) {
          saveData.servicos_vinculados = linkedServices; // Send the array of IDs
          saveData.para_cliente = targetType === "Cliente";
          saveData.para_funcionario = targetType === "Funcionário";
          saveData.grupo = selectedGroup || null;
          // Ensure cashback fields are null for general messages
          saveData.dias_mensagem_cashback = null;
          saveData.tipo_mensagem_cashback = null;
      } else if (isCashbackContext) {
          saveData.dias_mensagem_cashback = parseInt(diasMensagemCashback, 10); // Use correct state name
          saveData.tipo_mensagem_cashback = tipoMensagemCashback; // Use correct state name
          saveData.para_cliente = true; // Always send to client for cashback
          saveData.para_funcionario = false;
          saveData.para_grupo = false;
          saveData.grupo = null; // Group is not used for cashback
          saveData.servicos_vinculados = []; // Services are not linked for cashback
      }


      const saveUrl = messageId
        ? "https://n8n-n8n.sbw0pc.easypanel.host/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4" // Update webhook
        : "https://n8n-n8n.sbw0pc.easypanel.host/webhook/542ce8db-6b1d-40f5-b58b-23c9154c424d"; // Create webhook

      const saveRes = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, // Send as JSON
        body: JSON.stringify(saveData),
      });

      // --- MODIFIED: Check response status AND body for errors ---
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
        const redirectPath = messageContext === 'cashback' ? '/dashboard/14/messages' : '/dashboard/11';
        window.location.href = `${redirectPath}?clinic_code=${encodeURIComponent(
          clinicData.code
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
    }
  };

  // Show/hide fields based on context and category
  const isGeneralContext = messageContext === 'general';
  const isCashbackContext = messageContext === 'cashback';

  // General context fields visibility
  const showCategoryGeneral = isGeneralContext;
  const showTargetTypeSelectGeneral = isGeneralContext && (category === "Chegou" || category === "Liberado");
  const showGroupSelectGeneral = isGeneralContext && (category === "Chegou" || category === "Liberado") && targetType === "Grupo";
  const showServicesLinkedGeneral = isGeneralContext && category !== "Aniversário" && category !== "Chegou" && category !== "Liberado";
  const showScheduledTimeGeneral = isGeneralContext && (category === "Confirmar Agendamento" || category === "Aniversário");

  // Cashback context fields visibility
  const showCashbackTiming = isCashbackContext;
  const showScheduledTimeCashback = isCashbackContext && (category === 'Aniversário'); // Aniversário might still need time


  // Removed variations count

  // Handle variation change - Removed function

  // Cancel action: redirect back to list
  const handleCancel = () => {
    if (!clinicData?.code) return;
    // Redirect back to the correct list page based on context
    const redirectPath = messageContext === 'cashback' ? '/dashboard/14/messages' : '/dashboard/11';
    window.location.href = `${redirectPath}?clinic_code=${encodeURIComponent(
      clinicData.code
    )}`;
  };

  // Determine page title based on context and whether editing or creating
  const pageTitle = messageId
    ? `Editar Mensagem (${messageContext === 'cashback' ? 'Cashback' : 'Geral'})`
    : `Configurar Nova Mensagem (${messageContext === 'cashback' ? 'Cashback' : 'Geral'})`;


  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-6 overflow-auto">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="animate-spin" />
              Carregando dados...
            </div>
          ) : error ? (
            <div className="text-red-600 font-semibold">{error}</div>
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
                        "08:30",
                        "09:00",
                        "09:30",
                        "10:00",
                        "10:30",
                        "11:00",
                        "11:30",
                        "12:00",
                        "12:30",
                        "13:00",
                        "13:30",
                        "14:00",
                        "14:30",
                        "15:00",
                        "15:30",
                        "16:00",
                        "16:30",
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

              {/* NEW: Cashback Timing fields (only for Cashback context) */}
              {showCashbackTiming && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label
                            htmlFor="diasMensagemCashback" // Use correct ID
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Dias *
                          </label>
                          <Input
                              id="diasMensagemCashback" // Use correct ID
                              type="number"
                              placeholder="Ex: 3"
                              value={diasMensagemCashback} // Use correct state
                              onChange={(e) => setDiasMensagemCashback(e.target.value)} // Use correct state setter
                              min="0"
                          />
                          <p className="text-sm text-gray-500 mt-1">Número de dias para o agendamento.</p>
                      </div>
                      <div>
                          <label
                            htmlFor="tipoMensagemCashback" // Use correct ID
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Agendar Para *
                          </label>
                          <Select
                              value={tipoMensagemCashback} // Use correct state
                              onValueChange={setTipoMensagemCashback} // Use correct state setter
                              id="tipoMensagemCashback" // Use correct ID
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="apos_venda">Dias após a venda</SelectItem>
                                  <SelectItem value="antes_validade">Dias antes da validade do cashback</SelectItem>
                              </SelectContent>
                          </Select>
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

              {/* Removed Variations section */}

              {/* Status field (always starts active for new, but editable) */}
              {isGeneralContext && ( // <-- Only show Status for General context
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
                <Button onClick={handleSave} disabled={saving}>
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