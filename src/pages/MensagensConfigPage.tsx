import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TriangleAlert } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import MultiSelectServices from '@/components/MultiSelectServices';

interface MensagensConfigPageProps {
  clinicData: {
    id: number | string | null;
    code?: string;
    nome?: string;
    acesso_crm?: boolean;
    acesso_config_msg?: boolean;
    id_permissao?: number;
  } | null;
}

interface Service {
  id: number;
  nome: string;
}

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const initialCategoryFromUrl = searchParams.get('category');
  const isEditing = !!messageId;

  // Estado e fetch para lista de serviços vinculados (selecionados)
  // Mantido para que a query seja executada, mas não será usado para popular o combo desabilitado
  const { data: linkedServicesList, isLoading: isLoadingLinkedServices, error: linkedServicesError } = useQuery<Service[]>({
    queryKey: ['linkedServicesConfigPage', messageId],
    queryFn: async () => {
      if (!messageId) return [];
      const { data, error } = await supabase
        .from('north_clinic_mensagens_servicos')
        .select('id_servico, nome_servico:north_clinic_servicos(nome)')
        .eq('id_mensagem', parseInt(messageId, 10));
      if (error) throw new Error(error.message);
      return data?.map(item => ({
        id: item.id_servico,
        nome: item.nome_servico?.nome || `Serviço ${item.id_servico}`
      })) || [];
    },
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Estado e fetch para todos os serviços disponíveis da clínica
  const { data: allServicesList, isLoading: isLoadingAllServices, error: allServicesError } = useQuery<Service[]>({
    queryKey: ['allServices', clinicData?.id],
    queryFn: async () => {
      if (!clinicData?.id) return [];
      const { data, error } = await supabase
        .from('north_clinic_servicos')
        .select('id, nome')
        .eq('id_clinica', clinicData.id)
        .order('nome', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!clinicData?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Estado e fetch para dados da mensagem
  const { data: messageDetails, isLoading: isLoadingMessageDetails, error: messageDetailsError } = useQuery({
    queryKey: ['messageDetails', messageId],
    queryFn: async () => {
      if (!messageId) return null;
      const { data, error } = await supabase
        .from('north_clinic_config_mensagens')
        .select('*')
        .eq('id', parseInt(messageId, 10))
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Estado e fetch para instâncias
  const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery({
    queryKey: ['instancesList', clinicData?.id],
    queryFn: async () => {
      if (!clinicData?.id) return [];
      const { data, error } = await supabase
        .from('north_clinic_config_instancias')
        .select('id, nome_exibição')
        .eq('id_clinica', clinicData.id)
        .order('nome_exibição', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!clinicData?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Estado do formulário - Mantido como estava antes da última alteração
  const [formData, setFormData] = useState({
    categoria: initialCategoryFromUrl || '',
    id_instancia: '',
    modelo_mensagem: '',
    ativo: true,
    hora_envio: '',
    para_funcionario: false,
    para_grupo: true,
    para_cliente: false,
    variacao_1: '',
    variacao_2: '',
    variacao_3: '',
    variacao_4: '',
    variacao_5: '',
    prioridade: 1,
    // servicos_vinculados: [] as number[], // Removido o estado de serviços vinculados do formData
  });

  const messageTextRef = useRef<HTMLTextAreaElement>(null);

  // Popula o formulário com dados da mensagem ao carregar - Mantido como estava antes da última alteração
  useEffect(() => {
    if (isEditing && messageDetails) {
      setFormData({
        categoria: messageDetails.categoria || '',
        id_instancia: String(messageDetails.id_instancia || ''),
        modelo_mensagem: messageDetails.modelo_mensagem || '',
        ativo: messageDetails.ativo,
        hora_envio: messageDetails.hora_envio || '',
        para_funcionario: messageDetails.para_funcionario,
        para_grupo: messageDetails.para_grupo,
        para_cliente: messageDetails.para_cliente,
        variacao_1: messageDetails.variacao_1 || '',
        variacao_2: messageDetails.variacao_2 || '',
        variacao_3: messageDetails.variacao_3 || '',
        variacao_4: messageDetails.variacao_4 || '',
        variacao_5: messageDetails.variacao_5 || '',
        prioridade: messageDetails.prioridade ?? 1,
        // servicos_vinculados: linkedServicesList ? linkedServicesList.map(s => s.id) : [], // Removido a população de serviços vinculados
      });
    } else if (!isEditing && initialCategoryFromUrl) {
      setFormData(prev => ({
        ...prev,
        categoria: initialCategoryFromUrl,
        modelo_mensagem: '',
        prioridade: 1,
        // servicos_vinculados: [], // Removido a inicialização de serviços vinculados
      }));
    }
  }, [messageDetails, isEditing, initialCategoryFromUrl]); // Removido linkedServicesList da dependência

  // Handlers para inputs - Mantido como estava
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Handler para mudança dos serviços vinculados (multi select) - Removido, pois o combo será desabilitado
  // const handleServicesChange = (selectedIds: number[]) => {
  //   setFormData(prev => ({
  //     ...prev,
  //     servicos_vinculados: selectedIds
  //   }));
  // };

  // Salvar (placeholder) - Mantido como estava
  const handleSave = async () => {
    showSuccess("Salvar funcionalidade ainda não implementada.");
  };

  // Cancelar - Mantido como estava
  const handleCancel = () => {
    navigate(`/dashboard/11?clinic_code=${encodeURIComponent(clinicData?.code || '')}`, { replace: true });
  };

  // Loading e erros - Ajustado para incluir loading/error de allServicesList
  const isLoading = isLoadingMessageDetails || isLoadingInstances || isLoadingAllServices; // Removido isLoadingLinkedServices
  const error = messageDetailsError || instancesError || allServicesError; // Removido linkedServicesError

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-6">
        <TriangleAlert className="mx-auto mb-4 h-12 w-12" />
        <p>Erro ao carregar a página: {error.message}</p>
      </div>
    );
  }

  if (!clinicData) {
    return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
  }

  return (
    <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Mensagem' : 'Nova Mensagem'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={formData.categoria} onValueChange={(value) => handleSelectChange('categoria', value)}>
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Confirmar Agendamento">Confirmar Agendamento</SelectItem>
                    <SelectItem value="Aniversário">Aniversário</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="id_instancia">Instância</Label>
                <Select value={formData.id_instancia} onValueChange={(value) => handleSelectChange('id_instancia', value)}>
                  <SelectTrigger id="id_instancia">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instancesList?.map(inst => (
                      <SelectItem key={inst.id} value={String(inst.id)}>{inst.nome_exibição}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ativo">Ativo</Label>
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={handleInputChange}
                  className="mt-2"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="modelo_mensagem">Modelo de Mensagem</Label>
                <Textarea
                  id="modelo_mensagem"
                  value={formData.modelo_mensagem}
                  onChange={handleInputChange}
                  ref={messageTextRef}
                  rows={6}
                />
              </div>

              {/* Combo de serviços vinculados usando MultiSelectServices - APENAS EXIBINDO */}
              <div className="md:col-span-2">
                <Label htmlFor="servicos_vinculados">Serviços Vinculados *</Label>
                <p className="text-sm text-gray-500 mb-2">Quais agendamentos de serviço ativarão esta mensagem.</p>
                {/* Adicionado o MultiSelectServices aqui, desabilitado e sem vincular a estado */}
                <MultiSelectServices
                  options={allServicesList || []} // Lista todos os serviços disponíveis
                  selectedIds={[]} // Não vincula a serviços selecionados
                  onChange={() => {}} // Não tem handler de mudança
                  disabled={true} // Apenas exibe, não permite seleção
                />
                {(linkedServicesError || allServicesError) && (
                  <p className="text-red-600 mt-1">
                    Erro ao carregar serviços: {(linkedServicesError || allServicesError)?.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                <Button type="button" variant="secondary" onClick={handleCancel}>Cancelar</Button>
                <Button type="submit" disabled={isLoadingMessageDetails}>Salvar</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensConfigPage;