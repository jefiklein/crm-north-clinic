import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Save, XCircle, Smile, Tags, FileText, Video, Music, Download, Zap, Trash } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import Choices from 'choices.js';
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

interface ServiceInfo {
  id: number;
  nome: string;
}

interface LinkedService {
  id_servico: number;
}

interface MensagensConfigPageProps {
  clinicData: ClinicData | null;
}

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const initialCategoryFromUrl = searchParams.get('category');
  const isEditing = !!messageId;

  const clinicId = clinicData?.id;

  // Form state - keep stable, do not reset unnecessarily
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

  const serviceSelectRef = useRef<HTMLSelectElement>(null);
  const choicesServicesRef = useRef<Choices | null>(null);

  // Fetch services list
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

  // Fetch linked services if editing
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

  // Initialize Choices.js once
  useEffect(() => {
    if (serviceSelectRef.current && !choicesServicesRef.current) {
      try {
        choicesServicesRef.current = new Choices(serviceSelectRef.current, {
          removeItemButton: true,
          searchPlaceholderValue: "Buscar serviço...",
          noResultsText: 'Nenhum serviço encontrado',
          noChoicesText: 'Sem opções disponíveis ou erro no carregamento',
          itemSelectText: 'Pressione Enter para selecionar',
          allowHTML: false,
        });
        console.log("[MensagensConfigPage] Choices.js initialized.");
      } catch (e) {
        console.error("Failed to initialize Choices.js:", e);
      }
    }
    return () => {
      if (choicesServicesRef.current) {
        choicesServicesRef.current.destroy();
        choicesServicesRef.current = null;
        console.log("[MensagensConfigPage] Choices.js destroyed.");
      }
    };
  }, []);

  // Populate Choices.js options and set selected values when services or linked services change
  useEffect(() => {
    if (choicesServicesRef.current && servicesList) {
      const linkedServiceIdSet = new Set(linkedServicesList?.map(item => String(item.id_servico)) || []);
      const choicesData = servicesList.map(service => ({
        value: String(service.id),
        label: service.nome || `Serviço ID ${service.id}`,
        selected: isEditing ? linkedServiceIdSet.has(String(service.id)) : false,
      }));

      choicesServicesRef.current.clearStore();
      choicesServicesRef.current.setChoices(choicesData, 'value', 'label', true);
      choicesServicesRef.current.enable();

      console.log("[MensagensConfigPage] Choices.js populated with services and selections.");
    } else if (choicesServicesRef.current && servicesError) {
      choicesServicesRef.current.clearStore();
      choicesServicesRef.current.setChoices([{ value: '', label: 'Erro ao carregar serviços', disabled: true }], 'value', 'label', true);
      choicesServicesRef.current.disable();
      console.error("[MensagensConfigPage] Error loading services:", servicesError);
    }
  }, [servicesList, linkedServicesList, servicesError, isEditing]);

  // Handler to update formData when Choices.js selection changes
  useEffect(() => {
    if (!choicesServicesRef.current) return;

    const onChange = () => {
      const selectedValues = choicesServicesRef.current?.getValue(true);
      setFormData(prev => ({
        ...prev,
        // Store as comma-separated string or array as needed
        // Here storing as comma-separated string for simplicity
        variacao_1: Array.isArray(selectedValues) ? selectedValues.join(',') : selectedValues || '',
      }));
    };

    choicesServicesRef.current.passedElement.element.addEventListener('change', onChange);

    return () => {
      choicesServicesRef.current?.passedElement.element.removeEventListener('change', onChange);
    };
  }, [choicesServicesRef.current]);

  // Render the select always, avoid conditional rendering to prevent remounts
  return (
    <div className="mensagens-config-container p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
      <Card>
        <CardHeader>
          <CardTitle>Configurar Mensagem Automática</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Other form fields here... */}

          <div className="form-group">
            <Label htmlFor="serviceSelect">Serviços Vinculados *</Label>
            <select
              id="serviceSelect"
              ref={serviceSelectRef}
              multiple
              disabled={isLoadingServices || isLoadingLinkedServices}
              className="w-full border border-gray-300 rounded p-2"
            />
            {(isLoadingServices || isLoadingLinkedServices) && (
              <p className="text-sm text-gray-600 mt-1 flex items-center">
                <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Carregando serviços...
              </p>
            )}
            {(servicesError || linkedServicesError) && (
              <p className="text-sm text-red-600 mt-1 flex items-center">
                <TriangleAlert className="inline h-4 w-4 mr-1" /> Erro ao carregar serviços.
              </p>
            )}
          </div>

          {/* Other form fields and buttons */}
          <Button onClick={() => console.log("Salvar mensagem com dados:", formData)}>Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensConfigPage;