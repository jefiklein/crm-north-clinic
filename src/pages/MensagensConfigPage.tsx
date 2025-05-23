"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added missing import
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

// ... rest of the code remains unchanged (same as previous version)

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

interface MessageData {
  id?: number;
  categoria: string;
  id_instancia: number | null;
  modelo_mensagem: string;
  ativo: boolean;
  servicos_vinculados: number[];
  hora_envio?: string;
  grupo?: number | null;
  url_arquivo?: string | null;
  variacao_1?: string;
  variacao_2?: string;
  variacao_3?: string;
  variacao_4?: string;
  variacao_5?: string;
  para_cliente?: boolean;
  para_funcionario?: boolean;
}

const orderedCategories = [
  "Agendou",
  "Confirmar Agendamento",
  "Responder Confirmar Agendamento",
  "Faltou",
  "Finalizou Atendimento",
  "Aniversário",
  "Chegou",
  "Liberado",
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
};

const MensagensConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
  clinicData,
}) => {
  const { toast } = useToast();

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
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [targetType, setTargetType] = useState<"Grupo" | "Cliente" | "Funcionário">(
    "Grupo"
  );
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaSavedUrl, setMediaSavedUrl] = useState<string | null>(null);

  // Variations
  const [variations, setVariations] = useState<string[]>(["", "", "", "", ""]);
  const [showVariations, setShowVariations] = useState(false);

  // Emoji picker ref
  const emojiPickerRef = useRef<HTMLElement | null>(null);
  const messageTextRef = useRef<HTMLTextAreaElement | null>(null);

  // Load initial data: instances, services, message details if editing
  useEffect(() => {
    if (!clinicData?.code) {
      setError("Código da clínica não disponível.");
      setLoading(false);
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get("id");
    const isEditing = !!idParam;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch instances
        const { data: instancesData, error: instancesError } = await supabase
          .from("north_clinic_config_instancias")
          .select("*")
          .eq("id_clinica", clinicData.code);

        if (instancesError) throw instancesError;
        setInstances(instancesData || []);

        // Fetch services directly from Supabase
        const { data: servicesData, error: servicesError } = await supabase
          .from("north_clinic_servicos")
          .select("*")
          .eq("id_clinica", clinicData.code)
          .order("nome", { ascending: true });

        if (servicesError) throw servicesError;
        setServices(servicesData || []);

        if (isEditing && idParam) {
          // Fetch message details
          const resMessage = await fetch(
            `https://n8n-n8n.sbw0pc.easypanel.host/webhook/4dd9fe07-8863-4993-b21f-7e7419936d19`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_mensagem: idParam, codigo_clinica: clinicData.code }),
            }
          );
          if (!resMessage.ok) throw new Error("Falha ao carregar detalhes da mensagem");
          const messageData: MessageData = await resMessage.json();

          // --- ADDED CONSOLE LOG HERE ---
          console.log("Fetched message data:", messageData);
          console.log("Fetched message data - linkedServices:", messageData.servicos_vinculados);
          // --- END CONSOLE LOG ---


          setMessageId(messageData.id ?? null);
          setCategory(messageData.categoria);
          setInstanceId(messageData.id_instancia);
          setMessageText(messageData.modelo_mensagem);
          setActive(messageData.ativo ?? true);
          setLinkedServices(messageData.servicos_vinculados ?? []); // This line sets the linked services
          setScheduledTime(messageData.hora_envio ?? "");
          setSelectedGroup(messageData.grupo ?? null);
          setMediaSavedUrl(messageData.url_arquivo ?? null);
          setVariations([
            messageData.variacao_1 ?? "",
            messageData.variacao_2 ?? "",
            messageData.variacao_3 ?? "",
            messageData.variacao_4 ?? "",
            messageData.variacao_5 ?? "",
          ]);
          setTargetType(
            messageData.para_cliente ? "Cliente" : messageData.para_funcionario ? "Funcionário" : "Grupo"
          );
        } else {
          // New message defaults
          setMessageId(null);
          setCategory("");
          setInstanceId(null);
          setMessageText("");
          setActive(true);
          setLinkedServices([]);
          setScheduledTime("");
          setSelectedGroup(null);
          setMediaSavedUrl(null);
          setVariations(["", "", "", "", ""]);
          setTargetType("Grupo");
        }
      } catch (e: any) {
        setError(e.message || "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clinicData]);

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
        if (!groupsData.find((g) => g.id_grupo === selectedGroup)) {
          setSelectedGroup(null);
        }
      } catch {
        setGroups([]);
        setSelectedGroup(null);
      }
    }
    fetchGroups();
  }, [instanceId, targetType, instances, selectedGroup]);

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
    if (messageTextRef.current) {
      const el = messageTextRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = el.value;
      el.value = text.slice(0, start) + emoji + text.slice(end);
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
      setMessageText(el.value);
    }
    setShowEmojiPicker(false);
  };

  // Attach emoji picker event listener
  useEffect(() => {
    const picker = emojiPickerRef.current;
    if (!picker) return;
    picker.addEventListener("emoji-click", onEmojiSelect as EventListener);
    return () => {
      picker.removeEventListener("emoji-click", onEmojiSelect as EventListener);
    };
  }, [emojiPickerRef.current]);

  // Handle form submission
  const handleSave = async () => {
    if (!clinicData?.code) {
      toast({
        title: "Erro",
        description: "Código da clínica não disponível.",
        variant: "destructive",
      });
      return;
    }
    if (!category) {
      toast({
        title: "Erro",
        description: "Selecione uma categoria.",
        variant: "destructive",
      });
      return;
    }
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

    setSaving(true);
    setError(null);

    try {
      // Upload media if new file selected
      let url_arquivo = mediaSavedUrl;
      if (mediaFile) {
        const formData = new FormData();
        formData.append("data", mediaFile, mediaFile.name);
        formData.append("fileName", mediaFile.name);
        formData.append("clinicId", clinicData.code);
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

      // Prepare form data for save
      const saveData = new FormData();
      saveData.append("id_clinica", clinicData.code);
      if (messageId) saveData.append("id", messageId.toString());
      saveData.append("categoria", category);
      saveData.append("id_instancia", instanceId.toString());
      saveData.append("modelo_mensagem", messageText);
      saveData.append("ativo", active ? "true" : "false");
      saveData.append("servicos_vinculados", JSON.stringify(linkedServices));
      if (scheduledTime) saveData.append("hora_envio", scheduledTime);
      if (selectedGroup) saveData.append("grupo", selectedGroup.toString());
      saveData.append("url_arquivo", url_arquivo ?? "");
      saveData.append("para_cliente", targetType === "Cliente" ? "true" : "false");
      saveData.append(
        "para_funcionario",
        targetType === "Funcionário" ? "true" : "false"
      );
      // Variations
      variations.forEach((v, i) =>
        saveData.append(`variacao_${i + 1}`, v || "")
      );

      const saveUrl = messageId
        ? "https://n8n-n8n.sbw0pc.easypanel.host/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4"
        : "https://n8n-n8n.sbw0pc.easypanel.host/webhook/542ce8db-6b1d-40f5-b58b-23c9154c424d";

      const saveRes = await fetch(saveUrl, {
        method: "POST",
        body: saveData,
      });
      if (!saveRes.ok) {
        const text = await saveRes.text();
        throw new Error(text || "Falha ao salvar mensagem");
      }

      toast({
        title: "Sucesso",
        description: "Mensagem salva com sucesso.",
      });

      // Redirect or reset form after save
      setTimeout(() => {
        window.location.href = `https://n8n-n8n.sbw0pc.easypanel.host/webhook/6a77013c-713e-43e1-8830-c3afd89ee512?clinic_code=${encodeURIComponent(
          clinicData.code
        )}&status=${messageId ? "updated" : "created"}`;
      }, 1500);
    } catch (e: any) {
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
    if (!messageId) {
      setMessageText(defaultTemplates[value] || "");
    }
  };

  // Show/hide fields based on category and targetType
  const showScheduledTime =
    category === "Confirmar Agendamento" || category === "Aniversário";
  const showGroupSelect = (category === "Chegou" || category === "Liberado") && targetType === "Grupo";
  const showTargetTypeSelect = category === "Chegou" || category === "Liberado";

  // Variations count
  const variationsCount = variations.filter((v) => v.trim() !== "").length;

  // Handle variation change
  const handleVariationChange = (index: number, value: string) => {
    setVariations((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  // Handle media file change
  const onMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMediaFile(e.target.files[0]);
    } else {
      setMediaFile(null);
    }
  };

  // Cancel action: redirect back to list
  const handleCancel = () => {
    if (!clinicData?.code) return;
    window.location.href = `https://n8n-n8n.sbw0pc.easypanel.host/webhook/6a77013c-713e-43e1-8830-c3afd89ee512?clinic_code=${encodeURIComponent(
      clinicData.code
    )}`;
  };

  return (
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-6 overflow-auto">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>
            {messageId ? "Editar Mensagem" : "Configurar Nova Mensagem"}
          </CardTitle>
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
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              {showTargetTypeSelect && (
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

              {showGroupSelect && (
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

              {category === "Confirmar Agendamento" && (
                <div>
                  <label
                    htmlFor="scheduledTime"
                    className="block mb-1 font-medium text-gray-700"
                  >
                    Hora Programada (Confirmação) *
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

              {category === "Aniversário" && (
                <div>
                  <label
                    htmlFor="birthdayTime"
                    className="block mb-1 font-medium text-gray-700"
                  >
                    Hora de Envio (Aniversário) *
                  </label>
                  <Select
                    value={scheduledTime}
                    onValueChange={setScheduledTime}
                    id="birthdayTime"
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
                  {showEmojiPicker && (
                    <div className="absolute z-50 top-full right-0 mt-1">
                      <emoji-picker
                        ref={emojiPickerRef}
                        style={{ width: "300px", height: "300px" }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="services"
                  className="block mb-1 font-medium text-gray-700"
                >
                  Serviços Vinculados *
                </label>
                <MultiSelectServices
                  options={services}
                  selectedIds={linkedServices} // This prop controls which checkboxes are checked
                  onChange={setLinkedServices}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Quais agendamentos de serviço ativarão esta mensagem.
                </p>
              </div>

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

              <div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowVariations((v) => !v)}
                >
                  Gerenciar Variações ({variationsCount}/5)
                </Button>
                {showVariations && (
                  <div className="mt-4 space-y-4 border border-gray-300 rounded p-4 bg-gray-50">
                    <h4 className="text-lg font-semibold text-primary mb-2">
                      Variações da Mensagem
                    </h4>
                    <div className="mb-2 p-2 bg-white rounded border border-gray-200 whitespace-pre-wrap">
                      <strong>Mensagem Original (Base para IA):</strong>
                      <div>{messageText || "(Mensagem principal vazia)"}</div>
                    </div>
                    {variations.map((v, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <label
                          htmlFor={`variation${i + 1}`}
                          className="font-medium"
                        >
                          Variação {i + 1}
                        </label>
                        <div className="flex gap-2">
                          <Textarea
                            id={`variation${i + 1}`}
                            rows={3}
                            value={v}
                            onChange={(e) =>
                              handleVariationChange(i, e.target.value)
                            }
                            placeholder={`Variação ${i + 1}...`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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