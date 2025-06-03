"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input }
from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Ensure AvatarImage is imported
import { Loader2, TriangleAlert, User, Camera, Trash2, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { formatPhone } from '@/lib/utils';
import LeadTagManager from '@/components/LeadTagManager'; // Import the new component

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

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

interface Tag {
  id: number;
  name: string;
}

interface LeadDetailPageProps {
  clinicData: ClinicData | null;
}

const MEDIA_UPLOAD_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase";
const MEDIA_RETRIEVE_WEBHOOK_URL = "https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo";
const UPDATE_LEAD_DETAILS_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/update-lead-details";

// NEW: Webhook URLs for tag management
const CREATE_TAG_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/86305271-8e6f-416a-9972-feb34aa63ee7"; // Updated
const LINK_LEAD_TAG_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/a663d7d8-1d28-4b27-8b92-f456e69a3ccc"; // Updated to new webhook
const UNLINK_LEAD_TAG_WEBHOOK_URL = "https://n8n-n8n.sbw0pc.easypanel.host/webhook/a663d7d8-1d28-4b27-8b92-f456e69a3ccc"; // Updated to new webhook


const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const LeadDetailPage: React.FC<LeadDetailPageProps> = ({ clinicData }) => {
  const { leadId: leadIdParam } = useParams<{ leadId: string }>();
  const leadId = leadIdParam ? parseInt(leadIdParam, 10) : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Partial<LeadDetail>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState<{ isLoading: boolean, error: string | null }>({ isLoading: false, error: null });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const clinicId = clinicData?.id;

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
    enabled: !!leadId && !!clinicId,
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
    enabled: true, // Always enabled
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
    enabled: true, // Always enabled
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // NEW: Fetch all available tags for the clinic
  const { data: allAvailableTags, isLoading: isLoadingAllTags, error: allTagsError, refetch: refetchAllTags } = useQuery<Tag[]>({
    queryKey: ['allAvailableTags', clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      // Set the RLS context for the clinic_code
      await supabase.rpc('set_clinic_code_from_clinic_id', { clinic_id_param: clinicId });
      const { data, error } = await supabase
        .from('north_clinic_tags')
        .select('id, name')
        .eq('id_clinica', clinicId) // Explicitly filter by clinicId
        .order('name', { ascending: true });
      if (error) throw new Error(`Erro ao buscar tags disponíveis: ${error.message}`);
      return data || [];
    },
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000, // Cache tags for 5 minutes
    refetchOnWindowFocus: false,
  });

  // NEW: Fetch tags currently linked to this lead
  const { data: currentLeadTags, isLoading: isLoadingLeadTags, error: leadTagsError, refetch: refetchLeadTags } = useQuery<Tag[]>({
    queryKey: ['currentLeadTags', leadId, clinicId],
    queryFn: async () => {
      console.log(`[LeadDetailPage] Fetching currentLeadTags for lead ${leadId} and clinic ${clinicId}`);
      if (!leadId || !clinicId) return [];
      // Set the RLS context for the clinic_code (still needed for other RLS policies)
      await supabase.rpc('set_clinic_code_from_clinic_id', { clinic_id_param: clinicId });
      const { data, error } = await supabase
        .from('north_clinic_lead_tags')
        .select('tag_id, north_clinic_tags(id, name, id_clinica)') // Include id_clinica in the join
        .eq('lead_id', leadId)
        .eq('north_clinic_tags.id_clinica', clinicId); // Explicitly filter the joined table by clinicId
      
      console.log(`[LeadDetailPage] Raw Supabase response for currentLeadTags:`, data, error);

      if (error) throw new Error(`Erro ao buscar tags do lead: ${error.message}`);
      // Flatten the nested data and ensure id_clinica matches (though the query should handle this now)
      const fetchedTags = data?.map(item => item.north_clinic_tags).filter((tag): tag is Tag => tag !== null && tag.id_clinica === clinicId) || [];
      console.log(`[LeadDetailPage] Processed currentLeadTags:`, fetchedTags);
      return fetchedTags;
    },
    enabled: !!leadId && !!clinicId,
    staleTime: 0, // Always refetch lead tags
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
      if (leadDetails.avatar_url) {
        fetchSignedUrlForPreview(leadDetails.avatar_url);
      } else {
        setAvatarPreviewUrl(null);
      }
    } else {
      setFormData({});
      setAvatarPreviewUrl(null);
    }
    setAvatarFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
    setIsSaving(false);
    setAvatarUploadStatus({ isLoading: false, error: null });
  }, [leadDetails]);

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
      setAvatarPreviewUrl(leadDetails?.avatar_url ? leadDetails.avatar_url : null);
      setAvatarUploadStatus({ isLoading: false, error: null });
    }
  };

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

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setFormData(prev => ({ ...prev, avatar_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
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

      const payload = {
        leadId: leadId,
        clinicId: clinicId,
        updates: {
          nome_lead: formData.nome_lead?.trim(),
          id_etapa: formData.id_etapa,
          avatar_url: finalAvatarUrl,
        },
      };

      console.log("[LeadDetailPage] Sending update payload to webhook:", payload);

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
      queryClient.invalidateQueries({ queryKey: ['leadDetails', leadId, clinicId] }); // Invalidate to refetch latest data
      queryClient.invalidateQueries({ queryKey: ['paginatedLeads'] }); // Invalidate all leads list
      // No longer navigating back to /dashboard/3 here, as we use navigate(-1)
    } catch (e: any) {
      console.error("[LeadDetailPage] Save failed:", e);
      setError(e.message || "Ocorreu um erro desconhecido ao salvar.");
      showError(e.message || "Erro desconhecido.");
      setAvatarUploadStatus(prev => ({ ...prev, isLoading: false, error: prev.error || e.message }));
    } finally {
      setIsSaving(false);
    }
  };

  // NEW: Mutations for tag management
  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const payload = { name: tagName, id_clinica: clinicId };
      const response = await fetch(CREATE_TAG_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar tag: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      const data = await response.json();
      if (!data?.id) throw new Error("ID da nova tag não retornado.");
      return { id: data.id, name: tagName } as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAvailableTags', clinicId] });
      showSuccess("Tag criada com sucesso!");
    },
    onError: (err: Error) => {
      showError(`Erro ao criar tag: ${err.message}`);
    }
  });

  const linkTagMutation = useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: number; tagId: number }) => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const payload = { lead_id: leadId, tag_id: tagId, id_clinica: clinicId };
      console.log(`[LeadDetailPage] Calling LINK_LEAD_TAG_WEBHOOK_URL with payload:`, payload);
      const response = await fetch(LINK_LEAD_TAG_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao vincular tag: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      return true;
    },
    onSuccess: (_, variables) => {
      showSuccess("Tag vinculada com sucesso!");
      console.log(`[LeadDetailPage] Invalidating currentLeadTags query for lead ${variables.leadId} and clinic ${clinicId}`);
      setTimeout(() => { // Add a small delay
        queryClient.invalidateQueries({ queryKey: ['currentLeadTags', variables.leadId, clinicId] });
      }, 500);
    },
    onError: (err: Error) => {
      showError(`Erro ao vincular tag: ${err.message}`);
    }
  });

  const unlinkTagMutation = useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: number; tagId: number }) => {
      if (!clinicId) throw new Error("ID da clínica não disponível.");
      const payload = { lead_id: leadId, tag_id: tagId, id_clinica: clinicId };
      console.log(`[LeadDetailPage] Calling UNLINK_LEAD_TAG_WEBHOOK_URL with payload:`, payload);
      const response = await fetch(UNLINK_LEAD_TAG_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao desvincular tag: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      return true;
    },
    onSuccess: (_, variables) => {
      showSuccess("Tag desvinculada com sucesso!");
      console.log(`[LeadDetailPage] Invalidating currentLeadTags query for lead ${variables.leadId} and clinic ${clinicId}`);
      setTimeout(() => { // Add a small delay
        queryClient.invalidateQueries({ queryKey: ['currentLeadTags', variables.leadId, clinicId] });
      }, 500);
    },
    onError: (err: Error) => {
      showError(`Erro ao desvincular tag: ${err.message}`);
    }
  });

  const handleBack = () => {
    navigate(-1); // Go back to the previous page in history
  };

  const isLoadingData = isLoadingLead || isLoadingStages || isLoadingFunnels || isLoadingAllTags || isLoadingLeadTags;
  const fetchError = fetchLeadError || stagesError || funnelsError || allTagsError || leadTagsError;

  const selectedStageFunnelName = useMemo(() => {
    if (formData.id_etapa === null || formData.id_etapa === undefined) return 'N/D';
    const stage = stageMap.get(formData.id_etapa);
    if (stage && stage.id_funil !== null) {
      const funnel = funnelMap.get(stage.id_funil);
      return funnel?.nome_funil || 'Funil Desconhecido';
    }
    return 'N/D';
  }, [formData.id_etapa, stageMap, funnelMap]);

  if (!leadId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <TriangleAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <CardTitle className="text-2xl font-bold text-destructive">Lead Não Encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">O ID do lead não foi fornecido ou é inválido.</p>
            <Button onClick={handleBack} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a Lista de Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="lead-detail-page-container max-w-3xl mx-auto p-6 bg-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Detalhes do Lead</h1>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a Lista
        </Button>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Informações do Lead</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.nome_lead || ''}
                    onChange={(e) => setFormData({ ...formData, nome_lead: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formatPhone(leadDetails.telefone)}
                    disabled // Phone is read-only
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="remoteJid">RemoteJid</Label>
                  <Input
                    id="remoteJid"
                    value={leadDetails.remoteJid}
                    disabled // RemoteJid is read-only
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="stage">Etapa</Label>
                  <Select
                    value={formData.id_etapa?.toString() || ''}
                    onValueChange={(value) => setFormData({ ...formData, id_etapa: parseInt(value, 10) })}
                    disabled={isSaving || (allStages?.length ?? 0) === 0}
                  >
                    <SelectTrigger>
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
                <div className="form-group">
                  <Label htmlFor="funnel">Funil</Label>
                  <Input
                    id="funnel"
                    value={selectedStageFunnelName}
                    disabled // Funnel is derived, read-only
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="origin">Origem</Label>
                  <Input
                    id="origin"
                    value={leadDetails.origem || 'N/D'}
                    disabled // Origin is read-only
                  />
                </div>
                {leadDetails.sourceUrl && (
                  <div className="form-group col-span-full">
                    <Label htmlFor="sourceUrl">Anúncio</Label>
                    <div className="flex items-center gap-2">
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

              {/* NEW: Lead Tag Manager */}
              {leadId && clinicId && (
                <LeadTagManager
                  clinicId={clinicId}
                  leadId={leadId}
                  availableTags={allAvailableTags || []}
                  currentLeadTags={currentLeadTags || []}
                  isLoadingTags={isLoadingAllTags || isLoadingLeadTags}
                  isSavingTags={linkTagMutation.isLoading || unlinkTagMutation.isLoading || createTagMutation.isLoading}
                  onTagAdd={(leadId, tagId) => linkTagMutation.mutate({ leadId, tagId })}
                  onTagRemove={(leadId, tagId) => unlinkTagMutation.mutate({ leadId, tagId })}
                  onNewTagCreate={createTagMutation.mutateAsync}
                />
              )}
            </div>
          )}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button variant="outline" onClick={handleBack} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadDetailPage;