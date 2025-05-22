import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TriangleAlert } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

interface MensagensConfigPageProps {
  clinicData: {
    id: number | string | null;
    code?: string;
    nome?: string;
    acesso_crm?: boolean;
    acesso_config_msg?: boolean;
    id_permissao?: number;
  } | null;
}

interface Service {
  id: number;
  nome: string;
}

// Componente simples para exibir lista de serviços com debug da quantidade
const SimpleServicesList: React.FC<{ services: Service[] }> = ({ services }) => {
  if (!services) return <p className="text-gray-500">Serviços não carregados.</p>;
  if (services.length === 0) return <p className="text-gray-500">Nenhum serviço disponível.</p>;
  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">Total de serviços carregados: {services.length}</p>
      <ul className="list-disc list-inside max-h-48 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
        {services.map(service => (
          <li key={service.id} className="text-gray-700">
            {service.nome}
          </li>
        ))}
      </ul>
    </div>
  );
};

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const messageId = searchParams.get('id');
  const initialCategoryFromUrl = searchParams.get('category');
  const isEditing = !!messageId;

  // Estado e fetch para lista de serviços vinculados (mantendo fetch para exibir)
  const { data: linkedServicesList, isLoading: isLoadingLinkedServices, error: linkedServicesError } = useQuery<Service[]>({
    queryKey: ['linkedServicesConfigPage', messageId],
    queryFn: async () => {
      console.log("[MensagensConfigPage] Fetching linked services for messageId:", messageId);
      if (!messageId) return [];
      const { data, error } = await supabase
        .from('north_clinic_mensagens_servicos')
        .select('id_servico, nome_servico:north_clinic_servicos(nome)')
        .eq('id_mensagem', parseInt(messageId, 10));
      if (error) {
        console.error("[MensagensConfigPage] Error fetching linked services:", error);
        throw new Error(error.message);
      }
      console.log("[MensagensConfigPage] Linked services raw data:", data);
      // Map para formato Service[]
      const mapped = data?.map(item => ({
        id: item.id_servico,
        nome: item.nome_servico?.nome || `Serviço ${item.id_servico}`
      })) || [];
      console.log("[MensagensConfigPage] Linked services mapped:", mapped);
      return mapped;
    },
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // --- Mantém o restante do componente intacto ---

  // Exemplo simplificado do render, focando na seção de serviços vinculados

  return (
    <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
      {/* ... outras partes da tela ... */}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Disparador e Condições</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="linkedServices">Serviços Vinculados *</Label>
            <p className="text-sm text-gray-500 mb-2">Quais agendamentos de serviço ativarão esta mensagem.</p>
            {isLoadingLinkedServices ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Carregando serviços vinculados...</span>
              </div>
            ) : linkedServicesError ? (
              <p className="text-red-600">Erro ao carregar serviços: {linkedServicesError.message}</p>
            ) : (
              <SimpleServicesList services={linkedServicesList || []} />
            )}
          </div>

          {/* ... outras partes da tela ... */}
        </CardContent>
      </Card>

      {/* ... restante da tela ... */}
    </div>
  );
};

export default MensagensConfigPage;