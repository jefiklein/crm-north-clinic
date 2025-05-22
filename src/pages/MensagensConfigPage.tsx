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

const defaultTemplates: Record<string, string> = {
  "Confirmar Agendamento": "Olá, {primeiro_nome_cliente}! Gostaríamos de confirmar seu agendamento para {data_agendamento} às {hora_agendamento}.",
  "Aniversário": "Feliz aniversário, {primeiro_nome_cliente}! Que seu dia seja maravilhoso!",
  "Outros": "",
};

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const initialCategoryFromUrl = searchParams.get('category');
  const isEditing = !!messageId;

  // State for form data (without services)
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

  const messageTextRef = useRef<HTMLTextAreaElement>(null);

  // Fetch message details from Supabase by messageId
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

  // Fetch instances list for select
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

  // Fetch groups list for select
  const { data: groupsList, isLoading: isLoadingGroups, error: groupsError } = useQuery({
    queryKey: ['groupsList', clinicData?.id],
    queryFn: async () => {
      if (!clinicData?.id) return [];
      const { data, error } = await supabase
        .from('north_clinic_config_grupos')
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

  // Effect to populate form data when message details load (Edit mode)
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
    }
  }, [messageDetails, isEditing, initialCategoryFromUrl]);

  // Effect to handle category-specific field visibility and group fetching
  useEffect(() => {
    if (formData.categoria === 'Aniversário') {
      // Show grupo select
    } else {
      setFormData(prev => ({ ...prev, grupo: '' }));
    }
  }, [formData.categoria]);

  // Effect to handle overall page loading state and errors
  useEffect(() => {
    if (isLoadingMessageDetails || isLoadingInstances || isLoadingGroups) {
      setIsLoadingPage(true);
      setPageError(null);
    } else if (messageDetailsError || instancesError || groupsError) {
      setIsLoadingPage(false);
      setPageError(messageDetailsError?.message || instancesError?.message || groupsError?.message || 'Erro desconhecido');
    } else {
      setIsLoadingPage(false);
      setPageError(null);
    }
  }, [isLoadingMessageDetails, isLoadingInstances, isLoadingGroups, messageDetailsError, instancesError, groupsError]);

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) || 0 : value)
    }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
    if (id === 'categoria') {
      setFormData(prev => ({
        ...prev,
        categoria: value,
        para_funcionario: false,
        para_grupo: true,
        para_cliente: false,
        grupo: ''
      }));
    }
  };

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setSelectedMediaFile(file);
  };

  const handleSave = async () => {
    // Implement save logic here (excluding services)
    showToast("Salvar funcionalidade ainda não implementada.", "info");
  };

  const handleCancel = () => {
    navigate(`/dashboard/11?clinic_code=${encodeURIComponent(clinicData?.code || '')}`, { replace: true });
  };

  if (isLoadingPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="text-center text-red-600 p-6">
        <TriangleAlert className="mx-auto mb-4 h-12 w-12" />
        <p>Erro ao carregar a página: {pageError}</p>
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
                <Label htmlFor="grupo">Grupo</Label>
                <Select value={formData.grupo} onValueChange={(value) => handleSelectChange('grupo', value)}>
                  <SelectTrigger id="grupo">
                    <SelectValue placeholder="Selecione o grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupsList?.map(group => (
                      <SelectItem key={group.id} value={String(group.id)}>{group.nome}</SelectItem>
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

              <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                <Button type="button" variant="secondary" onClick={handleCancel}>Cancelar</Button>
                <Button type="submit" disabled={isLoadingMessageDetails}>Salvar</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Debug section for services (keep as is) */}
      <div className="debug-section bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6 shadow-sm">
        <h3 className="text-lg font-semibold text-yellow-800 border-b border-yellow-200 pb-2 mb-3">Debug: Serviços</h3>
        {/* Você pode adicionar informações de debug aqui manualmente */}
      </div>
    </div>
  );
};

export default MensagensConfigPage;