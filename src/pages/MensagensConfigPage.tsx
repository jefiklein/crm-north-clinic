import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ... (outros imports e código do componente)

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  // ... (outros estados e hooks)

  const messageId = /* obter id da mensagem do URL ou props */;

  // Fetch Linked Services (if editing)
  const { data: linkedServicesList, isLoading: isLoadingLinkedServices, error: linkedServicesError } = useQuery<LinkedService[]>({
    queryKey: ['linkedServicesConfigPage', messageId],
    queryFn: async () => {
      if (!messageId) return [];
      const { data, error } = await supabase
        .from('north_clinic_mensagens_servicos')
        .select('id_servico')
        .eq('id_mensagem', parseInt(messageId, 10));
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // NEW EFFECT: Populate selectedServiceIds state when linkedServicesList loads (Edit mode)
  useEffect(() => {
    if (isEditing && linkedServicesList !== undefined) {
      const ids = linkedServicesList?.map(item => item.id_servico) || [];

      // Only update state if different from current selectedServiceIds to avoid infinite loop
      const areArraysEqual = (a: number[], b: number[]) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      };

      setSelectedServiceIds(prevIds => {
        if (areArraysEqual(prevIds, ids)) {
          return prevIds; // No change, avoid state update
        }
        return ids;
      });
    } else if (!isEditing) {
      setSelectedServiceIds([]);
    }
  }, [linkedServicesList, isEditing]);

  // ... (restante do componente)
};

export default MensagensConfigPage;