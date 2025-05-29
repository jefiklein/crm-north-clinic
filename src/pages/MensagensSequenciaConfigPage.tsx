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
  id: string; 
  db_id?: number; 
  type: MessageStepType; 
  text?: string; 
  mediaFile?: File | null; 
  mediaKey?: string | null; // Stores the key/path of the uploaded file
  previewUrl?: string | null; // Stores blob URL or signed URL for preview
  originalFileName?: string; 
  delayValue?: number; 
  delayUnit?: 'segundos' | 'minutos' | 'horas' | 'dias'; 
}

// ... (constants for file validation remain the same) ...
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

  const urlParams = new URLSearchParams(location.search);
  const messageIdParam = urlParams.get("id");
  const isEditing = !!messageIdParam;
  const messageIdToEdit = messageIdParam ? parseInt(messageIdParam, 10) : null;

  const clinicId = clinicData?.id;
  const clinicCode = clinicData?.code; 

  const RECUPERAR_ARQUIVO_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo";
  const ENVIAR_ARQUIVO_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase";
  const N8N_SAVE_SEQUENCE_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/c85d9288-8072-43c6-8028-6df18d4843b5";


  const fetchSignedUrl = async (fileKey: string): Promise<string | null> => {
    if (!fileKey) return null;
    try {
      // console.log(`[MensagensConfigPage] Fetching signed URL for key: ${fileKey} using clinicCode: ${clinicCode}`);
      const response = await fetch(RECUPERAR_ARQUIVO_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileKey, clinicId: clinicCode }), // Assuming clinicCode is needed for namespacing/bucket
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MensagensConfigPage] Failed to fetch signed URL for ${fileKey}: ${response.status} ${errorText}`);
        throw new Error(`Falha ao obter URL assinada para ${fileKey}. Status: ${response.status}`);
      }
      const data = await response.json();
      // console.log(`[MensagensConfigPage] Received signed URL data for ${fileKey}:`, data);
      if (data && data.signedURL) { // N8N usually returns signedURL in caps
        return data.signedURL;
      } else if (data && data.url) { // Fallback if it's just 'url'
        return data.url;
      }
      console.warn(`[MensagensConfigPage] Signed URL not found in response for ${fileKey}:`, data);
      return null;
    } catch (e: any) {
      console.error(`[MensagensConfigPage] Error fetching signed URL for ${fileKey}:`, e);
      toast({ title: "Erro de Preview", description: `Não foi possível carregar o preview para um arquivo: ${e.message}`, variant: "destructive" });
      return null;
    }
  };
  

  useEffect(() => {
    async function loadMessageForEditing() {
      if (!clinicId) {
        setError("ID da clínica não disponível.");
        setLoading(false);
        return;
      }

      if (isEditing && messageIdToEdit !== null) { 
        try {
          const { data: msgData, error: msgError } = await supabase
              .from('north_clinic_mensagens_sequencias') 
              .select('id, nome_sequencia, contexto, ativo') 
              .eq('id', messageIdToEdit)
              .eq('id_clinica', clinicId) 
              .single();

          if (msgError) throw msgError;
          if (!msgData) throw new Error("Mensagem não encontrada ou acesso negado.");

          setMessageName(msgData.nome_sequencia); 
          const { data: stepsData, error: stepsError } = await supabase
            .from('north_clinic_mensagens_sequencia_passos') 
            .select('id, tipo_passo, conteudo_texto, url_arquivo, nome_arquivo_original, atraso_valor, atraso_unidade') // url_arquivo is the mediaKey
            .eq('id_sequencia', msgData.id) 
            .order('ordem', { ascending: true });

          if (stepsError) throw stepsError;

          const loadedStepsPromises: Promise<MessageStep>[] = (stepsData || [])
            .filter(step => step.tipo_passo !== 'documento')
            .map(async (step) => {
              let previewUrl = null;
              if (step.url_arquivo && (step.tipo_passo === 'imagem' || step.tipo_passo === 'video' || step.tipo_passo === 'audio')) {
                previewUrl = await fetchSignedUrl(step.url_arquivo);
              }
              return {
                id: step.id.toString(), 
                db_id: step.id,
                type: step.tipo_passo as MessageStepType,
                text: step.conteudo_texto || undefined,
                mediaKey: step.url_arquivo || undefined, // url_arquivo from DB is the mediaKey
                previewUrl: previewUrl,
                originalFileName: step.nome_arquivo_original || undefined,
                delayValue: step.atraso_valor || undefined,
                delayUnit: step.atraso_unidade as MessageStep['delayUnit'] || undefined,
              };
          });
          const resolvedSteps = await Promise.all(loadedStepsPromises);
          setMessageSteps(resolvedSteps);

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
    setLoading(true); 
    setError(null);   
    loadMessageForEditing();
  }, [clinicId, isEditing, messageIdToEdit, toast, clinicCode]); // Added clinicCode dependency for fetchSignedUrl

  const handleAddStep = (type: MessageStepType = 'texto') => {
      setMessageSteps(prev => [
          ...prev,
          { 
            id: Date.now().toString() + Math.random().toString().slice(2, 8), 
            type, 
            text: type === 'texto' ? '' : undefined, 
            delayValue: type === 'atraso' ? 60 : undefined, 
            delayUnit: type === 'atraso' ? 'segundos' : undefined,
          }
      ]);
  };

  const handleRemoveStep = (id: string) => {
      setMessageSteps(prev => {
        const stepToRemove = prev.find(s => s.id === id);
        if (stepToRemove?.previewUrl && stepToRemove.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(stepToRemove.previewUrl);
        }
        return prev.filter(step => step.id !== id);
      });
  };

  const handleUpdateStep = (id: string, updates: Partial<MessageStep>) => {
      setMessageSteps(prev => prev.map(step =>
          step.id === id ? { ...step, ...updates } : step
      ));
  };

  const handleMediaFileChange = (stepId: string, file: File | null) => {
    const step = messageSteps.find(s => s.id === stepId);
    if (!step) return;

    // Revoke old blob URL if it exists
    if (step.previewUrl && step.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(step.previewUrl);
    }

    if (file) {
        let maxSizeMB: number;
        let allowedTypes: string[];
        let typeName: string;

        switch (step.type) {
            case 'imagem': maxSizeMB = MAX_IMAGE_SIZE_MB; allowedTypes = ALLOWED_IMAGE_TYPES; typeName = 'Imagem'; break;
            case 'video': maxSizeMB = MAX_VIDEO_SIZE_MB; allowedTypes = ALLOWED_VIDEO_TYPES; typeName = 'Vídeo'; break;
            case 'audio': maxSizeMB = MAX_AUDIO_SIZE_MB; allowedTypes = ALLOWED_AUDIO_TYPES; typeName = 'Áudio'; break;
            default: toast({ title: "Erro", description: "Tipo de passo inválido para mídia.", variant: "destructive" }); return;
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            toast({ title: "Arquivo Muito Grande", description: `${typeName} não pode exceder ${maxSizeMB}MB.`, variant: "destructive" });
            handleUpdateStep(stepId, { mediaFile: null, previewUrl: null, originalFileName: undefined });
            const inputElement = document.getElementById(`step-media-${stepId}`) as HTMLInputElement;
            if (inputElement) inputElement.value = "";
            return;
        }

        if (!allowedTypes.includes(file.type)) {
            toast({ title: "Formato de Arquivo Inválido", description: `Formato de ${typeName.toLowerCase()} não suportado.`, variant: "destructive" });
            handleUpdateStep(stepId, { mediaFile: null, previewUrl: null, originalFileName: undefined });
            const inputElement = document.getElementById(`step-media-${stepId}`) as HTMLInputElement;
            if (inputElement) inputElement.value = "";
            return;
        }

        const newPreviewUrl = URL.createObjectURL(file);
        handleUpdateStep(stepId, { mediaFile: file, previewUrl: newPreviewUrl, originalFileName: file.name, mediaKey: null }); // Clear mediaKey if a new file is selected
    } else {
        handleUpdateStep(stepId, { mediaFile: null, previewUrl: null, originalFileName: undefined });
    }
  };

  useEffect(() => {
      return () => {
          messageSteps.forEach(step => {
              if (step.previewUrl && step.previewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(step.previewUrl);
              }
          });
      };
  }, [messageSteps]);

  const handleSave = async () => {
    const currentClinicCode = clinicData?.code;
    const currentClinicId = clinicData?.id;

    if (!currentClinicId || !currentClinicCode) {
      toast({ title: "Erro", description: "Dados da clínica não disponíveis.", variant: "destructive" });
      return;
    }
    if (!messageName.trim()) {
        toast({ title: "Erro", description: "O nome da mensagem é obrigatório.", variant: "destructive" });
        return;
    }
    if (messageSteps.length === 0) {
        toast({ title: "Erro", description: "Adicione pelo menos um passo à mensagem.", variant: "destructive" });
        return;
    }

     for (const step of messageSteps) {
         if (step.type === 'texto' && !step.text?.trim()) {
             toast({ title: "Erro", description: "O texto não pode ser vazio para passos de texto.", variant: "destructive" });
             return;
         }
         // If it's a media step, it must have a mediaKey (if already saved) or a mediaFile (if new)
         if ((step.type === 'imagem' || step.type === 'video' || step.type === 'audio') && !step.mediaKey && !step.mediaFile) {
              toast({ title: "Erro", description: `Anexe um arquivo para o passo de ${step.type}.`, variant: "destructive" });
              return;
         }
         if (step.type === 'atraso') {
            if (step.delayValue === undefined || isNaN(step.delayValue) || step.delayValue <= 0) {
                toast({ title: "Erro", description: "O valor do atraso deve ser um número positivo.", variant: "destructive" });
                return;
            }
            if (!step.delayUnit) {
                toast({ title: "Erro", description: "A unidade do atraso é obrigatória.", variant: "destructive" });
                return;
            }
         }
     }

    setSaving(true);
    setError(null);

    try {
      const stepsToSave = await Promise.all(
        messageSteps.map(async (step) => {
          if (step.mediaFile && (step.type === 'imagem' || step.type === 'video' || step.type === 'audio')) {
              const formData = new FormData();
              formData.append("data", step.mediaFile, step.mediaFile.name);
              formData.append("fileName", step.mediaFile.name);
              formData.append("clinicId", currentClinicCode); // clinicCode is used for namespacing/bucket
              
              const uploadRes = await fetch(ENVIAR_ARQUIVO_WEBHOOK_URL, { method: "POST", body: formData });

              if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`Falha ao enviar mídia (${step.mediaFile.name}): ${errorText.substring(0, 150)}...`);
              }
              const uploadData = await uploadRes.json();
              const savedMediaKey = (Array.isArray(uploadData) && uploadData[0]?.Key) || uploadData.Key || uploadData.key || null;
              if (!savedMediaKey) throw new Error(`Chave de mídia inválida para ${step.mediaFile.name}.`);
              
              // Fetch signed URL for immediate preview update if needed, though navigation will occur
              // const newPreviewUrl = await fetchSignedUrl(savedMediaKey);

              return { 
                ...step, 
                mediaKey: savedMediaKey, 
                // previewUrl: newPreviewUrl || step.previewUrl, // Keep blob if signed fails, or update
                mediaFile: undefined // Clear the file object
              };
          }
          return step; // Return step as is if no new file to upload
      }));
      
      // Update state with new mediaKeys and potentially new previewUrls from signed URLs
      // This ensures the state is consistent if we don't navigate away immediately
      // setMessageSteps(stepsToSave); // This might be too quick if navigation is immediate

      const messagePayloadForN8N = { 
        event: isEditing && messageIdToEdit ? "sequence_updated" : "sequence_created", 
        sequenceId: isEditing && messageIdToEdit ? messageIdToEdit : undefined, 
        clinicCode: currentClinicCode,
        clinicDbId: currentClinicId,
        sequenceName: messageName, 
        contexto: 'leads', 
        ativo: true, 
        steps: stepsToSave.map((step, index) => ({
          db_id: step.db_id, 
          ordem: index + 1,
          tipo_passo: step.type,
          conteudo_texto: step.text || null,
          url_arquivo: step.mediaKey || null, // Save mediaKey as url_arquivo
          nome_arquivo_original: step.originalFileName || null,
          atraso_valor: step.type === 'atraso' ? step.delayValue : null,
          atraso_unidade: step.type === 'atraso' ? step.delayUnit : null,
        })),
      };

      console.log("[MensagensConfigPage] Sending payload to n8n sequence webhook:", messagePayloadForN8N);

      const webhookResponse = await fetch(N8N_SAVE_SEQUENCE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messagePayloadForN8N),
      });

      if (!webhookResponse.ok) {
        const webhookErrorText = await webhookResponse.text();
        console.error(`[MensagensConfigPage] n8n Sequence Webhook call failed: ${webhookErrorText}`);
        let parsedError = webhookErrorText;
        try { const jsonError = JSON.parse(webhookErrorText); parsedError = jsonError.message || jsonError.error || webhookErrorText; } catch (parseErr) {}
        throw new Error(`Falha ao salvar sequência via n8n: ${parsedError.substring(0, 250)}`);
      }

      const webhookResult = await webhookResponse.json();
      console.log("[MensagensConfigPage] n8n Sequence Webhook call successful:", webhookResult);
      
      toast({ title: "Sucesso", description: `Mensagem "${messageName}" salva.` });

      if (currentClinicId) { 
        queryClient.invalidateQueries({ queryKey: ['leadMessagesList', currentClinicId] }); 
      }
      
      setTimeout(() => {
        if (currentClinicCode) {
            navigate(`/dashboard/9?clinic_code=${encodeURIComponent(currentClinicCode)}&status=${isEditing ? "updated_sent" : "created_sent"}`);
        } else {
            navigate(`/dashboard/9?status=${isEditing ? "updated_sent" : "created_sent"}`); 
        }
      }, 1500);

    } catch (e: any) {
      console.error("[MensagensConfigPage] Error in handleSave:", e);
      setError(e.message || "Erro ao processar a mensagem");
      toast({ title: "Erro no Processamento", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!clinicCode) return;
    navigate(`/dashboard/9?clinic_code=${encodeURIComponent(clinicCode)}`);
  };

  const pageTitle = isEditing ? "Editar Mensagem" : "Nova Mensagem";
  const isLoadingData = loading; 
  const fetchError = error; 

  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-4 md:p-6 w-full">
      <Card className="w-full shadow-lg">
        <CardHeader><CardTitle>{pageTitle}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isLoadingData ? (
            <div className="flex items-center justify-center gap-2 text-primary py-10">
              <Loader2 className="animate-spin h-8 w-8" /> Carregando...
            </div>
          ) : fetchError ? (
            <div className="text-red-600 font-semibold flex items-center gap-2 p-4 bg-red-50 border border-red-300 rounded-md">
              <TriangleAlert className="h-5 w-5" /> {fetchError}
            </div>
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

                {messageSteps.map((step, index) => (
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
                              mediaFile: undefined, mediaKey: undefined, previewUrl: undefined, originalFileName: undefined,
                              delayValue: newType === 'atraso' ? (step.delayValue || 60) : undefined,
                              delayUnit: newType === 'atraso' ? (step.delayUnit || 'segundos') : undefined,
                            });
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
                          {step.previewUrl && ( // Use previewUrl for display
                            <div className="mt-2">
                              {step.type === 'imagem' && <img src={step.previewUrl} alt={step.originalFileName || "Preview"} className="max-w-xs rounded" />}
                              {step.type === 'video' && <video src={step.previewUrl} controls className="max-w-xs rounded" />}
                              {step.type === 'audio' && <audio src={step.previewUrl} controls />}
                            </div>
                          )}
                          {/* Display original file name if available, especially if preview fails or for context */}
                          {step.originalFileName && !step.previewUrl && (
                             <p className="text-sm text-gray-600 mt-1">Arquivo: {step.originalFileName} (preview indisponível)</p>
                          )}
                           {!step.previewUrl && step.mediaFile && ( // Fallback for newly selected file if blob URL isn't ready
                            <p className="text-sm text-gray-600 mt-1">Selecionado: {step.mediaFile.name}</p>
                          )}
                           {step.mediaKey && step.originalFileName && ( // Show if it's a saved file
                            <p className="text-sm text-gray-600 mt-1">Arquivo salvo: {step.originalFileName}</p>
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
                ))}

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
                <Button onClick={handleSave} disabled={saving || isLoadingData || !!fetchError}>
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