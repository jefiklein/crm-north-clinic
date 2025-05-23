import React, { useState, useEffect } from 'react';
import MultiSelectServices from '@/components/MultiSelectServices';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

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
  const [servicesOptions, setServicesOptions] = useState<ServiceOption[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);

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

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Configuração de Mensagens</h2>

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

      {/* O restante do formulário e campos da tela permanecem inalterados */}
    </div>
  );
};

export default MensagensConfigPage;