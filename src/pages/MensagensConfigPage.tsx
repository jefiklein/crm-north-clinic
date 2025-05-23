import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MultiSelectServices from '@/components/MultiSelectServices';
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a service option
interface ServiceOption {
  id: number;
  nome: string;
}

interface MensagensConfigPageProps {
  clinicData: ClinicData | null;
}

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [servicesOptions, setServicesOptions] = useState<ServiceOption[]>([]);

  console.log("MensagensConfigPage: Render start");
  console.log("MensagensConfigPage: clinicData:", clinicData);

  // Fetch services from Supabase
  const { data: servicesData, isLoading, error } = useQuery<ServiceOption[]>({
    queryKey: ['services', clinicData?.id],
    queryFn: async () => {
      if (!clinicData?.id) {
        console.log("MensagensConfigPage: clinicData.id is missing, skipping fetch");
        return [];
      }
      console.log(`MensagensConfigPage: Fetching services for clinicId=${clinicData.id}`);
      const { data, error } = await supabase
        .from('north_clinic_servicos')
        .select('id, nome')
        .eq('id_clinica', clinicData.id)
        .order('nome', { ascending: true });

      if (error) {
        console.error("MensagensConfigPage: Error fetching services:", error);
        throw error;
      }
      console.log("MensagensConfigPage: Services fetched:", data);
      return data || [];
    },
    enabled: !!clinicData?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    console.log("MensagensConfigPage: useEffect servicesData changed:", servicesData);
    if (servicesData) {
      setServicesOptions(servicesData);
    }
  }, [servicesData]);

  useEffect(() => {
    console.log("MensagensConfigPage: selectedServices changed:", selectedServices);
  }, [selectedServices]);

  const handleServicesChange = (selected: number[]) => {
    console.log("MensagensConfigPage: handleServicesChange called with:", selected);
    setSelectedServices(selected);
  };

  return (
    <div className="mensagens-config-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Mensagens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label htmlFor="services" className="block font-semibold mb-2">Serviços</label>
            {isLoading && <p>Carregando serviços...</p>}
            {error && <p className="text-red-600">Erro ao carregar serviços: {error.message}</p>}
            {!isLoading && !error && (
              <>
                <MultiSelectServices
                  options={servicesOptions}
                  selectedIds={selectedServices}
                  onChange={handleServicesChange}
                />
                <p className="mt-2 text-sm text-gray-600">Serviços selecionados: {selectedServices.join(', ') || 'Nenhum'}</p>
              </>
            )}
          </div>
          {/* Other form fields and buttons can be here */}
          <Button onClick={() => console.log("Salvar clicado. Serviços selecionados:", selectedServices)}>
            Salvar Configuração
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensConfigPage;