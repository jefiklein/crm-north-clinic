// Adicione no topo, junto com os outros imports:
import MultiSelectServices from '@/components/MultiSelectServices';
import { useEffect, useState } from 'react';

// Dentro do componente MensagensConfigPage, adicione estes estados:
const [servicesOptions, setServicesOptions] = useState<ServiceOption[]>([]);
const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
const [selectedServices, setSelectedServices] = useState<number[]>([]);

// Adicione este useEffect para buscar os serviços do Supabase:
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

// No local onde deseja exibir a lista de serviços (por exemplo, próximo ao campo de mídia da mensagem), adicione:

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

// Além disso, ao carregar os dados da mensagem para edição, se existir um campo 'servicos', atualize o estado selectedServices com os valores existentes (array ou string CSV).

// E ao salvar a mensagem, inclua o campo 'servicos' com o array selectedServices no payload enviado para o banco.

// Essas são as únicas alterações necessárias para adicionar a lista de serviços sem modificar o restante do código.