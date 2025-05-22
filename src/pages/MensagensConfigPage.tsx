import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Save, XCircle, Smile, Tags, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { showSuccess, showError, showToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { MultiSelect } from '@/components/MultiSelect';

// Define interfaces for data
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

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const SAVE_MESSAGE_URL_CREATE = `${N8N_BASE_URL}/webhook/542ce8db-6b1d-40f5-b58b-23c9154c424d`;
const SAVE_MESSAGE_URL_UPDATE = `${N8N_BASE_URL}/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4`;

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const isEditing = !!messageId;
  const clinicId = clinicData?.id;

  // Form state
  const [formData, setFormData] = useState({
    categoria: '',
    modelo_mensagem: '',
    ativo: true,
    prioridade: 1,
  });

  // Selected services state
  const [selectedServices, setSelectedServices] = useState<ServiceInfo[]>([]);

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

  // Fetch message details if editing
  const { data: messageDetails, isLoading: isLoadingDetails, error: detailsError } = useQuery({
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

  // Populate form and selected services when data loads
  useEffect(() => {
    if (messageDetails) {
      setFormData({
        categoria: messageDetails.categoria || '',
        modelo_mensagem: messageDetails.modelo_mensagem || '',
        ativo: messageDetails.ativo,
        prioridade: messageDetails.prioridade ?? 1,
      });
    }
  }, [messageDetails]);

  useEffect(() => {
    if (servicesList) {
      if (isEditing && linkedServicesList) {
        const linkedIds = new Set(linkedServicesList.map(ls => ls.id_servico));
        const selected = servicesList.filter(s => linkedIds.has(s.id));
        setSelectedServices(selected);
      } else {
        setSelectedServices([]);
      }
    }
  }, [servicesList, linkedServicesList, isEditing]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
  };

  // Save mutation
  const saveMessageMutation = useMutation({
    mutationFn: async () => {
      if (!clinicData?.code) throw new Error("Código da clínica não disponível.");
      const url = isEditing ? SAVE_MESSAGE_URL_UPDATE : SAVE_MESSAGE_URL_CREATE;
      const dataToSave = new FormData();
      dataToSave.append('id_clinica', clinicData.code);
      if (isEditing && messageId) dataToSave.append('id', messageId);
      dataToSave.append('categoria', formData.categoria);
      dataToSave.append('modelo_mensagem', formData.modelo_mensagem);
      dataToSave.append('ativo', String(formData.ativo));
      dataToSave.append('prioridade', String(formData.prioridade));
      // Add linked services as JSON string
      const linkedServiceIds = selectedServices.map(s => s.id);
      dataToSave.append('servicos_vinculados', JSON.stringify(linkedServiceIds));

      const response = await fetch(url, { method: 'POST', body: dataToSave });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Erro ao salvar mensagem');
      }
      return response.json();
    },
    onSuccess: () => {
      showSuccess(`Mensagem ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['messagesList', clinicId] });
      navigate(`/dashboard/11?status=${isEditing ? 'updated' : 'created'}`, { replace: true });
    },
    onError: (error: Error) => {
      showError(`Erro ao salvar mensagem: ${error.message}`);
    },
  });

  const handleSave = () => {
    saveMessageMutation.mutate();
  };

  const handleCancel = () => {
    navigate(`/dashboard/11?clinic_code=${encodeURIComponent(clinicData?.code || '')}`, { replace: true });
  };

  if (!clinicData) {
    return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
  }

  const isLoading = isLoadingServices || isLoadingLinkedServices || isLoadingDetails || saveMessageMutation.isLoading;

  return (
    <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
      <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="config-title text-2xl font-bold text-primary whitespace-nowrap">
          {isEditing ? 'Editar Mensagem' : 'Configurar Nova Mensagem'}
        </h1>
      </div>

      {isLoading && (
        <div className="loading-indicator flex flex-col items-center justify-center p-8 text-primary">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <span className="text-lg">Carregando dados...</span>
        </div>
      )}

      {!isLoading && (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary border-b border-gray-200 pb-3 mb-4">Informações da Mensagem</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <Label htmlFor="categoria">Categoria *</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="form-group">
                <Label htmlFor="ativo">Ativo</Label>
                <input
                  id="ativo"
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Input
                  id="prioridade"
                  type="number"
                  value={formData.prioridade}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  min={1}
                />
              </div>

              <div className="form-group md:col-span-2">
                <Label htmlFor="modelo_mensagem">Texto da Mensagem Principal *</Label>
                <Textarea
                  id="modelo_mensagem"
                  value={formData.modelo_mensagem}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  rows={6}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary border-b border-gray-200 pb-3 mb-4">Serviços Vinculados *</h3>

            {servicesError && <p className="text-red-600 mb-2">Erro ao carregar serviços: {servicesError.message}</p>}

            <MultiSelect<ServiceInfo>
              options={servicesList || []}
              value={selectedServices}
              onChange={setSelectedServices}
              labelKey="nome"
              valueKey="id"
              placeholder="Selecione os serviços..."
              disabled={isLoading}
            />
          </div>

          <div className="form-actions flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {saveMessageMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MensagensConfigPage;