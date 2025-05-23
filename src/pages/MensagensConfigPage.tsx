import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, setHours, setMinutes, setSeconds } from 'date-fns';
import { TimePicker } from "@/components/ui/time-picker";
import MultiSelectServices from '@/components/MultiSelectServices';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface ServiceOption {
  id: number;
  nome: string;
}

interface MensagensConfigPageProps {
  clinicData: ClinicData | null;
}

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const [searchParams] = useSearchParams();
  const clinicCode = searchParams.get('clinic_code') || undefined;
  const messageIdParam = searchParams.get('id');
  const messageId = messageIdParam ? parseInt(messageIdParam, 10) : undefined;

  const [categoria, setCategoria] = useState<string>('');
  const [modeloMensagem, setModeloMensagem] = useState<string>('');
  const [midiaMensagem, setMidiaMensagem] = useState<string>('');
  const [ativo, setAtivo] = useState<boolean>(true);
  const [horaEnvio, setHoraEnvio] = useState<Date | undefined>(undefined);
  const [intervalo, setIntervalo] = useState<number | undefined>(undefined);
  const [paraFuncionario, setParaFuncionario] = useState<boolean>(false);
  const [paraGrupo, setParaGrupo] = useState<boolean>(false);
  const [paraCliente, setParaCliente] = useState<boolean>(false);
  const [prioridade, setPrioridade] = useState<number>(1);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);

  const [servicesOptions, setServicesOptions] = useState<ServiceOption[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch services from Supabase on mount
  useEffect(() => {
    if (!clinicData?.id) return;

    const fetchServices = async () => {
      setIsLoadingServices(true);
      try {
        const { data, error } = await supabase
          .from('north_clinic_servicos')
          .select('id, nome')
          .eq('id_clinica', clinicData.id)
          .order('nome', { ascending: true });

        if (error) {
          throw error;
        }

        if (data) {
          setServicesOptions(data);
        }
      } catch (error: any) {
        showError(`Erro ao carregar serviços: ${error.message}`);
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchServices();
  }, [clinicData]);

  // Fetch message details if editing existing message
  useEffect(() => {
    if (!messageId || !clinicData?.id) return;

    const fetchMessage = async () => {
      try {
        const { data, error } = await supabase
          .from('north_clinic_config_mensagens')
          .select('*')
          .eq('id', messageId)
          .eq('id_clinica', clinicData.id)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setCategoria(data.categoria || '');
          setModeloMensagem(data.modelo_mensagem || '');
          setMidiaMensagem(data.midia_mensagem || '');
          setAtivo(data.ativo ?? true);
          setPrioridade(data.prioridade ?? 1);
          setParaFuncionario(data.para_funcionario ?? false);
          setParaGrupo(data.para_grupo ?? false);
          setParaCliente(data.para_cliente ?? false);
          setIntervalo(data.intervalo ?? undefined);

          if (data.hora_envio) {
            const parsedDate = new Date(`1970-01-01T${data.hora_envio}`);
            if (!isNaN(parsedDate.getTime())) {
              setHoraEnvio(parsedDate);
            }
          }

          // Parse selected services if stored as array or CSV string
          if (data.servicos) {
            if (Array.isArray(data.servicos)) {
              setSelectedServices(data.servicos);
            } else if (typeof data.servicos === 'string') {
              const parsed = data.servicos.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
              setSelectedServices(parsed);
            }
          }
        }
      } catch (error: any) {
        showError(`Erro ao carregar mensagem: ${error.message}`);
      }
    };

    fetchMessage();
  }, [messageId, clinicData]);

  const handleSave = async () => {
    if (!clinicData?.id) {
      showError("Dados da clínica não disponíveis.");
      return;
    }
    if (!categoria) {
      showError("Selecione uma categoria.");
      return;
    }
    if (!modeloMensagem) {
      showError("Informe o modelo da mensagem.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        categoria,
        modelo_mensagem: modeloMensagem,
        midia_mensagem: midiaMensagem,
        ativo,
        hora_envio: horaEnvio ? format(horaEnvio, 'HH:mm:ss') : null,
        intervalo,
        para_funcionario: paraFuncionario,
        para_grupo: paraGrupo,
        para_cliente: paraCliente,
        prioridade,
        id_clinica: clinicData.id,
        servicos: selectedServices, // Save selected services as array
      };

      let response;
      if (messageId) {
        response = await supabase
          .from('north_clinic_config_mensagens')
          .update(payload)
          .eq('id', messageId)
          .eq('id_clinica', clinicData.id);
      } else {
        response = await supabase
          .from('north_clinic_config_mensagens')
          .insert(payload);
      }

      if (response.error) {
        throw response.error;
      }

      showSuccess("Mensagem salva com sucesso!");
    } catch (error: any) {
      showError(`Erro ao salvar mensagem: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!clinicData) {
    return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
  }

  return (
    <div className="mensagens-config-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>{messageId ? 'Editar Mensagem' : 'Nova Mensagem'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="categoria" className="block font-semibold mb-1">Categoria</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="categoria" className="w-full">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Agendou">Agendou</SelectItem>
                <SelectItem value="Confirmar Agendamento">Confirmar Agendamento</SelectItem>
                <SelectItem value="Responder Confirmar Agendamento">Responder Confirmar Agendamento</SelectItem>
                <SelectItem value="Aniversario">Aniversario</SelectItem>
                <SelectItem value="Faltou">Faltou</SelectItem>
                <SelectItem value="Chegou">Chegou</SelectItem>
                <SelectItem value="Liberado">Liberado</SelectItem>
                <SelectItem value="Finalizou atendimento">Finalizou atendimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="modeloMensagem" className="block font-semibold mb-1">Modelo da Mensagem</label>
            <Input
              id="modeloMensagem"
              type="text"
              value={modeloMensagem}
              onChange={(e) => setModeloMensagem(e.target.value)}
              placeholder="Digite o modelo da mensagem"
            />
          </div>

          <div>
            <label htmlFor="midiaMensagem" className="block font-semibold mb-1">Mídia da Mensagem (opcional)</label>
            <Input
              id="midiaMensagem"
              type="text"
              value={midiaMensagem}
              onChange={(e) => setMidiaMensagem(e.target.value)}
              placeholder="URL ou descrição da mídia"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Serviços Relacionados</label>
            {isLoadingServices ? (
              <p>Carregando serviços...</p>
            ) : (
              <MultiSelectServices
                options={servicesOptions}
                selectedIds={selectedServices}
                onChange={setSelectedServices}
              />
            )}
          </div>

          <div className="flex items-center space-x-4">
            <Checkbox
              id="paraFuncionario"
              checked={paraFuncionario}
              onCheckedChange={(checked) => setParaFuncionario(Boolean(checked))}
            />
            <label htmlFor="paraFuncionario">Para Funcionário</label>

            <Checkbox
              id="paraGrupo"
              checked={paraGrupo}
              onCheckedChange={(checked) => setParaGrupo(Boolean(checked))}
            />
            <label htmlFor="paraGrupo">Para Grupo</label>

            <Checkbox
              id="paraCliente"
              checked={paraCliente}
              onCheckedChange={(checked) => setParaCliente(Boolean(checked))}
            />
            <label htmlFor="paraCliente">Para Cliente</label>
          </div>

          <div>
            <label htmlFor="prioridade" className="block font-semibold mb-1">Prioridade</label>
            <Input
              id="prioridade"
              type="number"
              min={1}
              value={prioridade}
              onChange={(e) => setPrioridade(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <div>
            <label htmlFor="intervalo" className="block font-semibold mb-1">Intervalo (minutos)</label>
            <Input
              id="intervalo"
              type="number"
              min={0}
              value={intervalo ?? ''}
              onChange={(e) => setIntervalo(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            />
          </div>

          <div>
            <label htmlFor="horaEnvio" className="block font-semibold mb-1">Hora de Envio</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full text-left">
                  {horaEnvio ? format(horaEnvio, 'HH:mm') : 'Selecione a hora'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4">
                <TimePicker date={horaEnvio} setDate={setHoraEnvio} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center space-x-4">
            <Checkbox
              id="ativo"
              checked={ativo}
              onCheckedChange={(checked) => setAtivo(Boolean(checked))}
            />
            <label htmlFor="ativo">Ativo</label>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button variant="secondary" onClick={() => window.history.back()} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensConfigPage;