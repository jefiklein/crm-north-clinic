import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Using shadcn Switch for active status
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, TriangleAlert, Info, MessagesSquare, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff, TagIcon, CalendarClock, Gift, User, Users, Reply, CheckCircle2, CalendarMinus, CalendarPlus, MapPin, DoorOpen, Save, XCircle, Smile, Magic, FileText, DollarSign, Briefcase, ClipboardList, Bell, BarChart2, CreditCard, Package, ShoppingCart, Truck, Phone, Mail, Globe, Home, HelpCircle, Book, Folder, Database, Server, Cloud, Code, Terminal, Layers, Grid, List, Table2, Calendar, Clock, Map, Compass, Target, AwardIcon as AwardIconLucide, HeartIcon, StarIcon, SunIcon, MoonIcon, CloudRain, Zap, CoffeeIcon, Feather, Anchor, AtSign, BatteryCharging, BellRing, Bookmark, Box, Camera, Car, Cast, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Chrome, CircleDollarSign, CircleHelp, CircleMinus, CirclePlus, Clock4, CloudDrizzle, CloudFog, CloudHail, CloudLightning, CloudSnow, CloudSun, Code2, Codesandbox, Command, Download, Dribbble, Droplet, ExternalLink, Facebook, Figma, File, FileArchive, FileAudio, FileCode, FileHeart, FileImage, FileJson, FileKey, FileMinus, FileMusic, FileOutput, FilePlus, FileQuestion, FileSearch, FileSpreadsheet, FileStack, FileSymlink, FileTerminal, FileType, FileUp, FileWarning, FileX, Filter, Flag, FolderArchive, FolderDot, FolderGit2, FolderGit, FolderOpen, FolderRoot, FolderSearch, FolderSymlink, FolderTree, Frown, Gamepad2, Gauge, Gem, Github, Gitlab, GraduationCap, Handshake, HardDrive, Hash, Headphones, Image, Inbox, InfoIcon, Instagram, Key, Keyboard, Lamp, Laptop, LifeBuoy, Lightbulb, Link2, Linkedin, ListIcon, Lock, LogIn, LogOut, MailIcon, MapIcon, Maximize, Megaphone, Menu, MessageCircle, MessageSquareIcon, Mic, Minimize, Minus, Monitor, MoreHorizontal, MoreVertical, Mountain, Mouse, Music, Navigation, Newspaper, Octagon, Package2, PackageIcon, Paperclip, Pause, PenTool, Percent, PhoneCall, PhoneForwarded, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, PhoneOutgoingIcon, PictureInPicture, PieChart, Pin, Play, Pocket, Power, Printer, Puzzle, QrCode, Radio, Receipt, RectangleHorizontal, RectangleVertical, Redo, RefreshCcw, Repeat, Rocket, Rss, Scale, Scan, Scissors, Search, Send, ServerIcon, SettingsIcon, Share, Shield, ShoppingBag, ShoppingCartIcon, Shuffle, SidebarClose, SidebarOpen, Sigma, Siren, SkipBack, SkipForward, Slack, Slash, SlidersHorizontal, SlidersVertical, Smile, Snowflake, SortAsc, SortDesc, Speaker, Square, Sticker, StopCircle, Store, Sunrise, Sunset, TableIcon, Thermometer, ThumbsDown, ThumbsUp, Ticket, Timer, Tornado, Train, Trash, Trello, TrendingDown, TrendingUp, Triangle, TriangleAlertIcon, TruckIcon, Tv, Twitch, Twitter, Type, Umbrella, Underline, Undo, Unlock, Upload, UploadCloud, UserCheck, UserMinus, UserPlus, UserX, UsersIcon, Utensils, Verified, Video, VideoOff, View, Voicemail, Volume, Volume1, Volume2, VolumeX, Wallet, Wand2, Watch, Waves, Webcam, Wifi, WifiOff, Wind, X, Youtube, ZapIcon, ZoomIn, ZoomOut, MailOpen, Smartphone, BadgeDollarSign } from 'lucide-react'; // Using Lucide React for icons
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils'; // Utility for class names
import { showSuccess, showError, showToast } from '@/utils/toast'; // Using our toast utility
import Choices from 'choices.js'; // Import Choices.js
import 'choices.js/public/assets/styles/choices.min.css'; // Import Choices.js styles
import 'emoji-picker-element'; // Import the web component

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a message item fetched from Supabase
interface MessageItem {
    id: number;
    categoria: string;
    modelo_mensagem: string | null;
    midia_mensagem: string | null; // This will store the file key/path
    id_instancia: number | null | string;
    grupo: string | null; // Stores group ID/name if target is group
    ativo: boolean;
    hora_envio: string | null; // HH:mm format
    intervalo: number | null;
    id_clinica: number;
    variacao_1: string | null;
    variacao_2: string | null;
    variacao_3: string | null;
    variacao_4: string | null;
    variacao_5: string | null;
    para_funcionario: boolean; // Target type flags
    para_grupo: boolean;
    para_cliente: boolean;
    url_arquivo: string | null; // Redundant? Use midia_mensagem? Let's use midia_mensagem
    prioridade: number;
    created_at: string;
    updated_at: string;
}

// Define the structure for Instance Info from Supabase
interface InstanceInfo {
    id: number | string;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null; // Technical name for Evolution API
}

// Define the structure for Service Info from Supabase
interface ServiceItem {
    id: number;
    nome: string | null;
    // Add other service fields if needed
}

// Define the structure for Group Info from webhook
interface GroupInfo {
    id_grupo: string; // Assuming group ID is string
    nome_grupo: string;
}


interface MensagensConfigPageProps {
    clinicData: ClinicData | null;
}

// Webhook URLs (from the provided HTML)
const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const GET_INSTANCES_URL = `${N8N_BASE_URL}/webhook/469bd748-c728-4ba9-8a3f-64b55984183b`;
const GET_SERVICES_URL = `${N8N_BASE_URL}/webhook/fd13f63f-8fae-4e1b-996e-c42c1ba9d7ae`;
const GET_GROUPS_URL = `${N8N_BASE_URL}/webhook/29203acf-7751-4b18-8d69-d4bdb380810e`;
const GET_LINKED_SERVICES_URL = `${N8N_BASE_URL}/webhook/1e9c1d33-c815-4afb-8317-40195863ab3a`;
const SAVE_MESSAGE_URL_CREATE = `${N8N_BASE_URL}/webhook/542ce8db-6b1d-40f5-b58b-23c9154c424d`;
const SAVE_MESSAGE_URL_UPDATE = `${N8N_BASE_URL}/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4`;
const GET_MESSAGE_DETAILS_URL = `${N8N_BASE_URL}/webhook/4dd9fe07-8863-4993-b21f-7e741993d6d19`; // Placeholder - ADJUST THIS URL
const GENERATE_PREVIEW_URL = `${N8N_BASE_URL}/webhook/ajustar-mensagem-modelo`; // Placeholder - ADJUST THIS URL
const AI_VARIATION_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/225ecff5-6081-466f-a0d7-9cfe3ea2ce84`;
const UPLOAD_SUPABASE_URL = 'https://north-clinic-n8n.hmvvay.easypanel.host/webhook/enviar-para-supabase'; // Placeholder - ADJUST THIS URL
const GET_SIGNED_URL_WEBHOOK = 'https://north-clinic-n8n.hmvvay.easypanel.host/webhook/recuperar-arquivo'; // Placeholder - ADJUST THIS URL


// Required permission level for this page (assuming from HTML context)
const REQUIRED_PERMISSION_LEVEL = 2;

// Constants for categories and data (from the provided HTML)
const orderedCategories = [ 'Agendou', 'Confirmar Agendamento', 'Responder Confirmar Agendamento', 'Faltou', 'Finalizou Atendimento', 'Aniversário', 'Chegou', 'Liberado' ];
const categoryInfo: { [key: string]: { icon: string; description: string } } = {
    'Agendou': { icon: 'fa-calendar-plus', description: 'Mensagem enviada após a criação de um novo agendamento.' },
    'Confirmar Agendamento': { icon: 'fa-calendar-check', description: 'Enviada X horas/dias antes para solicitar confirmação.' },
    'Responder Confirmar Agendamento': { icon: 'fa-reply', description: 'Enviada após o cliente confirmar presença (status "Confirmado").' },
    'Faltou': { icon: 'fa-calendar-minus', description: 'Enviada quando o status do agendamento muda para "Não Compareceu".' },
    'Finalizou Atendimento': { icon: 'fa-check-circle', description: 'Enviada após a conclusão/registro do atendimento.' },
    'Aniversário': { icon: 'fa-birthday-cake', description: 'Enviada automaticamente no dia do aniversário do cliente.' },
    'Chegou': { icon: 'fa-map-marker-alt', description: 'Enviada quando o status do agendamento muda para "Cliente Chegou".' },
    'Liberado': { icon: 'fa-door-open', description: 'Enviada após a finalização da sessão ou consulta (status "Finalizado").' }
};
const placeholderData = {
    primeiro_nome_cliente: "Maria",
    nome_completo_cliente: "Maria Souza",
    primeiro_nome_funcionario: "Silva",
    nome_completo_funcionario: "Dr(a). João Silva",
    nome_servico_principal: "Consulta Inicial",
    lista_servicos: "Consulta Inicial, Exame Simples",
    data_agendamento: "19/04/2025", // DD/MM/YYYY
    dia_agendamento_num: "19",
    dia_semana_relativo_extenso: "sábado",
    mes_agendamento_num: "04",
    mes_agendamento_extenso: "Abril",
    hora_agendamento: "15:30" // HH:mm
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


const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const messageId = searchParams.get('id');
    const isEditing = !!messageId;

    const clinicCode = clinicData?.code;
    const clinicId = clinicData?.id; // Assuming clinicData has an 'id' field
    const userPermissionLevel = parseInt(String(clinicData?.id_permissao), 10);
    const hasPermission = !isNaN(userPermissionLevel) && userPermissionLevel >= REQUIRED_PERMISSION_LEVEL;

    // --- State for Form Fields ---
    const [category, setCategory] = useState('');
    const [instanceId, setInstanceId] = useState<string>(''); // Store as string to match select value
    const [messageText, setMessageText] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]); // Store as numbers
    const [scheduledTime, setScheduledTime] = useState(''); // HH:mm
    const [targetType, setTargetType] = useState('Grupo'); // Default to Grupo
    const [groupId, setGroupId] = useState(''); // Store group ID
    const [variations, setVariations] = useState<string[]>(['', '', '', '', '']); // Array for 5 variations
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [existingMediaKey, setExistingMediaKey] = useState<string | null>(null); // Key of media already saved

    // --- State for UI Control ---
    const [showVariations, setShowVariations] = useState(false);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null); // URL for previewing new/existing media
    const [isMediaLoading, setIsMediaLoading] = useState(false); // Loading state for media preview/upload

    // --- Refs for External Libraries ---
    const serviceSelectRef = useRef<HTMLSelectElement>(null);
    const choicesServicesRef = useRef<Choices | null>(null);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    const emojiPickerRef = useRef<any>(null); // Type 'any' for web component

    // --- Data Fetching ---

    // Fetch Instances
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListConfigPage', clinicCode],
        queryFn: async () => {
            if (!clinicCode) throw new Error("Código da clínica não disponível.");
            const response = await fetch(GET_INSTANCES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ codigo_clinica: clinicCode })
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar instâncias: ${errorText.substring(0, 100)}...`);
            }
            const data = await response.json();
            if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.data)) {
                 return data.data as InstanceInfo[];
             } else if (Array.isArray(data)) {
                 return data as InstanceInfo[];
             } else {
                 throw new Error("Formato inesperado da lista de instâncias.");
             }
        },
        enabled: hasPermission && !!clinicCode,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch Services
    const { data: availableServices, isLoading: isLoadingServices, error: servicesError } = useQuery<ServiceItem[]>({
        queryKey: ['availableServicesConfigPage', clinicCode],
        queryFn: async () => {
            if (!clinicCode) throw new Error("Código da clínica não disponível.");
            const response = await fetch(GET_SERVICES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo_clinica: clinicCode }) });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status} ao buscar serviços: ${errorText.substring(0, 100)}...`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                 throw new Error("Formato de resposta inválido para serviços.");
             }
            return data.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        },
        enabled: hasPermission && !!clinicCode,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch Message Details (if editing)
    const { data: messageDetails, isLoading: isLoadingMessageDetails, error: messageDetailsError } = useQuery<MessageItem>({
        queryKey: ['messageDetails', messageId],
        queryFn: async () => {
            if (!messageId || !clinicCode) throw new Error("ID da mensagem ou código da clínica não disponível.");
            if (!GET_MESSAGE_DETAILS_URL || GET_MESSAGE_DETAILS_URL.includes('seu-endpoint-get-message-details')) {
                 console.error("!!!!!!!!! URL GET_MESSAGE_DETAILS_URL NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para buscar detalhes da mensagem não configurado.");
             }
            const response = await fetch(GET_MESSAGE_DETAILS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_mensagem: messageId, codigo_clinica: clinicCode })
            });
            if (!response.ok) {
                 const errorText = await response.text();
                throw new Error(`Erro ${response.status} ao buscar detalhes da mensagem: ${errorText || response.statusText}`);
            }
            const data = await response.json();
             if (!data || typeof data !== 'object' || typeof data.id_instancia === 'undefined' || typeof data.categoria === 'undefined' || typeof data.modelo_mensagem === 'undefined') {
                 console.warn("[fetchMessageDetails] Response data structure might be invalid:", data);
                 throw new Error("Formato de resposta inválido para detalhes da mensagem recebidos.");
            }
            return data as MessageItem;
        },
        enabled: hasPermission && isEditing && !!clinicCode,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch Linked Services (if editing)
    const { data: linkedServices, isLoading: isLoadingLinkedServices, error: linkedServicesError } = useQuery<number[]>({
        queryKey: ['linkedServices', messageId],
        queryFn: async () => {
            if (!messageId) return [];
             if (!GET_LINKED_SERVICES_URL || GET_LINKED_SERVICES_URL.includes('seu-webhook-real-para-servicos-vinculados')) {
                 console.error("!!!!!!!!! URL GET_LINKED_SERVICES_URL NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para buscar serviços vinculados não configurado.");
             }
            const response = await fetch(GET_LINKED_SERVICES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_mensagem: messageId }) });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar serviços vinculados: ${errorText.substring(0, 100)}...`);
            }
            const data = await response.json();
            if (Array.isArray(data)) {
                 return data
                     .map(item => (typeof item === 'object' && item !== null && typeof item.id_servico !== 'undefined') ? parseInt(item.id_servico, 10) : parseInt(item, 10))
                     .filter(id => !isNaN(id));
             } else {
                 throw new Error("Formato de resposta inválido para serviços vinculados.");
             }
        },
        enabled: hasPermission && isEditing && !!messageDetails, // Only fetch if message details are loaded
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch Groups (dependent on selected instance and category)
    const { data: groupsList, isLoading: isLoadingGroups, error: groupsError } = useQuery<GroupInfo[]>({
        queryKey: ['groupsList', instanceId], // Key depends on selected instance
        queryFn: async () => {
            if (!instanceId) return []; // Don't fetch if no instance selected

            const selectedInstance = instancesList?.find(inst => String(inst.id) === String(instanceId));
            const evolutionInstanceName = selectedInstance?.nome_instancia_evolution;

            if (!evolutionInstanceName) {
                 console.warn("[fetchGroups] Selected instance has no evolution name:", selectedInstance);
                 showToast(`Instância '${selectedInstance?.nome_exibição || instanceId}' não tem nome Evolution configurado.`, "error");
                 return [];
            }

             if (!GET_GROUPS_URL || GET_GROUPS_URL.includes('seu-webhook-real-para-grupos')) {
                 console.error("!!!!!!!!! URL GET_GROUPS_URL NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para buscar grupos não configurado.");
             }

            const response = await fetch(GET_GROUPS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome_instancia_evolution: evolutionInstanceName }) });

            if (!response.ok) {
                 let errorDetails = `Erro HTTP ${response.status}`;
                 try {
                     const text = await response.text();
                      try { errorDetails = JSON.parse(text).message || text; } catch (e) { errorDetails = text || response.statusText; }
                 } catch (e) { errorDetails = response.statusText; }
                 console.error(`[fetchGroups] HTTP Error ${response.status}:`, errorDetails);
                 throw new Error(`Erro ${response.status} ao buscar grupos`);
             }

            const data = await response.json();
            if (!Array.isArray(data)) {
                 console.error("[fetchGroups] Invalid response format (expected array):", data);
                 throw new Error("Resposta da API de grupos inválida (não é array).");
             }
            return data as GroupInfo[];
        },
        enabled: hasPermission && !!instanceId && (category === 'Chegou' || category === 'Liberado'), // Only fetch if instance selected AND category requires group
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });


    // --- Mutations ---

    // Mutation for saving the message
    const saveMessageMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const url = isEditing ? SAVE_MESSAGE_URL_UPDATE : SAVE_MESSAGE_URL_CREATE;
             if (!url || url.includes('seu-webhook-real-para-salvar')) {
                 console.error("!!!!!!!!! URL SAVE_MESSAGE_URL NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para salvar mensagem não configurado.");
             }
            const response = await fetch(url, { method: 'POST', body: formData });
            if (!response.ok) {
                let errorMessage = `Falha ao salvar (Status: ${response.status})`;
                 try { const responseBody = await response.text(); errorMessage = JSON.parse(responseBody).message || responseBody; } catch (e) {}
                 throw new Error(`Erro ${response.status}: ${errorMessage}`);
             }
            return response.json();
        },
        onSuccess: () => {
            showSuccess(`Mensagem ${isEditing ? 'atualizada' : 'criada'} com sucesso! Redirecionando...`);
            // Redirect to list page
            const listPageUrl = `/dashboard/11?clinic_code=${encodeURIComponent(clinicCode || '')}&status=${isEditing ? 'updated' : 'created'}`;
            navigate(listPageUrl);
        },
        onError: (error: Error) => {
            showError(`Erro ao salvar mensagem: ${error.message}`);
        },
    });

    // Mutation for media upload
    const uploadMediaMutation = useMutation({
        mutationFn: async (file: File) => {
             if (!UPLOAD_SUPABASE_URL || UPLOAD_SUPABASE_URL.includes('seu-webhook-real-para-upload')) {
                 console.error("!!!!!!!!! URL UPLOAD_SUPABASE_URL NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para upload de mídia não configurado.");
             }
            const uploadFormData = new FormData();
            uploadFormData.append('data', file, file.name);
            if (file.name) uploadFormData.append('fileName', file.name);
            if (clinicCode) uploadFormData.append('clinicId', clinicCode);

            const response = await fetch(UPLOAD_SUPABASE_URL, { method: 'POST', body: uploadFormData });
            if (!response.ok) {
                let errorDetails = `Erro ${response.status}`;
                 try { const text = await response.text(); errorDetails = (JSON.parse(text).message || text); } catch (e) { errorDetails = await response.text().catch(() => response.statusText); }
                 throw new Error(`Falha no upload da mídia: ${errorDetails}`);
            }
            const uploadResult = await response.json();
            let fileKeyFromResult = null;
            if (Array.isArray(uploadResult) && uploadResult.length > 0 && typeof uploadResult[0] === 'object' && uploadResult[0] !== null) {
                 if (typeof uploadResult[0].Key === 'string' && uploadResult[0].Key) { fileKeyFromResult = uploadResult[0].Key; }
                 else if (typeof uploadResult[0].key === 'string' && uploadResult[0].key) { fileKeyFromResult = uploadResult[0].key; }
            } else if (typeof uploadResult === 'object' && uploadResult !== null) {
                 if (typeof uploadResult.Key === 'string' && uploadResult.Key) { fileKeyFromResult = uploadResult.Key; }
                 else if (typeof uploadResult.key === 'string' && uploadResult.key) { fileKeyFromResult = uploadResult.key; }
            }
             if (!fileKeyFromResult) {
                 console.error("[uploadMediaMutation] Could not extract 'Key' or 'key' from upload response structure:", uploadResult);
                 throw new Error("Resposta do upload inválida (Key não encontrada na estrutura esperada).");
            }
            return fileKeyFromResult; // Return the file key
        },
        onSuccess: (fileKey) => {
            setExistingMediaKey(fileKey); // Save the new file key
            setMediaFile(null); // Clear the file input state
            setMediaPreviewUrl(null); // Clear the temporary preview URL
            showSuccess("Mídia enviada com sucesso!");
            setIsMediaLoading(false);
        },
        onError: (error: Error) => {
            showError(`Erro no upload da mídia: ${error.message}`);
            setIsMediaLoading(false);
            setMediaFile(null); // Clear the file input state on error
            setMediaPreviewUrl(null); // Clear the temporary preview URL on error
        },
    });

    // Mutation for fetching signed URL for existing media
    const fetchSignedUrlMutation = useMutation({
        mutationFn: async (fileKey: string) => {
             if (!GET_SIGNED_URL_WEBHOOK || GET_SIGNED_URL_WEBHOOK.includes('seu-webhook-real-para-recuperar-arquivo')) {
                 console.error("!!!!!!!!! URL GET_SIGNED_URL_WEBHOOK NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para recuperar arquivo não configurado.");
             }
            const response = await fetch(GET_SIGNED_URL_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ arquivo_key: fileKey, codigo_clinica: clinicCode })
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar URL assinada: ${errorText || response.statusText}`);
            }
            const result = await response.json();
            if (!result || typeof result.signedUrl !== 'string' || !result.signedUrl) {
                 throw new Error("Resposta inválida do webhook (signedUrl não encontrada).");
            }
            return result.signedUrl;
        },
        onSuccess: (signedUrl) => {
            setMediaPreviewUrl(signedUrl); // Set the signed URL for preview
            setIsMediaLoading(false);
        },
        onError: (error: Error) => {
            showError(`Erro ao carregar mídia salva: ${error.message}`);
            setIsMediaLoading(false);
            setMediaPreviewUrl(null); // Clear preview on error
            setExistingMediaKey(null); // Also clear the key if it failed to load
        },
    });

    // Mutation for AI Variation Generation
    const generateAiVariationMutation = useMutation({
        mutationFn: async ({ slot, baseText, category, description }: { slot: number; baseText: string; category: string; description: string }) => {
             if (!AI_VARIATION_WEBHOOK_URL || AI_VARIATION_WEBHOOK_URL.includes('seu-webhook-real-para-ia')) {
                 console.error("!!!!!!!!! URL AI_VARIATION_WEBHOOK_URL NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para gerar variação com IA não configurado.");
             }
            const requestBody = {
                categoria: category,
                mensagem_base: baseText,
                placeholders: placeholderData,
                descricao_categoria: description
            };
            const response = await fetch(AI_VARIATION_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status}: ${errorText || 'Falha ao gerar variação com IA.'}`);
            }
            const result = await response.json();
            let suggestionText = null;
            if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && result[0] !== null && typeof result[0].output === 'string') {
                 suggestionText = result[0].output;
            }
            if (suggestionText === null || suggestionText.trim() === '') {
                 throw new Error("Resposta da IA inválida ou vazia.");
            }
            return { slot, suggestionText };
        },
        onSuccess: ({ slot, suggestionText }) => {
            setVariations(prev => {
                const newVariations = [...prev];
                newVariations[slot - 1] = suggestionText;
                return newVariations;
            });
            showSuccess(`Sugestão para Variação ${slot} gerada!`);
        },
        onError: (error: Error) => {
            showError(`Erro ao gerar variação com IA: ${error.message}`);
        },
    });

    // Mutation for generating text preview
    const generatePreviewMutation = useMutation({
        mutationFn: async (text: string) => {
             if (!GENERATE_PREVIEW_URL || GENERATE_PREVIEW_URL.includes('seu-webhook-real-para-preview')) {
                 console.error("!!!!!!!!! URL GENERATE_PREVIEW_URL NÃO FOI DEFINIDA CORRETAMENTE !!!!!!!!!");
                 throw new Error("Endpoint para gerar prévia não configurado.");
             }
            const dateStringDDMMYYYY = placeholderData.data_agendamento || "01/01/2025";
            let dateStringYYYYMMDD = "2025-01-01";
            try {
                const parts = dateStringDDMMYYYY.split('/');
                if (parts.length === 3) dateStringYYYYMMDD = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } catch(e) { console.error("Date conversion error in preview:", e); }

            const bodyData = {
                modelo_mensagem: text,
                nome_cliente: placeholderData.nome_completo_cliente || "Cliente Exemplo",
                data_agendamento: dateStringYYYYMMDD,
                hora_agendamento: placeholderData.hora_agendamento || "10:00",
                servicos: placeholderData.lista_servicos || "Serviço Exemplo"
            };

            const response = await fetch(GENERATE_PREVIEW_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText || 'Falha ao buscar prévia.'}`);
            }
            const result = await response.json();
            if (result && typeof result === 'object' && typeof result.mensagem === 'string') {
                 return result.mensagem;
             } else {
                throw new Error("Formato de resposta inesperado do servidor.");
             }
        },
        onSuccess: (previewHtml) => {
            // This mutation is likely used for an inline preview or modal,
            // not directly updating a state variable tied to the main form field.
            // We'll handle displaying this result where needed (e.g., a preview modal).
            console.log("Preview generated successfully:", previewHtml);
            // For now, just log success. A modal/dialog would be needed to display it.
            showToast("Prévia gerada no console (implementação visual futura).", "info");
        },
        onError: (error: Error) => {
            showError(`Erro ao gerar prévia: ${error.message}`);
        },
    });


    // --- Effects ---

    // Effect to initialize Choices.js
    useEffect(() => {
        if (serviceSelectRef.current && availableServices) {
            // Destroy existing instance if it exists
            if (choicesServicesRef.current) {
                choicesServicesRef.current.destroy();
                choicesServicesRef.current = null;
            }

            try {
                const serviceChoices = availableServices.map(service => ({
                    value: service.id.toString(),
                    label: service.nome || `Serviço ID ${service.id}`,
                    // Selection will be handled after messageDetails/linkedServices load
                    selected: false // Default to false here
                }));

                choicesServicesRef.current = new Choices(serviceSelectRef.current, {
                    removeItemButton: true,
                    searchPlaceholderValue: "Buscar serviço...",
                    noResultsText: 'Nenhum serviço encontrado',
                    noChoicesText: 'Sem opções disponíveis ou erro no carregamento',
                    itemSelectText: 'Pressione Enter para selecionar',
                    allowHTML: false,
                    choices: serviceChoices // Provide initial choices
                });

                // Add event listener for Choices.js change
                serviceSelectRef.current.addEventListener('change', handleServiceSelectChange);

                console.log("[useEffect] Choices.js initialized.");

            } catch (e) {
                console.error("Failed Choices.js init:", e);
                showToast("Erro ao carregar seletor de serviços.", "error");
            }
        }

        // Cleanup function
        return () => {
            if (choicesServicesRef.current) {
                // Remove event listener before destroying
                if (serviceSelectRef.current) {
                    serviceSelectRef.current.removeEventListener('change', handleServiceSelectChange);
                }
                choicesServicesRef.current.destroy();
                choicesServicesRef.current = null;
                console.log("[useEffect] Choices.js destroyed.");
            }
        };
    }, [availableServices]); // Re-initialize if availableServices changes

    // Effect to set Choices.js selection after linkedServices load (in edit mode)
    useEffect(() => {
        if (isEditing && choicesServicesRef.current && linkedServices) {
            console.log("[useEffect] Setting Choices.js selection:", linkedServices);
            // Ensure IDs are strings for Choices.js setValue
            const stringLinkedServiceIds = linkedServices.map(id => String(id));
            // Use a timeout to ensure Choices.js is fully ready
            setTimeout(() => {
                 if (choicesServicesRef.current) {
                     try {
                         choicesServicesRef.current.setValue(stringLinkedServiceIds);
                         console.log("[useEffect] Choices.js selection set successfully.");
                     } catch (e) {
                         console.error("Error setting Choices.js selection:", e);
                         showToast("Erro ao pré-selecionar serviços.", "warning");
                     }
                 }
            }, 100); // Small delay
        }
    }, [linkedServices, isEditing]); // Re-run when linkedServices or isEditing changes

    // Effect to populate form fields when messageDetails load (in edit mode)
    useEffect(() => {
        if (isEditing && messageDetails) {
            console.log("[useEffect] Populating form with message details:", messageDetails);
            setCategory(messageDetails.categoria || '');
            setInstanceId(String(messageDetails.id_instancia) || ''); // Ensure string
            setMessageText(messageDetails.modelo_mensagem || '');
            setIsActive(messageDetails.ativo);
            setScheduledTime(messageDetails.hora_envio || '');
            setGroupId(messageDetails.grupo || ''); // Set group ID
            setExistingMediaKey(messageDetails.midia_mensagem || null); // Set existing media key

            // Set target type based on boolean flags
            if (messageDetails.para_cliente) setTargetType('Cliente');
            else if (messageDetails.para_funcionario) setTargetType('Funcionário');
            else setTargetType('Grupo'); // Default

            // Populate variations
            setVariations([
                messageDetails.variacao_1 || '',
                messageDetails.variacao_2 || '',
                messageDetails.variacao_3 || '',
                messageDetails.variacao_4 || '',
                messageDetails.variacao_5 || ''
            ]);

            // Trigger media preview fetch if existing key exists
            if (messageDetails.midia_mensagem) {
                 setIsMediaLoading(true);
                 fetchSignedUrlMutation.mutate(messageDetails.midia_mensagem);
            }

        } else if (!isEditing) {
             // Reset form for add mode
             setCategory('');
             setInstanceId('');
             setMessageText(defaultTemplates[category] || ''); // Set default template based on initial category (if any)
             setIsActive(true);
             setSelectedServiceIds([]);
             setScheduledTime('');
             setTargetType('Grupo');
             setGroupId('');
             setVariations(['', '', '', '', '']);
             setMediaFile(null);
             setExistingMediaKey(null);
             setMediaPreviewUrl(null);
             setIsMediaLoading(false);
             setShowVariations(false); // Hide variations section initially in add mode
        }
    }, [messageDetails, isEditing]); // Re-run when messageDetails or isEditing changes

    // Effect to update message text with default template when category changes in add mode
    useEffect(() => {
        if (!isEditing && category) {
            setMessageText(defaultTemplates[category] || '');
        }
    }, [category, isEditing]);


    // Effect to handle sidebar active item
    useEffect(() => {
        // This page corresponds to menu item ID 11 (Mensagens Automáticas)
        const configMessagesMenuId = '11'; // Use string ID
        const currentPath = location.pathname;

        // Find the sidebar element and its items
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const navItems = sidebar.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.classList.remove('active');
                // Check if the item's data-page matches the current page's ID
                // Also check if the current path starts with the item's target URL (simplified check)
                const itemPageId = item.dataset.page;
                // For the config page, we want the 'Mensagens Automáticas' item (ID 11) to be active
                if (itemPageId === configMessagesMenuId) {
                    item.classList.add('active');
                }
            });
        }
    }, [location.pathname]); // Re-run when the route changes


    // Effect to initialize Emoji Picker
    useEffect(() => {
        const emojiPickerElement = emojiPickerRef.current;
        const emojiButtonElement = emojiBtnRef.current;
        const messageTextElement = document.getElementById('messageText') as HTMLTextAreaElement; // Get textarea by ID

        if (emojiPickerElement && emojiButtonElement && messageTextElement) {
            console.log("[useEffect] Setting up emoji picker listeners.");

            const handleEmojiClick = (event: CustomEvent) => {
                if (event.detail && event.detail.unicode) {
                    const emoji = event.detail.unicode;
                    const { selectionStart, selectionEnd, value } = messageTextElement;
                    messageTextElement.value = value.substring(0, selectionStart) + emoji + value.substring(selectionEnd);
                    const newPos = selectionStart + emoji.length;
                    messageTextElement.selectionStart = newPos;
                    messageTextElement.selectionEnd = newPos;
                    messageTextElement.focus();
                    emojiPickerElement.style.display = 'none';
                    console.log(`[handleEmojiClick] Inserted: ${emoji}`);
                    // Manually trigger input change if needed for preview/state update
                    messageTextElement.dispatchEvent(new Event('input', { bubbles: true }));
                }
            };

            const togglePicker = (event: MouseEvent) => {
                event.stopPropagation();
                const isVisible = emojiPickerElement.style.display !== 'none';
                if (isVisible) {
                    emojiPickerElement.style.display = 'none';
                } else {
                    const btnRect = emojiButtonElement.getBoundingClientRect();
                    emojiPickerElement.style.top = `${window.scrollY + btnRect.bottom + 5}px`;
                    emojiPickerElement.style.left = `${window.scrollX + btnRect.left}px`;
                    emojiPickerElement.style.display = 'block';
                    // Optional: focus search input
                    setTimeout(() => {
                       try {
                           const searchInput = emojiPickerElement.shadowRoot?.querySelector('input[type=search]');
                           if(searchInput) searchInput.focus();
                       } catch(e) { console.warn("Could not focus emoji picker search:", e); }
                    }, 100);
                }
            };

            const handleClickOutside = (event: MouseEvent) => {
                if (emojiPickerElement.style.display !== 'none' &&
                    !emojiPickerElement.contains(event.target as Node) &&
                    !emojiButtonElement.contains(event.target as Node)) {
                    emojiPickerElement.style.display = 'none';
                }
            };

            emojiPickerElement.addEventListener('emoji-click', handleEmojiClick as EventListener);
            emojiButtonElement.addEventListener('click', togglePicker);
            document.addEventListener('click', handleClickOutside);

            console.log("[useEffect] Emoji picker listeners attached.");

            // Cleanup function
            return () => {
                console.log("[useEffect] Cleaning up emoji picker listeners.");
                emojiPickerElement.removeEventListener('emoji-click', handleEmojiClick as EventListener);
                emojiButtonElement.removeEventListener('click', togglePicker);
                document.removeEventListener('click', handleClickOutside);
                // Ensure picker is hidden on unmount
                if (emojiPickerElement) emojiPickerElement.style.display = 'none';
            };
        }
    }, [emojiPickerRef, emojiBtnRef]); // Re-run if refs change


    // --- Handlers ---

    const handleCategoryChange = (value: string) => {
        setCategory(value);
        // Reset category-specific fields when category changes
        setScheduledTime('');
        setTargetType('Grupo'); // Reset target type
        setGroupId(''); // Reset group
        setSelectedServiceIds([]); // Reset services (will be re-selected if editing)
        if (choicesServicesRef.current) {
             choicesServicesRef.current.removeActiveItems(); // Clear selected items in Choices.js UI
        }
        // Hide variations section if it was open
        setShowVariations(false);
    };

    const handleInstanceChange = (value: string) => {
        setInstanceId(value);
        // Reset group when instance changes
        setGroupId('');
    };

    const handleMessageTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageText(e.target.value);
        // Update variations counter if variations section is visible
        if (showVariations) {
             updateVariationsCounter(e.target.value, variations);
        }
    };

    const handleActiveChange = (checked: boolean) => {
        setIsActive(checked);
    };

    const handleServiceSelectChange = () => {
        if (choicesServicesRef.current) {
            // Get selected values from Choices.js instance
            const selected = choicesServicesRef.current.getValue(true); // Returns array of values (strings)
            // Convert to numbers and update state
            const serviceIds = Array.isArray(selected) ? selected.map(idStr => parseInt(String(idStr), 10)).filter(id => !isNaN(id)) : [];
            setSelectedServiceIds(serviceIds);
            console.log("[handleServiceSelectChange] Selected service IDs:", serviceIds);
        }
    };

    const handleScheduledTimeChange = (value: string) => {
        setScheduledTime(value);
    };

    const handleTargetTypeChange = (value: string) => {
        setTargetType(value);
        // Reset group when target type changes
        setGroupId('');
    };

    const handleGroupChange = (value: string) => {
        setGroupId(value);
    };

    const handleVariationChange = (index: number, value: string) => {
        setVariations(prev => {
            const newVariations = [...prev];
            newVariations[index] = value;
            // Update variations counter
            updateVariationsCounter(messageText, newVariations);
            return newVariations;
        });
    };

    const handleClearVariation = (index: number) => {
        setVariations(prev => {
            const newVariations = [...prev];
            newVariations[index] = '';
            // Update variations counter
            updateVariationsCounter(messageText, newVariations);
            return newVariations;
        });
    };

    const handleGenerateAiVariation = (slot: number) => {
        const baseText = messageText;
        const currentCategory = category;
        const description = categoryInfo[currentCategory]?.description || '(Descrição não encontrada)';

        if (!baseText) {
            showToast("Por favor, digite o Texto da Mensagem Principal primeiro.", "warning");
            return;
        }
        if (!currentCategory) {
            showToast("Por favor, selecione uma Categoria primeiro.", "warning");
            return;
        }

        generateAiVariationMutation.mutate({ slot, baseText, category: currentCategory, description });
    };


    const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setMediaFile(file);
        setMediaPreviewUrl(file ? URL.createObjectURL(file) : null); // Create temporary URL for preview
        setExistingMediaKey(null); // Clear existing key if a new file is selected
        setIsMediaLoading(false); // Reset loading state
    };

    const handleRemoveMedia = () => {
        setMediaFile(null);
        setMediaPreviewUrl(null);
        setExistingMediaKey(''); // Set key to empty string to indicate removal on save
        setIsMediaLoading(false);
        // Clear the file input element value
        const fileInput = document.getElementById('messageMedia') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleTokenClick = (token: string) => {
        const textarea = document.getElementById('messageText') as HTMLTextAreaElement;
        if (textarea && token) {
            const { value, selectionStart, selectionEnd } = textarea;
            textarea.value = value.substring(0, selectionStart) + token + value.substring(selectionEnd);
            const newPos = selectionStart + token.length;
            textarea.selectionStart = newPos;
            textarea.selectionEnd = newPos;
            textarea.focus();
            setMessageText(textarea.value); // Update React state
        }
    };

    const handleSave = async () => {
        // --- 1. Validation ---
        let validationError = null;
        if (!category) validationError = "Categoria é obrigatória.";
        else if (!instanceId) validationError = "Instância é obrigatória.";
        else if (!messageText.trim()) validationError = "Texto da mensagem principal é obrigatório.";
        else if (category !== 'Aniversário' && serviceSelectionGroupVisible && selectedServiceIds.length === 0) { validationError = "Pelo menos um serviço deve ser vinculado (exceto para Aniversário)."; }
        else if (category === 'Confirmar Agendamento' && !scheduledTime) { validationError = "Hora de envio (Confirmação) é obrigatória."; }
        else if (category === 'Aniversário' && !scheduledTime) { validationError = "Hora de envio (Aniversário) é obrigatória."; }
        else if ((category === 'Chegou' || category === 'Liberado') && targetType === 'Grupo' && !groupId) { validationError = "Grupo alvo é obrigatório para Chegou/Liberado quando o tipo é Grupo."; }
        else if (mediaFile) {
            const fileSizeMB = mediaFile.size / 1024 / 1024;
            const fileType = mediaFile.type;
            let typeError = null;
            let sizeError = null;

            const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/avi', 'video/mkv'];
            const allowedAudioTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/opus', 'audio/m4a'];

            if (fileType.startsWith('image/')) {
                if (!allowedImageTypes.includes(fileType)) typeError = "Tipo de imagem inválido. Use JPG, PNG, GIF ou WEBP.";
                else if (fileSizeMB > 5) sizeError = `Imagem excede 5MB (${fileSizeMB.toFixed(1)}MB).`;
            } else if (fileType.startsWith('video/')) {
                if (!allowedVideoTypes.includes(fileType)) typeError = "Tipo de vídeo inválido. Use MP4, WEBM, MOV, etc.";
                else if (fileSizeMB > 10) sizeError = `Vídeo excede 10MB (${fileSizeMB.toFixed(1)}MB).`;
            } else if (fileType.startsWith('audio/')) {
                if (!allowedAudioTypes.includes(fileType)) typeError = "Tipo de áudio inválido. Use MP3, OGG, WAV, etc.";
                else if (fileSizeMB > 10) sizeError = `Áudio excede 10MB (${fileSizeMB.toFixed(1)}MB).`;
            } else {
                typeError = "Tipo de arquivo não suportado (use imagem, vídeo ou áudio).";
            }

            if (typeError) validationError = typeError;
            else if (sizeError) validationError = sizeError;
        }


        if (validationError) {
            showToast(validationError, "warning");
            return;
        }

        // --- 2. Upload Media if new file exists ---
        let finalMediaKey: string | null = existingMediaKey; // Start with existing key

        if (mediaFile) {
            setIsMediaLoading(true); // Indicate media upload is starting
            try {
                finalMediaKey = await uploadMediaMutation.mutateAsync(mediaFile);
                console.log("Upload successful, received key:", finalMediaKey);
            } catch (uploadError) {
                // Error handled by mutation's onError
                return; // Stop the save process
            } finally {
                 setIsMediaLoading(false); // Hide media loading indicator
            }
        } else if (existingMediaKey === '') {
             // User explicitly removed existing media
             finalMediaKey = '';
        }


        // --- 3. Prepare FormData for Save ---
        const formData = new FormData();
        if (isEditing && messageId) formData.append('id', messageId);
        if (clinicCode) {
             formData.append('id_clinica', clinicCode); // Use clinicCode as id_clinica for webhook
             formData.append('codigo_clinica', clinicCode); // Also send as codigo_clinica
        }
        formData.append('categoria', category);
        formData.append('id_instancia', instanceId);
        formData.append('modelo_mensagem', messageText.trim());
        formData.append('ativo', String(isActive));
        formData.append('servicos_vinculados', JSON.stringify(selectedServiceIds)); // Send selected service IDs

        // Add conditional fields
        if (scheduledTime) formData.append('hora_envio', scheduledTime);

        // Add target type flags and group ID
        formData.append('para_cliente', String(targetType === 'Cliente'));
        formData.append('para_funcionario', String(targetType === 'Funcionário'));
        formData.append('para_grupo', String(targetType === 'Grupo'));
        if (targetType === 'Grupo' && groupId) {
             formData.append('grupo', groupId); // Send group ID if target is group
        } else {
             formData.append('grupo', ''); // Send empty if not targeting group
        }


        // Add variations
        variations.forEach((v, index) => {
            formData.append(`variacao_${index + 1}`, v.trim());
        });

        // Add media key (or empty string if removed)
        formData.append('midia_mensagem', finalMediaKey ?? ''); // Use midia_mensagem field


        // --- 4. Trigger Save Mutation ---
        saveMessageMutation.mutate(formData);
    };


    const handleCancel = () => {
        // Redirect back to the list page
        const listPageUrl = `/dashboard/11?clinic_code=${encodeURIComponent(clinicCode || '')}`;
        navigate(listPageUrl);
    };

    // Helper to update variations counter display
    const updateVariationsCounter = (text: string, currentVariations: string[]) => {
        let count = 0;
        // Count non-empty variations
        currentVariations.forEach(v => {
            if (v.trim() !== '') count++;
        });
        // Also count the main message if it's not empty
        if (text.trim() !== '') count++;

        // This counter logic seems to count *all* non-empty messages (main + variations)
        // The HTML counter was just for variations. Let's stick to the HTML logic for the UI counter.
        let variationCount = 0;
        currentVariations.forEach(v => {
             if (v.trim() !== '') variationCount++;
        });
        // The span element for the counter is inside the button, need a ref or update state
        // Let's use state for the counter display
        // setVariationsCountDisplay(variationCount); // Need a state variable for this
    };

    // Determine visibility of category-specific fields
    const isScheduledTimeVisible = category === 'Confirmar Agendamento';
    const isBirthdayTimeVisible = category === 'Aniversário';
    const serviceSelectionGroupVisible = category !== 'Aniversário'; // Visible for all except Aniversário
    const targetTypeGroupVisible = category === 'Chegou' || category === 'Liberado';
    const groupSelectionGroupVisible = targetTypeGroupVisible && targetType === 'Grupo'; // Visible only if target type is Group


    // Determine loading state
    const isLoading = isLoadingInstances || isLoadingServices || isLoadingMessageDetails || isLoadingLinkedServices || isLoadingGroups || saveMessageMutation.isLoading || uploadMediaMutation.isLoading || generateAiVariationMutation.isLoading || fetchSignedUrlMutation.isLoading;
    const fetchError = instancesError || servicesError || messageDetailsError || linkedServicesError || groupsError;
    const isSaving = saveMessageMutation.isLoading || uploadMediaMutation.isLoading; // Saving includes media upload


    // --- Permission Check ---
    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    if (!hasPermission) {
         return (
             <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                 <Card className="w-full max-w-md text-center">
                     <CardHeader>
                         <TriangleAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
                         <CardTitle className="text-2xl font-bold text-destructive">Acesso Negado</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p className="text-gray-700">Você não tem permissão para acessar esta página.</p>
                         <p className="mt-2 text-gray-600 text-sm">Se você acredita que isso é um erro, entre em contato com o administrador.</p>
                     </CardContent>
                 </Card>
             </div>
         );
    }

    // Show loading or error if initial data fetching fails
    if ((isLoadingInstances || isLoadingServices || (isEditing && (isLoadingMessageDetails || isLoadingLinkedServices))) && !fetchError) {
         return (
             <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                 <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                 <span className="text-lg text-gray-700">Carregando dados...</span>
             </div>
         );
    }

    if (fetchError) {
         return (
             <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                 <Card className="w-full max-w-md text-center">
                     <CardHeader>
                         <TriangleAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
                         <CardTitle className="text-2xl font-bold text-destructive">Erro ao Carregar Dados</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p className="text-gray-700">Ocorreu um erro ao carregar as informações necessárias para esta página.</p>
                         <p className="mt-2 text-gray-600 text-sm">{fetchError.message}</p>
                         <Button onClick={() => window.location.reload()} className="mt-4">Tentar Novamente</Button>
                     </CardContent>
                 </Card>
             </div>
         );
    }

    // If editing and messageDetails is null/undefined after loading, it means message not found
    if (isEditing && !messageDetails && !isLoadingMessageDetails) {
         return (
             <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                 <Card className="w-full max-w-md text-center">
                     <CardHeader>
                         <Info className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                         <CardTitle className="text-2xl font-bold text-primary">Mensagem Não Encontrada</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p className="text-gray-700">A mensagem que você tentou editar não foi encontrada.</p>
                         <Button onClick={handleCancel} className="mt-4">Voltar para a Lista</Button>
                     </CardContent>
                 </Card>
             </div>
         );
    }


    const pageTitle = isEditing ? "Editar Mensagem Automática" : "Configurar Nova Mensagem Automática";
    const saveButtonText = isEditing ? "Salvar Alterações" : "Criar Mensagem";
    const variationsCountDisplay = variations.filter(v => v.trim() !== '').length;


    return (
        <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100">
            <div className="config-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="config-title text-2xl font-bold text-primary whitespace-nowrap">
                    {clinicData?.nome} | {pageTitle}
                </h1>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-primary mb-4 pb-3 border-b border-gray-200">Identificação e Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="form-group">
                            <Label htmlFor="messageCategorySelect">Categoria *</Label>
                            <Select value={category} onValueChange={handleCategoryChange} disabled={isLoading || isEditing}>
                                <SelectTrigger id="messageCategorySelect">
                                    <SelectValue placeholder="-- Selecione a Categoria * --" />
                                </SelectTrigger>
                                <SelectContent>
                                    {orderedCategories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="form-group">
                            <Label htmlFor="messageInstanceSelect">Instância (Número Enviador) *</Label>
                            <Select value={instanceId} onValueChange={handleInstanceChange} disabled={isLoading || !instancesList}>
                                <SelectTrigger id="messageInstanceSelect">
                                    <SelectValue placeholder={isLoadingInstances ? "-- Carregando Instâncias --" : (instancesError ? "-- Erro ao carregar --" : "-- Selecione a Instância * --")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {instancesList?.map(instance => (
                                        <SelectItem key={instance.id} value={String(instance.id)}>{instance.nome_exibição || `ID ${instance.id}`}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500 mt-1">Qual número/conexão enviará esta mensagem.</p>
                        </div>
                        <div className="form-group flex items-center space-x-2 col-span-1 md:col-span-2">
                            <Switch id="messageActive" checked={isActive} onCheckedChange={handleActiveChange} disabled={isLoading} />
                            <Label htmlFor="messageActive">Mensagem Ativa</Label>
                        </div>
                    </div>
                </div>

                <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-primary mb-4 pb-3 border-b border-gray-200">Conteúdo da Mensagem</h3>
                    <div className="form-group">
                        <Label htmlFor="messageText">Texto da Mensagem Principal *</Label>
                        <div className="flex items-center gap-2 mb-2">
                             <Button type="button" variant="outline" size="sm" ref={emojiBtnRef} title="Inserir Emoji">
                                 <Smile className="h-4 w-4" /> Emoji
                             </Button>
                             {/* Placeholder for Preview Button */}
                             <Button type="button" variant="outline" size="sm" onClick={() => showToast("Prévia em desenvolvimento.", "info")} title="Ver Prévia">
                                 <Eye className="h-4 w-4 mr-1" /> Prévia
                             </Button>
                        </div>
                        <Textarea
                            id="messageText"
                            rows={8}
                            placeholder="Digite a mensagem principal. Use {variaveis}, *para negrito*, _para itálico_..."
                            value={messageText}
                            onChange={handleMessageTextChange}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="tokens-container bg-gray-50 p-4 rounded-md border border-gray-200 mb-6">
                         <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TagIcon className="h-5 w-5 text-primary" /> Variáveis Disponíveis (clique para inserir):</p>
                         <div className="flex flex-wrap gap-2" id="tokensList">
                             {Object.keys(placeholderData).map(key => (
                                 <span
                                     key={key}
                                     className="token-badge bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm cursor-pointer hover:bg-blue-200 transition-colors"
                                     onClick={() => handleTokenClick(`{${key}}`)}
                                     title={`Inserir {${key}}`}
                                 >
                                     {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                 </span>
                             ))}
                         </div>
                    </div>

                    <div className="form-group">
                        <Label htmlFor="messageMedia">Anexar Mídia (Opcional)</Label>
                        <Input type="file" id="messageMedia" accept="image/*,video/*,audio/*" onChange={handleMediaFileChange} disabled={isLoading || isMediaLoading} />
                        <p className="text-xs text-gray-500 mt-1">Imagem (JPG, PNG, GIF, WEBP - máx 5MB), Vídeo (MP4, WEBM, MOV - máx 10MB), Áudio (MP3, OGG, WAV - máx 10MB).</p>

                        {(mediaFile || existingMediaKey || isMediaLoading || mediaPreviewUrl) && (
                            <div className="media-preview-container mt-4 p-4 border border-dashed border-gray-300 rounded-md bg-gray-50 flex flex-col items-center justify-center min-h-[100px]">
                                {isMediaLoading ? (
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                        <span className="text-sm text-gray-700">Carregando mídia...</span>
                                    </div>
                                ) : mediaPreviewUrl ? (
                                    <>
                                        {mediaPreviewUrl.match(/\.(jpeg|jpg|png|gif|webp|bmp|svg)$/i) ? (
                                            <img src={mediaPreviewUrl} alt="Preview" className="max-w-full max-h-[200px] rounded-md border border-gray-200" />
                                        ) : mediaPreviewUrl.match(/\.(mp4|webm|mov|avi|ogv|mkv)$/i) ? (
                                             <video src={mediaPreviewUrl} controls className="max-w-full max-h-[200px] rounded-md border border-gray-200"></video>
                                        ) : mediaPreviewUrl.match(/\.(mp3|wav|ogg|aac|m4a|opus|oga)$/i) ? (
                                             <audio src={mediaPreviewUrl} controls className="w-full max-w-sm"></audio>
                                        ) : (
                                             <a href={mediaPreviewUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Visualizar Arquivo</a>
                                        )}
                                        <Button variant="outline" size="sm" className="mt-3" onClick={handleRemoveMedia} disabled={isSaving}>Remover Mídia</Button>
                                    </>
                                ) : (
                                     <span className="text-gray-500 italic">Nenhuma mídia selecionada</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                         <Button type="button" variant="outline" size="sm" onClick={() => setShowVariations(!showVariations)} disabled={isLoading}>
                             <MessagesSquare className="h-4 w-4 mr-2" /> Gerenciar Variações ({variationsCountDisplay}/5)
                         </Button>
                         <p className="text-xs text-gray-500 mt-1">Clique para exibir/editar versões alternativas desta mensagem.</p>

                         {showVariations && (
                             <div className="variations-container border border-dashed border-gray-300 rounded-md p-4 mt-4 bg-gray-50">
                                 <h4 className="text-md font-semibold mb-4">Variações da Mensagem</h4>
                                 <div className="form-group">
                                     <Label>Mensagem Original (Base para IA)</Label>
                                     <div className="bg-gray-200 p-3 rounded-md text-sm whitespace-pre-wrap break-words min-h-[60px]">
                                         {messageText || '(Mensagem principal vazia)'}
                                     </div>
                                 </div>
                                 <hr className="my-6 border-gray-300" />
                                 {variations.map((variation, index) => (
                                     <div key={index} className="form-group variation-group">
                                         <Label htmlFor={`variationText${index + 1}`}>Variação {index + 1}</Label>
                                         <div className="flex gap-2 items-start">
                                             <Textarea
                                                 id={`variationText${index + 1}`}
                                                 rows={3}
                                                 placeholder={`Variação ${index + 1}...`}
                                                 value={variation}
                                                 onChange={(e) => handleVariationChange(index, e.target.value)}
                                                 disabled={isLoading || generateAiVariationMutation.isLoading}
                                                 className="flex-grow"
                                             />
                                             <TooltipProvider>
                                                 <Tooltip>
                                                     <TooltipTrigger asChild>
                                                         <Button
                                                             type="button"
                                                             variant="outline"
                                                             size="sm"
                                                             onClick={() => handleGenerateAiVariation(index + 1)}
                                                             disabled={isLoading || generateAiVariationMutation.isLoading}
                                                             className="flex-shrink-0"
                                                         >
                                                             {generateAiVariationMutation.isLoading && generateAiVariationMutation.variables?.slot === index + 1 ? (
                                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                             ) : (
                                                                  <Magic className="h-4 w-4" />
                                                             )}
                                                             <span className="hidden sm:inline ml-1">IA</span>
                                                         </Button>
                                                     </TooltipTrigger>
                                                     <TooltipContent>Sugerir com IA</TooltipContent>
                                                 </Tooltip>
                                                 <Tooltip>
                                                     <TooltipTrigger asChild>
                                                         <Button
                                                             type="button"
                                                             variant="destructive"
                                                             size="sm"
                                                             onClick={() => handleClearVariation(index)}
                                                             disabled={isLoading || generateAiVariationMutation.isLoading}
                                                             className="flex-shrink-0"
                                                         >
                                                             <Trash2 className="h-4 w-4" />
                                                         </Button>
                                                     </TooltipTrigger>
                                                     <TooltipContent>Limpar Variação</TooltipContent>
                                                 </Tooltip>
                                             </TooltipProvider>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                </div>

                <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-primary mb-4 pb-3 border-b border-gray-200">Disparador e Condições</h3>

                    {serviceSelectionGroupVisible && (
                         <div className="form-group">
                             <Label htmlFor="serviceSelect">Serviços Vinculados *</Label>
                             {/* Render the select element for Choices.js */}
                             <select id="serviceSelect" ref={serviceSelectRef} multiple disabled={isLoading || !availableServices}></select>
                             {isLoadingServices && <p className="text-sm text-gray-500 mt-1">Carregando serviços...</p>}
                             {servicesError && <p className="text-sm text-red-500 mt-1">Erro ao carregar serviços: {servicesError.message}</p>}
                             <p className="text-xs text-gray-500 mt-1">Quais agendamentos de serviço ativarão esta mensagem.</p>
                         </div>
                    )}

                    {isScheduledTimeVisible && (
                         <div className="form-group">
                             <Label htmlFor="scheduledTimeSelect">Hora Programada (Confirmação) *</Label>
                             <Select value={scheduledTime} onValueChange={handleScheduledTimeChange} disabled={isLoading}>
                                 <SelectTrigger id="scheduledTimeSelect">
                                     <SelectValue placeholder="-- Selecione a Hora * --" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {/* Example times - populate as needed */}
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

                    {isBirthdayTimeVisible && (
                         <div className="form-group">
                             <Label htmlFor="birthdayTimeSelect">Hora de Envio (Aniversário) *</Label>
                             <Select value={scheduledTime} onValueChange={handleScheduledTimeChange} disabled={isLoading}>
                                 <SelectTrigger id="birthdayTimeSelect">
                                     <SelectValue placeholder="-- Selecione a Hora * --" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {/* Example times - populate as needed */}
                                     <SelectItem value="08:00">08:00</SelectItem>
                                     <SelectItem value="09:00">09:00</SelectItem>
                                     <SelectItem value="10:00">10:00</SelectItem>
                                     <SelectItem value="11:00">11:00</SelectItem>
                                     <SelectItem value="12:00">12:00</SelectItem>
                                     <SelectItem value="13:00">13:00</SelectItem>
                                     <SelectItem value="14:00">14:00</SelectItem>
                                     <SelectItem value="15:00">15:00</SelectItem>
                                     <SelectItem value="16:00">16:00</SelectItem>
                                     <SelectItem value="17:00">17:00</SelectItem>
                                 </SelectContent>
                             </Select>
                             <p className="text-xs text-gray-500 mt-1">Hora de envio da mensagem de aniversário.</p>
                         </div>
                    )}

                    {targetTypeGroupVisible && (
                         <div className="form-group">
                             <Label htmlFor="targetTypeSelect">Enviar Para * <span className="text-xs text-gray-500">(Apenas Chegou/Liberado)</span></Label>
                             <Select value={targetType} onValueChange={handleTargetTypeChange} disabled={isLoading}>
                                 <SelectTrigger id="targetTypeSelect">
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

                    {groupSelectionGroupVisible && (
                         <div className="form-group">
                             <Label htmlFor="groupSelect">Grupo Alvo * <span className="text-xs text-gray-500">(Se 'Enviar Para' for Grupo)</span></Label>
                             <Select value={groupId} onValueChange={handleGroupChange} disabled={isLoading || !groupsList || groupsList.length === 0}>
                                 <SelectTrigger id="groupSelect">
                                     <SelectValue placeholder={isLoadingGroups ? "-- Carregando grupos..." : (groupsError ? "-- Erro ao carregar --" : (groupsList?.length === 0 ? "-- Nenhum grupo disponível --" : "-- Selecione o Grupo * --"))} />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {groupsList?.map(group => (
                                         <SelectItem key={group.id_grupo} value={group.id_grupo}>{group.nome_grupo}</SelectItem>
                                     ))}
                                 </SelectContent>
                             </Select>
                             {groupsError && <p className="text-sm text-red-500 mt-1">Erro ao carregar grupos: {groupsError.message}</p>}
                             <p className="text-xs text-gray-500 mt-1">Grupo do WhatsApp onde a mensagem será enviada.</p>
                         </div>
                    )}

                </div>

                <div className="form-actions flex justify-end gap-4 mt-6">
                    <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading || isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {uploadMediaMutation.isLoading ? 'Enviando Mídia...' : 'Salvando...'}
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" /> {saveButtonText}
                            </>
                        )}
                    </Button>
                </div>
            </form>

            {/* Emoji Picker Web Component */}
            <emoji-picker ref={emojiPickerRef} style={{ position: 'absolute', display: 'none', zIndex: 1050 }}></emoji-picker>

        </div>
    );
};

export default MensagensConfigPage;