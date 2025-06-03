"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, TriangleAlert, User, Camera, Trash2, Link as LinkIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { formatPhone } from '@/lib/utils';

interface LeadDetail {
  id: number;
  nome_lead: string | null;
  telefone: number | null;
  remoteJid: string;
  id_etapa: number | null;
  origem: string | null;
  sourceUrl: string | null;
  lead_score: number | null;
  created_at: string;
  avatar_url: string | null; // New field
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

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: number | null;
  clinicId: string | number | null;
  onLeadUpdated: () => void; // Callback to refresh parent list
}

const MEDIA_UPLOAD_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase";
const MEDIA_RETRIEVE_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo";
// NEW WEBHOOK: You will need to configure this in n8n to update north_clinic_leads_API table
const UPDATE_LEAD_DETAILS_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/update-lead-details"; // Placeholder

const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen,
  onClose,
  leadId,
  clinicId,
  onLeadUpdated,
}) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<LeadDetail>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState<{ isLoading: boolean, error: string | null }>({ isLoading: false, error: null });

  // Refs for file input to clear it
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch lead details
  const { data: leadDetails, isLoading: isLoadingLead, error: fetchLeadError } = useQuery<LeadDetail | null>({
    queryKey: ['leadDetails', leadId, clinicId],
    queryFn: async () => {
      if (!leadId || !clinicId) return null;
      const { data, error } = await supabase
        .from('north_clinic_leads_API')
        .select('id, nome_lead, telefone, remoteJid, id_etapa, origem, sourceUrl, lead_score, created_at, avatar_url')
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

  // Fetch all stages and funnels for dropdowns
  const { data: allStages, isLoading: isLoadingStages, error: stagesError } = useQuery<FunnelStage[]>({
    queryKey: ['allStagesLeadDetailModal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('north_clinic_crm_etapa')
        .select('id, nome_etapa, ordem, id_funil')
        .order('nome_etapa', { ascending: true });
      if (error) throw new Error(`Erro ao buscar etapas: ${error.message}`);
      return data || [];
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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

  // Map stages and funnels for quick lookup
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

  // Populate form data when lead details are fetched
  useEffect(() => {
    if (leadDetails) {
      setFormData({
        nome_lead: leadDetails.nome_lead,
        id_etapa: leadDetails.id_etapa,
        avatar_url: leadDetails.avatar_url,
      });
      // If there's a saved avatar URL, try to fetch a signed URL for preview
      if (leadDetails.avatar_url) {
        fetchSignedUrlForPreview(leadDetails.avatar_url);
      } else {
        setAvatarPreviewUrl(null);
      }
    } else {
      setFormData({});
      setAvatarPreviewUrl(null);
    }
    setAvatarFile(null); // Clear selected file on new lead load
    if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
    setError(null);
    setIsSaving(false);
    setAvatarUploadStatus({ isLoading: false, error: null });
  }, [leadDetails]);

  // Handle avatar file selection
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setError(`A imagem excede o tamanho máximo de ${MAX_IMAGE_SIZE_MB}MB.`);
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError("Formato de imagem não suportado. Use JPG, PNG, GIF ou WEBP.");
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setAvatarFile(file);
      setAvatarPreviewUrl(URL.createObjectURL(file));
      setAvatarUploadStatus({ isLoading: false, error: null });
      setError(null);
    } else {
      setAvatarFile(null);
      // If no new file, revert to saved URL if it exists
      setAvatarPreviewUrl(leadDetails?.avatar_url ? leadDetails.avatar_url : null);
      setAvatarUploadStatus({ isLoading: false, error: null });
    }
  };

  // Fetch signed URL for existing avatar
  const fetchSignedUrlForPreview = async (fileKey: string) => {
    if (!fileKey) {
      setAvatarPreviewUrl(null);
      setAvatarUploadStatus({ isLoading: false, error: null });
      return;
    }
    setAvatarUploadStatus({ isLoading: true, error: null });
    try {
      const response = await fetch(MEDIA_RETRIEVE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivo_key: fileKey }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao obter URL: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      const responseData = await response.json();
      const signedUrl = responseData?.signedUrl || responseData?.signedURL || responseData?.url || responseData?.link;
      if (signedUrl) {
        setAvatarPreviewUrl(signedUrl);
        setAvatarUploadStatus({ isLoading: false, error: null });
      } else {
        throw new Error('URL assinada não encontrada na resposta.');
      }
    } catch (e: any) {
      console.error("Error fetching signed URL:", e);
      setAvatarPreviewUrl(null);
      setAvatarUploadStatus({ isLoading: false, error: e.message || 'Erro ao carregar preview.' });
    }
  };

  // Handle removing the avatar
  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setFormData(prev => ({ ...prev, avatar_url: null })); // Mark for deletion in DB
    if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!leadId || !clinicId) {
      setError("ID do lead ou da clínica não disponível.");
      return;
    }
    if (!formData.nome_lead?.trim()) {
      setError("O nome do lead é obrigatório.");
      return;
    }
    if (formData.id_etapa === null || formData.id_etapa === undefined) {
      setError("A etapa do lead é obrigatória.");
      return;
    }

    setIsSaving(true);
    setAvatarUploadStatus({ isLoading: false, error: null });

    let finalAvatarUrl = formData.avatar_url;

    try {
      if (avatarFile) {
        setAvatarUploadStatus({ isLoading: true, error: null });
        const formDataUpload = new FormData();
        formDataUpload.append("data", avatarFile, avatarFile.name);
        formDataUpload.append("fileName", avatarFile.name);
        formDataUpload.append("clinicId", clinicId.toString());

        const uploadRes = await fetch(MEDIA_UPLOAD_WEBHOOK_URL, {
          method: "POST",
          body: formDataUpload,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          throw new Error(`Falha ao enviar imagem: ${uploadRes.status} - ${errorText.substring(0, 100)}`);
        }
        const uploadData = await uploadRes.json();
        finalAvatarUrl = (Array.isArray(uploadData) && uploadData[0]?.Key) || uploadData.Key || uploadData.key || null;
        if (!finalAvatarUrl) {
          throw new Error("Chave da imagem não retornada após o upload.");
        }
        setAvatarUploadStatus({ isLoading: false, error: null });
      }

      // Prepare payload for the new update webhook
      const payload = {
        leadId: leadId,
        clinicId: clinicId,
        updates: {
          nome_lead: formData.nome_lead?.trim(),
          id_etapa: formData.id_etapa,
          avatar_url: finalAvatarUrl, // This will be null if removed, or the new key
        },
      };

      console.log("[LeadDetailModal] Sending update payload to webhook:", payload);

      const response = await fetch(UPDATE_LEAD_DETAILS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao salvar lead: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      showSuccess("Lead atualizado com sucesso!");
      onLeadUpdated(); // Trigger refetch in parent
      onClose(); // Close modal
    } catch (e: any) {
      console.error("[LeadDetailModal] Save failed:", e);
      setError(e.message || "Ocorreu um erro desconhecido ao salvar.");
      showError(e.message || "Erro desconhecido.");
      setAvatarUploadStatus(prev => ({ ...prev, isLoading: false, error: prev.error || e.message }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setAvatarUploadStatus({ isLoading: false, error: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const isLoadingData = isLoadingLead || isLoadingStages || isLoadingFunnels;
  const fetchError = fetchLeadError || stagesError || funnelsError;

  // Get Funnel Name for the selected stage
  const selectedStageFunnelName = useMemo(() => {
    if (formData.id_etapa === null || formData.id_etapa === undefined) return 'N/D';
    const stage = stageMap.get(formData.id_etapa);
    if (stage && stage.id_funil !== null) {
      const funnel = funnelMap.get(stage.id_funil);
      return funnel?.nome_funil || 'Funil Desconhecido';
    }
    return 'N/D';
  }, [formData.id_etapa, stageMap, funnelMap]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Lead</DialogTitle>
        </DialogHeader>
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <span className="text-lg text-primary">Carregando detalhes do lead...</span>
          </div>
        ) : fetchError ? (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
            <TriangleAlert className="h-5 w-5" />
            <p className="text-sm">Erro ao carregar lead: {fetchError.message}</p>
          </div>
        ) : !leadDetails ? (
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

            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-3 mb-4">
              <Avatar className="h-24 w-24 border-2 border-primary">
                {avatarPreviewUrl ? (
                  <AvatarImage src={avatarPreviewUrl} alt="Avatar do Lead" className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-4xl font-bold">
                    {leadDetails.nome_lead ? leadDetails.nome_lead[0].toUpperCase() : <User className="h-12 w-12" />}
                  </AvatarFallback>
                )}
              </Avatar>
              {avatarUploadStatus.isLoading && (
                <div className="flex items-center text-primary text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando imagem...
                </div>
              )}
              {avatarUploadStatus.error && (
                <div className="text-red-600 text-sm flex items-center gap-1">
                  <TriangleAlert className="h-4 w-4" /> {avatarUploadStatus.error}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                  <Camera className="h-4 w-4 mr-2" /> Alterar Foto
                </Button>
                {(avatarPreviewUrl || leadDetails.avatar_url) && (
                  <Button variant="destructive" size="sm" onClick={handleRemoveAvatar} disabled={isSaving}>
                    <Trash2 className="h-4 w-4 mr-2" /> Remover Foto
                  </Button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                />
              </div>
            </div>

            {/* Lead Details Form */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Nome</Label>
              <Input
                id="name"
                value={formData.nome_lead || ''}
                onChange={(e) => setFormData({ ...formData, nome_lead: e.target.value })}
                className="col-span-3"
                disabled={isSaving}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Telefone</Label>
              <Input
                id="phone"
                value={formatPhone(leadDetails.telefone)}
                className="col-span-3"
                disabled // Phone is read-only
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="remoteJid" className="text-right">RemoteJid</Label>
              <Input
                id="remoteJid"
                value={leadDetails.remoteJid}
                className="col-span-3"
                disabled // RemoteJid is read-only
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="stage" className="text-right">Etapa</Label>
              <Select
                value={formData.id_etapa?.toString() || ''}
                onValueChange={(value) => setFormData({ ...formData, id_etapa: parseInt(value, 10) })}
                disabled={isSaving || (allStages?.length ?? 0) === 0}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {allStages?.map((stage) => (
                    <SelectItem key={stage.id} value={String(stage.id)}>
                      {stage.nome_etapa} (Funil: {funnelMap.get(stage.id_funil)?.nome_funil || 'Desconhecido'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="funnel" className="text-right">Funil</Label>
              <Input
                id="funnel"
                value={selectedStageFunnelName}
                className="col-span-3"
                disabled // Funnel is derived, read-only
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="origin" className="text-right">Origem</Label>
              <Input
                id="origin"
                value={leadDetails.origem || 'N/D'}
                className="col-span-3"
                disabled // Origin is read-only
              />
            </div>
            {leadDetails.sourceUrl && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sourceUrl" className="text-right">Anúncio</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="sourceUrl"
                    value={leadDetails.sourceUrl}
                    className="flex-grow"
                    disabled // Source URL is read-only
                  />
                  <Button variant="outline" size="icon" asChild>
                    <a href={leadDetails.sourceUrl} target="_blank" rel="noopener noreferrer" title="Abrir link">
                      <LinkIcon className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoadingData || !leadDetails || avatarUploadStatus.isLoading}
          >
            {isSaving || avatarUploadStatus.isLoading ? (
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