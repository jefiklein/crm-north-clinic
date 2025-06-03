"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, TriangleAlert, User, Camera, XCircle, LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn, formatPhone } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  id_permissao: number;
}

interface FunnelStage {
  id: number;
  nome_etapa: string;
  ordem: number | null;
  id_funil: number;
}

interface FunnelDetails {
  id: number;
  nome_funil: string;
}

interface LeadDetails {
  id: number;
  nome_lead: string | null;
  telefone: number | null;
  remoteJid: string;
  id_etapa: number | null;
  origem: string | null;
  sourceUrl: string | null;
  avatar_url: string | null; // New field
}

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string | number | null;
  leadId: number | null; // Pass the lead's numeric ID
  onLeadUpdated: () => void;
}

const MEDIA_UPLOAD_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase";
const MEDIA_RETRIEVE_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo";
const UPDATE_LEAD_DETAILS_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/update-lead-details"; // YOU NEED TO CREATE THIS WEBHOOK IN N8N

const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function getInitials(name: string | null): string {
  if (!name) return '??';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return '??';
}

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen,
  onClose,
  clinicId,
  leadId,
  onLeadUpdated,
}) => {
  const queryClient = useQueryClient();
  const [editedData, setEditedData] = useState<Partial<LeadDetails>>({});
  const [rawPhone, setRawPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch lead details
  const { data: leadData, isLoading: isLoadingLead, error: fetchLeadError, refetch: refetchLead } = useQuery<LeadDetails | null>({
    queryKey: ['leadDetails', leadId, clinicId],
    queryFn: async () => {
      if (!leadId || !clinicId) return null;
      const { data, error } = await supabase
        .from('north_clinic_leads_API')
        .select('id, nome_lead, telefone, remoteJid, id_etapa, origem, sourceUrl, avatar_url')
        .eq('id', leadId)
        .eq('id_clinica', clinicId)
        .single();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data || null;
    },
    enabled: isOpen && !!leadId && !!clinicId,
    staleTime: 0, // Always refetch when opened
    refetchOnWindowFocus: false,
  });

  // Fetch all stages
  const { data: allStages, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
    queryKey: ['allStagesLeadDetailModal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('north_clinic_crm_etapa')
        .select('id, nome_etapa, ordem, id_funil')
        .order('ordem', { ascending: true });
      if (error) throw new Error(`Erro ao buscar etapas: ${error.message}`);
      return data || [];
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch all funnels
  const { data: allFunnels, isLoading: isLoadingFunnels, error: funnelsError } = useQuery<FunnelDetails[]>({
    queryKey: ['allFunnelsLeadDetailModal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('north_clinic_crm_funil')
        .select('id, nome_funil')
        .order('nome_funil', { ascending: true });
      if (error) throw new Error(`Erro ao buscar funis: ${error.message}`);
      return data || [];
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const stageMap = useMemo(() => {
    const map = new Map<number, FunnelStage>();
    allStages?.forEach(stage => map.set(stage.id, stage));
    return map;
  }, [allStages]);

  const funnelMap = useMemo(() => {
    const map = new Map<number, FunnelDetails>();
    allFunnels?.forEach(funnel => map.set(funnel.id, funnel));
    return map;
  }, [allFunnels]);

  // Mutation for saving lead details
  const saveLeadMutation = useMutation({
    mutationFn: async (payload: {
      leadId: number;
      clinicId: string | number;
      nome_lead: string;
      telefone: number;
      id_etapa: number | null;
      origem: string | null;
      sourceUrl: string | null;
      avatar_url: string | null;
    }) => {
      const response = await fetch(UPDATE_LEAD_DETAILS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}...`);
      }
      return response.json();
    },
    onSuccess: () => {
      showSuccess("Lead atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['leadDetails', leadId, clinicId] });
      queryClient.invalidateQueries({ queryKey: ['funnelLeads', clinicId] }); // Invalidate leads in funnels
      queryClient.invalidateQueries({ queryKey: ['allLeads'] }); // Invalidate all leads
      onLeadUpdated(); // Notify parent component
      onClose();
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar lead: ${err.message}`);
      setError(err.message);
    },
  });

  // Effect to populate form when leadData is fetched
  useEffect(() => {
    if (leadData) {
      setEditedData({
        nome_lead: leadData.nome_lead,
        telefone: leadData.telefone,
        id_etapa: leadData.id_etapa,
        origem: leadData.origem,
        sourceUrl: leadData.sourceUrl,
        avatar_url: leadData.avatar_url,
      });
      setRawPhone(leadData.telefone ? String(leadData.telefone) : '');
      // Clear avatar file and preview if existing avatar_url is present
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
    }
  }, [leadData]);

  // Effect to handle avatar file preview
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  // Effect to fetch signed URL for existing avatar
  useEffect(() => {
    const fetchExistingAvatar = async () => {
      if (leadData?.avatar_url && !avatarPreviewUrl && !avatarFile) {
        try {
          const response = await fetch(MEDIA_RETRIEVE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arquivo_key: leadData.avatar_url })
          });
          const responseData = await response.json();
          const signedUrl = responseData?.signedUrl || responseData?.signedURL || responseData?.url || responseData?.link;
          if (signedUrl) {
            setAvatarPreviewUrl(signedUrl);
          } else {
            console.warn("Could not get signed URL for existing avatar:", responseData);
            setAvatarPreviewUrl(null); // Clear if unable to get URL
          }
        } catch (e) {
          console.error("Error fetching existing avatar:", e);
          setAvatarPreviewUrl(null); // Clear on error
        }
      }
    };
    if (isOpen) { // Only fetch when modal is open
        fetchExistingAvatar();
    }
  }, [isOpen, leadData?.avatar_url, avatarPreviewUrl, avatarFile]);


  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    let digits = input.replace(/\D/g, '');
    if (digits.length > 13) {
      digits = digits.substring(0, 13);
    }
    setRawPhone(digits);
    setEditedData(prev => ({ ...prev, telefone: digits ? parseInt(digits, 10) : null }));
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setError(`A imagem excede o tamanho máximo de ${MAX_IMAGE_SIZE_MB}MB.`);
        setAvatarFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError("Formato de imagem não suportado. Use JPG, PNG, GIF ou WEBP.");
        setAvatarFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setAvatarFile(file);
      setError(null);
    } else {
      setAvatarFile(null);
      setAvatarPreviewUrl(editedData.avatar_url || null); // Revert to saved URL if no new file
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setEditedData(prev => ({ ...prev, avatar_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setError(null);
    if (!leadId || !clinicId) {
      setError("Dados do lead ou da clínica não disponíveis.");
      return;
    }
    if (!editedData.nome_lead?.trim()) {
      setError("O nome do lead é obrigatório.");
      return;
    }
    if (rawPhone && !/^\d{10,13}$/.test(rawPhone)) {
      setError("Número de telefone inválido. Deve ter entre 10 e 13 dígitos.");
      return;
    }

    let finalAvatarUrl = editedData.avatar_url;

    if (avatarFile) {
      try {
        const formData = new FormData();
        formData.append("data", avatarFile, avatarFile.name);
        formData.append("fileName", avatarFile.name);
        formData.append("clinicId", clinicId.toString());
        const uploadRes = await fetch(MEDIA_UPLOAD_WEBHOOK_URL, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          throw new Error(`Falha ao enviar imagem: ${errorText.substring(0, 100)}`);
        }
        const uploadData = await uploadRes.json();
        finalAvatarUrl = (Array.isArray(uploadData) && uploadData[0]?.Key) || uploadData.Key || uploadData.key || null;
        if (!finalAvatarUrl) {
          throw new Error("URL da imagem não retornada após o upload.");
        }
      } catch (e: any) {
        setError(e.message || "Erro ao fazer upload da imagem.");
        return;
      }
    }

    saveLeadMutation.mutate({
      leadId: leadId,
      clinicId: clinicId,
      nome_lead: editedData.nome_lead.trim(),
      telefone: rawPhone ? parseInt(rawPhone, 10) : null,
      id_etapa: editedData.id_etapa,
      origem: editedData.origem || null,
      sourceUrl: editedData.sourceUrl || null,
      avatar_url: finalAvatarUrl,
    });
  };

  const isLoading = isLoadingLead || isLoadingStages || isLoadingFunnels || saveLeadMutation.isLoading;
  const fetchError = fetchLeadError || stagesError || funnelsError;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Detalhes do Lead</DialogTitle>
          <DialogDescription>
            Visualize e edite as informações do lead.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <span className="text-lg text-gray-700">Carregando detalhes do lead...</span>
          </div>
        ) : fetchError ? (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
            <TriangleAlert className="h-5 w-5" />
            <p className="text-sm">Erro ao carregar lead: {fetchError.message}</p>
          </div>
        ) : !leadData ? (
          <div className="p-4 bg-orange-100 border border-orange-400 text-orange-700 rounded-md flex items-center gap-2">
            <TriangleAlert className="h-5 w-5" />
            <p className="text-sm">Lead não encontrado.</p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
                <TriangleAlert className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="flex flex-col items-center gap-4">
              <div className="relative w-24 h-24">
                <Avatar className="w-24 h-24">
                  {avatarPreviewUrl ? (
                    <img src={avatarPreviewUrl} alt="Avatar do Lead" className="object-cover w-full h-full rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-gray-300 text-gray-800 text-3xl font-semibold">
                      {getInitials(editedData.nome_lead)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-0 right-0 bg-white rounded-full border border-gray-300 shadow-md hover:bg-gray-100"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saveLeadMutation.isLoading}
                >
                  <Camera className="h-5 w-5 text-gray-600" />
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  disabled={saveLeadMutation.isLoading}
                />
                {(avatarPreviewUrl || editedData.avatar_url) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 bg-white rounded-full border border-gray-300 shadow-md hover:bg-red-100"
                    onClick={handleRemoveAvatar}
                    disabled={saveLeadMutation.isLoading}
                  >
                    <XCircle className="h-5 w-5 text-red-500" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nome_lead" className="text-right">Nome</Label>
              <Input
                id="nome_lead"
                value={editedData.nome_lead || ''}
                onChange={(e) => setEditedData(prev => ({ ...prev, nome_lead: e.target.value }))}
                className="col-span-3"
                disabled={saveLeadMutation.isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="telefone" className="text-right">Telefone</Label>
              <Input
                id="telefone"
                value={formatPhone(rawPhone)}
                onChange={handlePhoneChange}
                className="col-span-3"
                placeholder="(XX) XXXXX-XXXX"
                disabled={saveLeadMutation.isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="id_etapa" className="text-right">Etapa</Label>
              <Select
                value={editedData.id_etapa?.toString() || ''}
                onValueChange={(value) => setEditedData(prev => ({ ...prev, id_etapa: value ? parseInt(value, 10) : null }))}
                disabled={saveLeadMutation.isLoading || isLoadingStages || !!stagesError || (allStages?.length ?? 0) === 0}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {allStages?.map(stage => (
                    <SelectItem key={stage.id} value={String(stage.id)}>
                      {stage.nome_etapa} ({funnelMap.get(stage.id_funil)?.nome_funil || 'Funil Desconhecido'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="origem" className="text-right">Origem</Label>
              <Input
                id="origem"
                value={editedData.origem || ''}
                onChange={(e) => setEditedData(prev => ({ ...prev, origem: e.target.value }))}
                className="col-span-3"
                disabled={saveLeadMutation.isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sourceUrl" className="text-right">Link Anúncio</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="sourceUrl"
                  value={editedData.sourceUrl || ''}
                  onChange={(e) => setEditedData(prev => ({ ...prev, sourceUrl: e.target.value }))}
                  className="flex-grow"
                  disabled={saveLeadMutation.isLoading}
                />
                {editedData.sourceUrl && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={editedData.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <LinkIcon className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || saveLeadMutation.isLoading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || saveLeadMutation.isLoading || !leadData}
          >
            {saveLeadMutation.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailModal;