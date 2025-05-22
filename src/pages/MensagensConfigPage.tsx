import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TriangleAlert } from 'lucide-react';

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

  // Fetch services list (mocked here for example)
  const servicesList: ServiceInfo[] = []; // Replace with actual fetch or props
  const isLoadingServices = false;
  const servicesError = null;

  const handleServicesChange = (values: string[]) => {
    setSelectedServices(values);
  };

  return (
    <div className="form-group" id="serviceSelectionGroup">
      <label htmlFor="serviceSelect" className="block mb-1 font-medium text-gray-700">Serviços Vinculados *</label>
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
            // No SelectItem with empty string value here to avoid error
            // Instead, render a disabled item with a non-empty value or nothing
            <SelectItem value="no-services" disabled>
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