import React, { useState, useEffect } from 'react';
import MultiSelectServices from '@/components/MultiSelectServices';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

// (Mantenha os outros imports e o código existente da tela intactos)

interface ServiceOption {
  id: number;
  nome: string;
}

const MensagensConfigPage: React.FC<{ clinicData: any }> = ({ clinicData }) => {
  // --- Seus estados e lógica existentes aqui ---

  // Estados para os serviços
  const [servicesOptions, setServicesOptions] = useState<ServiceOption[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);

  // Busque os serviços ao montar o componente ou quando clinicData mudar
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

        if (error) throw error;

        if (data) setServicesOptions(data);
      } catch (error: any) {
        showError(`Erro ao carregar serviços: ${error.message}`);
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchServices();
  }, [clinicData]);

  return (
    <div>
      {/* TODO: Mantenha todo o JSX existente da tela aqui */}

      {/* Exemplo: outros campos do formulário */}
      {/* ... seu código existente ... */}

      {/* Aqui insira a lista de serviços */}
      <div className="mt-6">
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

      {/* Continue com o restante do JSX da tela */}
      {/* ... seu código existente ... */}
    </div>
  );
};

export default MensagensConfigPage;