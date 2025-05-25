"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TriangleAlert, Plus, Trash2 } from "lucide-react"; // Added Plus and Trash2 icons
import { useLocation, useNavigate } from "react-router-dom"; // Import useLocation and useNavigate
import { cn } from '@/lib/utils'; // Import cn for conditional classes
import { useQuery } from "@tanstack/react-query"; // Import useQuery

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a single step in the message sequence
interface MessageSequenceStep {
    id: string; // Client-side ID for list rendering
    type: 'text' | 'image' | 'video' | 'audio'; // Type of message step
    text?: string; // Text content for text messages
    mediaFile?: File | null; // File object for media messages (client-side)
    mediaUrl?: string | null; // URL for saved media (or preview)
    delaySeconds?: number; // Optional delay before sending this step
    // Add other properties as needed (e.g., conditions, buttons)
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


const MensagensSequenciaConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
  clinicData,
}) => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate(); // Initialize navigate

  // Form state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for the sequence itself
  const [sequenceSteps, setSequenceSteps] = useState<MessageSequenceStep[]>([]);

  // State for linking to Funnel and Stage (required for Leads sequences)
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  // State for selecting the sending instance
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [instances, setInstances] = useState<any[]>([]); // State to hold instances


  // Get message sequence ID from URL if editing
  const urlParams = new URLSearchParams(location.search);
  const sequenceIdParam = urlParams.get("id");
  const isEditing = !!sequenceIdParam;
  const sequenceIdToEdit = sequenceIdParam ? parseInt(sequenceIdParam, 10) : null;

  const clinicId = clinicData?.id;
  const clinicCode = clinicData?.code;


  // Fetch All Funnels (for linking sequence)
  const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
      queryKey: ['allFunnelsSequenceConfigPage', clinicId],
      queryFn: async () => {
          if (!clinicId) return [];
          console.log(`[MensagensSequenciaConfigPage] Fetching all funnels from Supabase...`);
          const { data, error } = await supabase
              .from('north_clinic_crm_funil')
              .select('id, nome_funil')
              .order('nome_funil', { ascending: true });
          if (error) {
              console.error("[MensagensSequenciaConfigPage] Supabase all funnels fetch error:", error);
              throw new Error(`Erro ao buscar funis: ${error.message}`);
          }
          return data || [];
      },
      enabled: !!clinicId, // Enabled if clinicId is available
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
  });

  // Fetch Stages for the selected funnel (for linking sequence)
  const { data: stagesForSelectedFunnel, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
      queryKey: ['stagesForFunnelSequenceConfigPage', clinicId, selectedFunnelId],
      queryFn: async () => {
          if (!clinicId || selectedFunnelId === null) return [];
          console.log(`[MensagensSequenciaConfigPage] Fetching stages for funnel ${selectedFunnelId} from Supabase...`);
          const { data, error } = await supabase
              .from('north_clinic_crm_etapa')
              .select('id, nome_etapa, id_funil, ordem') // Select ordem for sorting
              .eq('id_funil', selectedFunnelId)
              .order('ordem', { ascending: true }); // Order by ordem
          if (error) {
              console.error("[MensagensSequenciaConfigPage] Supabase stages fetch error:", error);
              throw new Error(`Erro ao buscar etapas: ${error.message}`);
          }
          return data || [];
      },
      enabled: !!clinicId && selectedFunnelId !== null, // Enabled only if clinicId, and a funnel is selected
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
  });

  // Fetch Instances (for selecting sending instance)
  useEffect(() => {
      async function fetchInstances() {
          if (!clinicId) return;
          try {
              const { data, error } = await supabase
                  .from("north_clinic_config_instancias")
                  .select("id, nome_exibição, nome_instancia_evolution")
                  .eq("id_clinica", clinicId);

              if (error) throw error;
              setInstances(data || []);
          } catch (e: any) {
              console.error("Error fetching instances:", e);
              // Optionally set an error state specific to instances
          }
      }
      fetchInstances();
  }, [clinicId]);


  // Load sequence data if editing
  useEffect(() => {
    if (!clinicId) {
      setError("ID da clínica não disponível.");
      setLoading(false);
      return;
    }

    if (isEditing && sequenceIdToEdit !== null) {
      // TODO: Fetch sequence data from backend/Supabase
      // This requires a new table structure for sequences and steps
      console.log(`[MensagensSequenciaConfigPage] TODO: Fetch sequence data for ID: ${sequenceIdToEdit}`);
      setLoading(false); // Set loading false for now as fetch is not implemented
      // Placeholder for setting state if data was fetched:
      // setSequenceSteps(fetchedSequenceData.steps);
      // setSelectedFunnelId(fetchedSequenceData.id_funil);
      // setSelectedStageId(fetchedSequenceData.id_etapa);
      // setSelectedInstanceId(fetchedSequenceData.id_instancia);

    } else {
      // New sequence defaults
      setSequenceSteps([{ id: Date.now().toString(), type: 'text', text: '' }]); // Start with one empty text step
      setSelectedFunnelId(null);
      setSelectedStageId(null);
      setSelectedInstanceId(null);
      setLoading(false);
    }
  }, [clinicId, isEditing, sequenceIdToEdit]); // Depend on clinicId and editing state


  // Effect to reset stage when funnel changes
  useEffect(() => {
      console.log("MensagensSequenciaConfigPage: selectedFunnelId changed. Resetting selectedStageId.");
      setSelectedStageId(null);
  }, [selectedFunnelId]);


  // Handle adding a new step
  const handleAddStep = (type: MessageSequenceStep['type'] = 'text') => {
      setSequenceSteps(prev => [
          ...prev,
          { id: Date.now().toString() + Math.random().toString().slice(2, 8), type, text: type === 'text' ? '' : undefined, mediaFile: undefined, mediaUrl: undefined, delaySeconds: undefined }
      ]);
  };

  // Handle removing a step
  const handleRemoveStep = (id: string) => {
      setSequenceSteps(prev => prev.filter(step => step.id !== id));
  };

  // Handle updating a step (text, media, delay)
  const handleUpdateStep = (id: string, updates: Partial<MessageSequenceStep>) => {
      setSequenceSteps(prev => prev.map(step =>
          step.id === id ? { ...step, ...updates } : step
      ));
  };

  // Handle media file selection for a step
  const handleMediaFileChange = (stepId: string, file: File | null) => {
      if (file) {
          const previewUrl = URL.createObjectURL(file);
          handleUpdateStep(stepId, { mediaFile: file, mediaUrl: previewUrl });
      } else {
          // Clear file and preview/saved URL
          const step = sequenceSteps.find(s => s.id === stepId);
          if (step?.mediaUrl && step.mediaUrl.startsWith('blob:')) {
              URL.revokeObjectURL(step.mediaUrl); // Clean up previous preview URL
          }
          handleUpdateStep(stepId, { mediaFile: null, mediaUrl: null });
      }
  };

  // Clean up preview URLs on unmount
  useEffect(() => {
      return () => {
          sequenceSteps.forEach(step => {
              if (step.mediaUrl && step.mediaUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(step.mediaUrl);
              }
          });
      };
  }, [sequenceSteps]);


  // Handle form submission (Save)
  const handleSave = async () => {
    if (!clinicCode || !clinicId) {
      toast({
        title: "Erro",
        description: "Dados da clínica não disponíveis.",
        variant: "destructive",
      });
      return;
    }

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
     if (selectedInstanceId === null) {
         toast({
             title: "Erro",
             description: "Selecione a Instância Enviadora.",
             variant: "destructive",
         });
         return;
     }

     if (sequenceSteps.length === 0) {
         toast({
             title: "Erro",
             description: "Adicione pelo menos um passo à sequência.",
             variant: "destructive",
         });
         return;
     }

     // Basic validation for each step
     for (const step of sequenceSteps) {
         if (step.type === 'text' && !step.text?.trim()) {
             toast({ title: "Erro", description: "O texto da mensagem não pode ser vazio.", variant: "destructive" });
             return;
         }
         if ((step.type === 'image' || step.type === 'video' || step.type === 'audio') && !step.mediaFile && !step.mediaUrl) {
              toast({ title: "Erro", description: `Anexe um arquivo para o passo de ${step.type}.`, variant: "destructive" });
              return;
         }
         if (step.delaySeconds !== undefined && (isNaN(step.delaySeconds) || step.delaySeconds < 0)) {
              toast({ title: "Erro", description: "O atraso deve ser um número positivo.", variant: "destructive" });
              return;
         }
     }


    setSaving(true);
    setError(null);

    try {
      // TODO: Implement media upload for each step that has a new file
      // This will likely involve iterating through sequenceSteps, uploading media,
      // and updating the step's mediaUrl with the saved URL from the upload webhook.
      // Example placeholder:
      const stepsWithSavedMedia = await Promise.all(sequenceSteps.map(async (step) => {
          if (step.mediaFile) {
              console.log(`[MensagensSequenciaConfigPage] Uploading media for step ${step.id}...`);
              const formData = new FormData();
              formData.append("data", step.mediaFile, step.mediaFile.name);
              formData.append("fileName", step.mediaFile.name);
              formData.append("clinicId", clinicCode); // Use clinic code for upload webhook
              const uploadRes = await fetch(
                "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase",
                {
                  method: "POST",
                  body: formData,
                }
              );
              if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`Falha ao enviar mídia para o passo ${step.id}: ${errorText.substring(0, 100)}...`);
              }
              const uploadData = await uploadRes.json();
              const savedMediaUrl =
                (Array.isArray(uploadData) && uploadData[0]?.Key) ||
                uploadData.Key ||
                uploadData.key ||
                null;

              if (!savedMediaUrl) {
                   throw new Error(`Resposta de upload de mídia inválida para o passo ${step.id}.`);
              }

              // Return step with updated mediaUrl and removed mediaFile
              return { ...step, mediaUrl: savedMediaUrl, mediaFile: undefined };

          } else {
              // No new file, keep existing mediaUrl (if any) and remove mediaFile
              return { ...step, mediaFile: undefined };
          }
      }));


      // TODO: Prepare data for the new save sequence webhook
      // This requires a new webhook endpoint and database structure
      const saveSequenceData = {
          id: isEditing ? sequenceIdToEdit : null, // Include ID if editing
          id_clinica: clinicCode, // Use clinic code
          id_funil: selectedFunnelId,
          id_etapa: selectedStageId,
          id_instancia: selectedInstanceId,
          ativo: true, // Assuming sequences are active by default
          // Structure the steps data for the backend
          passos: stepsWithSavedMedia.map((step, index) => ({
              ordem: index + 1, // Order of the step
              tipo: step.type,
              texto: step.text || null,
              url_arquivo: step.mediaUrl || null,
              atraso_segundos: step.delaySeconds ?? 0, // Default delay to 0 if not set
              // Add other step properties if needed
          })),
          // Add other sequence properties if needed (e.g., name, description)
      };

      console.log("[MensagensSequenciaConfigPage] Saving sequence data:", saveSequenceData);

      // TODO: Call the new webhook endpoint to save the sequence
      const saveUrl = isEditing
        ? "https://n8n-n8n.sbw0pc.easypanel.host/webhook/SEU-WEBHOOK-ATUALIZAR-SEQUENCIA" // Placeholder
        : "https://n8n-n8n.sbw0pc.easypanel.host/webhook/SEU-WEBHOOK-CRIAR-SEQUENCIA"; // Placeholder

      // Placeholder fetch call
      // const saveRes = await fetch(saveUrl, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(saveSequenceData),
      // });

      // Placeholder success response
      // const responseData = { success: true, message: "Sequência salva com sucesso!" };

      // Placeholder error response
      // const responseData = { success: false, error: "Erro simulado ao salvar." };


      // --- Simulate Webhook Call (REMOVE THIS IN REAL IMPLEMENTATION) ---
      console.warn("[MensagensSequenciaConfigPage] Simulating webhook save. Replace with actual fetch.");
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      const responseData = { success: true, message: "Sequência salva com sucesso (simulado)!" };
      // const responseData = { success: false, error: "Erro simulado ao salvar sequência." };
      const saveRes = { ok: responseData.success, json: async () => responseData, text: async () => JSON.stringify(responseData) }; // Simulate response object
      // --- END Simulate Webhook Call ---


      if (!saveRes.ok || responseData.error || (responseData.success === false)) {
          const errorMessage = responseData.error || responseData.message || `Erro desconhecido (Status: ${saveRes.status})`;
          console.error("Webhook save error:", responseData);
          throw new Error(errorMessage);
      }

      toast({
        title: "Sucesso",
        description: responseData.message || "Sequência salva com sucesso.",
      });

      // Redirect after save
      setTimeout(() => {
        // Redirect back to the Leads Messages list page
        navigate(`/dashboard/9?clinic_code=${encodeURIComponent(clinicCode)}&status=${isEditing ? "updated" : "created"}`);
      }, 1500);

    } catch (e: any) {
      console.error("Error saving sequence:", e);
      setError(e.message || "Erro ao salvar sequência");
      toast({
        title: "Erro",
        description: e.message || "Erro ao salvar sequência",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Cancel action: redirect back to list
  const handleCancel = () => {
    if (!clinicCode) return;
    // Redirect back to the Leads Messages list page
    navigate(`/dashboard/9?clinic_code=${encodeURIComponent(clinicCode)}`);
  };

  const pageTitle = isEditing
    ? "Editar Sequência de Mensagens (Leads)"
    : "Configurar Nova Sequência de Mensagens (Leads)";

  const isLoadingData = loading || isLoadingFunnels || isLoadingStages;
  const fetchError = error || funnelsError || stagesError;


  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-6 overflow-auto">
      <Card className="max-w-4xl mx-auto">
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
              {/* Linking Fields: Funnel, Stage, Instance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                      <label htmlFor="funnel" className="block mb-1 font-medium text-gray-700">
                          Funil *
                      </label>
                      <Select
                          value={selectedFunnelId?.toString() || ''}
                          onValueChange={(value) => setSelectedFunnelId(value ? parseInt(value, 10) : null)}
                          id="funnel"
                          disabled={isLoadingFunnels || !!funnelsError || saving}
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
                      <label htmlFor="stage" className="block mb-1 font-medium text-gray-700">
                          Etapa *
                      </label>
                      <Select
                          value={selectedStageId?.toString() || ''}
                          onValueChange={(value) => setSelectedStageId(value ? parseInt(value, 10) : null)}
                          id="stage"
                          disabled={selectedFunnelId === null || isLoadingStages || !!stagesError || (stagesForSelectedFunnel?.length ?? 0) === 0 || saving}
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
                  <div>
                      <label htmlFor="instance" className="block mb-1 font-medium text-gray-700">
                          Instância Enviadora *
                      </label>
                      <Select
                          value={selectedInstanceId?.toString() || ''}
                          onValueChange={(value) => setSelectedInstanceId(value ? parseInt(value, 10) : null)}
                          id="instance"
                          disabled={instances.length === 0 || saving}
                      >
                          <SelectTrigger>
                              <SelectValue placeholder="Selecione a instância" />
                          </SelectTrigger>
                          <SelectContent>
                              {instances.map(inst => (
                                  <SelectItem key={inst.id} value={inst.id.toString()}>{inst.nome_exibição}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                       {instances.length === 0 && <p className="text-sm text-orange-600 mt-1">Nenhuma instância disponível.</p>}
                  </div>
              </div>


              {/* Sequence Steps Configuration Area */}
              <div className="sequence-steps-area flex flex-col gap-4 border rounded-md p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Passos da Sequência</h3>

                  {sequenceSteps.length === 0 && (
                      <div className="text-center text-gray-600 italic">Nenhum passo na sequência ainda. Adicione um abaixo.</div>
                  )}

                  {sequenceSteps.map((step, index) => (
                      <Card key={step.id} className="step-card p-4 shadow-sm border border-gray-200">
                          <CardContent className="p-0 flex flex-col gap-4">
                              <div className="flex justify-between items-center">
                                  <span className="font-medium text-gray-700">Passo {index + 1}</span>
                                  <Button variant="destructive" size="sm" onClick={() => handleRemoveStep(step.id)} disabled={saving}>
                                      <Trash2 className="h-4 w-4 mr-1" /> Remover
                                  </Button>
                              </div>

                              {/* Step Type Selection (Simple for now) */}
                              <div>
                                  <label htmlFor={`step-type-${step.id}`} className="block mb-1 font-medium text-gray-700">
                                      Tipo de Mensagem
                                  </label>
                                  <Select
                                      value={step.type}
                                      onValueChange={(value) => handleUpdateStep(step.id, { type: value as MessageSequenceStep['type'], text: value === 'text' ? '' : undefined, mediaFile: undefined, mediaUrl: undefined })}
                                      id={`step-type-${step.id}`}
                                      disabled={saving}
                                  >
                                      <SelectTrigger>
                                          <SelectValue placeholder="Selecione o tipo" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="text">Texto</SelectItem>
                                          <SelectItem value="image">Imagem</SelectItem>
                                          <SelectItem value="video">Vídeo</SelectItem>
                                          <SelectItem value="audio">Áudio</SelectItem>
                                      </SelectContent>
                                  </Select>
                              </div>

                              {/* Text Input (Conditional) */}
                              {step.type === 'text' && (
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

                              {/* Media Upload (Conditional) */}
                              {(step.type === 'image' || step.type === 'video' || step.type === 'audio') && (
                                  <div>
                                      <label htmlFor={`step-media-${step.id}`} className="block mb-1 font-medium text-gray-700">
                                          Anexar Arquivo ({step.type})
                                      </label>
                                      <Input
                                          type="file"
                                          id={`step-media-${step.id}`}
                                          accept={step.type === 'image' ? 'image/*' : step.type === 'video' ? 'video/*' : 'audio/*'}
                                          onChange={(e) => handleMediaFileChange(step.id, e.target.files ? e.target.files[0] : null)}
                                          disabled={saving}
                                      />
                                      {step.mediaUrl && (
                                          <div className="mt-2">
                                              {step.type === 'image' && <img src={step.mediaUrl} alt="Preview" className="max-w-xs rounded" />}
                                              {step.type === 'video' && <video src={step.mediaUrl} controls className="max-w-xs rounded" />}
                                              {step.type === 'audio' && <audio src={step.mediaUrl} controls />}
                                          </div>
                                      )}
                                       {!step.mediaUrl && step.mediaFile && (
                                           <p className="text-sm text-gray-600 mt-1">Arquivo selecionado: {step.mediaFile.name}</p>
                                       )}
                                  </div>
                              )}

                              {/* Delay Input */}
                              <div>
                                  <label htmlFor={`step-delay-${step.id}`} className="block mb-1 font-medium text-gray-700">
                                      Atraso antes deste passo (segundos)
                                  </label>
                                  <Input
                                      id={`step-delay-${step.id}`}
                                      type="number"
                                      placeholder="0"
                                      value={step.delaySeconds?.toString() || ''}
                                      onChange={(e) => handleUpdateStep(step.id, { delaySeconds: parseInt(e.target.value, 10) || 0 })}
                                      min="0"
                                      disabled={saving}
                                  />
                                  <p className="text-sm text-gray-500 mt-1">Tempo de espera antes de enviar esta mensagem.</p>
                              </div>

                          </CardContent>
                      </Card>
                  ))}

                  {/* Add Step Button */}
                  <div className="flex justify-center mt-4">
                      <Button variant="outline" onClick={() => handleAddStep('text')} disabled={saving}>
                          <Plus className="h-4 w-4 mr-2" /> Adicionar Passo (Texto)
                      </Button>
                       {/* Add buttons for other media types if needed */}
                       {/* <Button variant="outline" onClick={() => handleAddStep('image')} disabled={saving} className="ml-2">
                           <Plus className="h-4 w-4 mr-2" /> Adicionar Passo (Imagem)
                       </Button> */}
                  </div>
              </div>


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