import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ... (outros imports e código do componente)

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  // ... (outros estados e hooks)

  // Corrigido: Obter messageId dos parâmetros de busca da URL
  const [searchParams] = useSearchParams();
  const messageId = searchParams.get('id');

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

  // ... (restante do componente)
};

export default MensagensConfigPage;