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
import { Loader2, TriangleAlert, Plus, Trash2, Smile } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';
import { EmojiPicker } from "emoji-picker-element"; // Keep EmojiPicker for step textareas
import MultiSelectServices from "@/components/MultiSelectServices"; // Import MultiSelectServices

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

type MessageStepType = 'texto' | 'imagem' | 'video' | 'audio' | 'atraso';

interface MessageStep {
  id: string; // Client-side unique ID for the step instance
  db_id?: number; // ID from the database, if it's an existing step
  type: MessageStepType;
  text?: string;
  mediaFile?: File | null; // For new file uploads
  mediaKey?: string | null; // Key/path of the file in storage (after upload or when loaded)
  originalFileName?: string;
  delayValue?: number;
  delayUnit?: 'segundos' | 'minutos' | 'horas' | 'dias';
  sendingOrder?: 'both' | 'text_first' | 'media_first'; // New field for media steps
}

// Define the structure for Instance (for MultiSelectServices)
interface Instance {
  id: number;
  nome_exibição: string;
  nome_instancia_evolution: string | null;
}

// Interface for webhook response (assuming it might return success/error flags)
interface WebhookResponse {
    success?: boolean;
    error?: string;
    message?: string;
    // Add other expected fields from webhook response if any
}


const MensagensSequenciaConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
  clinicData,
}) => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messageName, setMessageName] = useState<string>("");
  const [messageSteps, setMessageSteps] = useState<MessageStep[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]); // State for instances
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<number[]>([]); // New state for selected instances

  // State for media previews, similar to ConversasPage
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<string, string | null>>({});
  const [mediaPreviewStatus, setMediaPreviewStatus] = useState<Record<string, { isLoading: boolean, error: string | null }>>({});

  // Refs for emoji pickers (one per textarea, managed dynamically)
  const emojiPickerRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const messageTextareaRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());
  const [showEmojiPickerForStep, setShowEmojiPickerForStep] = useState<string | null>(null);


  const urlParams = new URLSearchParams(location.search);
  const messageIdParam = urlParams.get("id");
  const isEditing = !!messageIdParam;
  const messageIdToEdit = messageIdParam ? parseInt(messageIdParam, 10) : null;

  const clinicId = clinicData?.id;
  const clinicCode = clinicData?.code; // This is the authentication string, not the numeric ID

  // Constants for file validation
  const MAX_IMAGE_SIZE_MB = 5;
  const MAX_VIDEO_SIZE_MB = 10;
  const MAX_AUDIO_SIZE_MB = 10;

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
  const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav'];

  // UPDATED: Use Supabase Edge Function URL for media retrieval
  const RECUPERAR_ARQUIVO_WEBHOOK_URL = "https://eencnctntsydevijdhdu.supabase.co/functions/v1/get-signed-url";
  const ENVIAR_ARQUIVO_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase";
  const N8N_CREATE_SEQUENCE_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/c85d9288-8072-43c6-8028-6df18d483b5";
  const N8N_UPDATE_SEQUENCE_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/editar-mensagem-v2";

  // Function to fetch signed URL (modified to be more flexible with webhook response)
  const fetchSignedUrlForPreview = async (fileKey: string, stepId: string): Promise<void> => {
    if (!fileKey || !clinicId) { // Use clinicId (numeric)
      setMediaPreviewUrls(prev => ({ ...prev, [stepId]: null }));
      setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: false, error: "Chave do arquivo ou ID da clínica ausente." } }));
      return;
    }

    setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: true, error: null } }));
    setMediaPreviewUrls(prev => ({ ...prev, [stepId]: null }));

    try {
      const response = await fetch(RECUPERAR_ARQUIVO_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: fileKey }), // Pass fileKey directly
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Falha (${response.status}) ao obter URL: ${responseText.substring(0,150)}`);
      }

      if (!responseText.trim()) {
        console.warn(`[MensagensSequenciaConfigPage] Webhook retornou resposta vazia para ${fileKey} (step ${stepId}).`);
        throw new Error("Webhook de recuperação de arquivo retornou uma resposta vazia.");
      }

      let signedUrl: string | null = null;
      try {
        const data = JSON.parse(responseText);
        signedUrl = data?.signedUrl || data?.signedURL || data?.url || data?.link || (typeof data === 'string' ? data : null);
        if (!signedUrl && Array.isArray(data) && data.length > 0) {
            if (typeof data[0] === 'string' && data[0].startsWith('http')) {
                signedUrl = data[0];
            } else if (data[0]?.signedUrl || data[0]?.signedURL || data[0]?.url || data[0]?.link) {
                signedUrl = data[0]?.signedUrl || data[0]?.signedURL || data[0]?.url || data[0]?.link;
            }
        }

      } catch (jsonError) {
        if (responseText.startsWith('http://') || responseText.startsWith('https://')) {
          signedUrl = responseText;
        } else {
          console.error(`[MensagensSequenciaConfigPage] Resposta não é JSON nem URL válida para ${fileKey} (step ${stepId}):`, responseText.substring(0, 200));
          throw new Error(`Resposta inesperada do webhook: ${responseText.substring(0,100)}`);
        }
      }

      if (signedUrl) {
        setMediaPreviewUrls(prev => ({ ...prev, [stepId]: signedUrl }));
        setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: false, error: null } }));
      } else {
        throw new Error(`URL assinada não extraída da resposta do webhook. Resposta recebida: ${responseText.substring(0,200)}`);
      }
    } catch (e: any) {
      console.error(`[MensagensSequenciaConfigPage] Error fetching signed URL for key ${fileKey} (step ${stepId}):`, e);
      setMediaPreviewUrls(prev => ({ ...prev, [stepId]: null }));
      setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: false, error: e.message || 'Erro ao carregar preview.' } }));
    }
  };

  useEffect(() => {
    if (!messageSteps || messageSteps.length === 0) {
      return;
    }

    messageSteps.forEach(step => {
      const isMediaStep = step.type === 'imagem' || step.type === 'video' || step.type === 'audio';
      if (isMediaStep && step.mediaKey && !step.mediaFile) {
        const currentStatus = mediaPreviewStatus[step.id];
        const currentUrl = mediaPreviewUrls[step.id];

        if (!currentUrl && (!currentStatus || !currentStatus.isLoading)) {
          fetchSignedUrlForPreview(step.mediaKey, step.id);
        }
      }
    });
  }, [messageSteps, clinicId]); // Depend on clinicId (numeric)

  useEffect(() => {
    async function loadMessageForEditing() {
      if (!clinicId) {
        setError("ID da clínica não disponível.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setMediaPreviewUrls({});
      setMediaPreviewStatus({});
      setMessageSteps([]); // Clear steps before loading

      try {
        // Fetch instances first
        const { data: instancesData, error: instancesError } = await supabase
          .from("north_clinic_config_instancias")
          .select("id, nome_exibição, nome_instancia_evolution")
          .eq("id_clinica", clinicId);

        if (instancesError) throw instancesError;
        setInstances(instancesData || []);

        if (isEditing && messageIdToEdit !== null) {
          const { data: msgData, error: msgError } = await supabase
              .from('north_clinic_mensagens_sequencias')
              .select('id, nome_sequencia, linked_instance_ids') // Select the new column
              .eq('id', messageIdToEdit)
              .eq('id_clinica', clinicId)
              .single();

          if (msgError) throw msgError;
          if (!msgData) throw new Error("Mensagem não encontrada ou acesso negado.");

          setMessageName(msgData.nome_sequencia);
          setSelectedInstanceIds(msgData.linked_instance_ids || []); // Set selected instances

          const { data: stepsData, error: stepsError } = await supabase
            .from('north_clinic_mensagens_sequencia_passos')
            .select('id, tipo_passo, conteudo_texto, url_arquivo, nome_arquivo_original, atraso_valor, atraso_unidade')
            .eq('id_sequencia', msgData.id)
            .order('ordem', { ascending: true });

          if (stepsError) throw stepsError;

          const loadedSteps: MessageStep[] = (stepsData || [])
            .filter(stepDb => stepDb.tipo_passo !== 'documento') // Filter out 'documento' type if not supported
            .map((stepDb) => ({
                id: stepDb.id.toString() + "_loaded_" + Math.random().toString(36).substring(7),
                db_id: stepDb.id,
                type: stepDb.tipo_passo as MessageStepType,
                text: stepDb.conteudo_texto || undefined,
                mediaKey: stepDb.url_arquivo || undefined,
                originalFileName: stepDb.nome_arquivo_original || undefined,
                delayValue: stepDb.atraso_valor || undefined,
                delayUnit: stepDb.atraso_unidade as MessageStep['delayUnit'] || undefined,
                sendingOrder: 'both', // Default for loaded steps, adjust if DB stores this
            }));
          setMessageSteps(loadedSteps);

        } else {
          setMessageName("");
          setMessageSteps([{ id: Date.now().toString(), type: 'texto', text: '' }]);
          setSelectedInstanceIds([]); // Clear selected instances for new sequence
        }
      } catch (e: any) {
        console.error("[MensagensSequenciaConfigPage] Error loading message for editing:", e);
        setError(e.message || "Erro ao carregar dados da mensagem.");
        toast({ title: "Erro ao Carregar", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    loadMessageForEditing();
  }, [clinicData?.id, isEditing, messageIdToEdit, toast]);

  const handleAddStep = (type: MessageStepType = 'texto') => {
      const newStepId = Date.now().toString() + Math.random().toString().slice(2, 8);
      setMessageSteps(prev => [
          ...prev,
          {
            id: newStepId,
            type,
            text: type === 'texto' ? '' : undefined,
            delayValue: type === 'atraso' ? 60 : undefined,
            delayUnit: type === 'atraso' ? 'segundos' : undefined,
            sendingOrder: (type === 'imagem' || type === 'video' || type === 'audio') ? 'both' : undefined,
          }
      ]);
  };

  const handleRemoveStep = (idToRemove: string) => {
      setMessageSteps(prevSteps => {
        const stepToRemove = prevSteps.find(s => s.id === idToRemove);
        if (stepToRemove) {
            const currentPreviewUrl = mediaPreviewUrls[idToRemove];
            if (currentPreviewUrl && currentPreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(currentPreviewUrl);
            }
        }
        setMediaPreviewUrls(prev => { const newState = {...prev}; delete newState[idToRemove]; return newState; });
        setMediaPreviewStatus(prev => { const newState = {...prev}; delete newState[idToRemove]; return newState; });
        return prevSteps.filter(step => step.id !== idToRemove);
      });
  };

  const handleUpdateStep = (idToUpdate: string, updates: Partial<MessageStep>) => {
      setMessageSteps(prevSteps => prevSteps.map(step =>
          step.id === idToUpdate ? { ...step, ...updates } : step
      ));
  };

  const handleMediaFileChange = (stepId: string, file: File | null) => {
    const stepIndex = messageSteps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    const currentStep = messageSteps[stepIndex];

    const oldPreviewUrl = mediaPreviewUrls[stepId];
    if (oldPreviewUrl && oldPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldPreviewUrl);
    }
    setMediaPreviewUrls(prev => ({ ...prev, [stepId]: null }));
    setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: false, error: null } }));


    if (file) {
        let maxSizeMB: number, allowedTypes: string[], typeName: string;
        switch (currentStep.type) {
            case 'imagem': maxSizeMB = MAX_IMAGE_SIZE_MB; allowedTypes = ALLOWED_IMAGE_TYPES; typeName = 'Imagem'; break;
            case 'video': maxSizeMB = MAX_VIDEO_SIZE_MB; allowedTypes = ALLOWED_VIDEO_TYPES; typeName = 'Vídeo'; break;
            case 'audio': maxSizeMB = MAX_AUDIO_SIZE_MB; allowedTypes = ALLOWED_AUDIO_TYPES; typeName = 'Áudio'; break;
            default: toast({ title: "Erro", description: "Tipo de passo inválido.", variant: "destructive" }); return;
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            toast({ title: "Arquivo Grande", description: `${typeName} excede ${maxSizeMB}MB.`, variant: "destructive" });
            handleUpdateStep(stepId, { mediaFile: null, mediaKey: null, originalFileName: undefined });
            const inputEl = document.getElementById(`step-media-${stepId}`) as HTMLInputElement; if (inputEl) inputEl.value = "";
            return;
        }
        if (!allowedTypes.includes(file.type)) {
            toast({ title: "Formato Inválido", description: `Formato de ${typeName.toLowerCase()} não suportado.`, variant: "destructive" });
            handleUpdateStep(stepId, { mediaFile: null, mediaKey: null, originalFileName: undefined });
            const inputEl = document.getElementById(`step-media-${stepId}`) as HTMLInputElement; if (inputEl) inputEl.value = "";
            return;
        }

        const newPreviewUrl = URL.createObjectURL(file);
        setMediaPreviewUrls(prev => ({ ...prev, [stepId]: newPreviewUrl }));
        setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: false, error: null } }));
        handleUpdateStep(stepId, { mediaFile: file, originalFileName: file.name, mediaKey: null });
    } else {
        handleUpdateStep(stepId, { mediaFile: null, mediaKey: null, originalFileName: undefined });
    }
  };

  useEffect(() => {
      return () => {
          Object.values(mediaPreviewUrls).forEach(url => {
              if (url && url.startsWith('blob:')) {
                  URL.revokeObjectURL(url);
              }
          });
      };
  }, [mediaPreviewUrls]);

  const handleSave = async () => {
    console.log("[MensagensSequenciaConfigPage] handleSave: Iniciando processo de salvamento...");
    const currentClinicCode = clinicData?.code; // This is the authentication string
    const currentClinicId = clinicData?.id; // This is the numeric ID

    if (!currentClinicId || !currentClinicCode) {
      toast({ title: "Erro", description: "Dados da clínica não disponíveis.", variant: "destructive" });
      console.error("[MensagensSequenciaConfigPage] handleSave: Dados da clínica não disponíveis.");
      return;
    }
    if (!messageName.trim()) {
      toast({ title: "Erro", description: "Nome da sequência obrigatório.", variant: "destructive" });
      console.error("[MensagensSequenciaConfigPage] handleSave: Nome da sequência obrigatório.");
      return;
    }
    if (messageSteps.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um passo à sequência.", variant: "destructive" });
      console.error("[MensagensSequenciaConfigPage] handleSave: Nenhum passo adicionado.");
      return;
    }
    if (selectedInstanceIds.length === 0) { // New validation for selected instances
        toast({ title: "Erro", description: "Selecione pelo menos uma instância para vincular à sequência.", variant: "destructive" });
        console.error("[MensagensSequenciaConfigPage] handleSave: Nenhuma instância selecionada.");
        return;
    }

     for (const step of messageSteps) {
         if (step.type === 'texto' && !step.text?.trim()) {
             toast({ title: "Erro", description: "Texto não pode ser vazio em um passo de texto.", variant: "destructive" });
             console.error("[MensagensSequenciaConfigPage] handleSave: Passo de texto vazio.", step);
             return;
         }
         if ((step.type === 'imagem' || step.type === 'video' || step.type === 'audio') && !step.mediaKey && !step.mediaFile) {
              toast({ title: "Erro", description: `Anexe um arquivo para o passo de ${step.type}.`, variant: "destructive" });
              console.error("[MensagensSequenciaConfigPage] handleSave: Arquivo de mídia ausente.", step);
              return;
         }
         if (step.type === 'atraso' && (step.delayValue === undefined || step.delayValue <= 0 || !step.delayUnit)) {
            toast({ title: "Erro", description: "Atraso inválido para o passo de atraso.", variant: "destructive" });
            console.error("[MensagensSequenciaConfigPage] handleSave: Atraso inválido.", step);
            return;
         }
         if ((step.type === 'imagem' || step.type === 'video' || step.type === 'audio') && !step.sendingOrder) {
            toast({ title: "Erro", description: `Selecione a ordem de envio para o passo de ${step.type}.`, variant: "destructive" });
            console.error("[MensagensSequenciaConfigPage] handleSave: Ordem de envio ausente.", step);
            return;
         }
     }

    setSaving(true); setError(null);
    console.log("[MensagensSequenciaConfigPage] handleSave: Validações passaram, iniciando try block.");

    try {
      console.log("[MensagensSequenciaConfigPage] handleSave: Processando steps...");
      const processedSteps = await Promise.all(
        messageSteps.map(async (step, idx) => {
          console.log(`[MensagensSequenciaConfigPage] handleSave: Processando step ${idx + 1}`, step);
          let currentMediaKey = step.mediaKey;
          if (step.mediaFile && (step.type === 'imagem' || step.type === 'video' || step.type === 'audio')) {
              console.log(`[MensagensSequenciaConfigPage] handleSave: Step ${idx + 1} - Fazendo upload de ${step.mediaFile.name}`);
              const formData = new FormData();
              formData.append("data", step.mediaFile, step.mediaFile.name);
              formData.append("fileName", step.mediaFile.name);
              formData.append("clinicId", currentClinicId.toString()); // Use currentClinicId (numeric)

              const uploadRes = await fetch(ENVIAR_ARQUIVO_WEBHOOK_URL, { method: "POST", body: formData });
              console.log(`[MensagensSequenciaConfigPage] handleSave: Step ${idx + 1} - Resposta do upload: status ${uploadRes.status}, ok: ${uploadRes.ok}`);
              if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                console.error(`[MensagensSequenciaConfigPage] handleSave: Step ${idx + 1} - Falha no upload:`, errorText);
                throw new Error(`Upload falhou (${step.mediaFile.name}): ${errorText.substring(0,150)}`);
              }
              const uploadData = await uploadRes.json();
              console.log(`[MensagensSequenciaConfigPage] handleSave: Step ${idx + 1} - Dados do upload:`, uploadData);
              currentMediaKey = (Array.isArray(uploadData) && uploadData[0]?.Key) || uploadData.Key || uploadData.key || null;
              if (!currentMediaKey) {
                console.error(`[MensagensSequenciaConfigPage] handleSave: Step ${idx + 1} - Chave de mídia inválida após upload. Dados recebidos:`, uploadData);
                throw new Error(`Chave de mídia inválida para ${step.mediaFile.name}.`);
              }
              console.log(`[MensagensSequenciaConfigPage] handleSave: Step ${idx + 1} - MediaKey obtida: ${currentMediaKey}`);
          }
          return {
            ...step,
            mediaKey: currentMediaKey,
            mediaFile: undefined
          };
      }));
      console.log("[MensagensSequenciaConfigPage] handleSave: Steps processados:", processedSteps);

      const messagePayloadForN8N = {
        event: isEditing && messageIdToEdit ? "sequence_updated" : "sequence_created",
        sequenceId: isEditing && messageIdToEdit ? messageIdToEdit : undefined,
        clinicDbId: currentClinicId, // This is the numeric ID, use this for DB operations
        sequenceName: messageName,
        contexto: 'leads', // Hardcoded context for lead sequences
        ativo: true, // Sequences are active by default on creation
        linkedInstanceIds: selectedInstanceIds, // Include selected instances
        steps: processedSteps.map((step, index) => ({
          db_id: step.db_id,
          ordem: index + 1,
          tipo_passo: step.type,
          conteudo_texto: step.text || null,
          url_arquivo: step.mediaKey || null,
          nome_arquivo_original: step.originalFileName || null,
          atraso_valor: step.type === 'atraso' ? step.delayValue : null,
          atraso_unidade: step.type === 'atraso' ? step.delayUnit : null,
          sending_order: (step.type === 'imagem' || step.type === 'video' || step.type === 'audio') ? (step.sendingOrder || 'both') : null,
        })),
      };
      console.log("[MensagensSequenciaConfigPage] handleSave: Payload para N8N:", JSON.stringify(messagePayloadForN8N, null, 2));

      const targetWebhookUrl = isEditing && messageIdToEdit
        ? N8N_UPDATE_SEQUENCE_WEBHOOK_URL
        : N8N_CREATE_SEQUENCE_WEBHOOK_URL;
      console.log("[MensagensSequenciaConfigPage] handleSave: Enviando para webhook:", targetWebhookUrl);

      const webhookResponse = await fetch(targetWebhookUrl, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(messagePayloadForN8N),
      });
      console.log("[MensagensSequenciaConfigPage] handleSave: Resposta do Webhook N8N - Status:", webhookResponse.status, "OK:", webhookResponse.ok);

      if (!webhookResponse.ok) {
        console.log("[MensagensSequenciaConfigPage] handleSave: Webhook response NOT OK. Tentando ler corpo do erro...");
        const errTxt = await webhookResponse.text().catch((e) => {
            console.error("[MensagensSequenciaConfigPage] handleSave: Erro ao ler corpo da resposta do webhook:", e);
            return "Erro ao ler corpo da resposta do webhook.";
        });
        console.log("[MensagensSequenciaConfigPage] handleSave: Corpo do erro do webhook (raw):", errTxt);
        let detailedError = `Falha na comunicação com o webhook (${webhookResponse.status}).`;
        if (errTxt && errTxt !== "Erro ao ler corpo da resposta do webhook.") {
            try {
                const jsonError = JSON.parse(errTxt);
                detailedError = jsonError.message || jsonError.error || `Erro ${webhookResponse.status}: ${errTxt.substring(0,100)}`;
            } catch (parseError) {
                detailedError = `Erro ${webhookResponse.status}: ${errTxt.substring(0,150)}`;
            }
        }
        console.error("[MensagensSequenciaConfigPage] handleSave: Webhook N8N response NOT OK. DetailedError:", detailedError);
        throw new Error(detailedError);
      }

      const responseData: WebhookResponse = await webhookResponse.json(); 

      if (responseData.error || (responseData.success === false)) {
          const errorMessage = responseData.error || responseData.message || `Erro desconhecido na resposta do webhook.`;
          console.error("[MensagensSequenciaConfigPage] Webhook save error (from responseData):", responseData); 
          throw new Error(errorMessage);
      }

      console.log("[MensagensSequenciaConfigPage] handleSave: Webhook N8N OK. Exibindo toast de sucesso.");
      toast({ title: "Sucesso", description: `Sequência "${messageName}" salva.` });
      if (currentClinicId) {
        console.log("[MensagensSequenciaConfigPage] handleSave: Invalidando queries para ['leadMessagesList',", currentClinicId, "]");
        queryClient.invalidateQueries({ queryKey: ['leadMessagesList', currentClinicId] });
      }

      console.log("[MensagensSequenciaConfigPage] handleSave: Agendando navegação.");
      setTimeout(() => {
        console.log("[MensagensSequenciaConfigPage] handleSave: Navegando...");
        if (currentClinicCode) navigate(`/dashboard/9?clinic_code=${encodeURIComponent(currentClinicCode)}&status=${isEditing ? "updated_sent" : "created_sent"}`);
        else navigate(`/dashboard/9?status=${isEditing ? "updated_sent" : "created_sent"}`);
      }, 1000);

    } catch (e: any) {
      console.error("[MensagensSequenciaConfigPage] Error saving message:", e);
      setError(e.message || "Erro ao salvar sequência");
      toast({
        title: "Erro",
        description: e.message || "Erro ao salvar sequência",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!clinicData?.code) return;
    const redirectPath = '/dashboard/9'; // Always redirect to Leads Messages Page
    window.location.href = `${redirectPath}?clinic_code=${encodeURIComponent(
      clinicData.code
    )}`;
  };

  const pageTitle = isEditing
    ? `Editar Sequência: ${messageName}`
    : `Configurar Nova Sequência de Mensagens`;

  const isLoadingData = loading; // Simplified loading state
  const fetchError = error; // Simplified error state

  // Placeholder data for message preview (simplified for sequences)
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
  };

  const availablePlaceholders = Object.keys(placeholderData);

  const handlePlaceholderClick = (stepId: string, placeholder: string) => {
      const placeholderText = `{${placeholder}}`;
      const textarea = messageTextareaRefs.current.get(stepId);
      if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const currentText = messageSteps.find(s => s.id === stepId)?.text || '';
          const newText = currentText.slice(0, start) + placeholderText + currentText.slice(end);

          handleUpdateStep(stepId, { text: newText });

          setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = start + placeholderText.length;
              textarea.focus();
          }, 0);
      }
  };

  const toggleEmojiPickerForStep = (stepId: string | null) => {
    setShowEmojiPickerForStep(prev => (prev === stepId ? null : stepId));
  };

  const onEmojiSelect = (event: CustomEvent) => {
    const emoji = event.detail.unicode;
    if (showEmojiPickerForStep) {
      const textarea = messageTextareaRefs.current.get(showEmojiPickerForStep);
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = messageSteps.find(s => s.id === showEmojiPickerForStep)?.text || '';
        const newText = currentText.slice(0, start) + emoji + currentText.slice(end);

        handleUpdateStep(showEmojiPickerForStep, { text: newText });

        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          textarea.focus();
        }, 0);
      }
    }
  };

  useEffect(() => {
    const currentPickerId = showEmojiPickerForStep;
    if (!currentPickerId) return;

    const picker = emojiPickerRefs.current.get(currentPickerId);
    if (!picker) return;

    customElements.whenDefined('emoji-picker').then(() => {
        picker.addEventListener("emoji-click", onEmojiSelect as EventListener);
    }).catch(err => {
        console.error("Error waiting for emoji-picker definition:", err);
    });

    return () => {
      if (picker) {
        picker.removeEventListener("emoji-click", onEmojiSelect as EventListener);
      }
    };
  }, [showEmojiPickerForStep, messageSteps]); // Re-attach listener if active step changes or messageSteps update


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
                {fetchError.message || "Erro ao carregar dados."}
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="messageName"
                  className="block mb-1 font-medium text-gray-700"
                >
                  Nome da Sequência *
                </label>
                <Input
                  id="messageName"
                  value={messageName}
                  onChange={(e) => setMessageName(e.target.value)}
                  placeholder="Ex: Sequência de Boas-Vindas para Leads"
                  disabled={saving}
                />
              </div>

              <div>
                <label
                  htmlFor="linkedInstances"
                  className="block mb-1 font-medium text-gray-700"
                >
                  Instâncias Vinculadas *
                </label>
                <MultiSelectServices
                  options={instances.map(inst => ({ id: inst.id, nome: inst.nome_exibição }))}
                  selectedIds={selectedInstanceIds}
                  onChange={setSelectedInstanceIds}
                  disabled={saving}
                />
                <p className="text-sm text-gray-500 mt-1">Selecione uma ou mais instâncias do WhatsApp que podem enviar mensagens desta sequência.</p>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mt-4">Passos da Sequência</h3>
              <div className="flex flex-col gap-4 border p-4 rounded-md bg-gray-50">
                {messageSteps.length === 0 && (
                  <div className="text-center text-gray-600 py-4">Nenhum passo adicionado. Clique em "Adicionar Passo" para começar.</div>
                )}
                {messageSteps.map((step, index) => (
                  <div key={step.id} className="border border-gray-200 rounded-md p-4 bg-white shadow-sm relative">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-800">Passo {index + 1} ({step.type === 'texto' ? 'Texto' : step.type === 'imagem' ? 'Imagem' : step.type === 'video' ? 'Vídeo' : step.type === 'audio' ? 'Áudio' : 'Atraso'})</h4>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveStep(step.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor={`step-type-${step.id}`}>Tipo de Passo</Label>
                        <Select
                          value={step.type}
                          onValueChange={(value: MessageStepType) => handleUpdateStep(step.id, { type: value, text: value === 'texto' ? '' : undefined, mediaFile: null, mediaKey: null, originalFileName: undefined, delayValue: value === 'atraso' ? 60 : undefined, delayUnit: value === 'atraso' ? 'segundos' : undefined, sendingOrder: (value === 'imagem' || value === 'video' || value === 'audio') ? 'both' : undefined })}
                          disabled={saving}
                        >
                          <SelectTrigger id={`step-type-${step.id}`}>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="texto">Texto</SelectItem>
                            <SelectItem value="imagem">Imagem</SelectItem>
                            <SelectItem value="video">Vídeo</SelectItem>
                            <SelectItem value="audio">Áudio</SelectItem>
                            <SelectItem value="atraso">Atraso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(step.type === 'imagem' || step.type === 'video' || step.type === 'audio') && (
                        <>
                          <div>
                            <Label htmlFor={`step-media-${step.id}`}>Anexar Arquivo *</Label>
                            <Input
                              id={`step-media-${step.id}`}
                              type="file"
                              accept={step.type === 'imagem' ? 'image/*' : step.type === 'video' ? 'video/*' : 'audio/*'}
                              onChange={(e) => handleMediaFileChange(step.id, e.target.files ? e.target.files[0] : null)}
                              disabled={saving}
                            />
                            {mediaPreviewUrls[step.id] && (
                              <div className="mt-2">
                                {step.type === 'imagem' && (
                                  <img src={mediaPreviewUrls[step.id] || ''} alt="Preview" className="max-w-xs rounded" />
                                )}
                                {step.type === 'video' && (
                                  <video src={mediaPreviewUrls[step.id] || ''} controls className="max-w-xs rounded" />
                                )}
                                {step.type === 'audio' && (
                                  <audio src={mediaPreviewUrls[step.id] || ''} controls />
                                )}
                              </div>
                            )}
                            {!mediaPreviewUrls[step.id] && step.mediaKey && (
                              <p className="text-sm text-gray-600 mt-1">
                                Arquivo salvo: {step.originalFileName || step.mediaKey}
                                {mediaPreviewStatus[step.id]?.isLoading && <Loader2 className="h-4 w-4 animate-spin inline-block ml-2" />}
                                {mediaPreviewStatus[step.id]?.error && <TriangleAlert className="h-4 w-4 text-red-500 inline-block ml-2" title={mediaPreviewStatus[step.id]?.error || ''} />}
                              </p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                              {step.type === 'imagem' && `JPG, PNG, GIF, WEBP - máx ${MAX_IMAGE_SIZE_MB}MB`}
                              {step.type === 'video' && `MP4, WEBM, MOV - máx ${MAX_VIDEO_SIZE_MB}MB`}
                              {step.type === 'audio' && `MP3, OGG, WAV - máx ${MAX_AUDIO_SIZE_MB}MB`}
                            </p>
                          </div>
                          <div>
                              <Label htmlFor={`sending-order-${step.id}`}>Ordem de Envio (Texto e Mídia) *</Label>
                              <Select
                                  value={step.sendingOrder || 'both'}
                                  onValueChange={(value: 'both' | 'text_first' | 'media_first') => handleUpdateStep(step.id, { sendingOrder: value })}
                                  disabled={saving}
                              >
                                  <SelectTrigger id={`sending-order-${step.id}`}>
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
                        </>
                      )}

                      {step.type === 'atraso' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`delay-value-${step.id}`}>Valor do Atraso *</Label>
                            <Input
                              id={`delay-value-${step.id}`}
                              type="number"
                              placeholder="Ex: 60"
                              value={step.delayValue || ''}
                              onChange={(e) => handleUpdateStep(step.id, { delayValue: parseInt(e.target.value, 10) || 0 })}
                              min="0"
                              disabled={saving}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`delay-unit-${step.id}`}>Unidade do Atraso *</Label>
                            <Select
                              value={step.delayUnit || 'segundos'}
                              onValueChange={(value: 'segundos' | 'minutos' | 'horas' | 'dias') => handleUpdateStep(step.id, { delayUnit: value })}
                              disabled={saving}
                            >
                              <SelectTrigger id={`delay-unit-${step.id}`}>
                                <SelectValue placeholder="Selecione a unidade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="segundos">Segundos</SelectItem>
                                <SelectItem value="minutos">Minutos</SelectItem>
                                <SelectItem value="horas">Horas</SelectItem>
                                <SelectItem value="dias">Dias</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button onClick={() => handleAddStep('texto')} variant="outline" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Texto
                </Button>
                <Button onClick={() => handleAddStep('imagem')} variant="outline" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Imagem
                </Button>
                <Button onClick={() => handleAddStep('video')} variant="outline" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Vídeo
                </Button>
                <Button onClick={() => handleAddStep('audio')} variant="outline" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Áudio
                </Button>
                <Button onClick={() => handleAddStep('atraso')} variant="outline" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Atraso
                </Button>
              </div>

              {availablePlaceholders.length > 0 && (
                  <div className="placeholder-list mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Placeholders disponíveis (clique para inserir no campo de texto):</p>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-800">
                          {availablePlaceholders.map(placeholder => (
                              <span
                                  key={placeholder}
                                  className="bg-gray-200 px-2 py-1 rounded font-mono text-xs cursor-pointer hover:bg-gray-300 transition-colors"
                                  onClick={() => {
                                    if (showEmojiPickerForStep) { // Only allow if a text area is active
                                      handlePlaceholderClick(showEmojiPickerForStep, placeholder);
                                    } else {
                                      toast({ title: "Atenção", description: "Selecione um campo de texto para inserir o placeholder.", variant: "info" });
                                    }
                                  }}
                               >
                                  {"{"}{placeholder}{"}"}
                              </span>
                          ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                          *A disponibilidade de alguns placeholders (como dados de agendamento ou funcionário) pode depender da configuração da etapa e dos dados do lead.
                      </p>
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
                    "Salvar Sequência"
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

export default MensagensSequenciaConfigPage;