import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TimePicker } from "@/components/ui/time-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, setHours, setMinutes, setSeconds } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import MultiSelectServices from '@/components/MultiSelectServices';
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
  const messageIdParam = searchParams.get('id');
  const clinicCodeParam = searchParams.get('clinic_code');

  const [categoria, setCategoria] = useState('');
  const [modeloMensagem, setModeloMensagem] = useState('');
  const [midiaMensagem, setMidiaMensagem] = useState('');
  const [grupo, setGrupo] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [horaEnvio, setHoraEnvio] = useState<Date | undefined>(undefined);
  const [intervalo, setIntervalo] = useState<number | undefined>(undefined);
  const [paraFuncionario, setParaFuncionario] = useState(false);
  const [paraGrupo, setParaGrupo] = useState(false);
  const [paraCliente, setParaCliente] = useState(false);
  const [prioridade, setPrioridade] = useState<number>(1);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);

  const [servicesList, setServicesList] = useState<ServiceOption[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [errorServices, setErrorServices] = useState<string | null>(null);

  // Fetch services from Supabase on mount
  useEffect(() => {
    if (!clinicData?.id) {
      setServicesList([]);
      return;
    }
    setIsLoadingServices(true);
    setErrorServices(null);

    supabase
      .from('north_clinic_servicos')
      .select('id, nome')
      .eq('id_clinica', clinicData.id)
      .order('nome', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setErrorServices(error.message);
          setServicesList([]);
        } else if (data) {
          setServicesList(data as ServiceOption[]);
        } else {
          setServicesList([]);
        }
      })
      .finally(() => setIsLoadingServices(false));
  }, [clinicData?.id]);

  // Load message data if editing existing message
  useEffect(() => {
    if (!messageIdParam || !clinicData?.id) return;

    supabase
      .from('north_clinic_config_mensagens')
      .select('*')
      .eq('id', Number(messageIdParam))
      .eq('id_clinica', clinicData.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          showError(`Erro ao carregar mensagem: ${error.message}`);
          return;
        }
        if (data) {
          setCategoria(data.categoria || '');
          setModeloMensagem(data.modelo_mensagem || '');
          setMidiaMensagem(data.midia_mensagem || '');
          setGrupo(data.grupo || '');
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

          // Assuming services are stored in a related table or a JSON array in data.servicos
          // If stored as JSON array of IDs, parse and set selectedServices
          if (data.servicos) {
            try {
              const parsedServices = typeof data.servicos === 'string' ? JSON.parse(data.servicos) : data.servicos;
              if (Array.isArray(parsedServices)) {
                setSelectedServices(parsedServices.map((id: any) => Number(id)).filter((id: number) => !isNaN(id)));
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      });
  }, [messageIdParam, clinicData?.id]);

  const handleSubmit = async () => {
    if (!clinicData?.id) {
      showError("Dados da clínica não disponíveis.");
      return;
    }
    if (!categoria) {
      showError("Categoria é obrigatória.");
      return;
    }
    if (!modeloMensagem) {
      showError("Modelo de mensagem é obrigatório.");
      return;
    }

    const payload = {
      categoria,
      modelo_mensagem: modeloMensagem,
      midia_mensagem: midiaMensagem,
      grupo,
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

    try {
      if (messageIdParam) {
        // Update existing message
        const { error } = await supabase
          .from('north_clinic_config_mensagens')
          .update(payload)
          .eq('id', Number(messageIdParam))
          .eq('id_clinica', clinicData.id);

        if (error) throw error;
        showSuccess("Mensagem atualizada com sucesso!");
      } else {
        // Insert new message
        const { error } = await supabase
          .from('north_clinic_config_mensagens')
          .insert(payload);

        if (error) throw error;
        showSuccess("Mensagem criada com sucesso!");
      }
    } catch (error: any) {
      showError(`Erro ao salvar mensagem: ${error.message}`);
    }
  };

  if (!clinicData) {
    return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
  }

  return (
    <div className="mensagens-config-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>{messageIdParam ? 'Editar Mensagem' : 'Nova Mensagem'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block mb-1 font-semibold">Categoria</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Confirmar Agendamento">Confirmar Agendamento</SelectItem>
                <SelectItem value="Aniversário">Aniversário</SelectItem>
                <SelectItem value="Lembrete">Lembrete</SelectItem>
                <SelectItem value="Promoção">Promoção</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block mb-1 font-semibold">Modelo de Mensagem</label>
            <Input
              type="text"
              value={modeloMensagem}
              onChange={(e) => setModeloMensagem(e.target.value)}
              placeholder="Digite o modelo da mensagem"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Mídia da Mensagem</label>
            <Input
              type="text"
              value={midiaMensagem}
              onChange={(e) => setMidiaMensagem(e.target.value)}
              placeholder="Digite a mídia da mensagem"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Grupo</label>
            <Input
              type="text"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Digite o grupo"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Serviços</label>
            {isLoadingServices ? (
              <p>Carregando serviços...</p>
            ) : errorServices ? (
              <p className="text-red-500">Erro ao carregar serviços: {errorServices}</p>
            ) : (
              <MultiSelectServices
                options={servicesList}
                selectedIds={selectedServices}
                onChange={setSelectedServices}
              />
            )}
          </div>

          <div>
            <label className="block mb-1 font-semibold">Hora de Envio</label>
            <TimePicker date={horaEnvio} setDate={setHoraEnvio} />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Intervalo (minutos)</label>
            <Input
              type="number"
              value={intervalo ?? ''}
              onChange={(e) => setIntervalo(e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder="Digite o intervalo em minutos"
              min={0}
            />
          </div>

          <div className="flex gap-4">
            <Checkbox checked={paraFuncionario} onCheckedChange={(checked) => setParaFuncionario(!!checked)}>
              Para Funcionário
            </Checkbox>
            <Checkbox checked={paraGrupo} onCheckedChange={(checked) => setParaGrupo(!!checked)}>
              Para Grupo
            </Checkbox>
            <Checkbox checked={paraCliente} onCheckedChange={(checked) => setParaCliente(!!checked)}>
              Para Cliente
            </Checkbox>
          </div>

          <div>
            <label className="block mb-1 font-semibold">Prioridade</label>
            <Input
              type="number"
              value={prioridade}
              onChange={(e) => setPrioridade(Number(e.target.value))}
              min={1}
              max={10}
            />
          </div>

          <div>
            <Checkbox checked={ativo} onCheckedChange={(checked) => setAtivo(!!checked)}>
              Ativo
            </Checkbox>
          </div>

          <div className="flex justify-end gap-4">
            <Button onClick={handleSubmit}>
              {messageIdParam ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensConfigPage;