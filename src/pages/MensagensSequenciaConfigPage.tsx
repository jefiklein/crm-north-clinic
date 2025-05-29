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
import { Loader2, Smile, TriangleAlert, Plus, Trash2 } from "lucide-react"; 
import { useLocation, useNavigate } from "react-router-dom"; 
import { cn } from '@/lib/utils'; 
import { useQuery, useQueryClient } from "@tanstack/react-query"; 

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface MessageStep {
  id: string; 
  db_id?: number; 
  type: 'texto' | 'imagem' | 'video' | 'audio' | 'documento' | 'atraso'; 
  text?: string; 
  mediaFile?: File | null; 
  mediaUrl?: string | null; 
  originalFileName?: string; 
  delayValue?: number; 
  delayUnit?: 'segundos' | 'minutos' | 'horas' | 'dias'; 
}

interface MessageData {
  id?: number; 
  id_clinica: number | string; 
  nome_mensagem: string;
  contexto: 'leads'; // Contexto 'leads' is still used internally
  ativo: boolean;
}

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
            .select('id, tipo_passo, conteudo_texto, url_arquivo, nome_arquivo_original, atraso_valor, atraso_unidade')
            .eq('id_sequencia', msgData.id) 
            .order('ordem', { ascending: true });

          if (stepsError) throw stepsError;

          const loadedSteps: MessageStep[] = (stepsData || []).map(step => ({
            id: step.id.toString(), 
            db_id: step.id,
            type: step.tipo_passo as MessageStep['type'],
            text: step.conteudo_texto || undefined,
            mediaUrl: step.url_arquivo || undefined,
            originalFileName: step.nome_arquivo_original || undefined,
            delayValue: step.atraso_valor || undefined,
            delayUnit: step.atraso_unidade as MessageStep['delayUnit'] || undefined,
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
    setLoading(true); 
    setError(null);   
    loadMessageForEditing();
  }, [clinicId, isEditing, messageIdToEdit, toast]);

  const handleAddStep = (type: MessageStep['type'] = 'texto') => {
      setMessageSteps(prev => [
          ...prev,
          { 
            id: Date.now().toString() + Math.random().toString().slice(2, 8), 
            type, 
            text: type === 'texto' ? '' : undefined, 
            mediaFile: undefined, 
            mediaUrl: undefined, 
            delayValue: type === 'atraso' ? 60 : undefined, 
            delayUnit: type === 'atraso' ? 'segundos' : undefined,
          }
      ]);
  };

  const handleRemoveStep = (id: string) => {
      setMessageSteps(prev => prev.filter(step => step.id !== id));
  };

  const handleUpdateStep = (id: string, updates: Partial<MessageStep>) => {
      setMessageSteps(prev => prev.map(step =>
          step.id === id ? { ...step, ...updates } : step
      ));
  };

  const handleMediaFileChange = (stepId: string, file: File | null) => {
      if (file) {
          const previewUrl = URL.createObjectURL(file);
          handleUpdateStep(stepId, { mediaFile: file, mediaUrl: previewUrl });
      } else {
          const step = messageSteps.find(s => s.id === stepId);
          if (step?.mediaUrl && step.mediaUrl.startsWith('blob:')) {
              URL.revokeObjectURL(step.mediaUrl); 
          }
          handleUpdateStep(stepId, { mediaFile: null, mediaUrl: null });
      }
  };

  useEffect(() => {
      return () => {
          messageSteps.forEach(step => {
              if (step.mediaUrl && step.mediaUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(step.mediaUrl);
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
         if ((step.type === 'imagem' || step.type === 'video' || step.type === 'audio' || step.type === 'documento') && !step.mediaFile && !step.mediaUrl) {
              toast({ title: "Erro", description: `Anexe um arquivo para o passo de ${step.type}.`, variant: "destructive" });
              return;
         }
         if (step.type === 'atraso') {
            if (step.delayValue === undefined || isNaN(step.delayValue) || step.delayValue <= 0) {
                toast({ title: "Erro", description: "O valor do atraso deve ser um número positivo.", variant: "destructive" });
                return;
            }
            if (!step.delayUnit) {
                toast({ title: "Erro", description: "A unidade do atraso (segundos, minutos, etc.) é obrigatória para passos de atraso.", variant: "destructive" });
                return;
            }
         }
     }

    setSaving(true);
    setError(null);

    try {
      const stepsWithPotentiallySavedMedia = await Promise.all(messageSteps.map(async (step) => {
          if (step.mediaFile && (step.type === 'imagem' || step.type === 'video' || step.type === 'audio' || step.type === 'documento')) {
              const formData = new FormData();
              formData.append("data", step.mediaFile, step.mediaFile.name);
              formData.append("fileName", step.mediaFile.name);
              formData.append("clinicId", currentClinicCode);
              
              const uploadRes = await fetch(
                "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase",
                { method: "POST", body: formData }
              );
              if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`Falha ao enviar mídia (${step.mediaFile.name}): ${errorText.substring(0, 150)}...`);
              }
              const uploadData = await uploadRes.json();
              const savedMediaUrl = (Array.isArray(uploadData) && uploadData[0]?.Key) || uploadData.Key || uploadData.key || null;
              if (!savedMediaUrl) throw new Error(`Resposta de upload de mídia inválida para ${step.mediaFile.name}.`);
              
              return { ...step, mediaUrl: savedMediaUrl, originalFileName: step.mediaFile.name, mediaFile: undefined };
          }
          return { ...step, mediaFile: undefined }; 
      }));

      const messagePayloadForN8N = { 
        event: isEditing && messageIdToEdit ? "sequence_updated" : "sequence_created", 
        sequenceId: isEditing && messageIdToEdit ? messageIdToEdit : undefined, 
        clinicCode: currentClinicCode,
        clinicDbId: currentClinicId,
        sequenceName: messageName, 
        contexto: 'leads', // Contexto 'leads' is still used internally for n8n
        ativo: true, 
        steps: stepsWithPotentiallySavedMedia.map((step, index) => ({
          db_id: step.db_id, 
          ordem: index + 1,
          tipo_passo: step.type,
          conteudo_texto: step.text || null,
          url_arquivo: step.mediaUrl || null,
          nome_arquivo_original: step.originalFileName || null,
          atraso_valor: step.type === 'atraso' ? step.delayValue : null,
          atraso_unidade: step.type === 'atraso' ? step.delayUnit : null,
        })),
      };

      console.log("[MensagensConfigPage] Sending payload to n8n webhook:", messagePayloadForN8N);

      const webhookResponse = await fetch("https://n8n-n8n.sbw0pc.easypanel.host/webhook/c85d9288-8072-43c6-8028-6df18d4843b5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messagePayloadForN8N),
      });

      if (!webhookResponse.ok) {
        const webhookErrorText = await webhookResponse.text();
        console.error(`[MensagensConfigPage] n8n Webhook call failed with status ${webhookResponse.status}: ${webhookErrorText}`);
        let parsedError = webhookErrorText;
        try { const jsonError = JSON.parse(webhookErrorText); parsedError = jsonError.message || jsonError.error || webhookErrorText; } catch (parseErr) {}
        throw new Error(`Falha ao salvar mensagem via n8n (Status: ${webhookResponse.status}): ${parsedError.substring(0, 250)}`);
      }

      const webhookResult = await webhookResponse.json();
      console.log("[MensagensConfigPage] n8n Webhook call successful, result:", webhookResult);
      
      toast({
        title: "Sucesso",
        description: `Mensagem "${messageName}" salva com sucesso.`,
      });

      if (currentClinicId) { 
        queryClient.invalidateQueries({ queryKey: ['leadMessagesList', currentClinicId] }); 
      } else {
        console.warn("[MensagensConfigPage] Clinic ID not available for query invalidation.");
      }
      
      if (isEditing && messageIdToEdit) {
        // queryClient.invalidateQueries({ queryKey: ['messageData', messageIdToEdit] }); 
      }

      setTimeout(() => {
        if (currentClinicCode) {
            navigate(`/dashboard/9?clinic_code=${encodeURIComponent(currentClinicCode)}&status=${isEditing ? "updated_sent" : "created_sent"}`);
        } else {
            console.error("[MensagensConfigPage] Clinic code is undefined, cannot navigate back.");
            navigate(`/dashboard/9?status=${isEditing ? "updated_sent" : "created_sent"}`); 
        }
      }, 1500);

    } catch (e: any) {
      console.error("[MensagensConfigPage] Error in handleSave:", e);
      setError(e.message || "Erro ao processar a mensagem");
      toast({
        title: "Erro no Processamento",
        description: e.message || "Ocorreu um erro inesperado ao tentar processar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!clinicCode) return;
    navigate(`/dashboard/9?clinic_code=${encodeURIComponent(clinicCode)}`);
  };

  const pageTitle = isEditing
    ? "Editar Mensagem" 
    : "Nova Mensagem";

  const isLoadingData = loading; 
  const fetchError = error; 

  // Re-written return statement to ensure clean JSX
  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-4 md:p-6 w-full">
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isLoadingData ? (
            <div className="flex items-center justify-center gap-2 text-primary py-10">
              <Loader2 className="animate-spin h-8 w-8" />
              Carregando dados da mensagem...
            </div>
          ) : fetchError ? (
            <div className="text-red-600 font-semibold flex items-center gap-2 p-4 bg-red-50 border border-red-300 rounded-md">
              <TriangleAlert className="h-5 w-5" />
              {fetchError || "Erro ao carregar dados."}
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="messageName" className="block mb-1 font-medium text-gray-700">
                  Nome da Mensagem *
                </label>
                <Input
                  id="messageName"
                  value={messageName}
                  onChange={(e) => setMessageName(e.target.value)}
                  placeholder="Ex: Boas-vindas Lead Frio, Follow-up Pós-Avaliação"
                  disabled={saving}
                  maxLength={100}
                />
                <p className="text-sm text-gray-500 mt-1">Um nome claro para identificar esta mensagem na listagem.</p>
              </div>

              <div className="message-steps-area flex flex-col gap-4 border rounded-md p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Passos da Mensagem</h3>

                {messageSteps.length === 0 && (
                  <div className="text-center text-gray-600 italic py-6">Nenhum passo na mensagem ainda. Adicione um abaixo.</div>
                )}

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
                        <label htmlFor={`step-type-${step.id}`} className="block mb-1 font-medium text-gray-700">
                          Tipo de Passo
                        </label>
                        <Select
                          value={step.type}
                          onValueChange={(value) => {
                            const newType = value as MessageStep['type'];
                            const updates: Partial<MessageStep> = {
                              type: newType,
                              text: newType === 'texto' ? (step.text || '') : undefined,
                              mediaFile: undefined,
                              mediaUrl: undefined,
                              delayValue: newType === 'atraso' ? (step.delayValue || 60) : undefined,
                              delayUnit: newType === 'atraso' ? (step.delayUnit || 'segundos') : undefined,
                            };
                            handleUpdateStep(step.id, updates);
                          }}
                          id={`step-type-${step.id}`}
                          disabled={saving}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="texto">Texto</SelectItem>
                            <SelectItem value="imagem">Imagem</SelectItem>
                            <SelectItem value="video">Vídeo</SelectItem>
                            <SelectItem value="audio">Áudio</SelectItem>
                            <SelectItem value="documento">Documento</SelectItem>
                            <SelectItem value="atraso">Atraso (Pausa)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {step.type === 'texto' && (
                        <div>
                          <label htmlFor={`step-text-${step.id}`} className="block mb-1 font-medium text-gray-700">
                            Texto da Mensagem
                          </label>
                          <Textarea
                            id={`step-text-${step.id}`}
                            rows={4}
                            value={step.text || ''}
                            onChange={(e) => handleUpdateStep(step.id, { text: e.target.value })}
                            placeholder="Digite o texto para este passo..."
                            disabled={saving}
                          />
                        </div>
                      )}

                      {(step.type === 'imagem' || step.type === 'video' || step.type === 'audio' || step.type === 'documento') && (
                        <div>
                          <label htmlFor={`step-media-${step.id}`} className="block mb-1 font-medium text-gray-700">
                            Anexar Arquivo ({step.type})
                          </label>
                          <Input
                            type="file"
                            id={`step-media-${step.id}`}
                            accept={
                              step.type === 'imagem' ? 'image/*' :
                              step.type === 'video' ? 'video/*' :
                              step.type === 'audio' ? 'audio/*' :
                              step.type === 'documento' ? '.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx' : '*'
                            }
                            onChange={(e) => handleMediaFileChange(step.id, e.target.files ? e.target.files[0] : null)}
                            disabled={saving}
                          />
                          {step.mediaUrl && (
                            <div className="mt-2">
                              {step.type === 'imagem' && <img src={step.mediaUrl} alt={step.originalFileName || "Preview"} className="max-w-xs rounded" />}
                              {step.type === 'video' && <video src={step.mediaUrl} controls className="max-w-xs rounded" />}
                              {step.type === 'audio' && <audio src={step.mediaUrl} controls />}
                              {step.type === 'documento' && (
                                <a href={step.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  Ver Documento: {step.originalFileName || step.mediaUrl.split('/').pop()}
                                </a>
                              )}
                            </div>
                          )}
                          {!step.mediaUrl && step.mediaFile && (
                            <p className="text-sm text-gray-600 mt-1">Arquivo selecionado: {step.mediaFile.name}</p>
                          )}
                          {step.mediaUrl && step.originalFileName && !step.mediaFile && (
                            <p className="text-sm text-gray-600 mt-1">Arquivo salvo: {step.originalFileName}</p>
                          )}
                        </div>
                      )}

                      {step.type === 'atraso' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor={`step-delay-value-${step.id}`} className="block mb-1 font-medium text-gray-700">
                              Duração do Atraso *
                            </label>
                            <Input
                              id={`step-delay-value-${step.id}`}
                              type="number"
                              placeholder="Ex: 30"
                              value={step.delayValue?.toString() || ''}
                              onChange={(e) => handleUpdateStep(step.id, { delayValue: parseInt(e.target.value, 10) || 0 })}
                              min="1"
                              disabled={saving}
                            />
                          </div>
                          <div>
                            <label htmlFor={`step-delay-unit-${step.id}`} className="block mb-1 font-medium text-gray-700">
                              Unidade do Atraso *
                            </label>
                            <Select
                              value={step.delayUnit || 'segundos'}
                              onValueChange={(value) => handleUpdateStep(step.id, { delayUnit: value as MessageStep['delayUnit'] })}
                              id={`step-delay-unit-${step.id}`}
                              disabled={saving}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="segundos">Segundos</SelectItem>
                                <SelectItem value="minutos">Minutos</SelectItem>
                                <SelectItem value="horas">Horas</SelectItem>
                                <SelectItem value="dias">Dias</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 md:col-span-2">Tempo de espera antes de prosseguir para o próximo passo.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <Button variant="outline" onClick={() => handleAddStep('texto')} disabled={saving}>
                    <Plus className="h-4 w-4 mr-2" /> Texto
                  </Button>
                  <Button variant="outline" onClick={() => handleAddStep('imagem')} disabled={saving}>
                    <Plus className="h-4 w-4 mr-2" /> Imagem
                  </Button>
                  <Button variant="outline" onClick={() => handleAddStep('video')} disabled={saving}>
                    <Plus className="h-4 w-4 mr-2" /> Vídeo
                  </Button>
                  <Button variant="outline" onClick={() => handleAddStep('audio')} disabled={saving}>
                    <Plus className="h-4 w-4 mr-2" /> Áudio
                  </Button>
                  <Button variant="outline" onClick={() => handleAddStep('documento')} disabled={saving}>
                    <Plus className="h-4 w-4 mr-2" /> Documento
                  </Button>
                  <Button variant="outline" onClick={() => handleAddStep('atraso')} disabled={saving}>
                    <Plus className="h-4 w-4 mr-2" /> Atraso/Pausa
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t mt-4">
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
                    isEditing ? "Salvar Alterações na Mensagem" : "Criar Nova Mensagem"
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