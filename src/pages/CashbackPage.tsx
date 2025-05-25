import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, DollarSign, CalendarDays, Settings, MessageSquare, Send } from "lucide-react"; // Added Send icon
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation and useQueryClient
import { endOfMonth, getDay, isAfter, startOfDay, format, addDays } from 'date-fns'; // Import addDays
import { ptBR } from 'date-fns/locale'; // Import locale for month names
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { Calendar } from "@/components/ui/calendar"; // Import shadcn/ui Calendar
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // For date picker popup
import { formatPhone } from '@/lib/utils'; // Import formatPhone
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Import Dialog components
import { Label } from "@/components/ui/label"; // Import Label
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { showSuccess, showError } from '@/utils/toast'; // Import toast utilities
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { cn } from '@/lib/utils'; // Import cn for conditional classes
import { Textarea } from "@/components/ui/textarea"; // Import Textarea for message preview

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a sale item fetched from Supabase
interface SupabaseSale {
    id_north: number;
    data_venda: string; // ISO date string
    codigo_cliente_north: number | null;
    cod_funcionario_north: number | null;
    nome_funcionario_north: string | null;
    valor_venda: number | null;
    valor_cashback: number | null; // Added new column
    validade_cashback: string | null; // Added new column (assuming ISO date string)
    // The client name comes from the joined table
    north_clinic_clientes: { nome_north: string | null, telefone_north: number | null } | null; // Nested client data - ADDED telefone_north
    // Add other fields if needed from the Supabase query
}

// Define the structure for Instance details from Supabase
interface InstanceDetails {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

// Define the structure for a Message Template fetched from Supabase
interface MessageTemplate {
    id: number;
    modelo_mensagem: string;
    url_arquivo: string | null;
    sending_order: string | null;
    // Add other fields if needed for preview or sending
}


// Define the structure for the data sent to the save config webhook
// Using Portuguese names to match the database columns for the webhook payload
interface SaveConfigPayload {
    id_clinica: number | string;
    cashback_percentual: number | null;
    cashback_validade: number | null;
    default_sending_instance_id: number | null; // Name expected by the webhook
    apply_to_current_month_sales?: boolean; // Added new optional field
}

// Define the structure for the data fetched from Supabase config table
// Using Portuguese names to match the database columns
interface FetchedConfig {
    cashback_percentual: number | null;
    cashback_validade: number | null;
    cashback_instancia_padrao: number | null; // Corrected name to match DB
}

// Define the structure for the data sent to the send message webhook
interface SendMessagePayload {
    mensagem: string;
    recipiente: string; // Phone number or JID
    instancia: string; // Evolution instance name
    id_clinica: number | string;
    tipo_mensagem: string; // e.g., "Cashback"
    prioridade: string; // e.g., "1"
    tipo_evolution: string; // e.g., "text", "media"
    url_arquivo?: string | null; // URL of the attachment if sending media
    sending_order?: string | null; // Order of text/media if sending both
}


interface CashbackPageProps {
  clinicData: ClinicData | null;
}

// Helper function to clean salesperson name (remove leading numbers and hyphen)
function cleanSalespersonName(name: string | null): string {
    if (!name) return 'N/D';
    // Remove leading digits, hyphen, and space (e.g., "1 - Nome" -> "Nome")
    const cleaned = name.replace(/^\d+\s*-\s*/, '').trim();
    return cleaned || 'N/D'; // Return 'N/D' if name becomes empty after cleaning
}


// Helper to format date string
const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/D';
    try {
        // Attempt to parse ISO string or other common formats
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
             // Fallback for potential different formats, e.g., 'YYYY-MM-DD'
             const parts = dateString.split('-');
             if (parts.length === 3) {
                 const [year, month, day] = parts;
                 const fallbackDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
                  if (!isNaN(fallbackDate.getTime())) {
                      return format(fallbackDate, 'dd/MM/yyyy');
                  }
             }
             return 'Data inválida';
        }
        return format(date, 'dd/MM/yyyy');
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Erro';
    }
};

// Placeholder data for message preview (updated for cashback)
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
    hora_agendamento: "15:30",
    valor_cashback: "R$ 50,00",
    validade_cashback: "20/05/2025"
};

function simulateMessage(template: string | null, placeholders: { [key: string]: string }): string {
    if (typeof template !== 'string' || !template) return '<i class="text-gray-500">(Modelo inválido ou vazio)</i>';
    let text = template;
    for (const key in placeholders) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        text = text.replace(regex, `<strong>${placeholders[key]}</strong>`);
    }
    text = text.replace(/\{([\w_]+)\}/g, '<span class="unreplaced-token text-gray-600 bg-gray-200 px-1 rounded font-mono text-xs">{$1}</span>');
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    text = text.replace(/\\n|\n/g, '<br>');
    return text;
}


const SALES_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/43a4753b-b7c2-48c0-b57a-61ba5256d5b7';
const LEADS_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/c12975eb-6e62-4a61-b19c-5e47b62ca642'; // Corrected Leads webhook URL
const APPOINTMENTS_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/72d5e8a4-eb58-4cdd-a784-5f8cfc9ee739';
const SEND_MESSAGE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/enviar-para-fila'; // Webhook para enviar mensagem


const CashbackPage: React.FC<CashbackPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient(); // Get query client instance
    const [currentDate, setCurrentDate] = useState<Date>(startOfMonth(new Date()));
    // State to hold manual cashback data (simple example, not persisted)
    const [manualCashbackData, setManualCashbackData] = useState<{ [saleId: number]: { valor?: string, validade?: Date | null } }>({}); // Made properties optional

    // State for the automatic cashback configuration modal
    const [isAutoCashbackModalOpen, setIsAutoCashbackModalOpen] = useState(false);
    const [autoCashbackConfig, setAutoCashbackConfig] = useState({
        percentual: '', // Corrected state name
        validadeDias: '', // Corrected state name
        idInstanciaEnvioPadrao: null as number | null, // Corrected state name to match DB column concept
    });
    // New state for the "Apply to current month sales" checkbox
    const [applyToCurrentMonthSales, setApplyToCurrentMonthSales] = useState(false);

    // NEW: Local state for saving loading indicator
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // NEW: State for the Send Message modal
    const [isSendMessageModalOpen, setIsSendMessageModalOpen] = useState(false);
    const [selectedSaleForMessage, setSelectedSaleForMessage] = useState<SupabaseSale | null>(null);
    const [selectedMessageTemplateId, setSelectedMessageTemplateId] = useState<number | null>(null);
    const [selectedSendingInstanceId, setSelectedSendingInstanceId] = useState<number | null>(null);

    // NEW: State for message preview in the modal
    const [messagePreview, setMessagePreview] = useState<string>('');


    // Effect to reset form state when modal closes
    useEffect(() => {
        console.log("[CashbackPage] useEffect [isAutoCashbackModalOpen] triggered. isAutoCashbackModalOpen:", isAutoCashbackModalOpen);
        if (!isAutoCashbackModalOpen) {
            console.log("[CashbackPage] Modal closed, resetting form state.");
            setAutoCashbackConfig({
                percentual: '',
                validadeDias: '',
                idInstanciaEnvioPadrao: null,
            });
            // Reset the new checkbox state as well
            setApplyToCurrentMonthSales(false);
            // Ensure saving state is false when modal closes
            setIsSavingConfig(false);
        }
    }, [isAutoCashbackModalOpen]); // Depend on modal open state

    // Effect to reset send message modal state when it closes
    useEffect(() => {
        if (!isSendMessageModalOpen) {
            setSelectedSaleForMessage(null);
            setSelectedMessageTemplateId(null);
            setSelectedSendingInstanceId(null);
            setMessagePreview('');
        }
    }, [isSendMessageModalOpen]);


    const clinicId = clinicData?.id;
    const clinicCode = clinicData?.code; // Get clinic code for webhooks

    // Format dates for Supabase query filters
    const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');


    // Fetch sales data using react-query directly from Supabase
    const { data: salesData, isLoading, error, refetch } = useQuery<SupabaseSale[]>({
        queryKey: ['monthlySalesSupabase', clinicId, startDate, endDate], // Use date range in key
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }

            console.log(`Fetching sales for clinic ${clinicId} from Supabase for date range ${startDate} to ${endDate}`);

            try {
                const { data, error } = await supabase
                    .from('north_clinic_vendas')
                    .select('id_north, data_venda, codigo_cliente_north, cod_funcionario_north, nome_funcionario_north, valor_venda, valor_cashback, validade_cashback, north_clinic_clientes(nome_north, telefone_north)') // Select sales data and join client name and phone - ADDED telefone_north
                    .eq('id_clinica', clinicId) // Filter by clinic ID
                    .gte('data_venda', startDate) // Filter by start date of the month
                    .lte('data_venda', endDate) // Filter by end date of the month
                    .order('data_venda', { ascending: true }); // Order by sale date

                console.log('Supabase sales fetch result:', { data, error });

                if (error) {
                    console.error('Supabase sales fetch error:', error);
                    throw new Error(`Erro ao buscar dados de vendas: ${error.message}`);
                }

                if (!data) {
                    console.warn("Supabase sales fetch returned null data.");
                    return []; // Return empty array if data is null
                }

                console.log("Sales data received from Supabase:", data.length, "items");
                return data as SupabaseSale[]; // Cast to the defined interface

            } catch (err: any) {
                console.error('Erro ao buscar dados de vendas do Supabase:', err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch instance details from Supabase for the select input (used in both modals)
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceDetails[]>({
        queryKey: ['instancesListCashbackPage', clinicId],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }
            console.log(`Fetching instance details for clinic ${clinicId} from Supabase`);

            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });

            if (error) {
                console.error("Error fetching instances from Supabase:", error);
                throw new Error(error.message);
            }

            return data || [];
        },
        enabled: !!clinicId && (isAutoCashbackModalOpen || isSendMessageModalOpen), // Only fetch when clinicId is available and either modal is open
        staleTime: 0, // Always refetch when modal opens
        refetchOnWindowFocus: false,
    });

    // Fetch existing automatic cashback configuration from Supabase (used in auto config modal)
    const { data: existingConfig, isLoading: isLoadingConfig, error: configError } = useQuery<FetchedConfig | null>({
        queryKey: ['cashbackConfig', clinicId],
        queryFn: async () => {
            if (!clinicId) return null;
            console.log(`[CashbackPage] Fetching existing cashback config for clinic ${clinicId} from Supabase`);
            const { data, error } = await supabase
                .from('north_clinic_config_clinicas')
                .select('cashback_percentual, cashback_validade, cashback_instancia_padrao') // Corrected column name here
                .eq('id', clinicId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                console.error("[CashbackPage] Error fetching existing cashback config:", error);
                throw new Error(error.message);
            }

            console.log("[CashbackPage] Existing cashback config fetched:", data);
            return data || null;
        },
        enabled: !!clinicId && isAutoCashbackModalOpen, // Only fetch when clinicId is available and modal is open
        staleTime: 0, // Always refetch when modal opens
        refetchOnWindowFocus: false,
    });

    // NEW: Fetch active cashback message templates (used in send message modal)
    const { data: cashbackMessageTemplates, isLoading: isLoadingMessageTemplates, error: messageTemplatesError } = useQuery<MessageTemplate[]>({
        queryKey: ['cashbackMessageTemplates', clinicId],
        queryFn: async () => {
            if (!clinicId) return [];
            console.log(`[CashbackPage] Fetching active cashback message templates for clinic ${clinicId}`);
            const { data, error } = await supabase
                .from('north_clinic_config_mensagens')
                .select('id, modelo_mensagem, url_arquivo, sending_order') // Select necessary fields
                .eq('id_clinica', clinicId)
                .eq('context', 'cashback') // Filter by cashback context
                .eq('ativo', true) // Only active templates
                .order('categoria', { ascending: true }); // Order by category

            if (error) {
                console.error("[CashbackPage] Error fetching cashback message templates:", error);
                throw new Error(error.message);
            }
            console.log("[CashbackPage] Fetched cashback message templates:", data);
            return data || [];
        },
        enabled: !!clinicId && isSendMessageModalOpen, // Only fetch when clinicId is available and send message modal is open
        staleTime: 0, // Always refetch when modal opens
        refetchOnWindowFocus: false,
    });


    // Effect to populate auto config modal state when existingConfig and instancesList are loaded
    useEffect(() => {
        console.log("[CashbackPage] useEffect [isAutoCashbackModalOpen, existingConfig, instancesList, isLoadingConfig, isLoadingInstances] triggered."); // <-- Updated log
        console.log("  isAutoCashbackModalOpen:", isAutoCashbackModalOpen);
        console.log("  isLoadingConfig:", isLoadingConfig);
        console.log("  isLoadingInstances:", isLoadingInstances);
        console.log("  existingConfig (before check):", existingConfig); // Log before check
        console.log("  instancesList (before check):", instancesList ? instancesList.length + ' items' : 'null/undefined'); // Log before check


        // Only attempt to populate state if the modal is open AND both queries are finished AND successful
        if (isAutoCashbackModalOpen && !isLoadingConfig && !configError && !isLoadingInstances && !instancesError) {
            console.log("[CashbackPage] useEffect: Modal is open, both fetches finished successfully. Populating state.");
            console.log("[CashbackPage] useEffect: existingConfig (after check):", existingConfig); // Log after check
            console.log("[CashbackPage] useEffect: instancesList (after check):", instancesList ? instancesList.length + ' items' : 'null/undefined'); // Log after check


            const loadedPercentual = existingConfig?.cashback_percentual?.toString() || '';
            const loadedValidade = existingConfig?.cashback_validade?.toString() || '';
            const loadedInstanceId = existingConfig?.cashback_instancia_padrao || null;

            console.log("[CashbackPage] useEffect: Loaded values - Percentual:", loadedPercentual, "Validade:", loadedValidade, "Instance ID:", loadedInstanceId, "Type:", typeof loadedInstanceId);

            // Set the state
            setAutoCashbackConfig({
                percentual: loadedPercentual,
                validadeDias: loadedValidade,
                idInstanciaEnvioPadrao: loadedInstanceId,
            });
            console.log("[CashbackPage] useEffect: State set to:", {
                 percentual: loadedPercentual,
                 validadeDias: loadedValidade,
                 idInstanciaEnvioPadrao: loadedInstanceId,
            });

        } else if (!isAutoCashbackModalOpen) {
            // Modal is closed, the other effect handles resetting.
            console.log("[CashbackPage] useEffect: Modal is closed. Skipping state population.");
        } else {
             // Modal is open, but still loading or has error
             console.log("[CashbackPage] useEffect: Modal is open, but still loading or has error. Waiting or showing error.");
        }

    }, [isAutoCashbackModalOpen, existingConfig, instancesList, isLoadingConfig, configError, isLoadingInstances, instancesError]); // Dependencies include all relevant states and query results


    // Effect to set default sending instance and update preview when send modal data changes
    useEffect(() => {
        console.log("[CashbackPage] Send message modal useEffect triggered.");
        if (!isSendMessageModalOpen || !selectedSaleForMessage || !instancesList || instancesList.length === 0 || !cashbackMessageTemplates) {
            console.log("[CashbackPage] Send message modal useEffect: Data not ready or modal closed. Skipping.");
            return;
        }

        // Set default sending instance if not already selected
        if (selectedSendingInstanceId === null) {
            // Try to find the default instance from clinic config (if fetched)
            const defaultInstanceId = existingConfig?.cashback_instancia_padrao;
            const defaultInstanceExists = defaultInstanceId !== null && instancesList.some(inst => inst.id === defaultInstanceId);

            if (defaultInstanceExists) {
                console.log("[CashbackPage] Setting default sending instance from config:", defaultInstanceId);
                setSelectedSendingInstanceId(defaultInstanceId);
            } else {
                // Default to the first available instance if no config or config instance not found
                const firstInstanceId = instancesList[0]?.id || null;
                console.log("[CashbackPage] Setting default sending instance to first available:", firstInstanceId);
                setSelectedSendingInstanceId(firstInstanceId);
            }
        }

        // Update message preview when selected template or sale data changes
        const selectedTemplate = cashbackMessageTemplates.find(t => t.id === selectedMessageTemplateId);
        if (selectedTemplate) {
            // Prepare placeholder data from the selected sale
            const salePlaceholders = {
                primeiro_nome_cliente: selectedSaleForMessage.north_clinic_clientes?.nome_north?.split(' ')[0] || 'Cliente',
                nome_completo_cliente: selectedSaleForMessage.north_clinic_clientes?.nome_north || 'Cliente',
                valor_cashback: selectedSaleForMessage.valor_cashback !== null && selectedSaleForMessage.valor_cashback !== undefined ? `R$ ${selectedSaleForMessage.valor_cashback.toFixed(2).replace('.', ',')}` : 'N/D',
                validade_cashback: formatDate(selectedSaleForMessage.validade_cashback),
                // Add other relevant sale/client placeholders here if needed
            };
            const preview = simulateMessage(selectedTemplate.modelo_mensagem, salePlaceholders);
            setMessagePreview(preview);
        } else {
            setMessagePreview('Selecione um modelo de mensagem para ver a prévia.');
        }

    }, [isSendMessageModalOpen, selectedSaleForMessage, instancesList, cashbackMessageTemplates, selectedMessageTemplateId, existingConfig]); // Depend on relevant states and query results


    // Mutation for saving automatic cashback configuration via webhook
    const saveConfigMutation = useMutation({
        mutationFn: async (configData: SaveConfigPayload) => {
            console.log("Sending cashback config to webhook:", configData);
            const webhookUrl = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/salvar-cashback'; // Your n8n webhook URL
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData),
            });

            if (!response.ok) {
                let errorMsg = `Erro ${response.status} ao salvar configuração`;
                try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
                throw new Error(errorMsg);
            }

            return response.json(); // Assuming webhook returns some confirmation
        },
        onSuccess: () => {
            showSuccess('Configurações de cashback salvas com sucesso!');
            setIsAutoCashbackModalOpen(false);
            // Invalidate the config query to refetch when modal is opened again
            queryClient.invalidateQueries({ queryKey: ['cashbackConfig', clinicId] });
            // Also refetch sales data for the current month if the checkbox was checked
            if (applyToCurrentMonthSales) {
                 queryClient.invalidateQueries({ queryKey: ['monthlySalesSupabase', clinicId, startDate, endDate] });
            }
        },
        onError: (error: Error) => {
            showError(`Falha ao salvar configurações: ${error.message}`);
        },
        onSettled: () => {
            // NEW: Set local saving state to false when mutation is settled
            setIsSavingConfig(false);
        }
    });

    // NEW: Mutation for sending a specific message via webhook
    const sendMessageMutation = useMutation({
        mutationFn: async (payload: SendMessagePayload) => {
            console.log("[CashbackPage] Sending message via webhook:", payload);
            const response = await fetch(SEND_MESSAGE_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorMsg = `Erro ${response.status} ao enviar mensagem`;
                try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
                throw new Error(errorMsg);
            }

            return response.json(); // Assuming webhook returns some confirmation
        },
        onSuccess: () => {
            showSuccess('Mensagem enviada para a fila!');
            setIsSendMessageModalOpen(false); // Close modal on success
            // Optionally refetch sales data or update UI to show message sent status
        },
        onError: (error: Error) => {
            showError(`Falha ao enviar mensagem: ${error.message}`);
        },
    });


    // Function to navigate months
    const goToPreviousMonth = () => {
        setCurrentDate(startOfMonth(subMonths(currentDate, 1)));
        setManualCashbackData({}); // Clear manual data on month change
    };

    const goToNextMonth = () => {
        const today = startOfMonth(new Date());
        const nextMonth = startOfMonth(addMonths(currentDate, 1));
        if (!isAfter(nextMonth, today)) { // Only navigate to next month if it's not in the future
            setCurrentDate(nextMonth);
            setManualCashbackData({}); // Clear manual data on month change
        }
    };

    // Check if the next month button should be disabled
    const isNextMonthDisabled = !isBefore(currentDate, startOfMonth(new Date()));


    // Handle manual input changes (simple state update)
    const handleCashbackInputChange = (saleId: number, field: 'valor' | 'validade', value: string | Date | null) => {
        setManualCashbackData(prev => ({
            ...prev,
            [saleId]: {
                ...prev[saleId],
                [field]: value
            }
        }));
    };

    // Handle navigation to Messages Config page
    const handleConfigMessagesClick = () => {
        if (!clinicData?.code) {
            console.error("Clinic code not available for navigation.");
            // Optionally show a toast error
            return;
        }
        // Navigate to the new Cashback Messages List page
        navigate(`/dashboard/14/messages?clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    // Handle saving automatic cashback configuration
    const handleSaveAutoCashbackConfig = () => {
        if (!clinicId) {
            showError("ID da clínica não disponível para salvar.");
            return;
        }

        // NEW: Set local saving state to true at the start
        setIsSavingConfig(true);

        // --- NEW VALIDATION ---
        const percentualNum = parseFloat(autoCashbackConfig.percentual);
        const validadeDiasNum = parseInt(autoCashbackConfig.validadeDias, 10);

        if (autoCashbackConfig.percentual.trim() === '' || isNaN(percentualNum) || percentualNum < 0) {
            showError("Por favor, informe um Percentual de Cashback válido (número >= 0).");
            setIsSavingConfig(false); // NEW: Set saving state to false on validation error
            return;
        }

        if (autoCashbackConfig.validadeDias.trim() === '' || isNaN(validadeDiasNum) || validadeDiasNum < 0) {
             showError("Por favor, informe uma Validade em dias válida (número inteiro >= 0).");
             setIsSavingConfig(false); // NEW: Set saving state to false on validation error
             return;
        }
        // --- END NEW VALIDATION ---


        // Prepare payload, converting string inputs to numbers
        const payload: SaveConfigPayload = {
            id_clinica: clinicId,
            cashback_percentual: percentualNum, // Use parsed number
            cashback_validade: validadeDiasNum, // Use parsed number
            default_sending_instance_id: autoCashbackConfig.idInstanciaEnvioPadrao,
            apply_to_current_month_sales: applyToCurrentMonthSales, // Include the new checkbox state
        };

        console.log("[CashbackPage] Saving config payload:", payload); // Log the payload before sending

        saveConfigMutation.mutate(payload); // Trigger the mutation
        // The onSettled callback will set isSavingConfig back to false
    };

    // NEW: Handle click on "Enviar Mensagem" button for a specific sale
    const handleSendMessageClick = (sale: SupabaseSale) => {
        setSelectedSaleForMessage(sale);
        setIsSendMessageModalOpen(true);
        // The useEffect for the modal will handle fetching instances and templates
    };

    // NEW: Handle sending the message from the modal
    const handleSendMessage = () => {
        if (!selectedSaleForMessage || !selectedMessageTemplateId || selectedSendingInstanceId === null || !clinicId || !clinicCode) {
            showError("Dados incompletos para enviar a mensagem.");
            return;
        }

        const selectedTemplate = cashbackMessageTemplates?.find(t => t.id === selectedMessageTemplateId);
        const selectedInstance = instancesList?.find(inst => inst.id === selectedSendingInstanceId);

        if (!selectedTemplate || !selectedInstance?.nome_instancia_evolution) {
             showError("Modelo de mensagem ou instância de envio inválida.");
             return;
        }

        const recipientPhone = selectedSaleForMessage.north_clinic_clientes?.telefone_north;
        if (!recipientPhone) {
             showError(`Telefone do cliente "${selectedSaleForMessage.north_clinic_clientes?.nome_north || 'N/D'}" não disponível.`);
             return;
        }

        // Prepare placeholder data for the selected sale
        const salePlaceholders = {
            primeiro_nome_cliente: selectedSaleForMessage.north_clinic_clientes?.nome_north?.split(' ')[0] || 'Cliente',
            nome_completo_cliente: selectedSaleForMessage.north_clinic_clientes?.nome_north || 'Cliente',
            valor_cashback: selectedSaleForMessage.valor_cashback !== null && selectedSaleForMessage.valor_cashback !== undefined ? `R$ ${selectedSaleForMessage.valor_cashback.toFixed(2).replace('.', ',')}` : 'N/D',
            validade_cashback: formatDate(selectedSaleForMessage.validade_cashback),
            // Add other relevant sale/client placeholders here if needed
        };

        // Generate the final message text by filling placeholders
        const finalMessageText = simulateMessage(selectedTemplate.modelo_mensagem, salePlaceholders).replace(/<[^>]*>/g, ''); // Remove HTML tags from simulation

        const payload: SendMessagePayload = {
            mensagem: finalMessageText,
            recipiente: String(recipientPhone), // Ensure phone is string
            instancia: selectedInstance.nome_instancia_evolution, // Use Evolution instance name
            id_clinica: clinicCode, // Use clinic code for this webhook
            tipo_mensagem: "Cashback", // Specific type for cashback messages
            prioridade: "1", // Default priority
            tipo_evolution: selectedTemplate.url_arquivo ? "media" : "text", // Determine type based on attachment
            url_arquivo: selectedTemplate.url_arquivo || null, // Include attachment URL if exists
            sending_order: selectedTemplate.sending_order || 'both', // Include sending order
        };

        sendMessageMutation.mutate(payload); // Trigger the send message mutation
    };


    // Determine if data is ready to render the auto config form
    const isAutoConfigDataReady = !isLoadingConfig && !configError && !isLoadingInstances && !instancesError;

    // Determine if data is ready to render the send message form
    const isSendMessageDataReady = !isLoadingMessageTemplates && !messageTemplatesError && !isLoadingInstances && !instancesError;


    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="cashback-container max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="page-title text-2xl font-bold text-primary">Gerenciar Cashback</h1>
                <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end"> {/* Container for date nav and action buttons */}
                    <div className="date-navigation flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={goToPreviousMonth} title="Mês Anterior">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <strong id="monthYearDisplay" className="text-lg font-bold text-primary whitespace-nowrap">
                            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                        </strong>
                        <Button variant="outline" size="icon" onClick={goToNextMonth} disabled={isNextMonthDisabled} title="Próximo Mês">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="action-buttons flex items-center gap-4"> {/* New div for action buttons */}
                        <Button variant="outline" onClick={() => setIsAutoCashbackModalOpen(true)} className="flex items-center gap-2">
                            <Settings className="h-4 w-4" /> Configurar Regras de Cashback
                        </Button>
                        <Button variant="outline" onClick={handleConfigMessagesClick} className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> Configurar Mensagens
                        </Button>
                    </div>
                </div>
            </div>

            <Card className="sales-list-container">
                <CardContent className="p-0">
                    {isLoading ? (
                         <div className="flex flex-col items-center justify-center p-8">
                             <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                             <span className="text-gray-700">Carregando dados de vendas...</span>
                         </div>
                    ) : error ? (
                         <div className="flex flex-col items-center justify-center p-8 text-red-600 bg-red-100 rounded-md">
                             <TriangleAlert className="h-8 w-8 mb-4" />
                             <span>Erro ao carregar dados de vendas: {error.message}</span>
                             {/* Add a retry button if needed */}
                         </div>
                    ) : (salesData?.length ?? 0) === 0 ? (
                        <div className="status-message text-gray-700 p-8 text-center">
                            Nenhuma venda encontrada para este mês.
                        </div>
                    ) : (
                        <div className="overflow-x-auto"> {/* Add overflow for smaller screens */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data Venda</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Vendedora</TableHead>
                                        <TableHead className="text-right">Valor Venda</TableHead>
                                        <TableHead>Valor Cashback</TableHead>
                                        <TableHead>Validade Cashback</TableHead>
                                        <TableHead className="text-right">Ações</TableHead> {/* New column for actions */}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {salesData?.map(sale => {
                                        const saleId = sale.id_north; // Use id_north as unique key
                                        // Prioritize manual input state, fallback to fetched data
                                        const currentCashbackValue = manualCashbackData[saleId]?.valor ?? sale.valor_cashback?.toFixed(2).replace('.', ',') ?? ''; // Format fetched number for display
                                        const currentCashbackValidity = manualCashbackData[saleId]?.validade ?? (sale.validade_cashback ? new Date(sale.validade_cashback) : null);


                                        return (
                                            <TableRow key={saleId}>
                                                <TableCell className="whitespace-nowrap">{formatDate(sale.data_venda)}</TableCell>
                                                {/* Access client name from the nested object */}
                                                <TableCell className="whitespace-nowrap">{sale.north_clinic_clientes?.nome_north || 'N/D'}</TableCell>
                                                <TableCell className="whitespace-nowrap">{cleanSalespersonName(sale.nome_funcionario_north)}</TableCell> {/* Apply cleanup here */}
                                                <TableCell className="text-right whitespace-nowrap">
                                                    {sale.valor_venda !== null && sale.valor_venda !== undefined ?
                                                        `R$ ${sale.valor_venda.toFixed(2).replace('.', ',')}` :
                                                        'N/D'
                                                    }
                                                </TableCell>
                                                <TableCell className="w-[150px]"> {/* Fixed width for input */}
                                                    <div className="flex items-center"> {/* Wrap input for R$ prefix */}
                                                        <span className="mr-1 text-gray-600 text-sm">R$</span> {/* R$ prefix */}
                                                        <Input
                                                            type="text" // Changed to text
                                                            placeholder="0,00" // Updated placeholder
                                                            value={currentCashbackValue} // Use current value (string)
                                                            onChange={(e) => {
                                                                const rawValue = e.target.value;
                                                                // Allow empty string
                                                                if (rawValue === '') {
                                                                     handleCashbackInputChange(saleId, 'valor', '');
                                                                     return;
                                                                }
                                                                // Replace comma with dot for internal processing
                                                                const valueWithDot = rawValue.replace(',', '.');
                                                                // Regex to allow digits, at most one dot, and at most two digits after the dot
                                                                // Also handle cases where the user types '.' first
                                                                const validRegex = /^\d*\.?\d{0,2}$/;
                                                                if (validRegex.test(valueWithDot)) {
                                                                     // Convert dot back to comma for display in the input field
                                                                     handleCashbackInputChange(saleId, 'valor', valueWithDot.replace('.', ','));
                                                                }
                                                                // If invalid, the state is not updated, keeping the last valid value
                                                            }}
                                                            className="h-8 text-right flex-grow" // Smaller input, right align text, flex-grow
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="w-[150px]"> {/* Fixed width for date picker */}
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className="w-full h-8 text-left"
                                                            >
                                                                {currentCashbackValidity ? format(currentCashbackValidity, 'dd/MM/yyyy') : 'Selecione a data'} {/* Use current value */}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={currentCashbackValidity ?? undefined} // Use current value, handle null/undefined
                                                                onSelect={(date) => {
                                                                    handleCashbackInputChange(saleId, 'validade', date);
                                                                }}
                                                                disabled={(date) => date < startOfMonth(new Date())} // Disable dates before the current month
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap"> {/* Actions cell */}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleSendMessageClick(sale)} // Trigger send message modal
                                                        className="flex items-center gap-1"
                                                        disabled={sendMessageMutation.isLoading || !sale.north_clinic_clientes?.telefone_north} // Disable if sending or no phone
                                                    >
                                                        <Send className="h-4 w-4" /> Enviar Mensagem
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
             {/* Optional: Add a button to save/process the manual cashback data */}
             {salesData && salesData.length > 0 && (
                 <div className="mt-6 text-right">
                     <Button onClick={() => console.log("Dados de Cashback a serem processados:", manualCashbackData)} disabled={isLoading}>
                         Salvar Cashback (Funcionalidade futura)
                     </Button>
                 </div>
             )}

            {/* Automatic Cashback Configuration Modal */}
            <Dialog open={isAutoCashbackModalOpen} onOpenChange={setIsAutoCashbackModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Regras de Cashback</DialogTitle> {/* Changed title */}
                    </DialogHeader>
                    {isLoadingConfig || isLoadingInstances ? ( // Show loading if either config or instances are loading
                         <div className="flex items-center justify-center gap-2 text-primary py-8">
                             <Loader2 className="animate-spin" />
                             Carregando configurações...
                         </div>
                    ) : configError || instancesError ? ( // Show error if either config or instances failed
                         <div className="text-red-600 font-semibold py-8">{configError?.message || instancesError?.message || 'Erro ao carregar dados.'}</div>
                    ) : (
                        // NEW: Use local isSavingConfig state for dimming and disabling pointer events
                        <div className={cn("grid gap-4 py-4", saveConfigMutation.isLoading && "opacity-50 pointer-events-none")}> {/* Apply dimming and disable pointer events when saving */}
                            <p className="text-sm text-gray-600">Defina regras para preencher automaticamente o valor e a validade do cashback para novas vendas.</p>
                            <div className="form-group">
                                <Label htmlFor="cashbackPercentual">Percentual de Cashback (%) *</Label> {/* Added asterisk */}
                                <Input
                                    id="cashbackPercentual"
                                    type="number"
                                    placeholder="Ex: 5"
                                    value={autoCashbackConfig.percentual}
                                    onChange={(e) => setAutoCashbackConfig({ ...autoCashbackConfig, percentual: e.target.value })}
                                    disabled={saveConfigMutation.isLoading} // Disable while saving
                                />
                            </div>
                            {/* Changed Validity field */}
                            <div className="form-group">
                                <Label htmlFor="cashbackValidadeDias">Validade (dias após a venda) *</Label> {/* Added asterisk */}
                                <Input
                                    id="cashbackValidadeDias"
                                    type="number"
                                    placeholder="Ex: 30"
                                    value={autoCashbackConfig.validadeDias}
                                    onChange={(e) => setAutoCashbackConfig({ ...autoCashbackConfig, validadeDias: e.target.value })}
                                    min="0"
                                    disabled={saveConfigMutation.isLoading} // Disable while saving
                                />
                                 <p className="text-xs text-gray-500 mt-1">O cashback será válido por este número de dias a partir da data da venda.</p>
                            </div>
                            {/* Added Sending Instance field */}
                             <div className="form-group">
                                <Label htmlFor="idInstanciaEnvioPadrao">Instância de Envio Padrão</Label>
                                {(instancesList?.length ?? 0) === 0 ? (
                                    <p className="text-sm text-orange-600">Nenhuma instância disponível para seleção.</p>
                                ) : (
                                    <Select
                                        // Add key here to force re-render when data is ready
                                        key={isAutoConfigDataReady ? 'data-ready' : 'loading'}
                                        value={autoCashbackConfig.idInstanciaEnvioPadrao?.toString() || 'none'} // Use 'none' string for null/undefined
                                        onValueChange={(value) => {
                                            console.log("[CashbackPage] Select onValueChange:", value);
                                            setAutoCashbackConfig({ ...autoCashbackConfig, idInstanciaEnvioPadrao: value === 'none' ? null : parseInt(value, 10) });
                                        }}
                                        disabled={saveConfigMutation.isLoading} // Disable while saving
                                    >
                                        <SelectTrigger id="idInstanciaEnvioPadrao">
                                            <SelectValue placeholder="Selecione a instância padrão" /> {/* Updated placeholder */}
                                        </SelectTrigger>
                                        <SelectContent>
                                            {/* Added option for no default instance */}
                                            <SelectItem value="none">Nenhuma instância padrão</SelectItem> {/* Use 'none' as value */}
                                            {instancesList?.map(inst => (
                                                <SelectItem key={inst.id} value={inst.id.toString()}>
                                                    {inst.nome_exibição} ({formatPhone(inst.telefone)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                 <p className="text-xs text-gray-500 mt-1">Esta é a instância padrão para enviar mensagens automáticas de cashback. Se nenhuma for selecionada, as mensagens automáticas de cashback não serão enviadas.</p> {/* Clarified text */}
                            </div>

                            {/* NEW: Checkbox to apply to current month sales */}
                            <div className="flex items-center space-x-2 mt-4">
                                <Checkbox
                                    id="applyToCurrentMonthSales"
                                    checked={applyToCurrentMonthSales}
                                    onCheckedChange={(checked) => setApplyToCurrentMonthSales(!!checked)}
                                    disabled={saveConfigMutation.isLoading} // Disable while saving
                                />
                                <Label
                                    htmlFor="applyToCurrentMonthSales"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Aplicar esta regra para todas as vendas do mês atual
                                </Label>
                            </div>
                             <p className="text-xs text-gray-500 mt-1">Marque esta opção para recalcular e aplicar o cashback para todas as vendas já registradas neste mês, usando as regras acima.</p> {/* Clarified text */}

                             {/* Add more configuration fields here as needed */}
                        </div>
                    )}
                    <DialogFooter>
                        {/* NEW: Disable Cancel button based on local saving state */}
                        <Button type="button" variant="secondary" onClick={() => setIsAutoCashbackModalOpen(false)} disabled={saveConfigMutation.isLoading || isLoadingConfig || !!configError || isLoadingInstances || !!instancesError}> {/* Disable based on all loading/error states */}
                            Cancelar
                        </Button>
                        {/* NEW: Use local isSavingConfig state for button loading indicator */}
                        <Button onClick={handleSaveAutoCashbackConfig} disabled={saveConfigMutation.isLoading || isLoadingConfig || !!configError || isLoadingInstances || !!instancesError}> {/* Disable based on all loading/error states */}
                            {saveConfigMutation.isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar Configurações'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* NEW: Send Message Modal */}
            <Dialog open={isSendMessageModalOpen} onOpenChange={setIsSendMessageModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Enviar Mensagem de Cashback</DialogTitle>
                    </DialogHeader>
                    {isLoadingMessageTemplates || isLoadingInstances ? (
                         <div className="flex items-center justify-center gap-2 text-primary py-8">
                             <Loader2 className="animate-spin" />
                             Carregando opções de envio...
                         </div>
                    ) : messageTemplatesError || instancesError ? (
                         <div className="text-red-600 font-semibold py-8">{messageTemplatesError?.message || instancesError?.message || 'Erro ao carregar dados.'}</div>
                    ) : (
                        <div className={cn("grid gap-4 py-4", sendMessageMutation.isLoading && "opacity-50 pointer-events-none")}>
                            <p className="text-sm text-gray-700">
                                Enviando para: <strong>{selectedSaleForMessage?.north_clinic_clientes?.nome_north || 'N/D'}</strong> ({formatPhone(selectedSaleForMessage?.north_clinic_clientes?.telefone_north)})
                            </p>

                            {/* Select Message Template */}
                            <div>
                                <Label htmlFor="messageTemplate">Modelo de Mensagem *</Label>
                                {(cashbackMessageTemplates?.length ?? 0) === 0 ? (
                                    <p className="text-sm text-orange-600">Nenhum modelo de mensagem de cashback ativo encontrado.</p>
                                ) : (
                                    <Select
                                        value={selectedMessageTemplateId?.toString() || ''}
                                        onValueChange={(value) => setSelectedMessageTemplateId(value ? parseInt(value, 10) : null)}
                                        disabled={sendMessageMutation.isLoading}
                                    >
                                        <SelectTrigger id="messageTemplate">
                                            <SelectValue placeholder="Selecione o modelo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {cashbackMessageTemplates?.map(template => (
                                                <SelectItem key={template.id} value={template.id.toString()}>
                                                    {template.modelo_mensagem.substring(0, 50)}... {/* Show preview */}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Select Sending Instance */}
                            <div>
                                <Label htmlFor="sendingInstance">Instância Enviadora *</Label>
                                {(instancesList?.length ?? 0) === 0 ? (
                                    <p className="text-sm text-orange-600">Nenhuma instância de WhatsApp configurada.</p>
                                ) : (
                                    <Select
                                        value={selectedSendingInstanceId?.toString() || ''}
                                        onValueChange={(value) => setSelectedSendingInstanceId(value ? parseInt(value, 10) : null)}
                                        disabled={sendMessageMutation.isLoading}
                                    >
                                        <SelectTrigger id="sendingInstance">
                                            <SelectValue placeholder="Selecione a instância" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {instancesList?.map(inst => (
                                                <SelectItem key={inst.id} value={inst.id.toString()}>
                                                    {inst.nome_exibição} ({formatPhone(inst.telefone)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Message Preview */}
                            <div>
                                <Label>Prévia da Mensagem</Label>
                                <Card className="mt-1">
                                    <CardContent className="p-3 text-sm text-gray-800 bg-gray-50 rounded-md">
                                        {/* Use dangerouslySetInnerHTML to render formatted preview */}
                                        <div dangerouslySetInnerHTML={{ __html: messagePreview || '<i class="text-gray-500">Selecione um modelo para ver a prévia.</i>' }}></div>
                                    </CardContent>
                                </Card>
                            </div>

                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsSendMessageModalOpen(false)} disabled={sendMessageMutation.isLoading}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSendMessage}
                            disabled={sendMessageMutation.isLoading || !selectedMessageTemplateId || selectedSendingInstanceId === null || (cashbackMessageTemplates?.length ?? 0) === 0 || (instancesList?.length ?? 0) === 0}
                        >
                            {sendMessageMutation.isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                'Enviar Mensagem'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


        </div>
    );
};

export default CashbackPage;