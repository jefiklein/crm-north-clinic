import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Save, XCircle, Smile, Tags, FileText, Video, Music, Download } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { showSuccess, showError, showToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

import 'emoji-picker-element';

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface MessageDetails {
  id: number;
  categoria: string;
  modelo_mensagem: string | null;
  midia_mensagem: string | null;
  id_instancia: number | null;
  grupo: string | null;
  ativo: boolean;
  hora_envio: string | null;
  intervalo: number | null;
  id_clinica: number;
  variacao_1: string | null;
  variacao_2: string | null;
  variacao_3: string | null;
  variacao_4: string | null;
  variacao_5: string | null;
  para_funcionario: boolean;
  para_grupo: boolean;
  para_cliente: boolean;
  url_arquivo: string | null;
  prioridade: number;
  created_at: string;
  updated_at: string;
}

interface InstanceInfo {
  id: number;
  nome_exibição: string;
  telefone: number | null;
  nome_instancia_evolution: string | null;
}

interface ServiceInfo {
  id: number;
  nome: string;
}

interface GroupInfo {
  id_grupo: string;
  nome_grupo: string;
}

interface LinkedService {
  id_servico: number;
}

interface MensagensConfigPageProps {
  clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const GET_GROUPS_URL = `${N8N_BASE_URL}/webhook/29203acf-7751-4b18-8d69-d4bdb380810e`;
const SAVE_MESSAGE_URL_CREATE = `${N8N_BASE_URL}/webhook/542ce8db-6b1d-40f5-b58b-23c9154c424d`;
const SAVE_MESSAGE_URL_UPDATE = `${N8N_BASE_URL}/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4`;
const UPLOAD_SUPABASE_URL = 'https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase';
const GET_SIGNED_URL_WEBHOOK = 'https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo';

const orderedCategories = [ 'Agendou', 'Confirmar Agendamento', 'Responder Confirmar Agendamento', 'Faltou', 'Finalizou Atendimento', 'Aniversário', 'Chegou', 'Liberado' ];
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
  hora_agendamento: "15:30"
};
const defaultTemplates: { [key: string]: string } = {
  'Agendou': "Olá {primeiro_nome_cliente}!\n\nSeu agendamento de *{lista_servicos}* foi realizado para o dia *{dia_agendamento_num} de {mes_agendamento_extenso} ({dia_semana_relativo_extenso}) às {hora_agendamento}h* com {nome_completo_funcionario}.\n\nNossa equipe estará lhe esperando.\nSe precisar reagendar ou tiver alguma dúvida, é só nos chamar por aqui.",
  'Confirmar Agendamento': "Olá {primeiro_nome_cliente}, passando para lembrar do seu agendamento de *{nome_servico_principal}* {dia_semana_relativo_extenso} ({data_agendamento}) às *{hora_agendamento}h*. Confirma sua presença? (Responda SIM ou NAO)",
  'Responder Confirmar Agendamento': "Obrigado por confirmar, {primeiro_nome_cliente}! Seu horário das *{hora_agendamento}h* para *{nome_servico_principal}* está garantido.",
  'Faltou': "Olá {primeiro_nome_cliente}, notamos que você não pôde comparecer ao seu agendamento de *{nome_servico_principal}* hoje. Gostaríamos de remarcar, qual o melhor horário para você?",
  'Finalizou Atendimento': "Olá {primeiro_nome_cliente}, seu atendimento de *{nome_servico_principal}* com {nome_completo_funcionario} foi finalizado. Esperamos que tenha sido ótimo! Se precisar de algo mais, estamos à disposição.",
  'Aniversário': "Feliz aniversário, {primeiro_nome_cliente}! 🎉 Desejamos a você um dia maravilhoso cheio de alegria e saúde! Equipe North Clinic.",
  'Chegou': "Olá {primeiro_nome_cliente}, que bom que você chegou! Por favor, aguarde um momento, em breve {primeiro_nome_funcionario} irá te chamar.",
  'Liberado': "{primeiro_nome_cliente}, sua sessão de *{nome_servico_principal}* foi concluída. Se tiver uma próxima etapa, informaremos em breve. Obrigado!"
};

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const initialCategoryFromUrl = searchParams.get('category');
  const isEditing = !!messageId;

  const clinicCode = clinicData?.code;
  const clinicId = clinicData?.id;

  // Add selectedServices as array of strings (service IDs)
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    categoria: initialCategoryFromUrl || '',
    id_instancia: '',
    modelo_mensagem: '',
    ativo: true,
    hora_envio: '',
    grupo: '',
    para_funcionario: false,
    para_grupo: true,
    para_cliente: false,
    variacao_1: '',
    variacao_2: '',
    variacao_3: '',
    variacao_4: '',
    variacao_5: '',
    prioridade: 1,
  });
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [existingMediaKey, setExistingMediaKey] = useState<string | null>(null);

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [aiLoadingSlot, setAiLoadingSlot] = useState<number | null>(null);
  const [mediaViewLoading, setMediaViewLoading] = useState(false);

  const messageTextRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<any>(null);

  // Fetch message details
  const { data: messageDetails, isLoading: isLoadingDetails, error: detailsError } = useQuery<MessageDetails | null>({
    queryKey: ['messageDetails', messageId, clinicId],
    queryFn: async () => {
      if (!messageId || !clinicId) return null;
      const { data, error } = await supabase
        .from('north_clinic_config_mensagens')
        .select('*')
        .eq('id', parseInt(messageId, 10))
        .eq('id_clinica', clinicId)
        .single();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data || null;
    },
    enabled: isEditing && !!messageId && !!clinicId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch instances
  const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
    queryKey: ['instancesListConfigPage', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const { data, error } = await supabase
        .from('north_clinic_config_instancias')
        .select('id, nome_exibição, telefone, nome_instancia_evolution')
        .eq('id_clinica', clinicId);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch services
  const { data: servicesList, isLoading: isLoadingServices, error: servicesError } = useQuery<ServiceInfo[]>({
    queryKey: ['servicesListConfigPage', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const { data, error } = await supabase
        .from('north_clinic_servicos')
        .select('id, nome')
        .eq('id_clinica', clinicId)
        .order('nome', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch linked services
  const { data: linkedServicesList, isLoading: isLoadingLinkedServices, error: linkedServicesError } = useQuery<LinkedService[]>({
    queryKey: ['linkedServicesConfigPage', messageId],
    queryFn: async () => {
      if (!messageId) return [];
      const { data, error } = await supabase
        .from('north_clinic_mensagens_servicos')
        .select('id_servico')
        .eq('id_mensagem', parseInt(messageId, 10));
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: isEditing && !!messageId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // On messageDetails or linkedServicesList load, set formData and selectedServices
  useEffect(() => {
    if (isEditing && messageDetails) {
      setFormData({
        categoria: messageDetails.categoria || '',
        id_instancia: String(messageDetails.id_instancia || ''),
        modelo_mensagem: messageDetails.modelo_mensagem || '',
        ativo: messageDetails.ativo,
        hora_envio: messageDetails.hora_envio || '',
        grupo: messageDetails.grupo || '',
        para_funcionario: messageDetails.para_funcionario,
        para_grupo: messageDetails.para_grupo,
        para_cliente: messageDetails.para_cliente,
        variacao_1: messageDetails.variacao_1 || '',
        variacao_2: messageDetails.variacao_2 || '',
        variacao_3: messageDetails.variacao_3 || '',
        variacao_4: messageDetails.variacao_4 || '',
        variacao_5: messageDetails.variacao_5 || '',
        prioridade: messageDetails.prioridade ?? 1,
      });
      setExistingMediaKey(messageDetails.midia_mensagem || null);
    } else if (!isEditing && initialCategoryFromUrl) {
      setFormData(prev => ({
        ...prev,
        categoria: initialCategoryFromUrl,
        modelo_mensagem: defaultTemplates[initialCategoryFromUrl] || '',
        prioridade: 1,
      }));
      setSelectedServices([]);
    }
  }, [messageDetails, linkedServicesList, isEditing, initialCategoryFromUrl]);

  // When linkedServicesList loads, set selectedServices
  useEffect(() => {
    if (isEditing && linkedServicesList) {
      const linkedIds = linkedServicesList.map(ls => String(ls.id_servico));
      setSelectedServices(linkedIds);
    }
  }, [linkedServicesList, isEditing]);

  // Handle services selection change
  const handleServicesChange = (values: string[]) => {
    setSelectedServices(values);
  };

  // On save, include selectedServices in form data as JSON string
  const handleSave = async () => {
    // ... existing save logic ...

    const dataToSave = new FormData();
    // ... append other fields ...

    dataToSave.append('servicos_vinculados', JSON.stringify(selectedServices));

    // ... rest of save logic ...
  };

  // Render form with shadcn/ui Select multiple for services
  return (
    <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
      {/* ... other form parts ... */}

      <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
        <h3 className="text-lg font-semibold text-primary border-b border-gray-200 pb-3 mb-4">Disparador e Condições</h3>

        {/* Service Selection Group (Visible unless category is Aniversário) */}
        <div className="form-group" id="serviceSelectionGroup">
          <Label htmlFor="serviceSelect">Serviços Vinculados *</Label>
          <Select
            multiple
            value={selectedServices}
            onValueChange={handleServicesChange}
            disabled={isLoadingServices || isLoadingLinkedServices}
          >
            {servicesList?.map(service => (
              <SelectItem key={service.id} value={String(service.id)}>
                {service.nome}
              </SelectItem>
            ))}
          </Select>
          <p className="text-xs text-gray-500 mt-1">Quais agendamentos de serviço ativarão esta mensagem.</p>
          {(isLoadingServices || isLoadingLinkedServices) && (
            <p className="text-sm text-gray-600 mt-1">
              <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Carregando serviços...
            </p>
          )}
          {(servicesError || linkedServicesError) && (
            <p className="text-sm text-red-600 mt-1">
              <TriangleAlert className="inline h-4 w-4 mr-1" /> Erro ao carregar serviços.
            </p>
          )}
        </div>

        {/* ... rest of form ... */}
      </div>

      {/* ... rest of component ... */}
    </div>
  );
};

export default MensagensConfigPage;