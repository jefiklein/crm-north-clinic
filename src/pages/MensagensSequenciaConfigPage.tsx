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
  const clinicCode = clinicData?.code; 

  const RECUPERAR_ARQUIVO_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo";
  const ENVIAR_ARQUIVO_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase";
  const N8N_SAVE_SEQUENCE_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/c85d9288-8072-43c6-8028-6df18d4843b5";

  // Function to fetch signed URL (modified to be more flexible with webhook response)
  const fetchSignedUrlForPreview = async (fileKey: string, stepId: string): Promise<void> => {
    if (!fileKey || !clinicCode) {
      setMediaPreviewUrls(prev => ({ ...prev, [stepId]: null }));
      setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: false, error: "Chave do arquivo ou código da clínica ausente." } }));
      return;
    }

    setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: true, error: null } }));
    setMediaPreviewUrls(prev => ({ ...prev, [stepId]: null }));

    try {
      const response = await fetch(RECUPERAR_ARQUIVO_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivo_key: fileKey, clinicId: clinicCode }), 
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
        signedUrl = data?.signedURL || data?.url || data?.link || (typeof data === 'string' ? data : null); 
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string' && data[0].startsWith('http')) { 
            signedUrl = data[0];
        } else if (Array.isArray(data) && data.length > 0 && (data[0]?.signedURL || data[0]?.url || data[0]?.link)) { 
            signedUrl = data[0]?.signedURL || data[0]?.url || data[0]?.link;
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
        throw new Error(`URL assinada não extraída da resposta do webhook. Resposta: ${responseText.substring(0,100)}`);
      }
    } catch (e: any) {
      console.error(`[MensagensConfigPage] Error fetching signed URL for key ${fileKey} (step ${stepId}):`, e);
      setMediaPreviewUrls(prev => ({ ...prev, [stepId]: null }));
      setMediaPreviewStatus(prev => ({ ...prev, [stepId]: { isLoading: false, error: e.message || 'Erro ao carregar preview.' } }));
    }
  };
  
  // useEffect to fetch signed URLs for existing mediaKeys when messageSteps are loaded/changed
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
  }, [messageSteps, clinicCode]); 

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
    const currentClinicCode = clinicData?.code;
    const currentClinicId = clinicData?.id;

    if (!currentClinicId || !currentClinicCode) {
      toast({ title: "Erro", description: "Dados da clínica não disponíveis.", variant: "destructive" }); return;
    }
    if (!messageName.trim()) {
      toast({ title: "Erro", description: "Nome da mensagem obrigatório.", variant: "destructive" }); return;
    }
    if (messageSteps.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um passo.", variant: "destructive" }); return;
    }

     for (const step of messageSteps) {
         if (step.type === 'texto' && !step.text?.trim()) {
             toast({ title: "Erro", description: "Texto não pode ser vazio.", variant: "destructive" }); return;
         }
         if ((step.type === 'imagem' || step.type === 'video' || step.type === 'audio') && !step.mediaKey && !step.mediaFile) {
              toast({ title: "Erro", description: `Anexe um arquivo para ${step.type}.`, variant: "destructive" }); return;
         }
         if (step.type === 'atraso' && (step.delayValue === undefined || step.delayValue <= 0 || !step.delayUnit)) {
            toast({ title: "Erro", description: "Atraso inválido.", variant: "destructive" }); return;
         }
     }

    setSaving(true); setError(null);

    try {
      const processedSteps = await Promise.all(
        messageSteps.map(async (step) => {
          let currentMediaKey = step.mediaKey;
          if (step.mediaFile && (step.type === 'imagem' || step.type === 'video' || step.type === 'audio')) {
              const formData = new FormData();
              formData.append("data", step.mediaFile, step.mediaFile.name);
              formData.append("fileName", step.mediaFile.name);
              formData.append("clinicId", currentClinicCode);
              
              const uploadRes = await fetch(ENVIAR_ARQUIVO_WEBHOOK_URL, { method: "POST", body: formData });
              if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`Upload falhou (${step.mediaFile.name}): ${errorText.substring(0,150)}`);
              }
              const uploadData = await uploadRes.json();
              currentMediaKey = (Array.isArray(uploadData) && uploadData[0]?.Key) || uploadData.Key || uploadData.key || null;
              if (!currentMediaKey) throw new Error(`Chave de mídia inválida para ${step.mediaFile.name}.`);
          }
          return { 
            ...step, 
            mediaKey: currentMediaKey, 
            mediaFile: undefined 
          };
      }));
      
      const messagePayloadForN8N = { 
        event: isEditing && messageIdToEdit ? "sequence_updated" : "sequence_created", 
        sequenceId: isEditing && messageIdToEdit ? messageIdToEdit : undefined, 
        clinicCode: currentClinicCode,
        clinicDbId: currentClinicId,
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

      const webhookResponse = await fetch(N8N_SAVE_SEQUENCE_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(messagePayloadForN8N),
      });

      if (!webhookResponse.ok) {
        const errTxt = await webhookResponse.text();
        throw new Error(`Salvar sequência falhou: ${errTxt.substring(0,250)}`);
      }
      
      toast({ title: "Sucesso", description: `Mensagem "${messageName}" salva.` });
      if (currentClinicId) queryClient.invalidateQueries({ queryKey: ['leadMessagesList', currentClinicId] }); 
      
      setTimeout(() => {
        if (currentClinicCode) navigate(`/dashboard/9?clinic_code=${encodeURIComponent(currentClinicCode)}&status=${isEditing ? "updated_sent" : "created_sent"}`);
        else navigate(`/dashboard/9?status=${isEditing ? "updated_sent" : "created_sent"}`); 
      }, 1000);

    } catch (e: any) {
      console.error("[MensagensConfigPage] Error in handleSave:", e);
      setError(e.message || "Erro ao salvar.");
      toast({ title: "Erro ao Salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!clinicCode) return;
    navigate(`/dashboard/9?clinic_code=${encodeURIComponent(clinicCode)}`);
  };

  const pageTitle = isEditing ? "Editar Mensagem" : "Nova Mensagem";

  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-4 md:p-6 w-full">
      <Card className="w-full shadow-lg">
        <CardHeader><CardTitle>{pageTitle}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-primary py-10"><Loader2 className="animate-spin h-8 w-8" /> Carregando...</div>
          ) : error ? (
            <div className="text-red-600 font-semibold flex items-center gap-2 p-4 bg-red-50 border border-red-300 rounded-md"><TriangleAlert className="h-5 w-5" /> {error}</div>
          ) : (
            <>
              <div>
                <label htmlFor="messageName" className="block mb-1 font-medium text-gray-700">Nome da Mensagem *</label>
                <Input id="messageName" value={messageName} onChange={(e) => setMessageName(e.target.value)} placeholder="Ex: Boas-vindas Lead Frio" disabled={saving} maxLength={100} />
                <p className="text-sm text-gray-500 mt-1">Nome para identificar esta mensagem.</p>
              </div>

              <div className="message-steps-area flex flex-col gap-4 border rounded-md p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Passos da Mensagem</h3>
                {messageSteps.length === 0 && <div className="text-center text-gray-600 italic py-6">Nenhum passo. Adicione um abaixo.</div>}

                {messageSteps.map((step, index) => {
                  const previewUrl = mediaPreviewUrls[step.id];
                  const status = mediaPreviewStatus[step.id];
                  const isLoadingMedia = status?.isLoading ?? false;
                  const mediaError = status?.error ?? null;

                  return (
                    <Card key={step.id} className="step-card p-4 shadow-sm border border-gray-200 bg-white">
                      <CardContent className="p-0 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">Passo {index + 1}</span>
                          <Button variant="destructive" size="sm" onClick={() => handleRemoveStep(step.id)} disabled={saving}>
                            <Trash2 className="h-4 w-4 mr-1" /> Remover
                          </Button>
                        </div>
                        <div>
                          <label htmlFor={`step-type-${step.id}`} className="block mb-1 font-medium text-gray-700">Tipo</label>
                          <Select
                            value={step.type}
                            onValueChange={(value) => {
                              const newType = value as MessageStepType;
                              handleUpdateStep(step.id, {
                                type: newType, text: newType === 'texto' ? (step.text || '') : undefined,
                                mediaFile: undefined, mediaKey: undefined, originalFileName: undefined,
                                delayValue: newType === 'atraso' ? (step.delayValue || 60) : undefined,
                                delayUnit: newType === 'atraso' ? (step.delayUnit || 'segundos') : undefined,
                              });
                              if (!(newType === 'imagem' || newType === 'video' || newType === 'audio')) {
                                setMediaPreviewUrls(prev => ({...prev, [step.id]: null}));
                                setMediaPreviewStatus(prev => ({...prev, [step.id]: {isLoading: false, error: null}}));
                              }
                            }}
                            id={`step-type-${step.id}`} disabled={saving}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="texto">Texto</SelectItem>
                              <SelectItem value="imagem">Imagem</SelectItem>
                              <SelectItem value="video">Vídeo</SelectItem>
                              <SelectItem value="audio">Áudio</SelectItem>
                              <SelectItem value="atraso">Atraso (Pausa)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {step.type === 'texto' && (
                          <div>
                            <label htmlFor={`step-text-${step.id}`} className="block mb-1 font-medium text-gray-700">Texto</label>
                            <Textarea id={`step-text-${step.id}`} rows={4} value={step.text || ''} onChange={(e) => handleUpdateStep(step.id, { text: e.target.value })} placeholder="Digite o texto..." disabled={saving} />
                          </div>
                        )}

                        {(step.type === 'imagem' || step.type === 'video' || step.type === 'audio') && (
                          <div>
                            <label htmlFor={`step-media-${step.id}`} className="block mb-1 font-medium text-gray-700">Anexar Arquivo ({step.type})</label>
                            <Input type="file" id={`step-media-${step.id}`}
                              accept={
                                step.type === 'imagem' ? ALLOWED_IMAGE_TYPES.join(',') :
                                step.type === 'video' ? ALLOWED_VIDEO_TYPES.join(',') :
                                step.type === 'audio' ? ALLOWED_AUDIO_TYPES.join(',') : '*'
                              }
                              onChange={(e) => handleMediaFileChange(step.id, e.target.files ? e.target.files[0] : null)}
                              disabled={saving}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {step.type === 'imagem' && `Max ${MAX_IMAGE_SIZE_MB}MB. Tipos: JPG, PNG, GIF, WEBP`}
                              {step.type === 'video' && `Max ${MAX_VIDEO_SIZE_MB}MB. Tipos: MP4, WEBM, MOV`}
                              {step.type === 'audio' && `Max ${MAX_AUDIO_SIZE_MB}MB. Tipos: MP3, OGG, WAV`}
                            </p>
                            
                            {isLoadingMedia && <div className="mt-2 text-sm text-primary"><Loader2 className="inline h-4 w-4 animate-spin mr-1" />Carregando preview...</div>}
                            {mediaError && <div className="mt-2 text-sm text-red-600"><TriangleAlert className="inline h-4 w-4 mr-1" />{mediaError}</div>}
                            
                            {previewUrl && !mediaError && (
                              <div className="mt-2">
                                {step.type === 'imagem' && <img src={previewUrl} alt={step.originalFileName || "Preview"} className="max-w-xs rounded" />}
                                {step.type === 'video' && <video src={previewUrl} controls className="max-w-xs rounded" />}
                                {step.type === 'audio' && <audio src={previewUrl} controls />}
                              </div>
                            )}
                            {step.originalFileName && !previewUrl && !isLoadingMedia && !mediaError && (
                               <p className="text-sm text-gray-600 mt-1">Arquivo: {step.originalFileName} (preview indisponível)</p>
                            )}
                          </div>
                        )}

                        {step.type === 'atraso' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor={`step-delay-value-${step.id}`} className="block mb-1 font-medium text-gray-700">Duração *</label>
                              <Input id={`step-delay-value-${step.id}`} type="number" placeholder="Ex: 30" value={step.delayValue?.toString() || ''} onChange={(e) => handleUpdateStep(step.id, { delayValue: parseInt(e.target.value, 10) || 0 })} min="1" disabled={saving} />
                            </div>
                            <div>
                              <label htmlFor={`step-delay-unit-${step.id}`} className="block mb-1 font-medium text-gray-700">Unidade *</label>
                              <Select value={step.delayUnit || 'segundos'} onValueChange={(value) => handleUpdateStep(step.id, { delayUnit: value as MessageStep['delayUnit'] })} id={`step-delay-unit-${step.id}`} disabled={saving}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="segundos">Segundos</SelectItem>
                                  <SelectItem value="minutos">Minutos</SelectItem>
                                  <SelectItem value="horas">Horas</SelectItem>
                                  <SelectItem value="dias">Dias</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <p className="text-sm text-gray-500 mt-1 md:col-span-2">Tempo de espera.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <Button variant="outline" onClick={() => handleAddStep('texto')} disabled={saving}><Plus className="h-4 w-4 mr-2" /> Texto</Button>
                  <Button variant="outline" onClick={() => handleAddStep('imagem')} disabled={saving}><Plus className="h-4 w-4 mr-2" /> Imagem</Button>
                  <Button variant="outline" onClick={() => handleAddStep('video')} disabled={saving}><Plus className="h-4 w-4 mr-2" /> Vídeo</Button>
                  <Button variant="outline" onClick={() => handleAddStep('audio')} disabled={saving}><Plus className="h-4 w-4 mr-2" /> Áudio</Button>
                  <Button variant="outline" onClick={() => handleAddStep('atraso')} disabled={saving}><Plus className="h-4 w-4 mr-2" /> Atraso</Button>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t mt-4">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || loading || !!error}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : (isEditing ? "Salvar Alterações" : "Criar Mensagem")}
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