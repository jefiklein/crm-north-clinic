import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Save, XCircle, Smile, Tags, FileText, Video, Music, Download, Zap } from 'lucide-react'; // Added icons
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils'; // Utility for class names
import { showSuccess, showError, showToast } from '@/utils/toast'; // Using our toast utility
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { MultiSelect } from '@/components/MultiSelect'; // Import new MultiSelect component

// Define the structure for Service Info
interface ServiceInfo {
    id: number;
    nome: string;
}

// Define the structure for Linked Service (from Supabase)
interface LinkedService {
    id_servico: number;
}

interface MensagensConfigPageProps {
    clinicData: {
        code: string;
        nome: string;
        id: string | number | null;
        acesso_crm: boolean;
        acesso_config_msg: boolean;
        id_permissao: number;
    } | null;
}

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const isEditing = !!messageId;
  const clinicId = clinicData?.id;

  // State for selected services as array of ServiceInfo
  const [selectedServices, setSelectedServices] = useState<ServiceInfo[]>([]);

  // Fetch Services List - NOW FROM SUPABASE
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

  // Fetch Linked Services (if editing) - NOW FROM SUPABASE
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
      enabled: isEditing && !!messageId,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
  });

  // When servicesList or linkedServicesList change, update selectedServices state
  useEffect(() => {
    if (servicesList) {
      if (isEditing && linkedServicesList) {
        // Map linked service IDs to service objects
        const linkedIds = new Set(linkedServicesList.map(ls => ls.id_servico));
        const selected = servicesList.filter(s => linkedIds.has(s.id));
        setSelectedServices(selected);
      } else {
        setSelectedServices([]);
      }
    }
  }, [servicesList, linkedServicesList, isEditing]);

  // ... rest of the component code (render, handlers, etc.) remains unchanged

  return (
    <div>
      {/* Temporary debug display */}
      <h2>Serviços Disponíveis ({servicesList?.length ?? 0}):</h2>
      <ul>
        {servicesList?.map(s => (
          <li key={s.id}>{s.id}: {s.nome}</li>
        ))}
      </ul>

      <h2>Serviços Vinculados ({linkedServicesList?.length ?? 0}):</h2>
      <ul>
        {linkedServicesList?.map((ls, idx) => (
          <li key={idx}>ID Serviço: {ls.id_servico}</li>
        ))}
      </ul>

      {/* Here you can add the MultiSelect or other UI as needed */}
    </div>
  );
};

export default MensagensConfigPage;