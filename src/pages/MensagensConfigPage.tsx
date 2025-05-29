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
import { Loader2 } from "@/components/ui/loader"; 
import { TriangleAlert } from "@/components/ui/triangle-alert"; 
import { Smile } from "lucide-react";
import MultiSelectServices from "@/components/MultiSelectServices";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  orderedCategoriesGeneral,
  defaultTemplates,
  placeholderData,
} from "@/data/placeholders";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ClinicData {
  code: string;
  id: number;
  nome?: string; 
  acesso_crm?: boolean;
  acesso_config_msg?: boolean;
  id_permissao?: number;
}

interface Instance {
  id: number;
  nome_exibicao: string;
  nome_instancia_evolution?: string | null;
}

interface Service {
  id: number;
  nome: string;
}

interface Group {
  id_grupo: string; 
  nome_grupo: string;
}

interface FunnelDetails {
  id: number;
  nome_funil: string;
}

interface FunnelStage {
  id: number;
  nome_etapa: string;
  id_funil?: number;
  ordem?: number | null;
}

interface FetchedMessageData {
  id: number;
  categoria: string | null;
  id_instancia: number | null;
  modelo_mensagem: string;
  ativo: boolean;
  hora_envio: string | null;
  grupo: string | null;
  url_arquivo: string | null;
  variacao_1?: string | null;
  variacao_2?: string | null;
  variacao_3?: string | null;
  variacao_4?: string | null;
  variacao_5?: string | null;
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
  north_clinic_mensagens_servicos?: { id_servico: number }[];
  nome_grupo?: string | null;
}

interface WebhookResponse {
  success?: boolean;
  message?: string;
  error?: string;
  Key?: string;
  key?: string;
}

const MensagensConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
  clinicData,
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);
  const [services, setServices] = useState<Service[]>([]);
  const [linkedServices, setLinkedServices] = useState<number[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"Grupo" | "Cliente" | "Funcionário" | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaSavedUrl, setMediaSavedUrl] = useState<string | null>(null);
  const [messageContext, setMessageContext] = useState<string | null>(null);
  const [diasMensagemCashback, setDiasMensagemCashback] = useState<string | null>(null);
  const [tipoMensagemCashback, setTipoMensagemCashback] = useState<string | null>(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [timingType, setTimingType] = useState<string | null>("immediate");
  const [delayValue, setDelayValue] = useState<string | null>(null);
  const [delayUnit, setDelayUnit] = useState<string | null>("hours");
  const [sendingOrder, setSendingOrder] = useState<string | null>("both");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messageTextRef = useRef<HTMLTextAreaElement>(null);

  const urlParams = new URLSearchParams(location.search);
  const contextParam = urlParams.get("context");

  const isGeneralContext = messageContext === "clientes" || messageContext === null;
  const isCashbackContext = messageContext === "cashback";
  const isLeadsContext = messageContext === "leads";

  const allFunnels = useQuery<FunnelDetails[], Error>(
    ["allFunnels", clinicData?.id, messageContext], 
    async () => {
      if (!clinicData?.id || messageContext !== "leads") return []; 
      const { data, error: dbError } = await supabase.from("north_clinic_crm_funil").select("id, nome_funil");
      if (dbError) throw new Error(dbError.message);
      return data || [];
    },
    { enabled: !!clinicData?.id && messageContext === "leads" }
  );

  const stagesForSelectedFunnel = useQuery<FunnelStage[], Error>(
    ["stagesForFunnel", selectedFunnelId, clinicData?.id, messageContext], 
    async () => {
      if (!selectedFunnelId || !clinicData?.id || messageContext !== "leads") return []; 
      const { data, error: dbError } = await supabase.from("north_clinic_crm_etapa").select("id, nome_etapa").eq("id_funil", selectedFunnelId);
      if (dbError) throw new Error(dbError.message);
      return data || [];
    },
    { enabled: !!selectedFunnelId && !!clinicData?.id && messageContext === "leads" }
  );

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

    if (!isEditing && contextParam) {
        setMessageContext(contextParam);
    }

    async function fetchData() {
      setLoading(true);
      setError(null);
       const currentMessageContextForFetch = isEditing ? messageContext : contextParam; 

        if (instancesError) throw instancesError;
        setInstances(instancesData || []);

        let servicesData: Service[] = [];
        if (currentMessageContextForFetch === 'clientes' && servicesError) throw servicesError;
        if (currentMessageContextForFetch === 'clientes') {
             servicesData = fetchedServicesData || [];
        }
        setServices(servicesData);

        if (isEditing && messageIdToEdit !== null) {
          const { data: msgData, error: messageError } = await supabase
            .from('north_clinic_config_mensagens')
            .select('*, north_clinic_mensagens_servicos(id_servico)') 
            .eq('id', messageIdToEdit) 
            .eq('id_clinica', currentClinicData.id) 
            .single(); 

          if (messageError && messageError.code !== 'PGRST116') { 
              throw messageError;
          }

          if (msgData) {
            const messageData = msgData as FetchedMessageData;
            setMessageContext(messageData.context); 

            const fetchedLinkedServices = messageData.context === 'clientes' && messageData.north_clinic_mensagens_servicos
                ? messageData.north_clinic_mensagens_servicos
                    .map(link => link.id_servico)
                    .filter((id): id is number => id !== null) 
                : []; 

            setMessageId(messageData.id);
            setCategory(messageData.categoria || null); 
            setInstanceId(messageData.id_instancia);
            setMessageText(messageData.modelo_mensagem);
            setActive(messageData.ativo ?? true);
            setLinkedServices(fetchedLinkedServices); 
            
            const fetchedScheduledTime = messageData.hora_envio;
            let formattedScheduledTime = null;
            if (fetchedScheduledTime) {
                try {
                    const parts = fetchedScheduledTime.split(':');
                    if (parts.length >= 2) {
                        formattedScheduledTime = `${parts[0]}:${parts[1]}`;
                    } else {
                         formattedScheduledTime = fetchedScheduledTime; 
                    }
                } catch (e) {
                    formattedScheduledTime = fetchedScheduledTime; 
                }
            }
            setScheduledTime(formattedScheduledTime); 
            setSelectedGroup(messageData.grupo ?? null); 
            setMediaSavedUrl(messageData.url_arquivo ?? null);
            setTargetType(
              messageData.para_cliente ? "Cliente" : messageData.para_funcionario ? "Funcionário" : "Grupo"
            );
            setDiasMensagemCashback(messageData.dias_mensagem_cashback?.toString() || null);
            setTipoMensagemCashback(messageData.tipo_mensagem_cashback || null);
            if (messageData.context === 'leads') {
                 setSelectedFunnelId(messageData.id_funil ?? null);
                 setSelectedStageId(messageData.id_etapa ?? null);
                 setTimingType(messageData.timing_type || 'immediate');
                 setDelayValue(messageData.delay_value?.toString() || null);
                 setDelayUnit(messageData.delay_unit || 'hours');
            }
            setSendingOrder(messageData.sending_order || 'both');
          } else {
              setError("Mensagem não encontrada ou você não tem permissão para editá-la.");
              setMessageId(null); 
              if (contextParam) setMessageContext(contextParam);
          }
        } else { 
          setMessageId(null);
          setCategory(null);
          setInstanceId(null);
          setMessageText("");
          setActive(true); 
          setLinkedServices([]);
          setScheduledTime(null);
          setSelectedGroup(null); 
          setMediaSavedUrl(null);
          setTargetType(contextParam === 'cashback' || contextParam === 'leads' ? 'Cliente' : 'Grupo'); 
          setDiasMensagemCashback(null);
          setTipoMensagemCashback(null);
          setSelectedFunnelId(urlParams.get('funnelId') ? parseInt(urlParams.get('funnelId')!, 10) : null); 
          setSelectedStageId(urlParams.get('stageId') ? parseInt(urlParams.get('stageId')!, 10) : null); 
          setTimingType('immediate');
          setDelayValue(null);
          setDelayUnit('hours');
          setSendingOrder('both');
          if (contextParam) setMessageContext(contextParam);
        }
      } catch (e: any) {
        setError(e.message || "Erro ao carregar dados iniciais");
        if (contextParam && !messageContext) setMessageContext(contextParam);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [clinicData?.id, location.search]); 

  useEffect(() => {
    setSelectedStageId(null); 
  }, [selectedFunnelId]);

  useEffect(() => {
    async function fetchGroups() {
      const currentClinicId = clinicData?.id; 
      if (!instanceId || targetType !== "Grupo" || !currentClinicId) { 
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
        const res = await fetch(
          `https://n8n-n8n.sbw0pc.easypanel.host/webhook/29203acf-7751-4b18-8d69-d4bdb380810e`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome_instancia_evolution: instance.nome_instancia_evolution }),
          }
        );
        if (!res.ok) {
            throw new Error("Falha ao carregar grupos");
        }
        const groupsData: Group[] = await res.json();
        setGroups(groupsData);
        if (selectedGroup !== null && !groupsData.find((g) => g.id_grupo === selectedGroup)) {
          setSelectedGroup(null); 
        }
      } catch(e: any) {
        setGroups([]);
        setSelectedGroup(null); 
      }
    }
    fetchGroups();
  }, [instanceId, targetType, instances, clinicData?.id]);
  
  useEffect(() => {
    if (!mediaFile) {
      setMediaPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(mediaFile);
    setMediaPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl); 
  }, [mediaFile]);
  
  const toggleEmojiPicker = () => setShowEmojiPicker((v) => !v);

  const onEmojiSelect = (emojiData: EmojiClickData) => { 
    const emoji = emojiData.emoji;
    if (messageTextRef.current) {
      const el = messageTextRef.current;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const text = messageText;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setMessageText(newText);
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }
  };

  const handleSave = async () => {
    const currentClinicCode = clinicData?.code;
    const currentClinicId = clinicData?.id;

    if (!currentClinicCode || !currentClinicId) {
      toast({ title: "Erro", description: "Dados da clínica não disponíveis.", variant: "destructive" });
      return;
    }
    if (!instanceId) {
      toast({ title: "Erro", description: "Selecione uma instância.", variant: "destructive" });
      return;
    }
    if (!messageText.trim()) {
      toast({ title: "Erro", description: "Digite o texto da mensagem.", variant: "destructive" });
      return;
    }

    if (isGeneralContext) {
        if (!category) { 
          toast({ title: "Erro", description: "Selecione uma categoria.", variant: "destructive" });
          return;
        }
        if (category !== "Aniversário" && linkedServices.length === 0 && category !== "Chegou" && category !== "Liberado") {
          toast({ title: "Erro", description: "Selecione pelo menos um serviço vinculado.", variant: "destructive" });
          return;
        }
        if ((category === "Confirmar Agendamento" || category === "Aniversário") && !scheduledTime) {
          toast({ title: "Erro", description: "Selecione a hora programada.", variant: "destructive" });
          return;
        }
        if ((category === "Chegou" || category === "Liberado") && targetType === "Grupo" && selectedGroup === null ) {
          toast({ title: "Erro", description: "Selecione o grupo alvo.", variant: "destructive" });
          return;
        }
    }

    if (isCashbackContext) {
        const offsetNum = diasMensagemCashback ? parseInt(diasMensagemCashback, 10) : NaN; 
        if (diasMensagemCashback === null || diasMensagemCashback.trim() === '' || isNaN(offsetNum) || offsetNum < 0) {
             toast({ title: "Erro", description: "Informe um número válido de dias (>= 0).", variant: "destructive" });
             return;
        }
        if (!tipoMensagemCashback) { 
             toast({ title: "Erro", description: "Selecione o tipo de agendamento (Após Venda ou Antes da Validade).", variant: "destructive" });
             return;
        }
         const showScheduledTimeCashbackInternal = true; 
         if (showScheduledTimeCashbackInternal && !scheduledTime) { 
              toast({ title: "Erro", description: "Selecione a hora programada.", variant: "destructive" });
             return;
         }
    }

    if (isLeadsContext) {
        if (selectedFunnelId === null) {
             toast({ title: "Erro", description: "Selecione um Funil.", variant: "destructive" });
             return;
        }
         if (selectedStageId === null) {
             toast({ title: "Erro", description: "Selecione uma Etapa.", variant: "destructive" });
             return;
         }
         if (!timingType) {
              toast({ title: "Erro", description: "Selecione o tipo de agendamento.", variant: "destructive" });
              return;
         }
         if (timingType === 'delay') {
             const delayNum = delayValue ? parseInt(delayValue, 10) : NaN;
             if (delayValue === null || delayValue.trim() === '' || isNaN(delayNum) || delayNum < 0) {
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
         toast({ title: "Erro", description: "Contexto da mensagem não definido.", variant: "destructive" });
         return;
    }

    if ((mediaFile || mediaSavedUrl) && (!sendingOrder || sendingOrder === 'none')) {
         toast({ title: "Erro", description: "Selecione a ordem de envio para a mensagem com anexo.", variant: "destructive" });
         return;
    }

    setSaving(true);
    setError(null);

    try {
      let final_url_arquivo = mediaSavedUrl;
      if (mediaFile) {
        const formData = new FormData();
        formData.append("data", mediaFile, mediaFile.name);
        formData.append("fileName", mediaFile.name);
        formData.append("clinicId", currentClinicCode);
        const uploadRes = await fetch(
          "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase",
          { method: "POST", body: formData, }
        );
        if (!uploadRes.ok) { throw new Error("Falha ao enviar mídia"); }
        const uploadData: WebhookResponse = await uploadRes.json();
        final_url_arquivo = uploadData.Key || uploadData.key || null;
      }

      const saveData: any = {
        id_clinica: currentClinicCode,
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
          saveData.dias_mensagem_cashback = null;
          saveData.tipo_mensagem_cashback = null;
          saveData.id_funil = null;
          saveData.id_etapa = null;
          saveData.timing_type = null;
          saveData.delay_value = null;
          saveData.delay_unit = null;
      } else if (isCashbackContext) {
          saveData.dias_mensagem_cashback = diasMensagemCashback ? parseInt(diasMensagemCashback, 10) : null;
          saveData.tipo_mensagem_cashback = tipoMensagemCashback;
          saveData.para_cliente = true;
          saveData.para_funcionario = false;
          saveData.para_grupo = false;
          saveData.grupo = null;
          saveData.nome_grupo = null;
          saveData.servicos_vinculados = [];
          saveData.id_funil = null;
          saveData.id_etapa = null;
          saveData.timing_type = null;
          saveData.delay_value = null;
          saveData.delay_unit = null;
          saveData.categoria = category || "Cashback";
      } else if (isLeadsContext) {
          saveData.id_funil = selectedFunnelId;
          saveData.id_etapa = selectedStageId;
          saveData.para_cliente = true;
          saveData.timing_type = timingType;
          saveData.delay_value = timingType === 'delay' && delayValue ? parseInt(delayValue, 10) : null;
          saveData.delay_unit = timingType === 'delay' ? delayUnit : null;
          saveData.para_funcionario = false;
          saveData.para_grupo = false;
          saveData.grupo = null;
          saveData.nome_grupo = null;
          saveData.servicos_vinculados = [];
          saveData.dias_mensagem_cashback = null;
          saveData.tipo_mensagem_cashback = null;
          saveData.categoria = null;
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
          throw new Error(errorMessage);
      }
      toast({ title: "Sucesso", description: "Mensagem salva com sucesso." });
      setTimeout(() => {
        let redirectPath = '/dashboard';
        if (messageContext === 'clientes') redirectPath = '/dashboard/11';
        else if (messageContext === 'cashback') redirectPath = '/dashboard/14/messages';
        else if (messageContext === 'leads') redirectPath = '/dashboard/9';
        navigate(`${redirectPath}?clinic_code=${encodeURIComponent(currentClinicCode)}&status=${messageId ? "updated" : "created"}`);
      }, 1500);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar mensagem");
      toast({ title: "Erro", description: e.message || "Erro ao salvar mensagem", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    if (messageId === null) {
        const currentContext = messageContext || contextParam;
        if (currentContext === 'clientes' && defaultTemplates.general && defaultTemplates.general[value]) { 
            setMessageText(defaultTemplates.general[value]);
        } else if (currentContext === 'cashback' && defaultTemplates.cashback && defaultTemplates.cashback[value]) { 
             setMessageText(defaultTemplates.cashback[value]);
        } else {
            setMessageText("");
        }
    }
  };

  const showCategoryGeneral = isGeneralContext;
  const showTargetTypeSelectGeneral = isGeneralContext && category && (category === "Chegou" || category === "Liberado");
  const showGroupSelectGeneral = isGeneralContext && category && (category === "Chegou" || category === "Liberado") && targetType === "Grupo";
  const showServicesLinkedGeneral = isGeneralContext && category && category !== "Aniversário" && category !== "Chegou" && category !== "Liberado";
  const showScheduledTimeGeneral = isGeneralContext && category && (category === "Confirmar Agendamento" || category === "Aniversário");
  const showCashbackTiming = isCashbackContext;
  const showScheduledTimeCashback = isCashbackContext;
  const showFunnelStageSelectLeads = isLeadsContext;
  const showTimingFieldsLeads = isLeadsContext;
  const showSendingOrder = !!mediaFile || !!mediaSavedUrl; 

  const handleCancel = () => {
    if (!clinicData?.code) return;
    let redirectPath = '/dashboard';
    if (messageContext === 'clientes') redirectPath = '/dashboard/11';
    else if (messageContext === 'cashback') redirectPath = '/dashboard/14/messages';
    else if (messageContext === 'leads') redirectPath = '/dashboard/9';
    navigate(`${redirectPath}?clinic_code=${encodeURIComponent(clinicData.code)}`);
  };

  const pageTitle = messageId
    ? `Editar Mensagem (${messageContext === 'clientes' ? 'Clientes' : messageContext === 'cashback' ? 'Cashback' : messageContext === 'leads' ? 'Leads' : 'Geral'})`
    : `Configurar Nova Mensagem (${messageContext === 'clientes' ? 'Clientes' : messageContext === 'cashback' ? 'Cashback' : messageContext === 'leads' ? 'Leads' : 'Geral'})`;

  const isLoadingData = loading || (isLeadsContext && (allFunnels.isFetching || stagesForSelectedFunnel.isFetching));
  const currentFetchError = error || (isLeadsContext && (allFunnels.error?.message || stagesForSelectedFunnel.error?.message));

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
  }, [isCashbackContext, isLeadsContext]);

  const handlePlaceholderClick = (placeholder: string) => {
      const placeholderText = `{${placeholder}}`;
      const textarea = messageTextRef.current;
      if (textarea) {
          const start = textarea.selectionStart ?? 0;
          const end = textarea.selectionEnd ?? 0;
          const text = messageText;
          const newText = text.slice(0, start) + placeholderText + text.slice(end);
          setMessageText(newText);
          const newCursorPosition = start + placeholderText.length;
          setTimeout(() => {
              if (textarea) {
                textarea.selectionStart = textarea.selectionEnd = newCursorPosition;
                textarea.focus(); 
              }
          }, 0); 
      }
  };

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
          ) : currentFetchError ? ( 
            <div className="text-red-600 font-semibold flex items-center gap-2">
                <TriangleAlert className="h-5 w-5" />
                {typeof currentFetchError === 'string' ? currentFetchError : "Erro ao carregar dados."}
            </div>
          ) : (
            <>
              {/* Category field */}
              {showCategoryGeneral && (
                  <div>
                    <Label htmlFor="category" className="block mb-1 font-medium text-gray-700">Categoria *</Label>
                    <Select
                      value={category || ""}
                      onValueChange={handleCategoryChange}
                      disabled={messageId !== null} 
                    >
                      <SelectTrigger id="category">
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

              {/* Funnel and Stage fields */}
              {showFunnelStageSelectLeads && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <Label htmlFor="funnel" className="block mb-1 font-medium text-gray-700">Funil *</Label>
                          <Select
                            value={selectedFunnelId?.toString() || ''}
                            onValueChange={(value) => setSelectedFunnelId(value ? parseInt(value, 10) : null)}
                            disabled={allFunnels.isFetching || allFunnels.error}
                          >
                            <SelectTrigger id="funnel">
                              <SelectValue placeholder="Selecione o funil" />
                            </SelectTrigger>
                            <SelectContent>
                              {allFunnels.data?.map(funnel => (
                                  <SelectItem key={funnel.id} value={funnel.id.toString()}>{funnel.nome_funil}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                           {allFunnels.error && <p className="text-sm text-red-600 mt-1">{allFunnels.error.message}</p>}
                      </div>
                      <div>
                          <Label htmlFor="stage" className="block mb-1 font-medium text-gray-700">Etapa *</Label>
                          <Select
                            value={selectedStageId?.toString() || ''}
                            onValueChange={(value) => setSelectedStageId(value ? parseInt(value, 10) : null)}
                            disabled={selectedFunnelId === null || stagesForSelectedFunnel.isFetching || stagesForSelectedFunnel.error || (stagesForSelectedFunnel.data?.length ?? 0) === 0}
                          >
                            <SelectTrigger id="stage">
                              <SelectValue placeholder="Selecione a etapa" />
                            </SelectTrigger>
                            <SelectContent>
                               {(stagesForSelectedFunnel.data?.length ?? 0) === 0 && !stagesForSelectedFunnel.isFetching && !stagesForSelectedFunnel.error ? (
                                   <SelectItem value="none" disabled>Nenhuma etapa disponível</SelectItem>
                               ) : (
                                   stagesForSelectedFunnel.data?.map(stage => (
                                       <SelectItem key={stage.id} value={stage.id.toString()}>{stage.nome_etapa}</SelectItem>
                                   ))
                               )}
                            </SelectContent>
                          </Select>
                           {stagesForSelectedFunnel.error && <p className="text-sm text-red-600 mt-1">{stagesForSelectedFunnel.error.message}</p>}
                           {selectedFunnelId !== null && (stagesForSelectedFunnel.data?.length ?? 0) === 0 && !stagesForSelectedFunnel.isFetching && !stagesForSelectedFunnel.error && (
                                <p className="text-sm text-orange-600 mt-1">Nenhuma etapa encontrada para este funil.</p>
                           )}
                      </div>
                  </div>
              )}

              {/* Instance field */}
              <div>
                <Label htmlFor="instance" className="block mb-1 font-medium text-gray-700">Instância (Número Enviador) *</Label>
                <Select
                  value={instanceId?.toString() || ""}
                  onValueChange={(v) => setInstanceId(v ? parseInt(v, 10) : null)}
                >
                  <SelectTrigger id="instance">
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

              {/* Target Type field */}
              {showTargetTypeSelectGeneral && (
                <div>
                  <Label htmlFor="targetType" className="block mb-1 font-medium text-gray-700">Enviar Para *</Label>
                  <Select
                    value={targetType || ""}
                    onValueChange={(v) => setTargetType(v as "Grupo" | "Cliente" | "Funcionário")}
                  >
                    <SelectTrigger id="targetType">
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

              {/* Group Select field */}
              {showGroupSelectGeneral && (
                <div>
                  <Label htmlFor="group" className="block mb-1 font-medium text-gray-700">Grupo Alvo *</Label>
                  <Select
                    value={selectedGroup ?? undefined} 
                    onValueChange={(v) => setSelectedGroup(v || null)}
                    disabled={groups.length === 0}
                  >
                    <SelectTrigger id="group">
                      <SelectValue placeholder="Selecione o grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                            <SelectItem key={g.id_grupo} value={g.id_grupo}> 
                              {g.nome_grupo}
                            </SelectItem>
                          )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Scheduled Time field */}
              {(showScheduledTimeGeneral || showScheduledTimeCashback) && ( 
                <div>
                  <Label htmlFor="scheduledTime" className="block mb-1 font-medium text-gray-700">Hora Programada *</Label>
                  <Select
                    value={scheduledTime || ""}
                    onValueChange={setScheduledTime}
                  >
                    <SelectTrigger id="scheduledTime">
                      <SelectValue placeholder="Selecione a hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Cashback Timing fields */}
              {showCashbackTiming && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <Label htmlFor="diasMensagemCashback" className="block mb-1 font-medium text-gray-700">Dias *</Label>
                          <Input
                              id="diasMensagemCashback"
                              type="number"
                              placeholder="Ex: 3"
                              value={diasMensagemCashback || ""}
                              onChange={(e) => setDiasMensagemCashback(e.target.value)}
                              min="0"
                          />
                          <p className="text-sm text-gray-500 mt-1">Número de dias para o agendamento.</p>
                      </div>
                      <div>
                          <Label htmlFor="tipoMensagemCashback" className="block mb-1 font-medium text-gray-700">Agendar Para *</Label>
                          <RadioGroup
                              value={tipoMensagemCashback || ""}
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

              {/* Leads Timing fields */}
              {showTimingFieldsLeads && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                          <Label htmlFor="timingType" className="block mb-1 font-medium text-gray-700">Agendar Envio *</Label>
                          <Select
                              value={timingType || ""}
                              onValueChange={setTimingType}
                          >
                              <SelectTrigger id="timingType">
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
                                  <Label htmlFor="delayValue" className="block mb-1 font-medium text-gray-700">Valor do Atraso *</Label>
                                  <Input
                                      id="delayValue"
                                      type="number"
                                      placeholder="Ex: 2"
                                      value={delayValue || ""}
                                      onChange={(e) => setDelayValue(e.target.value)}
                                      min="0"
                                  />
                              </div>
                              <div>
                                  <Label htmlFor="delayUnit" className="block mb-1 font-medium text-gray-700">Unidade do Atraso *</Label>
                                  <Select
                                      value={delayUnit || ""}
                                      onValueChange={setDelayUnit}
                                  >
                                      <SelectTrigger id="delayUnit">
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

              {/* Message Text field */}
              <div>
                <Label htmlFor="messageText" className="block mb-1 font-medium text-gray-700">Texto da Mensagem Principal *</Label>
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
                  {showEmojiPicker && (
                    <div className="absolute z-50 top-full right-0 mt-1">
                      <EmojiPicker
                        onEmojiClick={onEmojiSelect}
                        width={300}
                        height={300}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Placeholder List */}
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
                               *A disponibilidade de alguns placeholders pode depender da configuração da etapa e dos dados do lead.
                           </p>
                       )}
                  </div>
              )}

              {/* Services Vinculados */}
              {showServicesLinkedGeneral && (
                <div>
                  <Label htmlFor="services" className="block mb-1 font-medium text-gray-700">Serviços Vinculados *</Label>
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

              {/* Media File field */}
              <div>
                <Label htmlFor="mediaFile" className="block mb-1 font-medium text-gray-700">Anexar Mídia (Opcional)</Label>
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
                      <img src={mediaPreviewUrl} alt="Preview da mídia" className="max-w-xs rounded" />
                    )}
                    {mediaFile?.type.startsWith("video/") && (
                      <video src={mediaPreviewUrl} controls className="max-w-xs rounded" />
                    )}
                    {mediaFile?.type.startsWith("audio/") && (
                      <audio src={mediaPreviewUrl} controls />
                    )}
                  </div>
                )}
                {!mediaPreviewUrl && mediaSavedUrl && (
                  <p className="text-sm text-gray-600 mt-1">Mídia salva: {mediaSavedUrl}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Imagem (JPG, PNG, GIF, WEBP - máx 5MB), Vídeo (MP4, WEBM, MOV - máx 10MB), Áudio (MP3, OGG, WAV - máx 10MB).
                </p>
              </div>

              {/* Sending Order field */}
              {showSendingOrder && (
                  <div>
                      <Label htmlFor="sendingOrder" className="block mb-1 font-medium text-gray-700">Ordem de Envio (Texto e Mídia) *</Label>
                      <Select
                          value={sendingOrder || ""}
                          onValueChange={setSendingOrder}
                      >
                          <SelectTrigger id="sendingOrder">
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

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || isLoadingData || !!currentFetchError}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : ( "Salvar Alterações" )}
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