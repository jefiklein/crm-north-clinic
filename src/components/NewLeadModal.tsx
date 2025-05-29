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
import { formatPhone } from '@/lib/utils';
import { Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client'; // For fetching first stage
import { showSuccess, showError } from '@/utils/toast'; // Import toast utilities

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
  funnelIdForQuery: number | undefined; // The actual funnel ID for DB queries
  onLeadAdded: () => void; // Callback to refresh leads list
}

const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  clinicId,
  funnelIdForQuery,
  onLeadAdded,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rawPhone, setRawPhone] = useState(''); // Store unformatted phone
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstStageId, setFirstStageId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && funnelIdForQuery) {
      // Fetch the first stage of the current funnel
      const fetchFirstStage = async () => {
        console.log(`[NewLeadModal] Fetching first stage for funnel ID: ${funnelIdForQuery}`);
        const { data: stages, error: stageError } = await supabase
          .from('north_clinic_crm_etapa')
          .select('id, ordem')
          .eq('id_funil', funnelIdForQuery)
          .order('ordem', { ascending: true })
          .limit(1);

        if (stageError) {
          console.error('[NewLeadModal] Error fetching first stage:', stageError);
          setError('Erro ao buscar a primeira etapa do funil.');
          setFirstStageId(null);
        } else if (stages && stages.length > 0) {
          console.log(`[NewLeadModal] First stage found: ID ${stages[0].id}`);
          setFirstStageId(stages[0].id);
        } else {
          console.warn(`[NewLeadModal] No stages found for funnel ID: ${funnelIdForQuery}`);
          setError('Nenhuma etapa encontrada para este funil. Não é possível adicionar lead.');
          setFirstStageId(null);
        }
      };
      fetchFirstStage();
    }
  }, [isOpen, funnelIdForQuery]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');
    setRawPhone(digits);
    setPhone(formatPhone(digits));
  };

  const validatePhone = (phoneNumber: string): boolean => {
    const digits = phoneNumber.replace(/\D/g, '');
    // Basic validation: check if it has 10 or 11 digits (common for Brazil)
    // Or 12 or 13 if it includes country code 55
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
    if (funnelIdForQuery === undefined || firstStageId === null) {
      setError("ID do funil ou etapa inicial não definidos. Não é possível salvar.");
      return;
    }

    setIsSaving(true);

    try {
      const leadData = {
        nome_lead: name.trim(),
        telefone: parseInt(rawPhone, 10), // Save raw digits as number
        id_clinica: clinicId,
        id_etapa: firstStageId, // Assign to the first stage of the current funnel
        origem: 'Manual', // Default origin
        lead_score: 5, // Default score, can be adjusted
        created_at: new Date().toISOString(),
        // remoteJid needs to be constructed carefully, e.g., 55 + DDD + Number + @s.whatsapp.net
        // For simplicity, we'll let the backend/trigger handle this if possible, or omit for now.
        // For now, let's ensure it's a valid phone number that can be used to form remoteJid
        remoteJid: `${rawPhone}@s.whatsapp.net` // Basic construction, might need refinement
      };

      console.log("[NewLeadModal] Saving new lead:", leadData);

      const { error: insertError } = await supabase
        .from('north_clinic_leads_API')
        .insert([leadData]);

      if (insertError) {
        console.error("[NewLeadModal] Error inserting lead:", insertError);
        setError(`Erro ao salvar lead: ${insertError.message}`);
        showError(`Erro ao salvar lead: ${insertError.message.substring(0,100)}`);
        throw insertError;
      }

      showSuccess("Lead adicionado com sucesso!");
      onLeadAdded(); // Trigger refresh
      handleClose();
    } catch (e: any) {
      // Error already set or toast shown by Supabase error
      console.error("[NewLeadModal] Save failed:", e);
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
    setFirstStageId(null); // Reset first stage ID
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
          {error && (
            <div className="col-span-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}
           {funnelIdForQuery !== undefined && firstStageId === null && !error && (
             <div className="col-span-4 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md flex items-center gap-2">
               <Loader2 className="h-4 w-4 animate-spin" />
               <p className="text-sm">Carregando configuração da etapa inicial...</p>
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
            disabled={isSaving || firstStageId === null}
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