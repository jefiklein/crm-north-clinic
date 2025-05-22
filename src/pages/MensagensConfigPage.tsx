import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { showError } from '@/utils/toast';

interface ServiceInfo {
  id: number;
  nome: string;
}

interface MensagensConfigPageProps {
  clinicData: {
    id: string | number | null;
  } | null;
}

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const clinicId = clinicData?.id;

  const [selectedServices, setSelectedServices] = useState<string[]>([]);

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

  // Example: If you have linked services from editing, set them here
  // For demo, assume empty or you can set from props or effect

  // Handle selection change
  const handleServicesChange = (values: string[]) => {
    setSelectedServices(values);
  };

  return (
    <div className="form-group" id="serviceSelectionGroup">
      <Label htmlFor="serviceSelect">Serviços Vinculados *</Label>
      <Select
        multiple
        value={selectedServices}
        onValueChange={handleServicesChange}
        disabled={isLoadingServices || !!servicesError}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione um ou mais serviços" />
        </SelectTrigger>
        <SelectContent>
          {servicesList && servicesList.length > 0 ? (
            servicesList.map(service => (
              <SelectItem key={service.id} value={String(service.id)}>
                {service.nome}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="" disabled>
              {isLoadingServices ? 'Carregando...' : 'Nenhum serviço disponível'}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {(isLoadingServices || !!servicesError) && (
        <p className="text-sm text-gray-600 mt-1">
          {isLoadingServices ? (
            <>
              <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Carregando serviços...
            </>
          ) : (
            <span className="text-red-600">
              <TriangleAlert className="inline h-4 w-4 mr-1" /> Erro ao carregar serviços.
            </span>
          )}
        </p>
      )}
    </div>
  );
};

export default MensagensConfigPage;