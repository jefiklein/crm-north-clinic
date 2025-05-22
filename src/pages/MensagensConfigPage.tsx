"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"; // Import Command components
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Save, XCircle, Smile, Tags, FileText, Video, Music, Download, ChevronDown } from 'lucide-react'; // Added ChevronDown
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils'; // Utility for class names
import { showSuccess, showError, showToast } from '@/utils/toast'; // Using our toast utility
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client

// Ensure the emoji picker element is defined
import 'emoji-picker-element';

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a message item fetched for editing
interface MessageDetails {
    id: number;
    categoria: string;
    modelo_mensagem: string | null;
    midia_mensagem: string | null; // This is the file key/path
    id_instancia: number | null;
    grupo: string | null; // Group ID
    ativo: boolean;
    hora_envio: string | null; // HH:mm format
    intervalo: number | null;
    id_clinica: number;
    variacao_1: string | null;
    variacao_2: string | null;
    variacao_3: string | null;
    variacao_4: string | null;
    variacao_5: string | null;
    para_funcionario: boolean;
    para_grupo: boolean;
    para_cliente: boolean;
    url_arquivo: string | null; // Redundant? Assuming midia_mensagem is the key
    prioridade: number;
    created_at: string;
    updated_at: string;
}

// Define the structure for Instance Info
interface InstanceInfo {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null; // Technical name for Evolution API
}

// Define the structure for Service Info
interface ServiceInfo {
    id: number;
    nome: string;
}

// Define the structure for Group Info
interface GroupInfo {
    id_grupo: string; // Assuming group ID is string
    nome_grupo: string;
}

// Define the structure for Linked Service (from Supabase)
interface LinkedService {
    id_servico: number;
}

// Define the structure for AI Variation response
interface AiVariationResponse {
    output: string;
}


interface MensagensConfigPageProps {
    clinicData: ClinicData | null;
}

// Webhook URLs
const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const GET_GROUPS_URL = `${N8N_BASE_URL}/webhook/29203acf-7751-4b18-8d69-d4bdb380810e`;
const SAVE_MESSAGE_URL_CREATE = `${N8N_BASE_URL}/webhook/542ce8db-6b1d-40f5-b58b-23c91654c424d`; // Corrected webhook URL
const SAVE_MESSAGE_URL_UPDATE = `${N8N_BASE_URL}/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4`;
const GET_MESSAGE_DETAILS_URL = `${N8N_BASE_URL}/webhook/4dd9fe07-8863-4993-b21f-7e74199d6d19`;
const GENERATE_PREVIEW_URL = `${N8N_BASE_URL}/webhook/ajustar-mensagem-modelo`;
const AI_VARIATION_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/225ecff5-6081-466f-a0d7-9cfe3ea2ce84`;
const UPLOAD_SUPABASE_URL = 'https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase';
const GET_SIGNED_URL_WEBHOOK = 'https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo';

// Constants for categories and data
const orderedCategories = [ 'Agendou', 'Confirmar Agendamento', 'Responder Confirmar Agendamento', 'Faltou', 'Finalizou Atendimento', 'Aniversário', 'Chegou', 'Liberado' ];
const categoryInfo: { [key: string]: { icon: string; description: string } } = {
    'Agendou':{icon:'fa-calendar-plus',description:'Mensagem enviada após a criação de um novo agendamento.'},
    'Confirmar Agendamento':{icon:'fa-calendar-check',description:'Enviada X horas/dias antes para solicitar confirmação.'},
    'Responder Confirmar Agendamento':{icon:'fa-reply',description:'Enviada após o cliente confirmar presença (status "Confirmado").'},
    'Faltou':{icon:'fa-calendar-minus', description:'Enviada quando o status do agendamento muda para "Não Compareceu".'},
    'Finalizou Atendimento':{icon:'fa-check-circle', description:'Enviada após a conclusão/registro do atendimento.'},
    'Aniversário':{icon:'fa-birthday-cake',description:'Enviada automaticamente no dia do aniversário do cliente.'},
    'Chegou':{icon:'fa-map-marker-alt',description:'Enviada quando o status do agendamento muda para "Cliente Chegou".'},
    'Liberado':{icon:'fa-door-open',description:'Enviada após a finalização da sessão ou consulta (status "Finalizado").'}
};
const placeholderData = {
    primeiro_nome_cliente: "Maria",
    nome_completo_cliente: "Maria Souza",
    primeiro_nome_funcionario: "Silva",
    nome_completo_funcionario: "Dr(a). João Silva",
    nome_servico_principal: "Consulta Inicial",
    lista_servicos: "Consulta Inicial, Exame Simples",
    data_agendamento: "19/04/2025",
    dia_agendamento_num: "19",
    dia_semana_relativo_extenso: "sábado",
    mes_agendamento_num: "04",
    mes_agendamento_extenso: "Abril",
    hora_agendamento: "15:30"
};
const defaultTemplates: { [key: string]: string } = {
    'Agendou': "Olá {primeiro_nome_cliente}!\n\nSeu agendamento de *{lista_servicos}* foi realizado para o dia *{dia_agendamento_num} de {mes_agendamento_extenso} ({dia_semana_relativo_extenso}) às {hora_agendamento}h* com {nome_completo_funcionario}.\n\nNossa equipe estará lhe esperando.\nSe precisar reagendar ou tiver alguma dúvida, é só nos chamar por aqui.",
    'Confirmar Agendamento': "Olá {primeiro_nome_cliente}, passando para lembrar do seu agendamento de *{nome_servico_principal}* {dia_semana_relativo_extenso} ({data_agendamento}) às *{hora_agendamento}h*. Confirma sua presença? (Responda SIM ou NAO)",
    'Responder Confirmar Agendamento': "Obrigado por confirmar, {primeiro_nome_cliente}! Seu horário das *{hora_agendamento}h* para *{nome_servico_principal}* está garantido.",
    'Faltou': "Olá {primeiro_nome_cliente}, notamos que você não pôde comparecer ao seu agendamento de *{nome_servico_principal}* hoje. Gostaríamos de remarcar, qual o melhor horário para você?",
    'Finalizou Atendimento': "Olá {primeiro_nome_cliente}, seu atendimento de *{nome_servico_principal}* com {nome_completo_funcionario} foi finalizado. Esperamos que tenha sido ótimo! Se precisar de algo mais, estamos à disposição.",
    'Aniversário': "Feliz aniversário, {primeiro_nome_cliente}! 🎉 Desejamos a você um dia maravilhoso cheio de alegria e saúde! Equipe North Clinic.",
    'Chegou': "Olá {primeiro_nome_cliente}, que bom que você chegou! Por favor, aguarde um momento, em breve {primeiro_nome_funcionario} irá te chamar.",
    'Liberado': "{primeiro_nome_cliente}, sua sessão de *{nome_servico_principal}* foi concluída. Se tiver uma próxima etapa, informaremos em breve. Obrigado!"
};

// Helper function to simulate message rendering with placeholders
function simulateMessage(template: string | null, placeholders: { [key: string]: string }): string {
    if (typeof template !== 'string' || !template) return '<i class="text-gray-500">(Modelo inválido ou vazio)</i>';
    let text = template;
    for (const key in placeholders) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        text = text.replace(regex, `<strong>${placeholders[key]}</strong>`);
    }
    // Highlight any remaining unreplaced tokens
    text = text.replace(/\{([\w_]+)\}/g, '<span class="unreplaced-token text-gray-600 bg-gray-200 px-1 rounded font-mono text-xs">{$1}</span>');
    // Basic markdown-like formatting for bold and italic
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    // Replace newline characters with <br> tags
    text = text.replace(/\\n|\n/g, '<br>');
    return text;
}

// Helper to normalize text for technical names
function normalizeText(text: string | null): string {
    if(!text) return '';
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}


const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
    console.log("[MensagensConfigPage] Component rendering...");
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const messageId = searchParams.get('id');
    const initialCategoryFromUrl = searchParams.get('category'); // Get category from URL for new messages
    const isEditing = !!messageId;

    const clinicCode = clinicData?.code;
    const clinicId = clinicData?.id; // Use clinicId for Supabase queries

    // State for form data
    const [formData, setFormData] = useState({
        categoria: initialCategoryFromUrl || '',
        id_instancia: '',
        modelo_mensagem: '',
        ativo: true,
        hora_envio: '',
        grupo: '',
        para_funcionario: false,
        para_grupo: true, // Default to group
        para_cliente: false,
        variacao_1: '',
        variacao_2: '',
        variacao_3: '',
        variacao_4: '',
        variacao_5: '',
        prioridade: 1, // Added priority field, default to 1
        // Media is handled separately
    });
    const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
    const [existingMediaKey, setExistingMediaKey] = useState<string | null>(null); // To store the key if editing

    // State for UI elements and loading
    const [isLoadingPage, setIsLoadingPage] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    // const [showVariations, setShowVariations] = useState(false); // Removed state for variations visibility
    const [aiLoadingSlot, setAiLoadingSlot] = useState<number | null>(null); // Slot number being generated by AI
    const [mediaViewLoading, setMediaViewLoading] = useState(false); // State for media preview loading

    // State for shadcn multi-select
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
    const [isServiceSelectOpen, setIsServiceSelectOpen] = useState(false);


    // Refs for Textarea and Emoji Picker
    const messageTextRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<any>(null); // Ref for emoji picker element


    // --- Data Fetching ---

    // Fetch Message Details (if editing) - NOW FROM SUPABASE
    const { data: messageDetails, isLoading: isLoadingDetails, error: detailsError } = useQuery<MessageDetails | null>({
        queryKey: ['messageDetails', messageId, clinicId], // Use clinicId in key
        queryFn: async () => {
            if (!messageId || !clinicId) {
                 console.warn("[MensagensConfigPage] Skipping message details fetch: messageId or clinicId missing.");
                 return null;
            }
            console.log(`[MensagensConfigPage] Fetching details for message ID ${messageId} from Supabase (Clinic ID: ${clinicId})...`);

            try {
                const { data, error } = await supabase
                    .from('north_clinic_config_mensagens')
                    .select('*') // Select all fields
                    .eq('id', parseInt(messageId, 10)) // Filter by message ID (ensure it's a number)
                    .eq('id_clinica', clinicId) // Filter by clinic ID
                    .single(); // Expecting a single result

                console.log("[MensagensConfigPage] Supabase message details fetch result:", { data, error });

                if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                    console.error("[MensagensConfigPage] Supabase message details fetch error:", error);
                    throw new Error(`Erro ao buscar detalhes da mensagem: ${error.message}`);
                }

                // If no rows found or data is null, return null
                if (!data) {
                     console.warn(`[MensagensConfigPage] No message details found for ID ${messageId} and Clinic ID ${clinicId}.`);
                     return null;
                }

                console.log("[MensagensConfigPage] Message details loaded:", data);
                return data as MessageDetails; // Return the single object

            } catch (err: any) {
                console.error("[MensagensConfigPage] Error fetching message details from Supabase:", err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: isEditing && !!messageId && !!clinicId, // Only fetch if editing, messageId, and clinicId are available
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch Instances List - NOW FROM SUPABASE
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListConfigPage', clinicId], // Use clinicId for Supabase fetch
        queryFn: async () => {
            if (!clinicId) {
                console.warn("[MensagensConfigPage] Skipping instances fetch: clinicId missing.");
                throw new Error("ID da clínica não disponível.");
            }
            console.log(`[MensagensConfigPage] Fetching instances list from Supabase (Clinic ID: ${clinicId})...`);

            try {
                const { data, error } = await supabase
                    .from('north_clinic_config_instancias')
                    .select('id, nome_exibição, telefone, nome_instancia_evolution') // Select necessary fields
                    .eq('id_clinica', clinicId); // Filter by clinic ID

                console.log("[MensagensConfigPage] Supabase instances fetch result:", { data, error });

                if (error) {
                    console.error("[MensagensConfigPage] Supabase instances fetch error:", error);
                    throw new Error(`Erro ao buscar instâncias: ${error.message}`);
                }

                if (!data) {
                    console.warn("[MensagensConfigPage] Supabase instances fetch returned null data.");
                    return []; // Return empty array if data is null
                }

                console.log("[MensagensConfigPage] Instances list loaded:", data.length, "items");
                return data as InstanceInfo[]; // Cast to the defined interface

            } catch (err: any) {
                console.error("[MensagensConfigPage] Error fetching instances from Supabase:", err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch Services List - NOW FROM SUPABASE
    const { data: servicesList, isLoading: isLoadingServices, error: servicesError } = useQuery<ServiceInfo[]>({
        queryKey: ['servicesListConfigPage', clinicId], // Use clinicId for Supabase fetch
        queryFn: async () => {
            if (!clinicId) {
                console.warn("[MensagensConfigPage] Skipping services fetch: clinicId missing.");
                throw new Error("ID da clínica não disponível.");
            }
            console.log(`[MensagensConfigPage] Fetching services list from Supabase (Clinic ID: ${clinicId})...`);

            try {
                const { data, error } = await supabase
                    .from('north_clinic_servicos')
                    .select('id, nome') // Select necessary fields
                    .eq('id_clinica', clinicId) // Filter by clinic ID
                    .order('nome', { ascending: true }); // Order by name

                console.log("[MensagensConfigPage] Supabase services fetch result:", { data, error });

                if (error) {
                    console.error("[MensagensConfigPage] Supabase services fetch error:", error);
                    throw new Error(`Erro ao buscar serviços: ${error.message}`);
                }

                if (!data) {
                    console.warn("[MensagensConfigPage] Supabase services fetch returned null data.");
                    return []; // Return empty array if data is null
                }

                console.log("[MensagensConfigPage] Services list loaded:", data.length, "items");
                return data as ServiceInfo[]; // Cast to the defined interface

            } catch (err: any) {
                console.error("[MensagensConfigPage] Error fetching services from Supabase:", err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch Linked Services (if editing) - NOW FROM SUPABASE
    const { data: linkedServicesList, isLoading: isLoadingLinkedServices, error: linkedServicesError } = useQuery<LinkedService[]>({
        queryKey: ['linkedServicesConfigPage', messageId], // Use messageId in key
        queryFn: async () => {
            if (!messageId) {
                 console.warn("[MensagensConfigPage] Skipping linked services fetch: messageId missing.");
                 return []; // Return empty if not editing or messageId is missing
            }
            console.log(`[MensagensConfigPage] Fetching linked services for message ID ${messageId} from Supabase...`);

            try {
                const { data, error } = await supabase
                    .from('north_clinic_mensagens_servicos')
                    .select('id_servico') // Select only the service ID
                    .eq('id_mensagem', parseInt(messageId, 10)); // Filter by message ID (ensure it's a number)

                console.log("[MensagensConfigPage] Supabase linked services fetch result:", { data, error });

                if (error) {
                    console.error("[MensagensConfigPage] Supabase linked services fetch error:", error);
                    throw new Error(`Erro ao buscar serviços vinculados: ${error.message}`);
                }

                if (!data) {
                    console.warn("[MensagensConfigPage] Supabase linked services fetch returned null data.");
                    return []; // Return empty array if data is null
                }

                console.log("[MensagensConfigPage] Linked services loaded:", data.length, "items");
                return data as LinkedService[]; // Cast to the defined interface

            } catch (err: any) {
                console.error("[MensagensConfigPage] Error fetching linked services from Supabase:", err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: isEditing && !!messageId, // Only fetch if editing and messageId is available
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchOnWindowFocus: false,
    });


    // Fetch Groups for selected Instance (Conditional Fetch) - STILL USING WEBHOOK
    const { data: groupsList, isLoading: isLoadingGroups, error: groupsError, refetch: refetchGroups } = useQuery<GroupInfo[]>({
        queryKey: ['groupsListConfigPage', formData.id_instancia],
        queryFn: async () => {
            const instanceId = formData.id_instancia;
            const selectedInstance = instancesList?.find(inst => String(inst.id) === String(instanceId));
            const evolutionInstanceName = selectedInstance?.nome_instancia_evolution;

            if (!instanceId || !evolutionInstanceName) {
                 console.log("[MensagensConfigPage] Skipping groups fetch: No instance selected or Evolution name missing.");
                 return []; // Return empty if no valid instance selected
            }

            console.log(`[MensagensConfigPage] Fetching groups for instance: ${evolutionInstanceName}`);
            const response = await fetch(GET_GROUPS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ nome_instancia_evolution: evolutionInstanceName })
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar grupos: ${errorText.substring(0, 100)}...`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                 console.error("[MensagensConfigPage] Invalid groups list response format:", data);
                 throw new Error("Formato de resposta inválido para lista de grupos.");
            }
            console.log("[MensagensConfigPage] Groups list loaded:", data.length, "items");
            return data as GroupInfo[];
        },
        // Enable only if instance selected AND target is group AND category is Chegou or Liberado AND instances list is loaded
        enabled: !!formData.id_instancia && formData.para_grupo && (formData.categoria === 'Chegou' || formData.categoria === 'Liberado') && !!instancesList,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchOnWindowFocus: false,
    });


    // --- Mutations ---

    // Mutation for saving/updating message
    const saveMessageMutation = useMutation({
        mutationFn: async (dataToSave: FormData) => {
            const url = isEditing ? SAVE_MESSAGE_URL_UPDATE : SAVE_MESSAGE_URL_CREATE;
            console.log(`[MensagensConfigPage] Saving message (${isEditing ? 'Update' : 'Create'}) to ${url}`);
            const response = await fetch(url, { method: 'POST', body: dataToSave });
            if (!response.ok) {
                let errorMsg = `Erro ${response.status}`;
                try { const errorData = await response.text(); errorMsg = JSON.parse(errorData).message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
                throw new Error(errorMsg);
            }
            return response.json();
        },
        onSuccess: () => {
            showSuccess(`Mensagem ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
            // Invalidate and refetch the messages list on the list page
            queryClient.invalidateQueries({ queryKey: ['messagesList', clinicId] });
            // Redirect back to the list page
            navigate(`/dashboard/11?status=${isEditing ? 'updated' : 'created'}`, { replace: true });
        },
        onError: (error: Error) => {
            showError(`Erro ao salvar mensagem: ${error.message}`);
        },
    });

    // Mutation for uploading media
    const uploadMediaMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!clinicCode) throw new Error("Código da clínica não disponível para upload.");
            console.log(`[MensagensConfigPage] Uploading media file: ${file.name}`);
            const uploadFormData = new FormData();
            uploadFormData.append('data', file, file.name);
            uploadFormData.append('fileName', file.name);
            uploadFormData.append('clinicId', clinicCode);

            const response = await fetch(UPLOAD_SUPABASE_URL, { method: 'POST', body: uploadFormData });
            if (!response.ok) {
                let errorDetails = `Erro ${response.status}`;
                 try { const text = await response.text(); errorDetails = (JSON.parse(text).message || text); } catch (e) { errorDetails = await response.text().catch(() => response.statusText); }
                 throw new Error(`Falha no upload da mídia: ${errorDetails}`);
            }
            const uploadResult = await response.json();
            console.log("[MensagensConfigPage] Upload response data:", uploadResult);

            let fileKeyFromResult = null;
            if (Array.isArray(uploadResult) && uploadResult.length > 0 && typeof uploadResult[0] === 'object' && uploadResult[0] !== null) {
                 if (typeof uploadResult[0].Key === 'string' && uploadResult[0].Key) { fileKeyFromResult = uploadResult[0].Key; }
                 else if (typeof uploadResult[0].key === 'string' && uploadResult[0].key) { fileKeyFromResult = uploadResult[0].key; }
            } else if (typeof uploadResult === 'object' && uploadResult !== null) {
                 if (typeof uploadResult.Key === 'string' && uploadResult.Key) { fileKeyFromResult = uploadResult.Key; }
                 else if (typeof uploadResult.key === 'string' && uploadResult.key) { fileKeyFromResult = uploadResult.key; }
            }

            if (!fileKeyFromResult) {
                 console.error("[MensagensConfigPage] Could not extract 'Key' or 'key' from upload response structure:", uploadResult);
                 throw new Error("Resposta do upload inválida (Key não encontrada na estrutura esperada).");
            }

            return fileKeyFromResult; // Return the file key/path
        },
        onError: (error: Error) => {
            showError(`Erro no upload da mídia: ${error.message}`);
        },
    });

    // Mutation for AI Variation generation
    const generateAiVariationMutation = useMutation({
        mutationFn: async ({ slot, baseText, category, description }: { slot: number; baseText: string; category: string; description: string }) => {
            console.log(`[MensagensConfigPage] Requesting AI suggestion for slot ${slot}...`);
            const response = await fetch(AI_VARIATION_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    categoria: category,
                    mensagem_base: baseText,
                    placeholders: placeholderData, // Use the placeholder data constant
                    descricao_categoria: description
                })
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} IA: ${errorText.substring(0, 100)}...`);
            }
            const result = await response.json();
            console.log("[MensagensConfigPage] AI Webhook Response:", result);

            let suggestionText = null;
            if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && result[0] !== null && typeof result[0].output === 'string') {
                 suggestionText = result[0].output;
            }

            if (suggestionText === null || suggestionText.trim() === '') {
                 throw new Error("Resposta da IA inválida ou vazia.");
            }

            return { slot, suggestion: suggestionText };
        },
        onMutate: (variables) => {
            setAiLoadingSlot(variables.slot);
        },
        onSuccess: (data) => {
            const textarea = document.getElementById(`variacao_${data.slot}`) as HTMLTextAreaElement | null;
            if (textarea) {
                textarea.value = data.suggestion;
                // Manually trigger change event for React state update if needed, or update state directly
                setFormData(prev => ({ ...prev, [`variacao_${data.slot}` as keyof typeof formData]: data.suggestion }));
                updateVariationsCounter(formData); // Update counter after setting value
            }
            showSuccess(`Sugestão para Variação ${data.slot} gerada!`);
        },
        onError: (error: Error) => {
            showError(`Erro ao gerar sugestão de IA: ${error.message}`);
        },
        onSettled: () => {
            setAiLoadingSlot(null);
        },
    });


    // --- Effects ---

    // Effect to populate form data when message details load (Edit mode)
    useEffect(() => {
        console.log("[useEffect messageDetails] Running. isEditing:", isEditing, "messageDetails:", messageDetails);
        if (isEditing && messageDetails) {
            console.log("[useEffect messageDetails] Populating form from messageDetails:", messageDetails);
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
                prioridade: messageDetails.prioridade ?? 1, // Populate priority, default to 1 if null/undefined
            });
            setExistingMediaKey(messageDetails.midia_mensagem || null);
            // Initial population of variations counter
            updateVariationsCounter(messageDetails);
        } else if (!isEditing && initialCategoryFromUrl) {
             console.log("[useEffect messageDetails] Create mode with initialCategoryFromUrl:", initialCategoryFromUrl);
             // Set default template if adding and category is in URL
             setFormData(prev => ({
                 ...prev,
                 categoria: initialCategoryFromUrl, // Ensure category is set from URL
                 modelo_mensagem: defaultTemplates[initialCategoryFromUrl] || '',
                 prioridade: 1, // Default priority for new messages
             }));
        } else {
             console.log("[useEffect messageDetails] No messageDetails (not editing or not loaded) and no initialCategoryFromUrl.");
        }
    }, [messageDetails, isEditing, initialCategoryFromUrl]); // Re-run if details change or mode/initial category changes

    // Effect to populate selectedServiceIds when linkedServicesList loads (Edit mode)
    useEffect(() => {
        console.log("[useEffect linkedServicesList] Running. isEditing:", isEditing, "linkedServicesList:", linkedServicesList);
        if (isEditing && linkedServicesList !== undefined) { // Ensure linkedServicesList has been fetched (not undefined)
            console.log("[useEffect linkedServicesList] Populating selectedServiceIds from linkedServicesList:", linkedServicesList);
            const ids = linkedServicesList.map(item => item.id_servico).filter(id => id !== null) as number[];
            setSelectedServiceIds(ids);
        } else if (!isEditing) {
             console.log("[useEffect linkedServicesList] Create mode. Clearing selectedServiceIds.");
             // In create mode, ensure selectedServiceIds is empty
             setSelectedServiceIds([]);
        } else {
             console.log("[useEffect linkedServicesList] Not editing or linkedServicesList is undefined.");
        }
    }, [linkedServicesList, isEditing]); // Re-run when linkedServicesList changes or mode changes


    // Effect to handle category-specific field visibility and group fetching
    useEffect(() => {
        console.log("[useEffect category/instance] Running. Category:", formData.categoria, "Instance:", formData.id_instancia, "Target Group:", formData.para_grupo);
        const category = formData.categoria;
        const instanceId = formData.id_instancia;

        // Hide elements that are conditionally rendered in JSX
        // No need to hide scheduledTimeGroupEl, birthdayTimeGroupEl, targetTypeGroupEl, groupSelectionGroupEl here
        // The service selection group is also conditionally rendered in JSX now.


        // Trigger group select visibility logic based on category and target type
        // This will also trigger group fetching if needed
        // Pass current target type based on formData
        const currentTargetType = formData.para_grupo ? 'Grupo' : (formData.para_cliente ? 'Cliente' : (formData.para_funcionario ? 'Funcionário' : 'Grupo'));
        handleTargetTypeChange(currentTargetType); // This will handle showing/hiding group select and fetching


        // If category changes to something that doesn't show target type or group,
        // ensure para_grupo, para_cliente, para_funcionario are reset to defaults
        if (category !== 'Chegou' && category !== 'Liberado') {
             console.log("[useEffect category/instance] Category is not Chegou/Liberado. Resetting target type and group.");
             setFormData(prev => ({
                 ...prev,
                 para_funcionario: false,
                 para_grupo: true, // Default back to group
                 para_cliente: false,
                 grupo: '' // Clear group selection
             }));
             // Also ensure group select is hidden (handled by useEffect watching para_grupo/categoria)
        } else {
             console.log("[useEffect category/instance] Category is Chegou/Liberado. Target type and group logic active.");
        }


    }, [formData.categoria, formData.id_instancia, formData.para_grupo, formData.para_cliente, formData.para_funcionario, instancesList]); // Re-run if category, instance, target type, or instances list changes

    // Effect to handle media preview when selectedMediaFile or existingMediaKey changes
    useEffect(() => {
        console.log("[useEffect media] Running. selectedMediaFile:", selectedMediaFile?.name, "existingMediaKey:", existingMediaKey);
        const mediaPreviewEl = document.getElementById('mediaPreview') as HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null;
        const currentMediaPreviewEl = document.getElementById('currentMediaPreview') as HTMLImageElement | null;
        const mediaPlaceholderTextEl = document.getElementById('mediaPlaceholderText');
        const currentMediaInfoEl = document.getElementById('currentMediaInfo');
        const mediaViewLoadingEl = document.getElementById('mediaViewLoading');
         const mediaPreviewContainerEl = document.getElementById('mediaPreviewContainer');
         const dynamicMediaElementContainer = document.getElementById('dynamicMediaElementContainer');


        // Cleanup previous dynamic media element
        if (dynamicMediaElementContainer) {
             dynamicMediaElementContainer.innerHTML = ''; // Clear container
        }
         if (mediaPreviewEl) { mediaPreviewEl.style.display = 'none'; mediaPreviewEl.src = ''; } // Hide img tag preview


        if (selectedMediaFile) {
            console.log("[useEffect media] New media file selected. Showing preview.");
            if (mediaPreviewContainerEl) mediaPreviewContainerEl.style.display = 'flex';
            if (mediaPlaceholderTextEl) mediaPlaceholderTextEl.style.display = 'none';
            if (currentMediaPreviewEl) currentMediaPreviewEl.style.display = 'none'; // Hide existing preview
            if (currentMediaInfoEl) { currentMediaInfoEl.textContent = `Novo: ${selectedMediaFile.name}`; currentMediaInfoEl.style.display = 'inline'; }

            // Create preview URL for the new file
            const reader = new FileReader();
            reader.onload = (e) => {
                 if (mediaPreviewEl) {
                     mediaPreviewEl.src = e.target?.result as string;
                     mediaPreviewEl.style.display = 'block';
                 }
            };
            reader.readAsDataURL(selectedMediaFile);

        } else if (existingMediaKey) {
            console.log("[useEffect media] Existing media key found. Fetching signed URL for preview.");
             if (mediaPreviewContainerEl) mediaPreviewContainerEl.style.display = 'flex';
             if (mediaPlaceholderTextEl) mediaPlaceholderTextEl.style.display = 'none';
             if (currentMediaPreviewEl) currentMediaPreviewEl.style.display = 'none'; // Hide img tag until loaded
             if (currentMediaInfoEl) {
                 const filename = existingMediaKey.includes('/') ? existingMediaKey.substring(existingMediaKey.lastIndexOf('/') + 1) : existingMediaKey;
                 currentMediaInfoEl.textContent = `Arquivo salvo: ${filename}`;
                 currentMediaInfoEl.style.display = 'inline';
             }
             if (mediaPreviewEl) { mediaPreviewEl.style.display = 'none'; mediaPreviewEl.src = ''; } // Hide new file preview

             // Fetch and display the saved media (handles different types)
             fetchAndDisplaySavedMedia(existingMediaKey);

        } else {
            console.log("[useEffect media] No media (new or existing). Hiding preview.");
            if (mediaPreviewContainerEl) mediaPreviewContainerEl.style.display = 'none';
            if (mediaPlaceholderTextEl) { mediaPlaceholderTextEl.textContent = 'Nenhuma mídia selecionada'; mediaPlaceholderTextEl.style.display = 'inline'; }
            if (currentMediaPreviewEl) { currentMediaPreviewEl.style.display = 'none'; currentMediaPreviewEl.src = ''; }
            if (currentMediaInfoEl) { currentMediaInfoEl.textContent = ''; currentMediaInfoEl.style.display = 'none'; }
            if (mediaPreviewEl) { mediaPreviewEl.style.display = 'none'; mediaPreviewEl.src = ''; }
        }

        // Cleanup object URL on unmount or when file changes
        return () => {
            if (mediaPreviewEl && mediaPreviewEl.src && mediaPreviewEl.src.startsWith('blob:')) {
                URL.revokeObjectURL(mediaPreviewEl.src);
            }
        };
    }, [selectedMediaFile, existingMediaKey]); // Re-run when file or key changes

    // Effect to handle overall page loading state and errors
    useEffect(() => {
        console.log("[useEffect pageState] Running. isLoadingDetails:", isLoadingDetails, "isLoadingInstances:", isLoadingInstances, "isLoadingServices:", isLoadingServices, "isLoadingLinkedServices:", isLoadingLinkedServices);
        console.log("[useEffect pageState] detailsError:", detailsError, "instancesError:", instancesError, "servicesError:", servicesError, "linkedServicesError:", linkedServicesError);

        const loading = isLoadingDetails || isLoadingInstances || isLoadingServices || isLoadingLinkedServices;
        const error = detailsError || instancesError || servicesError || linkedServicesError;

        setIsLoadingPage(loading);
        setPageError(error ? error.message : null);

        console.log("[useEffect pageState] setIsLoadingPage:", loading, "setPageError:", error ? error.message : null);

    }, [isLoadingDetails, isLoadingInstances, isLoadingServices, isLoadingLinkedServices, detailsError, instancesError, servicesError, linkedServicesError, isEditing]);


    // Effect to initialize emoji picker
    useEffect(() => {
        console.log("[useEffect emojiPicker] Running.");
        const picker = emojiPickerRef.current;
        const textarea = messageTextRef.current;

        if (picker && textarea) {
            picker.addEventListener('emoji-click', (event: any) => {
                const emoji = event.detail.unicode;
                const { selectionStart, selectionEnd, value } = textarea;
                textarea.value = value.substring(0, selectionStart) + emoji + value.substring(selectionEnd);
                const newPos = selectionStart + emoji.length;
                textarea.selectionStart = newPos;
                textarea.selectionEnd = newPos;
                textarea.focus();
                if (picker) picker.style.display = 'none';
            });

            // Global click listener to close picker
            const handleClickOutside = (event: MouseEvent) => {
                if (picker.style.display !== 'none' && !picker.contains(event.target as Node) && event.target !== document.getElementById('emojiBtn')) {
                    picker.style.display = 'none';
                }
            };
            document.addEventListener('click', handleClickOutside);

            // Cleanup
            return () => {
                console.log("[useEffect emojiPicker] Cleaning up emoji picker listeners.");
                picker.removeEventListener('emoji-click', () => {}); // Remove dummy listener
                document.removeEventListener('click', handleClickOutside);
            };
        } else {
             console.log("[useEffect emojiPicker] Emoji picker or textarea ref not available.");
        }
    }, []); // Empty dependency array

    // Effect to update variations counter when form data changes
    useEffect(() => {
        console.log("[useEffect variationsCounter] Running.");
        updateVariationsCounter(formData);
    }, [formData.variacao_1, formData.variacao_2, formData.variacao_3, formData.variacao_4, formData.variacao_5]);

    // Effect to populate group select when groupsList changes
    useEffect(() => {
        console.log("[useEffect groupsList] Running. groupsList:", groupsList, "formData.para_grupo:", formData.para_grupo, "formData.categoria:", formData.categoria);
        // Only populate if the target type is 'Grupo' AND category is Chegou or Liberado AND groupsList is available
        const shouldPopulateGroupSelect = formData.para_grupo && (formData.categoria === 'Chegou' || formData.categoria === 'Liberado') && groupsList;

        const groupSelectEl = document.getElementById('grupo') as HTMLSelectElement | null;
        if (!groupSelectEl) {
             console.warn("[useEffect groupsList] Group select element not found.");
             return;
        }

        if (shouldPopulateGroupSelect) {
            console.log("[useEffect groupsList] Populating group select...");
            groupSelectEl.innerHTML = ''; // Clear existing options
            groupSelectEl.disabled = true; // Disable while populating

            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-- Selecione o Grupo * --";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            groupSelectEl.appendChild(defaultOption);

            if (groupsList && groupsList.length > 0) {
                groupsList.forEach(group => {
                    if (group && typeof group.id_grupo !== 'undefined' && typeof group.nome_grupo !== 'undefined') {
                        const option = document.createElement('option');
                        option.value = String(group.id_grupo); // Ensure string value
                        option.textContent = group.nome_grupo;
                        groupSelectEl.appendChild(option);
                    } else {
                         console.warn("[useEffect groupsList] Invalid group object found:", group);
                    }
                });

                if (groupSelectEl.options.length > 1) { // If added any valid group
                    groupSelectEl.disabled = false;
                    // Try to select the targetGroupId
                    const targetValueString = formData.grupo !== null ? String(formData.grupo) : null;
                    if (targetValueString !== null && Array.from(groupSelectEl.options).some(opt => opt.value === targetValueString)) {
                        console.log(`[useEffect groupsList] Selecting target group ID: ${formData.grupo}`);
                        groupSelectEl.value = targetValueString;
                        // State is already updated by handleSelectChange or initial load, no need to set here
                    } else {
                        console.warn(`[useEffect groupsList] Target group ID '${formData.grupo}' not found or null.`);
                        groupSelectEl.value = ""; // Keep placeholder selected
                        // State is already updated by handleSelectChange or initial load, no need to set here
                        if(isEditing && formData.grupo !== null) showToast("Grupo alvo salvo não encontrado.", "warning");
                    }
                } else {
                    // If the array of groups came but none were valid
                     defaultOption.textContent = "-- Nenhum grupo válido --";
                     groupSelectEl.disabled = true;
                     // State is already updated by handleSelectChange or initial load, no need to set here
                }
            } else {
                 console.log("[useEffect groupsList] No groups provided or empty array.");
                defaultOption.textContent = "-- Nenhum grupo disponível --";
                groupSelectEl.disabled = true;
                // State is already updated by handleSelectChange or initial load, no need to set here
            }
             console.log("[useEffect groupsList] Group select populated.");

        } else {
            console.log("[useEffect groupsList] Group select not needed for current category/target type. Hiding/clearing.");
            // If not showing group select, ensure it's hidden and cleared
            const groupSelectionGroupEl = document.getElementById('groupSelectionGroup');
            if (groupSelectionGroupEl) groupSelectionGroupEl.style.display = 'none';
            // Clear the select element options
            groupSelectEl.innerHTML = '';
            groupSelectEl.disabled = true;
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-- Selecione o Grupo * --"; // Or a different placeholder
            defaultOption.disabled = true;
            defaultOption.selected = true;
            groupSelectEl.appendChild(defaultOption);
            // Clear the selected group ID in state if the group select is hidden
            if (formData.grupo !== '') {
                 setFormData(prev => ({ ...prev, grupo: '' }));
            }
             console.log("[useEffect groupsList] Group select hidden/cleared.");
        }
    }, [groupsList, groupsError, formData.para_grupo, formData.grupo, formData.categoria, isEditing]); // Depend on groupsList, error, and relevant form state


    // --- Handlers ---

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) || 0 : value) // Parse number input
        }));
    };

    const handleSelectChange = (id: string, value: string) => {
         console.log(`[handleSelectChange] ID: ${id}, Value: ${value}`);
         setFormData(prev => ({
             ...prev,
             [id]: value
         }));
         // Special handling for category and target type changes
         if (id === 'categoria') {
             console.log("[handleSelectChange] Category changed. Resetting target type and group.");
             // When category changes, reset target type and group to defaults
             setFormData(prev => ({
                 ...prev,
                 categoria: value,
                 para_funcionario: false,
                 para_grupo: true, // Default back to group
                 para_cliente: false,
                 grupo: '' // Clear group selection
             }));
             // useEffect handles category-specific visibility and group fetching logic
         } else if (id === 'targetTypeSelect') {
             handleTargetTypeChange(value);
         }
    };

    const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("[handleMediaFileChange] File input changed.");
        const file = e.target.files ? e.target.files[0] : null;
        setSelectedMediaFile(file);
        // The useEffect for media preview will handle displaying it
    };

    const handleTargetTypeChange = (value: string) => {
        console.log(`[handleTargetTypeChange] Target type changed to: ${value}`);
        setFormData(prev => ({
            ...prev,
            para_grupo: value === 'Grupo',
            para_cliente: value === 'Cliente',
            para_funcionario: value === 'Funcionário',
        }));

        // The useEffect watching formData.para_grupo and formData.categoria will handle
        // showing/hiding the group select and triggering group fetching.
        // No need to manually manage display or refetchGroups here.
    };

    const handleTokenClick = (e: React.MouseEvent<HTMLSpanElement>) => {
        console.log("[handleTokenClick] Token clicked.");
        const token = e.currentTarget.dataset.token;
        const textarea = messageTextRef.current;
        if (token && textarea) {
            const { selectionStart, selectionEnd, value } = textarea;
            textarea.value = value.substring(0, selectionStart) + token + value.substring(selectionEnd);
            const newPos = selectionStart + token.length;
            textarea.selectionStart = newPos;
            textarea.selectionEnd = newPos;
            textarea.focus();
        }
    };

    // Handler for selecting/deselecting services in the shadcn multi-select
    const handleServiceSelectChange = (serviceId: number, isChecked: boolean) => {
        console.log(`[handleServiceSelectChange] Service ID: ${serviceId}, Checked: ${isChecked}`);
        setSelectedServiceIds(prev => {
            if (isChecked) {
                // Add the ID if it's not already there
                return prev.includes(serviceId) ? prev : [...prev, serviceId];
            } else {
                // Remove the ID
                return prev.filter(id => id !== serviceId);
            }
        });
    };


    const handleSave = async () => {
        console.log("[handleSave] Save button clicked.");
        // No need to clear error message here, react-query handles mutation errors

        // --- 1. Coleta de Dados ---
        const dataToSave = new FormData();
        const currentFormData = formData; // Use state directly

        // Add basic fields
        if (clinicData?.code) {
            dataToSave.append('id_clinica', clinicData.code);
            dataToSave.append('codigo_clinica', clinicData.code); // Assuming webhook uses this name
        } else {
             showError("Erro: Código da clínica não disponível.");
             return;
        }
        dataToSave.append('categoria', currentFormData.categoria);
        dataToSave.append('id_instancia', currentFormData.id_instancia);
        dataToSave.append('modelo_mensagem', currentFormData.modelo_mensagem);
        dataToSave.append('ativo', String(currentFormData.ativo)); // Send as string 'true' or 'false'
        // Only append priority if editing
        if (isEditing) {
             dataToSave.append('prioridade', String(currentFormData.prioridade)); // Add priority to FormData
        }


        // Add conditional fields (Hora, Grupo, Target Type)
        // Only append hora_envio if category requires it
        if (currentFormData.categoria === 'Confirmar Agendamento' || currentFormData.categoria === 'Aniversário') {
             if (currentFormData.hora_envio) dataToSave.append('hora_envio', currentFormData.hora_envio);
        } else {
             dataToSave.append('hora_envio', ''); // Ensure empty string if not applicable
        }


        // Only append grupo if category is Chegou/Liberado AND target is Grupo
        if ((currentFormData.categoria === 'Chegou' || currentFormData.categoria === 'Liberado') && currentFormData.para_grupo && currentFormData.grupo) {
             dataToSave.append('grupo', currentFormData.grupo); // Group ID
        } else {
             dataToSave.append('grupo', ''); // Ensure empty string if not applicable
        }

        // Only append target type flags if category is Chegou/Liberado
        if (currentFormData.categoria === 'Chegou' || currentFormData.categoria === 'Liberado') {
            dataToSave.append('para_funcionario', String(currentFormData.para_funcionario));
            dataToSave.append('para_grupo', String(currentFormData.para_grupo));
            dataToSave.append('para_cliente', String(currentFormData.para_cliente));
        } else {
             // Ensure default values are sent if not Chegou/Liberado
             dataToSave.append('para_funcionario', 'false');
             dataToSave.append('para_grupo', 'true'); // Default
             dataToSave.append('para_cliente', 'false');
        }


        // Add variations
        console.log("[handleSave] Appending variations to FormData...");
        for (let i = 1; i <= 5; i++) {
             const variationKey = `variacao_${i}` as keyof typeof currentFormData;
             dataToSave.append(variationKey, currentFormData[variationKey] || '');
        }

        // Add linked services (get from selectedServiceIds state)
        // Check if the service selection group is currently visible (based on category)
        const isServiceSelectionVisible = formData.categoria !== 'Aniversário';

        if (isServiceSelectionVisible) {
             dataToSave.append('servicos_vinculados', JSON.stringify(selectedServiceIds));
             console.log("[handleSave] Linked services added from state:", selectedServiceIds);
        } else {
             dataToSave.append('servicos_vinculados', JSON.stringify([])); // Send empty array if not visible
             console.log("[handleSave] Service selection not visible. Sending empty linked services array.");
        }


        // --- 2. Validação ---
        console.log("[handleSave] Validating data...");
        let validationError = null;
        if (!currentFormData.categoria) validationError = "Categoria é obrigatória.";
        else if (!currentFormData.id_instancia) validationError = "Instância é obrigatória.";
        else if (!currentFormData.modelo_mensagem.trim()) validationError = "Texto da mensagem principal é obrigatório.";
        // Check linked services only if the service selection group is visible AND category is NOT Aniversário
        else if (isServiceSelectionVisible && currentFormData.categoria !== 'Aniversário' && selectedServiceIds.length === 0) { validationError = "Pelo menos um serviço deve ser vinculado (exceto para Aniversário)."; }
        else if (currentFormData.categoria === 'Confirmar Agendamento' && !currentFormData.hora_envio) { validationError = "Hora de envio (Confirmação) é obrigatória."; }
        else if (currentFormData.categoria === 'Aniversário' && !currentFormData.hora_envio) { validationError = "Hora de envio (Aniversário) é obrigatória."; }
        // Validate group only if category is Chegou/Liberado AND target is Grupo
        else if ((currentFormData.categoria === 'Chegou' || currentFormData.categoria === 'Liberado') && currentFormData.para_grupo && !currentFormData.grupo) { validationError = "Grupo alvo é obrigatório para Chegou/Liberado quando o alvo é Grupo."; }
        // Media validation is handled before setting selectedMediaFile

        if (validationError) {
            console.warn("[handleSave] Validation failed:", validationError);
            showToast(validationError, "warning");
            return;
        }

        // --- 3. Upload de Mídia (if new file selected) ---
        let fileKeyToSave: string | null = existingMediaKey; // Start with existing key

        if (selectedMediaFile) {
            console.log("[handleSave] New media file detected. Starting upload...");
            // Use the mutation for upload
            try {
                // No need to manually update button text here, mutation state handles loading
                fileKeyToSave = await uploadMediaMutation.mutateAsync(selectedMediaFile);
                console.log("[handleSave] Upload successful. Key:", fileKeyToSave);
            } catch (uploadError) {
                // Error handled by mutation's onError
                return; // Stop the save process
            }
        } else if (isEditing && existingMediaKey !== null && document.getElementById('messageMedia')?.files?.length === 0) {
             // Case: Was editing, had media, user cleared it by selecting nothing in the file input
             console.log("[handleSave] Existing media was cleared by user via file input.");
             fileKeyToSave = ''; // Save empty string to remove media
        } else if (!isEditing && selectedMediaFile === null && existingMediaKey === null) {
             // Case: Creating new message, no file selected
             console.log("[handleSave] Creating new message, no media file selected.");
             fileKeyToSave = ''; // Ensure empty string is sent
        }
        // If editing and no new file selected, existingMediaKey remains the value

        // Add the media key to the main form data
        dataToSave.append('url_arquivo', fileKeyToSave ?? ''); // Use the correct field name 'url_arquivo'


        // --- 4. Final Save Mutation ---
        if (isEditing) dataToSave.append('id', messageId!); // Add ID if editing

        // No need to manually update button text here, mutation state handles loading

        // Use the save mutation
        saveMessageMutation.mutate(dataToSave);

    };

    const handleCancel = () => {
        console.log("[handleCancel] Canceling...");
        // Redirect back to the list page
        navigate(`/dashboard/11?clinic_code=${encodeURIComponent(clinicData?.code || '')}`, { replace: true });
    };

    const handlePreviewClick = () => {
        // This button is not in the HTML, but we can add it or use the simulateMessage directly
        // For now, let's just log the simulated message
        console.log("[handlePreviewClick] Simulating message preview:");
        console.log(simulateMessage(formData.modelo_mensagem, placeholderData));
        // If you want a modal preview, you'd implement showPreviewModal here
    };

    const handleAiVariationClick = (slot: number) => {
        const baseText = messageTextRef.current?.value.trim();
        const category = formData.categoria;
        const categoryDesc = categoryInfo[category]?.description || '';

        if (!baseText) {
            showToast("Por favor, digite a mensagem principal antes de gerar variações.", "warning");
            return;
        }
        if (!category) {
             showToast("Por favor, selecione uma categoria antes de gerar variações.", "warning");
             return;
        }

        generateAiVariationMutation.mutate({ slot, baseText, category, description: categoryDesc });
    };

    const handleClearVariationClick = (slot: number) => {
        // Update state directly
        setFormData(prev => ({ ...prev, [`variacao_${slot}` as keyof typeof formData]: '' }));
        // updateVariationsCounter is triggered by the state change effect
    };

    // Helper to populate group select (used by useEffect and handleTargetTypeChange)
    const populateGroupSelect = (groups: GroupInfo[], targetGroupId: string | null) => {
        const groupSelectEl = document.getElementById('grupo') as HTMLSelectElement | null;
        if (!groupSelectEl) return;

        groupSelectEl.innerHTML = ''; // Clear existing options
        groupSelectEl.disabled = true; // Disable while populating

        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "-- Selecione o Grupo * --";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        groupSelectEl.appendChild(defaultOption);

        if (groups && groups.length > 0) {
            groups.forEach(group => {
                if (group && typeof group.id_grupo !== 'undefined' && typeof group.nome_grupo !== 'undefined') {
                    const option = document.createElement('option');
                    option.value = String(group.id_grupo); // Ensure string value
                    option.textContent = group.nome_grupo;
                    groupSelectEl.appendChild(option);
                } else {
                     console.warn("[populateGroupSelect] Invalid group object found:", group);
                }
            });

            if (groupSelectEl.options.length > 1) { // If added any valid group
                groupSelectEl.disabled = false;
                // Try to select the targetGroupId
                const targetValueString = targetGroupId !== null ? String(targetGroupId) : null;
                if (targetValueString !== null && Array.from(groupSelectEl.options).some(opt => opt.value === targetValueString)) {
                    console.log(`[populateGroupSelect] Selecting target group ID: ${targetGroupId}`);
                    groupSelectEl.value = targetValueString;
                    // State is already updated by handleSelectChange or initial load, no need to set here
                } else {
                    console.warn(`[populateGroupSelect] Target group ID '${formData.grupo}' not found or null.`);
                    groupSelectEl.value = ""; // Keep placeholder selected
                    // State is already updated by handleSelectChange or initial load, no need to set here
                    if(isEditing && formData.grupo !== null) showToast("Grupo alvo salvo não encontrado.", "warning");
                }
            } else {
                // If the array of groups came but none were valid
                 defaultOption.textContent = "-- Nenhum grupo válido --";
                 groupSelectEl.disabled = true;
                 // State is already updated by handleSelectChange or initial load, no need to set here
            }
        } else {
             console.log("[populateGroupSelect] Group select not needed for current category/target type. Hiding/clearing.");
            // If not showing group select, ensure it's hidden and cleared
            const groupSelectionGroupEl = document.getElementById('groupSelectionGroup');
            if (groupSelectionGroupEl) groupSelectionGroupEl.style.display = 'none';
            // Clear the select element options
            groupSelectEl.innerHTML = '';
            groupSelectEl.disabled = true;
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-- Selecione o Grupo * --"; // Or a different placeholder
            defaultOption.disabled = true;
            defaultOption.selected = true;
            groupSelectEl.appendChild(defaultOption);
            // Clear the selected group ID in state if the group select is hidden
            if (formData.grupo !== '') {
                 setFormData(prev => ({ ...prev, grupo: '' }));
            }
             console.log("[populateGroupSelect] Group select hidden/cleared.");
        }
    };

    // Helper to fetch and display saved media
    const fetchAndDisplaySavedMedia = async (fileKey: string) => {
        console.log("[fetchAndDisplaySavedMedia] Running for key:", fileKey);
        const currentMediaPreviewEl = document.getElementById('currentMediaPreview') as HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null;
        const mediaPlaceholderTextEl = document.getElementById('mediaPlaceholderText');
        const currentMediaInfoEl = document.getElementById('currentMediaInfo');
        const mediaViewLoadingEl = document.getElementById('mediaViewLoading');
        const mediaPreviewContainerEl = document.getElementById('mediaPreviewContainer');
        const dynamicMediaElementContainer = document.getElementById('dynamicMediaElementContainer');


        if (!fileKey || !currentMediaPreviewEl || !mediaPlaceholderTextEl || !currentMediaInfoEl || !mediaViewLoadingEl || !mediaPreviewContainerEl || !dynamicMediaElementContainer) {
            console.warn("[fetchAndDisplaySavedMedia] Missing key or elements.");
            setMediaViewLoading(false); // Ensure loading stops
            if(currentMediaInfoEl) { currentMediaInfoEl.innerHTML = `<span style="color:var(--color-destructive);">Erro interno ao carregar mídia.</span>`; currentMediaInfoEl.style.display = 'inline'; }
            return;
        }

        // Cleanup previous dynamic media element
        dynamicMediaElementContainer.innerHTML = ''; // Clear container
        if (mediaPreviewEl) { mediaPreviewEl.style.display = 'none'; mediaPreviewEl.src = ''; } // Hide img tag preview


        setMediaViewLoading(true); // Start media view loading state

        try {
            console.log(`[fetchAndDisplaySavedMedia] Requesting signed URL for key: ${fileKey}`);
            const response = await fetch(GET_SIGNED_URL_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ arquivo_key: fileKey, codigo_clinica: clinicData?.code })
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} URL assinada: ${errorText.substring(0, 100)}...`);
            }
            const result = await response.json();
            if (!result || typeof result.signedUrl !== 'string' || !result.signedUrl) {
                 throw new Error("Resposta inválida do webhook (signedUrl não encontrada).");
            }
            const signedUrl = result.signedUrl;

            // Determine file type by extension
            let fileType = 'unknown';
            let fileExt = '';
            try {
                 const urlPath = new URL(signedUrl).pathname;
                 fileExt = urlPath.split('.').pop()?.toLowerCase() || '';
                 if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt)) fileType = 'image';
                 else if (['mp4', 'webm', 'mov', 'avi', 'ogv', 'mkv'].includes(fileExt)) fileType = 'video';
                 else if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'opus', 'oga'].includes(fileExt)) fileType = 'audio';
                 else fileType = 'download';
            } catch (e) { fileType = 'download'; }

            // Display the appropriate media element
            if (fileType === 'image') {
                currentMediaPreviewEl.src = signedUrl;
                currentMediaPreviewEl.style.display = 'block';
            } else if (fileType === 'video') {
                const videoElement = document.createElement('video');
                videoElement.id = 'dynamicMediaElement'; videoElement.src = signedUrl; videoElement.controls = true;
                videoElement.classList.add('image-preview'); videoElement.style.maxWidth = '300px'; videoElement.style.maxHeight = '250px'; videoElement.style.display = 'block';
                dynamicMediaElementContainer.appendChild(videoElement); // Append to container
            } else if (fileType === 'audio') {
                const audioElement = document.createElement('audio');
                audioElement.id = 'dynamicMediaElement'; audioElement.src = signedUrl; audioElement.controls = true;
                audioElement.style.display = 'block'; audioElement.style.width = '100%';
                dynamicMediaElementContainer.appendChild(audioElement); // Append to container
            } else { // download or unknown
                const downloadLink = document.createElement('a');
                downloadLink.id = 'dynamicMediaElement'; downloadLink.href = signedUrl;
                const filename = fileKey.includes('/') ? fileKey.substring(fileKey.lastIndexOf('/') + 1) : fileKey;
                downloadLink.textContent = `Download ${filename}`;
                downloadLink.target = "_blank"; downloadLink.rel = "noopener noreferrer";
                downloadLink.classList.add('btn', 'btn-sm', 'btn-outline'); // Use outline variant
                dynamicMediaElementContainer.appendChild(downloadLink); // Append to container
                if(currentMediaInfoEl) { currentMediaInfoEl.textContent = `Arquivo: ${filename}`; currentMediaInfoEl.style.display = 'inline'; }
            }

            // Show container if something is displayed
             if (currentMediaPreviewEl.style.display === 'block' || dynamicMediaElementContainer.children.length > 0) {
                 mediaPreviewContainerEl.style.display = 'flex';
             }


        } catch (error) {
            console.error("[fetchAndDisplaySavedMedia] FAILED:", error);
            showToast(`Erro ao carregar mídia: ${error.message}`, "error");
            if(currentMediaInfoEl) { currentMediaInfoEl.innerHTML = `<span style="color:var(--color-destructive);">Falha ao carregar mídia</span>`; currentMediaInfoEl.style.display = 'inline'; } // Use destructive color
        } finally {
            setMediaViewLoading(false); // Stop media view loading state
        }
    };

    // Helper to update variations counter
    const updateVariationsCounter = (data: typeof formData | MessageDetails) => {
        const variationsCountEl = document.getElementById('variationsCount');
        if (!variationsCountEl) return;

        let count = 0;
        for (let i = 1; i <= 5; i++) {
            const variationKey = `variacao_${i}` as keyof (typeof formData | MessageDetails);
            // Check both formData and messageDetails if editing
            const value = (data as any)[variationKey]; // Use 'any' for flexible access
            if (value && typeof value === 'string' && value.trim() !== '') {
                count++;
            }
        }
        variationsCountEl.textContent = String(count);
        console.log(`[updateVariationsCounter] Count updated to: ${count}`);
    };


    // --- Render ---

    // Combine loading states
    const isLoading = isLoadingPage || saveMessageMutation.isLoading || uploadMediaMutation.isLoading || generateAiVariationMutation.isLoading || mediaViewLoading;

    // Permission Check (Basic check based on clinicData presence)
    if (!clinicData) {
        console.log("[MensagensConfigPage] Rendering: clinicData is null. Showing error message.");
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }
    // Add specific permission check if needed, similar to WhatsappInstancesPage

    // Determine if the service selection group should be visible
    const isServiceSelectionVisible = formData.categoria !== 'Aniversário';

    // Get selected service names for the trigger button
    const selectedServiceNames = useMemo(() => {
        console.log("[useMemo selectedServiceNames] Running. selectedServiceIds:", selectedServiceIds, "servicesList:", servicesList);
        if (!servicesList) return [];
        const names = selectedServiceIds
            .map(id => servicesList.find(service => service.id === id)?.nome)
            .filter(name => name !== undefined) as string[];
        console.log("[useMemo selectedServiceNames] Generated names:", names);
        return names;
    }, [selectedServiceIds, servicesList]);

    console.log("[MensagensConfigPage] Rendering main JSX. isLoadingPage:", isLoadingPage, "pageError:", pageError);

    return (
        <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 id="pageTitle" className="config-title text-2xl font-bold text-primary whitespace-nowrap">
                    {isLoadingPage ? 'Carregando...' : `${isEditing ? 'Editar' : 'Configurar Nova'} Mensagem`}
                </h1>
            </div>

            {/* Loading Indicator */}
            {isLoadingPage && !pageError && (
                <div className="loading-indicator flex flex-col items-center justify-center p-8 text-primary">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <span className="text-lg">Carregando dados...</span>
                </div>
            )}

            {/* Error Display */}
            {pageError && (
                <div className="error-message flex items-center gap-2 p-3 mb-4 bg-red-100 text-red-700 border border-red-200 rounded-md shadow-sm">
                    <TriangleAlert className="h-5 w-5 flex-shrink-0" />
                    <span>Erro ao carregar dados: {pageError}</span>
                    {/* Add a retry button if needed */}
                </div>
            )}

            {/* Temporary Debug Sections */}
            {!isLoadingPage && !pageError && (
                <div className="debug-section bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-yellow-800 border-b border-yellow-200 pb-2 mb-3">Debug: Serviços</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-medium text-yellow-900 mb-1">Serviços Disponíveis ({servicesList?.length ?? 0}):</p>
                            {isLoadingServices ? (
                                <p className="text-gray-600"><Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Carregando...</p>
                            ) : servicesError ? (
                                <p className="text-red-600">Erro: {servicesError.message}</p>
                            ) : (servicesList?.length ?? 0) === 0 ? (
                                <p className="text-gray-600">Nenhum serviço disponível.</p>
                            ) : (
                                <ul className="list-disc list-inside max-h-40 overflow-y-auto">
                                    {servicesList?.map(s => <li key={s.id}>{s.id}: {s.nome}</li>)}
                                </ul>
                            )}
                        </div>
                        <div>
                            <p className="font-medium text-yellow-900 mb-1">Serviços Vinculados ({selectedServiceIds.length ?? 0}):</p> {/* Use selectedServiceIds length */}
                            {isLoadingLinkedServices ? (
                                <p className="text-gray-600"><Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Carregando...</p>
                            ) : linkedServicesError ? (
                                <p className="text-red-600">Erro: {linkedServicesError.message}</p>
                            ) : (selectedServiceIds.length ?? 0) === 0 ? ( {/* Use selectedServiceIds length */}
                                <p className="text-gray-600">Nenhum serviço vinculado.</p>
                            ) : (
                                <ul className="list-disc list-inside max-h-40 overflow-y-auto">
                                    {selectedServiceIds.map((id, index) => <li key={index}>ID Serviço: {id}</li>)} {/* Map selectedServiceIds */}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Form */}
            {!isLoadingPage && !pageError && (
                <form id="messageConfigForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}> {/* Call handleSave on form submit */}
                    <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-primary border-b border-gray-200 pb-3 mb-4">Identificação e Status</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group" id="messageCategoryGroup">
                                <Label htmlFor="categoria">Categoria *</Label>
                                <Select
                                    id="categoria"
                                    value={formData.categoria}
                                    onValueChange={(value) => handleSelectChange('categoria', value)}
                                    disabled={isEditing || isLoading} // Disable category select if editing or loading
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="-- Selecione --" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {orderedCategories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="form-group" id="messageInstanceGroup">
                                <Label htmlFor="id_instancia">Instância (Número Enviador) *</Label>
                                <Select
                                    id="id_instancia"
                                    value={formData.id_instancia}
                                    onValueChange={(value) => handleSelectChange('id_instancia', value)}
                                    disabled={isLoading || isLoadingInstances}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingInstances ? "-- Carregando Instâncias --" : "-- Selecione --"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instancesList?.map(instance => (
                                            <SelectItem key={instance.id} value={String(instance.id)}>{instance.nome_exibição || `ID ${instance.id}`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 mt-1">Qual número/conexão enviará esta mensagem.</p>
                            </div>
                            {isEditing && ( // Only show status group if editing
                                <div className="form-group" id="messageStatusGroup">
                                    <Label htmlFor="ativo">Status da Mensagem</Label>
                                    <Select
                                        id="ativo"
                                        value={String(formData.ativo)} // Convert boolean to string for select
                                        onValueChange={(value) => setFormData(prev => ({ ...prev, ativo: value === 'true' }))}
                                        disabled={isLoading}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Ativo (Habilitado)</SelectItem>
                                            <SelectItem value="false">Inativo (Desabilitado)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                             {/* Priority Field - Only visible if editing */}
                            {isEditing && (
                                <div className="form-group" id="messagePriorityGroup">
                                    <Label htmlFor="prioridade">Prioridade</Label>
                                    <Input
                                        id="prioridade"
                                        type="number"
                                        placeholder="1"
                                        value={formData.prioridade}
                                        onChange={handleInputChange}
                                        disabled={isLoading}
                                        min="1" // Assuming priority is 1 or higher
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Define a ordem de envio (menor número = maior prioridade).</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-primary border-b border-gray-200 pb-3 mb-4">Conteúdo da Mensagem</h3>
                        <div className="form-group">
                            <Label htmlFor="modelo_mensagem">Texto da Mensagem Principal *</Label>
                            <div className="flex items-start gap-2">
                                <Textarea
                                    id="modelo_mensagem"
                                    ref={messageTextRef}
                                    rows={8}
                                    placeholder="Digite a mensagem principal. Use {variaveis}, *para negrito*, _para itálico_..."
                                    value={formData.modelo_mensagem}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    className="flex-grow"
                                />
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent form submission
                                                    const picker = emojiPickerRef.current;
                                                    if (picker) {
                                                        const isVisible = picker.style.display !== 'none';
                                                        picker.style.display = isVisible ? 'none' : 'block';
                                                        if (!isVisible) {
                                                            // Position picker near the button
                                                            const btnRect = (e.target as HTMLElement).closest('button')?.getBoundingClientRect();
                                                            if (btnRect) {
                                                                picker.style.position = 'absolute';
                                                                picker.style.top = `${window.scrollY + btnRect.bottom + 5}px`;
                                                                picker.style.left = `${window.scrollX + btnRect.left}px`;
                                                                picker.style.zIndex = '1050';
                                                            }
                                                            // Try to focus search input
                                                            setTimeout(() => {
                                                                try {
                                                                    const searchInput = picker.shadowRoot?.querySelector('input[type=search]');
                                                                    if(searchInput) searchInput.focus();
                                                                } catch(e) { console.warn("Could not focus emoji picker search:", e); }
                                                            }, 100);
                                                        }
                                                    }
                                                }}
                                                disabled={isLoading}
                                                id="emojiBtn" // Keep ID for global listener if needed
                                            >
                                                <Smile className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Inserir Emoji</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>

                        <div className="tokens-container bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                             <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Tags className="h-5 w-5 text-primary" /> Variáveis Disponíveis (clique para inserir):</p>
                             <div id="tokensList" className="flex flex-wrap gap-2">
                                {Object.keys(placeholderData).map(key => (
                                    <span
                                        key={key}
                                        className="token-badge bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm cursor-pointer hover:bg-blue-200 transition-colors"
                                        data-token={`{${key}}`}
                                        onClick={handleTokenClick}
                                    >
                                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </span>
                                ))}
                             </div>
                        </div>

                        {/* Media Upload and Preview */}
                        <div className="form-group">
                            <Label htmlFor="messageMedia">Anexar Mídia (Opcional)</Label>
                            <Input
                                id="messageMedia"
                                type="file"
                                accept="image/*,video/*,audio/*" // Allow more types based on HTML comment
                                onChange={handleMediaFileChange}
                                disabled={isLoading || uploadMediaMutation.isLoading}
                            />
                            <p className="text-xs text-gray-500 mt-1">Imagem (JPG, PNG, GIF, WEBP - máx 5MB), Vídeo (MP4, WEBM, MOV - máx 10MB), Áudio (MP3, OGG, WAV - máx 10MB).</p>

                            <div id="mediaPreviewContainer" className={cn("image-preview-container mt-4 p-4 border border-dashed rounded-md bg-gray-50 flex-col items-center justify-center", (!selectedMediaFile && !existingMediaKey && !mediaViewLoading) && 'hidden')}>
                                {uploadMediaMutation.isLoading && (
                                     <div className="flex flex-col items-center mb-4">
                                         <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                         <span className="text-sm text-gray-700">Enviando mídia...</span>
                                     </div>
                                )}
                                {mediaViewLoading && (
                                     <div className="flex flex-col items-center mb-4">
                                         <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                         <span className="text-sm text-gray-700">Carregando mídia salva...</span>
                                     </div>
                                )}
                                {/* Placeholder text */}
                                <span id="mediaPlaceholderText" className={cn("text-gray-700 italic", (selectedMediaFile || existingMediaKey || uploadMediaMutation.isLoading || mediaViewLoading) && 'hidden')}>Nenhuma mídia selecionada</span>

                                {/* Preview for NEW file */}
                                {selectedMediaFile && (
                                     <img id="mediaPreview" src={URL.createObjectURL(selectedMediaFile)} alt="Preview Nova Mídia" className="max-w-[300px] max-h-[250px] object-contain border border-gray-300 rounded-md mb-2" />
                                )}

                                {/* Preview for EXISTING file (handled by fetchAndDisplaySavedMedia) */}
                                {/* Dynamic element will be inserted into dynamicMediaElementContainer by fetchAndDisplaySavedMedia */}
                                <img id="currentMediaPreview" src="" alt="Mídia Salva" className="max-w-[300px] max-h-[250px] object-contain border border-gray-300 rounded-md mb-2 hidden" />
                                <div id="dynamicMediaElementContainer"></div> {/* Container for dynamic video/audio/link */}


                                {/* Info about current/saved media */}
                                <span id="currentMediaInfo" className="text-sm text-gray-600 mt-1 hidden"></span>

                                {/* View Saved Media Button (only if existingMediaKey and not loading) */}
                                {existingMediaKey && !mediaViewLoading && !selectedMediaFile && (
                                     <Button
                                         type="button"
                                         variant="outline"
                                         size="sm"
                                         onClick={() => fetchAndDisplaySavedMedia(existingMediaKey)}
                                         className="mt-2"
                                         id="viewMediaBtn"
                                     >
                                         <Eye className="h-4 w-4 mr-1" /> Visualizar Mídia Salva
                                     </Button>
                                )}
                            </div>
                        </div>

                        {/* Variations Section - HIDDEN FOR NOW */}
                        {/*
                        <div className="mt-6 pt-6 border-t border-gray-200">
                             <Button type="button" variant="outline" size="sm" onClick={() => setShowVariations(!showVariations)} id="manageVariationsBtn">
                                 <MessagesSquare className="h-4 w-4 mr-2" /> Gerenciar Variações (<span id="variationsCount">0</span>/5)
                             </Button>
                             <p className="text-xs text-gray-500 mt-1">Clique para exibir/editar versões alternativas desta mensagem.</p>

                             {showVariations && (
                                 <div id="variationsContainer" className="border border-dashed border-gray-300 rounded-md p-4 mt-4 bg-gray-50">
                                     <h4 className="text-md font-semibold mb-4">Variações da Mensagem</h4>
                                     <div className="form-group">
                                         <Label>Mensagem Original (Base para IA)</Label>
                                         <div id="originalMessageDisplayInline" className="bg-gray-200 text-gray-800 p-3 rounded-md text-sm whitespace-pre-wrap break-words border border-gray-300">
                                             {formData.modelo_mensagem || '(Mensagem principal vazia)'}
                                         </div>
                                     </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                         {[1, 2, 3, 4, 5].map(slot => (
                                             <div key={slot} className="form-group variation-group">
                                                 <Label htmlFor={`variacao_${slot}`}>Variação {slot}</Label>
                                                 <div className="flex items-start gap-2">
                                                     <Textarea
                                                         id={`variacao_${slot}` as keyof typeof formData}
                                                         name={`variacao_${slot}`}
                                                         rows={3}
                                                         placeholder={`Variação ${slot}...`}
                                                         value={formData[`variacao_${slot}` as keyof typeof formData] || ''}
                                                         onChange={handleInputChange}
                                                         disabled={isLoading}
                                                         className="flex-grow variation-textarea"
                                                     />
                                                     <TooltipProvider>
                                                         <Tooltip>
                                                             <TooltipTrigger asChild>
                                                                 <Button
                                                                     type="button"
                                                                     variant="outline"
                                                                     size="icon"
                                                                     onClick={() => handleAiVariationClick(slot)}
                                                                     disabled={isLoading || aiLoadingSlot === slot || !formData.modelo_mensagem.trim() || !formData.categoria}
                                                                     className="generate-ai-btn"
                                                                 >
                                                                     {aiLoadingSlot === slot ? (
                                                                          <Loader2 className="h-4 w-4 animate-spin" />
                                                                     ) : (
                                                                          <Zap className="h-4 w-4" />
                                                                     )}
                                                                 </Button>
                                                             </TooltipTrigger>
                                                             <TooltipContent><p>Sugerir com IA</p></TooltipContent>
                                                         </Tooltip>
                                                         <Tooltip>
                                                             <TooltipTrigger asChild>
                                                                 <Button
                                                                     type="button"
                                                                     variant="destructive"
                                                                     size="icon"
                                                                     onClick={() => handleClearVariationClick(slot)}
                                                                     disabled={isLoading}
                                                                     className="clear-variation-btn"
                                                                 >
                                                                     <Trash2 className="h-4 w-4" />
                                                                 </Button>
                                                             </TooltipTrigger>
                                                             <TooltipContent><p>Limpar Variação</p></TooltipContent>
                                                         </Tooltip>
                                                     </TooltipProvider>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                        </div>
                        */}
                    </div>

                    <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-primary border-b border-gray-200 pb-3 mb-4">Disparador e Condições</h3>

                        {/* Service Selection Group (Visible unless category is Aniversário) */}
                        {isServiceSelectionVisible && (
                            <div className="form-group" id="serviceSelectionGroup">
                                <Label htmlFor="serviceSelect">Serviços Vinculados *</Label>
                                {/* Replaced select with shadcn Popover/Command/Checkbox */}
                                <Popover open={isServiceSelectOpen} onOpenChange={setIsServiceSelectOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isServiceSelectOpen}
                                            className="w-full justify-between"
                                            disabled={isLoading || isLoadingServices || isLoadingLinkedServices || servicesError !== undefined || linkedServicesError !== undefined}
                                        >
                                            {selectedServiceIds.length === 0
                                                ? (isLoadingServices || isLoadingLinkedServices ? "Carregando serviços..." : "Selecione os serviços...")
                                                : `${selectedServiceIds.length} serviço(s) selecionado(s)`}
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[calc(100%-3rem)] p-0"> {/* Adjust width */}
                                        <Command>
                                            <CommandInput placeholder="Buscar serviço..." />
                                            <CommandList>
                                                {isLoadingServices || isLoadingLinkedServices ? (
                                                    <CommandEmpty>
                                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                        <span className="ml-2">Carregando serviços...</span>
                                                    </CommandEmpty>
                                                ) : servicesError || linkedServicesError ? (
                                                     <CommandEmpty>
                                                         <TriangleAlert className="h-6 w-6 text-red-500" />
                                                         <span className="ml-2 text-red-600">Erro ao carregar serviços.</span>
                                                     </CommandEmpty>
                                                ) : (servicesList?.length ?? 0) === 0 ? (
                                                     <CommandEmpty>Nenhum serviço disponível.</CommandEmpty>
                                                ) : (
                                                    <CommandGroup>
                                                        {servicesList?.map(service => (
                                                            <CommandItem
                                                                key={service.id}
                                                                value={service.nome || `Serviço ${service.id}`} // Use name for search value
                                                                onSelect={() => {
                                                                    const isSelected = selectedServiceIds.includes(service.id);
                                                                    handleServiceSelectChange(service.id, !isSelected);
                                                                }}
                                                            >
                                                                <Checkbox
                                                                    checked={selectedServiceIds.includes(service.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        handleServiceSelectChange(service.id, !!checked);
                                                                    }}
                                                                    className="mr-2"
                                                                />
                                                                {service.nome}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                )}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <p className="text-xs text-gray-500 mt-1">Quais agendamentos de serviço ativarão esta mensagem.</p>
                                {/* Removed loading/error messages here as they are handled inside the Popover */}
                            </div>
                        )}


                        {/* Scheduled Time Group (Visible only for Confirmar Agendamento) */}
                        {formData.categoria === 'Confirmar Agendamento' && (
                            <div className="form-group" id="scheduledTimeGroup">
                                <Label htmlFor="hora_envio">Hora Programada (Confirmação) *</Label>
                                <Select
                                    id="hora_envio"
                                    value={formData.hora_envio}
                                    onValueChange={(value) => handleSelectChange('hora_envio', value)}
                                    disabled={isLoading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="-- Selecione a Hora * --" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Example times - populate dynamically if needed */}
                                        <SelectItem value="08:00">08:00</SelectItem>
                                        <SelectItem value="08:30">08:30</SelectItem>
                                        <SelectItem value="09:00">09:00</SelectItem>
                                        <SelectItem value="09:30">09:30</SelectItem>
                                        <SelectItem value="10:00">10:00</SelectItem>
                                        <SelectItem value="10:30">10:30</SelectItem>
                                        <SelectItem value="11:00">11:00</SelectItem>
                                        <SelectItem value="11:30">11:30</SelectItem>
                                        <SelectItem value="12:00">12:00</SelectItem>
                                        <SelectItem value="12:30">12:30</SelectItem>
                                        <SelectItem value="13:00">13:00</SelectItem>
                                        <SelectItem value="13:30">13:30</SelectItem>
                                        <SelectItem value="14:00">14:00</SelectItem>
                                        <SelectItem value="14:30">14:30</SelectItem>
                                        <SelectItem value="15:00">15:00</SelectItem>
                                        <SelectItem value="15:30">15:30</SelectItem>
                                        <SelectItem value="16:00">16:00</SelectItem>
                                        <SelectItem value="16:30">16:30</SelectItem>
                                        <SelectItem value="17:00">17:00</SelectItem>
                                        <SelectItem value="17:30">17:30</SelectItem>
                                        <SelectItem value="18:00">18:00</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 mt-1">Hora de envio da mensagem de lembrete/confirmação.</p>
                            </div>
                        )}


                        {/* Birthday Time Group (Visible only for Aniversário) */}
                        {formData.categoria === 'Aniversário' && (
                            <div className="form-group" id="birthdayTimeGroup">
                                <Label htmlFor="hora_envio_aniversario">Hora de Envio (Aniversário) *</Label>
                                <Select
                                    id="hora_envio_aniversario" // Use a different ID if needed, or handle logic based on category
                                    value={formData.hora_envio} // Still maps to hora_envio in state
                                    onValueChange={(value) => handleSelectChange('hora_envio', value)}
                                    disabled={isLoading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="-- Selecione a Hora * --" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Example times - populate dynamically if needed */}
                                        <SelectItem value="08:00">08:00</SelectItem>
                                        <SelectItem value="09:00">09:00</SelectItem>
                                        <SelectItem value="10:00">10:00</SelectItem>
                                        <SelectItem value="11:00">11:00</SelectItem>
                                        <SelectItem value="12:00">12:00</SelectItem>
                                        <SelectItem value="12:30">12:30</SelectItem>
                                        <SelectItem value="13:00">13:00</SelectItem>
                                        <SelectItem value="13:30">13:30</SelectItem>
                                        <SelectItem value="14:00">14:00</SelectItem>
                                        <SelectItem value="14:30">14:30</SelectItem>
                                        <SelectItem value="15:00">15:00</SelectItem>
                                        <SelectItem value="15:30">15:30</SelectItem>
                                        <SelectItem value="16:00">16:00</SelectItem>
                                        <SelectItem value="16:30">16:30</SelectItem>
                                        <SelectItem value="17:00">17:00</SelectItem>
                                        <SelectItem value="17:30">17:30</SelectItem>
                                        <SelectItem value="18:00">18:00</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 mt-1">Hora de envio da mensagem de aniversário.</p>
                            </div>
                        )}


                        {/* Target Type Group (Visible only for Chegou/Liberado) */}
                        {(formData.categoria === 'Chegou' || formData.categoria === 'Liberado') && (
                            <div className="form-group" id="targetTypeGroup">
                                 <Label htmlFor="targetTypeSelect">Enviar Para * <span className="text-xs text-gray-500">(Apenas Chegou/Liberado)</span></Label>
                                 <Select
                                     id="targetTypeSelect"
                                     value={formData.para_grupo ? 'Grupo' : (formData.para_cliente ? 'Cliente' : (formData.para_funcionario ? 'Funcionário' : 'Grupo'))}
                                     onValueChange={handleTargetTypeChange}
                                     disabled={isLoading}
                                 >
                                     <SelectTrigger>
                                         <SelectValue placeholder="Selecione..." />
                                     </SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="Grupo">Grupo do WhatsApp</SelectItem>
                                         <SelectItem value="Cliente">Cliente (Mensagem Direta)</SelectItem>
                                         <SelectItem value="Funcionário">Funcionário (Mensagem Direta)</SelectItem>
                                     </SelectContent>
                                 </Select>
                                 <p className="text-xs text-gray-500 mt-1">Escolha se a mensagem vai para um grupo específico, direto para o cliente ou para o funcionário do agendamento.</p>
                             </div>
                        )}


                        {/* Group Selection Group (Visible only if Target Type is Grupo for Chegou/Liberado) */}
                        {/* Conditional rendering based on category AND target type */}
                        {(formData.categoria === 'Chegou' || formData.categoria === 'Liberado') && formData.para_grupo && (
                            <div className="form-group" id="groupSelectionGroup">
                                <Label htmlFor="grupo">Grupo Alvo * <span className="text-xs text-gray-500">(Se 'Enviar Para' for Grupo)</span></Label>
                                <Select
                                    id="grupo"
                                    value={formData.grupo}
                                    onValueChange={(value) => handleSelectChange('grupo', value)}
                                    disabled={isLoading || isLoadingGroups || !formData.id_instancia} // Disable if loading groups or no instance
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingGroups ? "-- Carregando Grupos --" : "-- Selecione --"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groupsList?.map(group => (
                                            <SelectItem key={group.id_grupo} value={String(group.id_grupo)}>{group.nome_grupo}</SelectItem>
                                        ))}
                                        {!isLoadingGroups && groupsList?.length === 0 && (
                                             <SelectItem value="" disabled>Nenhum grupo disponível</SelectItem>
                                        )}
                                         {groupsError && (
                                             <SelectItem value="" disabled>Erro ao carregar grupos</SelectItem>
                                         )}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 mt-1">Grupo do WhatsApp onde a mensagem será enviada.</p>
                            </div>
                        )}

                    </div>

                    <div className="form-actions flex justify-end gap-4 mt-6">
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading || !!pageError}> {/* Control disabled state */}
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {saveMessageMutation.isLoading ? 'Salvando...' : uploadMediaMutation.isLoading ? 'Enviando Mídia...' : 'Carregando...'}
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" /> Salvar Alterações
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            )}

            {/* Emoji Picker Element */}
            <emoji-picker ref={emojiPickerRef} style={{ position: 'absolute', display: 'none', zIndex: 1050 }}></emoji-picker>

        </div>
    );
};

export default MensagensConfigPage;