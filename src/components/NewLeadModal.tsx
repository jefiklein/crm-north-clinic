"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhone } from '@/lib/utils';
import { Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client'; 
import { showSuccess, showError } from '@/utils/toast'; 

interface FunnelStage {
  id: number;
  nome_etapa: string;
  ordem: number | null;
  id_funil: number;
}

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string | number | null;
  funnelIdForQuery: number | undefined; 
  onLeadAdded: () => void; 
}

const NEW_LEAD_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/d5c35a3e-7919-4ef9-b284-cdf70a7650fb'; 

const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  clinicId,
  funnelIdForQuery,
  onLeadAdded,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rawPhone, setRawPhone] = useState(''); 
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]); 
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null); 

  useEffect(() => {
    if (isOpen && funnelIdForQuery) {
      const fetchFunnelStages = async () => { 
        console.log(`[NewLeadModal] Fetching stages for funnel ID: ${funnelIdForQuery}`);
        const { data: stages, error: stageError } = await supabase
          .from('north_clinic_crm_etapa')
          .select('id, nome_etapa, ordem, id_funil')
          .eq('id_funil', funnelIdForQuery)
          .order('ordem', { ascending: true });

        if (stageError) {
          console.error('[NewLeadModal] Error fetching funnel stages:', stageError);
          setError('Erro ao buscar as etapas do funil.');
        } else if (stages && stages.length > 0) {
          console.log(`[NewLeadModal] Stages found:`, stages);
          setFunnelStages(stages);
          setSelectedStageId(String(stages[0].id)); 
        } else {
          console.warn(`[NewLeadModal] No stages found for funnel ID: ${funnelIdForQuery}`);
          setError('Nenhuma etapa encontrada para este funil. Não é possível adicionar lead.');
        }
      };
      fetchFunnelStages();
    }
  }, [isOpen, funnelIdForQuery]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    let digits = input.replace(/\D/g, '');
    if (digits.length > 13) {
      digits = digits.substring(0, 13);
    }
    setRawPhone(digits);
    setPhone(formatPhone(digits));
  };

  const validatePhone = (phoneNumber: string): boolean => {
    const digits = phoneNumber.replace(/\D/g, '');
    return (digits.length >= 10 && digits.length <= 13);
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError("O nome do lead é obrigatório.");
      return;
    }
    if (!validatePhone(rawPhone)) {
      setError("Número de telefone inválido. Use o formato (XX) XXXXX-XXXX ou similar.");
      return;
    }
    if (!clinicId) {
      setError("ID da clínica não disponível. Não é possível salvar.");
      return;
    }
    if (!selectedStageId) {
      setError("Etapa inicial não selecionada. Não é possível salvar.");
      return;
    }

    setIsSaving(true);

    try {
      const leadData = {
        nome_lead: name.trim(),
        telefone: parseInt(rawPhone, 10), 
        id_clinica: clinicId,
        id_etapa: parseInt(selectedStageId, 10), 
        origem: 'Manual', 
        lead_score: 5, 
        created_at: new Date().toISOString(),
        remoteJid: `${rawPhone}@s.whatsapp.net` 
      };

      console.log("[NewLeadModal] Sending new lead data to webhook:", leadData);

      const response = await fetch(NEW_LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[NewLeadModal] Webhook error response:", errorText);
        setError(`Erro ao salvar lead via webhook: ${response.status} ${errorText.substring(0, 100)}`);
        showError(`Erro no webhook: ${response.status} ${errorText.substring(0,100)}`);
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      const responseData = await response.json();
      console.log("[NewLeadModal] Webhook success response:", responseData);

      showSuccess("Lead adicionado com sucesso!");
      onLeadAdded(); 
      handleClose();
    } catch (e: any) {
      console.error("[NewLeadModal] Save failed:", e);
      if (!error) { 
        setError(e.message || "Ocorreu um erro desconhecido ao salvar.");
        showError(e.message || "Erro desconhecido.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setPhone('');
    setRawPhone('');
    setError(null);
    setIsSaving(false);
    setFunnelStages([]); 
    setSelectedStageId(null); 
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Lead</DialogTitle>
          <DialogDescription>
            Preencha as informações abaixo para criar um novo lead no funil.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nome
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Nome completo do lead"
              disabled={isSaving}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Telefone
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={handlePhoneChange}
              className="col-span-3"
              placeholder="(XX) XXXXX-XXXX"
              disabled={isSaving}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stage" className="text-right">
              Etapa
            </Label>
            <Select
              value={selectedStageId || ''}
              onValueChange={(value) => setSelectedStageId(value)}
              disabled={isSaving || funnelStages.length === 0}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecione a etapa inicial" />
              </SelectTrigger>
              <SelectContent>
                {funnelStages.map((stage) => (
                  <SelectItem key={stage.id} value={String(stage.id)}>
                    {stage.nome_etapa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div className="col-span-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {funnelIdForQuery !== undefined && funnelStages.length === 0 && !error && (
            <div className="col-span-4 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm">Carregando etapas do funil...</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !selectedStageId}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Lead"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewLeadModal;