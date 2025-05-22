import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, TriangleAlert, Smile, Tags, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError, showToast } from '@/utils/toast';

// Define interfaces and constants as before (omitted here for brevity)...

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const initialCategoryFromUrl = searchParams.get('category');
  const isEditing = !!messageId;

  // Fetch message details from Supabase by messageId
  const { data: messageDetails, isLoading: isLoadingMessageDetails, error: messageDetailsError } = useQuery({
    queryKey: ['messageDetails', messageId],
    queryFn: async () => {
      if (!messageId) return null;
      const { data, error } = await supabase
        .from('north_clinic_config_mensagens')
        .select('*')
        .eq('id', parseInt(messageId, 10))
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // State for form data (without services)
  const [formData, setFormData] = useState({
    categoria: initialCategoryFromUrl || '',
    id_instancia: '',
    modelo_mensagem: '',
    ativo: true,
    hora_envio: '',
    grupo: '',
    para_funcionario: false,
    para_grupo: true,
    para_cliente: false,
    variacao_1: '',
    variacao_2: '',
    variacao_3: '',
    variacao_4: '',
    variacao_5: '',
    prioridade: 1,
  });

  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [existingMediaKey, setExistingMediaKey] = useState<string | null>(null);

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [aiLoadingSlot, setAiLoadingSlot] = useState<number | null>(null);
  const [mediaViewLoading, setMediaViewLoading] = useState(false);

  const messageTextRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<any>(null);

  // --- Effects ---

  // Effect to populate form data when message details load (Edit mode)
  useEffect(() => {
    if (isEditing && messageDetails) {
      setFormData({
        categoria: messageDetails.categoria || '',
        id_instancia: String(messageDetails.id_instancia || ''),
        modelo_mensagem: messageDetails.modelo_mensagem || '',
        ativo: messageDetails.ativo,
        hora_envio: messageDetails.hora_envio || '',
        grupo: messageDetails.grupo || '',
        para_funcionario: messageDetails.para_funcionario,
        para_grupo: messageDetails.para_grupo,
        para_cliente: messageDetails.para_cliente,
        variacao_1: messageDetails.variacao_1 || '',
        variacao_2: messageDetails.variacao_2 || '',
        variacao_3: messageDetails.variacao_3 || '',
        variacao_4: messageDetails.variacao_4 || '',
        variacao_5: messageDetails.variacao_5 || '',
        prioridade: messageDetails.prioridade ?? 1,
      });
      setExistingMediaKey(messageDetails.midia_mensagem || null);
    } else if (!isEditing && initialCategoryFromUrl) {
      setFormData(prev => ({
        ...prev,
        categoria: initialCategoryFromUrl,
        modelo_mensagem: defaultTemplates[initialCategoryFromUrl] || '',
        prioridade: 1,
      }));
    }
  }, [messageDetails, isEditing, initialCategoryFromUrl]);

  // --- Handlers and rest of component unchanged ---

  return (
    <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
      {/* Header, loading, error, and form sections as before, but without service selection group */}

      {/* Debug section for services (keep as is) */}
      <div className="debug-section bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 shadow-sm">
        <h3 className="text-lg font-semibold text-yellow-800 border-b border-yellow-200 pb-2 mb-3">Debug: Serviços</h3>
        {/* You can add debug info here manually as you want */}
      </div>

      {/* Rest of the form without service selection */}
    </div>
  );
};

export default MensagensConfigPage;