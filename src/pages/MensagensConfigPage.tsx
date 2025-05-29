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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "@/components/ui/loader";
import { TriangleAlert } from "@/components/ui/triangle-alert";
import { Smile } from "@/components/ui/smile";
import { MultiSelectServices } from "@/components/ui/multi-select-services";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { EmojiPicker } from "emoji-picker-react";
import { Lucide } from "@/components/ui/lucide";
import { useLocation, useNavigate } from "react-router-dom";
import cn from "classnames";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  orderedCategoriesGeneral,
  orderedCategoriesCashback,
  defaultTemplates,
  placeholderData,
} from "@/data/placeholders";
import { simulateMessage } from "@/lib/simulate-message";

interface ClinicData {
  code: string;
  id: number;
  // Add other properties as needed
}

interface Instance {
  id: number;
  nome_exibicao: string;
  // Add other properties as needed
}

interface Service {
  id: number;
  nome: string;
  // Add other properties as needed
}

interface Group {
  id_grupo: number;
  nome_grupo: string;
  // Add other properties as needed
}

interface FunnelDetails {
  id: number;
  nome_funil: string;
  // Add other properties as needed
}

interface FunnelStage {
  id: number;
  nome_etapa: string;
  // Add other properties as needed
}

interface FetchedMessageData {
  id: number;
  categoria: string;
  // Add other properties as needed
}

interface WebhookResponse {
  success: boolean;
  message: string;
  // Add other properties as needed
}

const MensagensConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
  clinicData,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [messageId, setMessageId] = useState(null);
  const [category, setCategory] = useState(null);
  const [instanceId, setInstanceId] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [active, setActive] = useState(true);
  const [services, setServices] = useState([]);
  const [linkedServices, setLinkedServices] = useState([]);
  const [instances, setInstances] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [targetType, setTargetType] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [mediaSavedUrl, setMediaSavedUrl] = useState(null);
  const [messageContext, setMessageContext] = useState(null);
  const [diasMensagemCashback, setDiasMensagemCashback] = useState(null);
  const [tipoMensagemCashback, setTipoMensagemCashback] = useState(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState(null);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [timingType, setTimingType] = useState(null);
  const [delayValue, setDelayValue] = useState(null);
  const [delayUnit, setDelayUnit] = useState(null);
  const [sendingOrder, setSendingOrder] = useState(null);

  const emojiPickerRef = useRef(null);
  const messageTextRef = useRef(null);

  const urlParams = new URLSearchParams(useLocation().search);
  const contextParam = urlParams.get("context");
  const isGeneralContext = contextParam === "geral";
  const isCashbackContext = contextParam === "cashback";
  const isLeadsContext = contextParam === "leads";

  const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery(
    ["allFunnels"],
    async () => {
      const { data, error } = await supabase.from("funil").select("id, nome_funil");
      if (error) {
        throw error;
      }
      return data;
    }
  );

  const { data: stagesForSelectedFunnel, isLoading: isLoadingStages, error: stagesError } = useQuery(
    ["stagesForFunnel", selectedFunnelId],
    async () => {
      if (!selectedFunnelId) {
        return [];
      }
      const { data, error } = await supabase.from("etapa").select("id, nome_etapa").eq("id_funil", selectedFunnelId);
      if (error) {
        throw error;
      }
      return data;
    },
    {
      enabled: !!selectedFunnelId,
    }
  );

  useEffect(() => {
    const fetchData = async () => {
      // Initial data fetching logic
    };
    fetchData();
  }, []);

  useEffect(() => {
    const logMessageContext = async () => {
      // Logging messageContext logic
    };
    logMessageContext();
  }, [messageContext]);

  useEffect(() => {
    const resetStage = async () => {
      // Resetting stage when funnel changes logic
    };
    resetStage();
  }, [selectedFunnelId]);

  useEffect(() => {
    const fetchGroups = async () => {
      // Fetching groups logic
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    const handleMediaFileSelection = async () => {
      // Media file selection and preview logic
    };
    handleMediaFileSelection();
  }, [mediaFile]);

  const toggleEmojiPicker = () => {
    // Emoji picker toggle logic
  };

  const onEmojiSelect = (event, emojiObject) => {
    // Emoji select logic
  };

  useEffect(() => {
    const listener = () => {
      // Emoji picker listener logic
    };
    // Add event listener
    return () => {
      // Remove event listener
    };
  }, []);

  const handleSave = async () => {
    // Current clinic code and id capture
    // Initial validations (clinicData, instanceId, messageText)
    // Context-specific validations (isGeneralContext, isCashbackContext, isLeadsContext)
    // Message context validation
    // Sending order validation

    setSaving(true);
    setError(null);

    try {
      // Media upload logic (url_arquivo)
      let final_url_arquivo = mediaSavedUrl; 
      if (mediaFile) {
        // Media upload logic, assuming it sets a variable like 'uploadedMediaUrl'
        // final_url_arquivo = uploadedMediaUrl; 
      }

      const saveData: any = { 
        id_clinica: clinicData?.code, 
        id: messageId, 
        categoria: category || null, 
        id_instancia: instanceId,
        modelo_mensagem: messageText,
        ativo: active, 
        hora_envio: scheduledTime || null, 
        url_arquivo: final_url_arquivo, 
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
        }
      } else if (isCashbackContext) {
        // Cashback specific fields
        saveData.nome_grupo = null;
      } else if (isLeadsContext) { 
        // Leads specific fields
        saveData.nome_grupo = null;
      }

      // Save URL, fetch call, response handling
      // Toast success, redirect logic
    } catch (e: any) {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    // Handle category change logic
  };

  const showCategoryGeneral = isGeneralContext;
  const showTargetTypeSelectGeneral = isGeneralContext;
  const showGroupSelectGeneral = isGeneralContext && targetType === "Grupo";
  const showServicesLinkedGeneral = isGeneralContext;
  const showScheduledTimeGeneral = isGeneralContext;
  const showCashbackTiming = isCashbackContext;
  const showTimingFieldsLeads = isLeadsContext;
  const showFunnelStageSelectLeads = isLeadsContext;
  const showSendingOrder = true;

  const pageTitle = "Configuração de Mensagens";
  const isLoadingData = loading;
  const fetchError = error;

  const availablePlaceholders = useMemo(() => {
    // Available placeholders memo logic
  }, []);

  const handlePlaceholderClick = (placeholder: string) => {
    // Handle placeholder click logic
  };

  console.log("Rendering MensagensConfigPage");

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
                      disabled={messageId !== null} 
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
                        {inst.nome_exibicao}
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
                          <label
                            htmlFor="tipoMensagemCashback"
                            className="block mb-1 font-medium text-gray-700"
                          >
                            Agendar Para *
                          </label>
                          <Select
                              value={tipoMensagemCashback}
                              onValueChange={setTipoMensagemCashback}
                              id="tipoMensagemCashback"
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="Selecione a opção" />
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

              {/* Leads Timing fields (only for Leads context) */}
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
                  {/* Render emoji picker always, but control visibility with 'hidden' */}
                  <div className="absolute z-50 top-full right-0 mt-1" hidden={!showEmojiPicker}>
                      <EmojiPicker
                        ref={emojiPickerRef}
                        style={{ width: "300px", height: "300px" }}
                      />
                    </div>
                </div>
              </div>

              {/* --- NEW: Placeholder List --- */}
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
              {/* --- END NEW --- */


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
              {/* Hiding the Status field as requested */}
              {/* {(isGeneralContext || isLeadsContext) && (
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
              )} */}

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={() => {}} disabled={saving}>
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