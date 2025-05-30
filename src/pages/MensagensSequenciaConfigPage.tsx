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
import { Loader2, TriangleAlert, Plus, Trash2 } from "lucide-react"; 
import { useLocation, useNavigate } from "react-router-dom"; 
import { useQueryClient } from "@tanstack/react-query"; 

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
}

// Constants for file validation
const MAX_IMAGE_SIZE_MB = 5;
const MAX_VIDEO_SIZE_MB = 10;
const MAX_AUDIO_SIZE_MB = 10;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav'];

const MensagensConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
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

  // State for media previews, similar to ConversasPage
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<string, string | null>>({});
  const [mediaPreviewStatus, setMediaPreviewStatus] = useState<Record<string, { isLoading: boolean, error: string | null }>>({});

  const urlParams = new URLSearchParams(location.search);
  const messageIdParam = urlParams.get("id");
  const isEditing = !!messageIdParam;
  const messageIdToEdit = messageIdParam ? parseInt(messageIdParam, 10) : null;

  const clinicId = clinicData?.id;
  const clinicCode = clinicData?.code; // This is the authentication string, not the numeric ID

  const RECUPERAR_ARQUIVO_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo";
  const ENVIAR_ARQUIVO_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase";
  const N8N_CREATE_SEQUENCE_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/c85d9288-8072-43c6-8028-6df18d4843b5"; 
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
        body: JSON.stringify({ arquivo_key: fileKey, clinicId: clinicId }), // Use clinicId (numeric)
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Falha (${response.status}) ao obter URL: ${responseText.substring(0,150)}`);
      }

      if (!responseText.trim()) {
        console.warn(`[MensagensConfigPage] Webhook retornou resposta vazia para ${fileKey} (step ${stepId}).`);
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
          console.error(`[MensagensConfigPage] Resposta não é JSON nem URL válida para ${fileKey} (step ${stepId}):`, responseText.substring(0, 200));
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
      console.error(`[MensagensConfigPage] Error fetching signed URL for key ${fileKey} (step ${stepId}):`, e);
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

      if (isEditing && messageIdToEdit !== null) { 
        try {
          const { data: msgData, error: msgError } = await supabase
              .from('north_clinic_mensagens_sequencias') 
              .select('id, nome_sequencia') 
              .eq('id', messageIdToEdit)
              .eq('id_clinica', clinicId) 
              .single();

          if (msgError) throw msgError;
          if (!msgData) throw new Error("Mensagem não encontrada ou acesso negado.");

          setMessageName(msgData.nome_sequencia); 
          const { data: stepsData, error: stepsError } = await supabase
            .from('north_clinic_mensagens_sequencia_passos') 
            .select('id, tipo_passo, conteudo_texto, url_arquivo, nome_arquivo_original, atraso_valor, atraso_unidade')
            .eq('id_sequencia', msgData.id) 
            .order('ordem', { ascending: true });

          if (stepsError) throw stepsError;

          const loadedSteps: MessageStep[] = (stepsData || [])
            .filter(stepDb => stepDb.tipo_passo !== 'documento')
            .map((stepDb) => ({
                id: stepDb.id.toString() + "_loaded_" + Math.random().toString(36).substring(7), 
                db_id: stepDb.id,
                type: stepDb.tipo_passo as MessageStepType,
                text: stepDb.conteudo_texto || undefined,
                mediaKey: stepDb.url_arquivo || undefined, 
                originalFileName: stepDb.nome_arquivo_original || undefined,
                delayValue: stepDb.atraso_valor || undefined,
                delayUnit: stepDb.atraso_unidade as MessageStep['delayUnit'] || undefined,
            }));
          setMessageSteps(loadedSteps);

        } catch (e: any) {
          console.error("[MensagensConfigPage] Error loading message for editing:", e);
          setError(e.message || "Erro ao carregar dados da mensagem.");
          toast({ title: "Erro ao Carregar", description: e.message, variant: "destructive" });
        } finally {
          setLoading(false);
        }
      } else {
        setMessageName("");
        setMessageSteps([{ id: Date.now().toString(), type: 'texto', text: '' }]);
        setLoading(false);
      }
    }
    loadMessageForEditing();
  }, [clinicId, isEditing, messageIdToEdit, toast]); 

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
    console.log("[MensagensConfigPage] handleSave: Iniciando processo de salvamento...");
    const currentClinicCode = clinicData?.code; // This is the authentication string
    const currentClinicId = clinicData?.id; // This is the numeric ID

    if (!currentClinicId || !currentClinicCode) {
      toast({ title: "Erro", description: "Dados da clínica não disponíveis.", variant: "destructive" }); 
      console.error("[MensagensConfigPage] handleSave: Dados da clínica não disponíveis."); 
      return;
    }
    if (!messageName.trim()) {
      toast({ title: "Erro", description: "Nome da mensagem obrigatório.", variant: "destructive" }); 
      console.error("[MensagensConfigPage] handleSave: Nome da mensagem obrigatório."); 
      return;
    }
    if (messageSteps.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um passo.", variant: "destructive" }); 
      console.error("[MensagensConfigPage] handleSave: Nenhum passo adicionado."); 
      return;
    }

     for (const step of messageSteps) {
         if (step.type === 'texto' && !step.text?.trim()) {
             toast({ title: "Erro", description: "Texto não pode ser vazio.", variant: "destructive" }); 
             console.error("[MensagensConfigPage] handleSave: Passo de texto vazio.", step); 
             return;
         }
         if ((step.type === 'imagem' || step.type === 'video' || step.type === 'audio') && !step.mediaKey && !step.mediaFile) {
              toast({ title: "Erro", description: `Anexe um arquivo para ${step.type}.`, variant: "destructive" }); 
              console.error("[MensagensConfigPage] handleSave: Arquivo de mídia ausente.", step); 
              return;
         }
         if (step.type === 'atraso' && (step.delayValue === undefined || step.delayValue <= 0 || !step.delayUnit)) {
            toast({ title: "Erro", description: "Atraso inválido.", variant: "destructive" }); 
            console.error("[MensagensConfigPage] handleSave: Atraso inválido.", step); 
            return;
         }
     }

    setSaving(true); setError(null);
    console.log("[MensagensConfigPage] handleSave: Validações passaram, iniciando try block."); 

    try {
      console.log("[MensagensConfigPage] handleSave: Processando steps..."); 
      const processedSteps = await Promise.all(
        messageSteps.map(async (step, idx) => {
          console.log(`[MensagensConfigPage] handleSave: Processando step ${idx + 1}`, step);
          let currentMediaKey = step.mediaKey;
          if (step.mediaFile && (step.type === 'imagem' || step.type === 'video' || step.type === 'audio')) {
              console.log(`[MensagensConfigPage] handleSave: Step ${idx + 1} - Fazendo upload de ${step.mediaFile.name}`); 
              const formData = new FormData();
              formData.append("data", step.mediaFile, step.mediaFile.name);
              formData.append("fileName", step.mediaFile.name);
              formData.append("clinicId", currentClinicId.toString()); // Use currentClinicId (numeric)
              
              const uploadRes = await fetch(ENVIAR_ARQUIVO_WEBHOOK_URL, { method: "POST", body: formData });
              console.log(`[MensagensConfigPage] handleSave: Step ${idx + 1} - Resposta do upload: status ${uploadRes.status}, ok: ${uploadRes.ok}`); 
              if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                console.error(`[MensagensConfigPage] handleSave: Step ${idx + 1} - Falha no upload:`, errorText); 
                throw new Error(`Upload falhou (${step.mediaFile.name}): ${errorText.substring(0,150)}`);
              }
              const uploadData = await uploadRes.json();
              console.log(`[MensagensConfigPage] handleSave: Step ${idx + 1} - Dados do upload:`, uploadData); 
              currentMediaKey = (Array.isArray(uploadData) && uploadData[0]?.Key) || uploadData.Key || uploadData.key || null;
              if (!currentMediaKey) {
                console.error(`[MensagensConfigPage] handleSave: Step ${idx + 1} - Chave de mídia inválida após upload. Dados recebidos:`, uploadData); 
                throw new Error(`Chave de mídia inválida para ${step.mediaFile.name}.`);
              }
              console.log(`[MensagensConfigPage] handleSave: Step ${idx + 1} - MediaKey obtida: ${currentMediaKey}`); 
          }
          return { 
            ...step, 
            mediaKey: currentMediaKey, 
            mediaFile: undefined 
          };
      }));
      console.log("[MensagensConfigPage] handleSave: Steps processados:", processedSteps); 
      
      const messagePayloadForN8N = { 
        event: isEditing && messageIdToEdit ? "sequence_updated" : "sequence_created", 
        sequenceId: isEditing && messageIdToEdit ? messageIdToEdit : undefined, 
        clinicCode: currentClinicCode, // This is the authentication string, kept for compatibility if n8n needs it
        clinicDbId: currentClinicId, // This is the numeric ID, use this for DB operations
        sequenceName: messageName, 
        contexto: 'leads', 
        ativo: true, 
        steps: processedSteps.map((step, index) => ({
          db_id: step.db_id, 
          ordem: index + 1,
          tipo_passo: step.type,
          conteudo_texto: step.text || null,
          url_arquivo: step.mediaKey || null, 
          nome_arquivo_original: step.originalFileName || null,
          atraso_valor: step.type === 'atraso' ? step.delayValue : null,
          atraso_unidade: step.type === 'atraso' ? step.delayUnit : null,
        })),
      };
      console.log("[MensagensConfigPage] handleSave: Payload para N8N:", JSON.stringify(messagePayloadForN8N, null, 2)); 

      const targetWebhookUrl = isEditing && messageIdToEdit 
        ? N8N_UPDATE_SEQUENCE_WEBHOOK_URL 
        : N8N_CREATE_SEQUENCE_WEBHOOK_URL;
      console.log("[MensagensConfigPage] handleSave: Enviando para webhook:", targetWebhookUrl); 

      const webhookResponse = await fetch(targetWebhookUrl, { 
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(messagePayloadForN8N),
      });
      console.log("[MensagensConfigPage] handleSave: Resposta do Webhook N8N - Status:", webhookResponse.status, "OK:", webhookResponse.ok); 

      if (!webhookResponse.ok) {
        console.log("[MensagensConfigPage] handleSave: Webhook response NOT OK. Tentando ler corpo do erro..."); 
        const errTxt = await webhookResponse.text().catch((e) => {
            console.error("[MensagensConfigPage] handleSave: Erro ao ler corpo da resposta do webhook:", e); 
            return "Erro ao ler corpo da resposta do webhook.";
        }); 
        console.log("[MensagensConfigPage] handleSave: Corpo do erro do webhook (raw):", errTxt); 
        let detailedError = `Falha na comunicação com o webhook (${webhookResponse.status}).`;
        if (errTxt && errTxt !== "Erro ao ler corpo da resposta do webhook.") {
            try {
                const jsonError = JSON.parse(errTxt);
                detailedError = jsonError.message || jsonError.error || `Erro ${webhookResponse.status}: ${errTxt.substring(0,100)}`;
            } catch (parseError) {
                detailedError = `Erro ${webhookResponse.status}: ${errTxt.substring(0,150)}`;
            }
        }
        console.error("[MensagensConfigPage] handleSave: Webhook N8N response NOT OK. DetailedError:", detailedError); 
        throw new Error(detailedError); 
      }
      
      console.log("[MensagensConfigPage] handleSave: Webhook N8N OK. Exibindo toast de sucesso."); 
      toast({ title: "Sucesso", description: `Mensagem "${messageName}" salva.` });
      if (currentClinicId) {
        console.log("[MensagensConfigPage] handleSave: Invalidando queries para ['leadMessagesList',", currentClinicId, "]"); 
        queryClient.invalidateQueries({ queryKey: ['leadMessagesList', currentClinicId] }); 
      }
      
      console.log("[MensagensConfigPage] handleSave: Agendando navegação."); 
      setTimeout(() => {
        console.log("[MensagensConfigPage] handleSave: Navegando..."); 
        if (currentClinicCode) navigate(`/dashboard/9?clinic_code=${encodeURIComponent(currentClinicCode)}&status=${isEditing ? "updated_sent" : "created_sent"}`);
        else navigate(`/dashboard/9?status=${isEditing ? "updated_sent" : "created_sent"}`); 
      }, 1000);

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