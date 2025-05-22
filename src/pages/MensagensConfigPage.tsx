"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TriangleAlert } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError, showToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

// Define the component as a const arrow function
const MensagensConfigPage: React.FC<{ clinicData: any }> = ({ clinicData }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const messageId = searchParams.get('id');
  const isEditing = !!messageId;

  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Minimal state for example
  const [formData, setFormData] = useState({
    categoria: '',
    id_instancia: '',
    modelo_mensagem: '',
    ativo: true,
  });

  // Example: fetch message details if editing
  const { data: messageDetails, isLoading: isLoadingDetails, error: detailsError } = useQuery({
    queryKey: ['messageDetails', messageId],
    queryFn: async () => {
      if (!messageId) return null;
      const { data, error } = await supabase
        .from('north_clinic_config_mensagens')
        .select('*')
        .eq('id', parseInt(messageId, 10))
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (messageDetails) {
      setFormData({
        categoria: messageDetails.categoria || '',
        id_instancia: String(messageDetails.id_instancia || ''),
        modelo_mensagem: messageDetails.modelo_mensagem || '',
        ativo: messageDetails.ativo,
      });
    }
  }, [messageDetails]);

  useEffect(() => {
    setIsLoadingPage(isLoadingDetails);
    setPageError(detailsError ? (detailsError as any).message : null);
  }, [isLoadingDetails, detailsError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = () => {
    showToast("Salvar funcionalidade não implementada.", "info");
  };

  const handleCancel = () => {
    navigate('/dashboard/11');
  };

  return (
    <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
      <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="config-title text-2xl font-bold text-primary whitespace-nowrap">
          {isLoadingPage ? 'Carregando...' : `${isEditing ? 'Editar' : 'Configurar Nova'} Mensagem`}
        </h1>
      </div>

      {isLoadingPage && !pageError && (
        <div className="loading-indicator flex flex-col items-center justify-center p-8 text-primary">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <span className="text-lg">Carregando dados...</span>
        </div>
      )}

      {pageError && (
        <div className="error-message flex items-center gap-2 p-3 mb-4 bg-red-100 text-red-700 border border-red-200 rounded-md shadow-sm">
          <TriangleAlert className="h-5 w-5 flex-shrink-0" />
          <span>Erro ao carregar dados: {pageError}</span>
        </div>
      )}

      {!isLoadingPage && !pageError && (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="form-group">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select id="categoria" value={formData.categoria} onValueChange={(v) => setFormData(prev => ({ ...prev, categoria: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="-- Selecione --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Agendou">Agendou</SelectItem>
                <SelectItem value="Confirmar Agendamento">Confirmar Agendamento</SelectItem>
                <SelectItem value="Aniversário">Aniversário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="form-group">
            <Label htmlFor="modelo_mensagem">Texto da Mensagem *</Label>
            <Textarea
              id="modelo_mensagem"
              value={formData.modelo_mensagem}
              onChange={handleInputChange}
              rows={6}
            />
          </div>

          <div className="form-actions flex justify-end gap-4 mt-6">
            <Button type="button" variant="outline" onClick={handleCancel}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MensagensConfigPage;