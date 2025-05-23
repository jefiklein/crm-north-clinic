import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TimePicker } from "@/components/ui/time-picker"; // Assuming you have a TimePicker component
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, setHours, setMinutes, setSeconds, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, TriangleAlert, Info, CalendarIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import MultiSelectServices from '@/components/MultiSelectServices'; // Import the MultiSelectServices component
import { supabase } from '@/integrations/supabase/client';

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
    midia_mensagem: string | null;
    id_instancia: number | null | string;
    grupo: string | null;
    ativo: boolean;
    hora_envio: string | null; // HH:mm:ss format
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
    url_arquivo: string | null;
    prioridade: number;
    created_at: string;
    updated_at: string;
}

// Define the structure for Instance Info from Supabase
interface InstanceInfo {
    id: number | string;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

// Define the structure for Service Info from Supabase
interface ServiceInfo {
    id: number;
    nome: string;
}

// Define the structure for Message-Service Link from Supabase
interface MessageServiceLink {
    id: number;
    id_mensagem: number;
    id_servico: number;
}


interface MensagensConfigPageProps {
    clinicData: ClinicData | null;
}

// Webhook URLs
const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const SAVE_MESSAGE_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4`; // Webhook to save/update message
const GET_MESSAGE_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/4632ce57-e78a-4c62-9578-5a33b576ad73`; // Webhook to get message by ID (using delete webhook for now as per HTML) - **NOTE: This webhook URL seems incorrect for GET**
// Corrected GET webhook URL based on previous context or assumption:
const GET_MESSAGE_BY_ID_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/get-message-by-id`; // Placeholder - **Need actual GET webhook URL**
// Using the list webhook for now as it returns all messages, then filter by ID
const GET_ALL_MESSAGES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4`; // Using the save webhook URL as it was used for GET in HTML

// Webhook to save message-service links
const SAVE_MESSAGE_SERVICES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/save-message-services`; // Placeholder - **Need actual webhook URL**
// Using a generic save webhook for now, assuming it handles message_services
const GENERIC_SAVE_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/04d103eb-1a13-411f-a3a7-fd46a789daa4`; // Re-using save message webhook for now

// Webhook to delete message-service links
const DELETE_MESSAGE_SERVICES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/delete-message-services`; // Placeholder - **Need actual webhook URL**
// Using a generic delete webhook for now, assuming it handles message_services
const GENERIC_DELETE_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/4632ce57-e78a-4c62-9578-5a33b576ad73`; // Re-using delete message webhook for now


const REQUIRED_PERMISSION_LEVEL = 2; // Assuming permission level 2 is needed for message config

// List of categories for the dropdown - **UPDATED**
const CATEGORY_OPTIONS = [
    "Agendou",
    "Confirmar Agendamento",
    "Responder Confirmar Agendamento",
    "Aniversario",
    "Faltou",
    "Chegou",
    "Liberado",
    "Finalizou atendimento",
];


const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const messageId = searchParams.get('id'); // Get message ID from URL for editing

    const clinicId = clinicData?.id;
    const userPermissionLevel = parseInt(String(clinicData?.id_permissao), 10);
    const hasPermission = !isNaN(userPermissionLevel) && userPermissionLevel >= REQUIRED_PERMISSION_LEVEL;

    const [formData, setFormData] = useState<Partial<MessageItem>>({
        categoria: '',
        modelo_mensagem: '',
        midia_mensagem: '',
        id_instancia: '', // Use string for select value
        grupo: '',
        ativo: true,
        hora_envio: null,
        intervalo: null,
        para_funcionario: false,
        para_grupo: false,
        para_cliente: false,
        url_arquivo: '',
        prioridade: 1,
    });
    const [selectedServices, setSelectedServices] = useState<number[]>([]); // State for selected services
    const [timePickerDate, setTimePickerDate] = useState<Date | undefined>(undefined); // State for TimePicker

    // Fetch message data if editing
    const { data: messageData, isLoading: isLoadingMessage, error: messageError } = useQuery<MessageItem | null>({
        queryKey: ['messageConfig', messageId, clinicId],
        queryFn: async () => {
            if (!messageId || !clinicId) return null; // Only fetch if messageId and clinicId exist

            console.log(`Fetching message with ID ${messageId} for clinic ${clinicId}`);

            // Using the GET_ALL_MESSAGES_WEBHOOK_URL and filtering locally for now
            // **Replace with a dedicated GET BY ID webhook if available**
            const response = await fetch(GET_ALL_MESSAGES_WEBHOOK_URL, {
                 method: 'POST', // Assuming POST based on HTML
                 headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                 body: JSON.stringify({ clinic_id: clinicId }) // Sending clinic ID
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Erro ${response.status} ao buscar mensagem: ${errorText.substring(0, 100)}...`);
            }

            const data = await response.json();
            console.log("All messages data received:", data);

            // Assuming the webhook returns an array of messages for the clinic
            if (Array.isArray(data)) {
                 const foundMessage = data.find(msg => String(msg.id) === messageId);
                 if (foundMessage) {
                     console.log("Message found:", foundMessage);
                     return foundMessage as MessageItem;
                 } else {
                     console.warn(`Message with ID ${messageId} not found for clinic ${clinicId}.`);
                     return null;
                 }
            } else {
                 console.error("Unexpected data format from GET_ALL_MESSAGES_WEBHOOK_URL:", data);
                 throw new Error("Formato de resposta inesperado ao buscar mensagem.");
            }
        },
        enabled: !!messageId && !!clinicId && hasPermission, // Only enable if editing, clinicId exists, and has permission
        staleTime: 5 * 60 * 1000, // Cache message data for 5 minutes
        refetchOnWindowFocus: false,
    });

    // Fetch message-service links if editing
    const { data: messageServicesData, isLoading: isLoadingMessageServices, error: messageServicesError } = useQuery<MessageServiceLink[]>({
        queryKey: ['messageServices', messageId],
        queryFn: async () => {
            if (!messageId) return []; // Only fetch if messageId exists

            console.log(`Fetching message-service links for message ID ${messageId}`);

            const { data, error } = await supabase
                .from('north_clinic_mensagens_servicos')
                .select('id, id_mensagem, id_servico')
                .eq('id_mensagem', messageId);

            if (error) {
                console.error("Error fetching message-service links from Supabase:", error);
                throw new Error(error.message);
            }

            console.log("Message-service links data received:", data);
            return data || [];
        },
        enabled: !!messageId && hasPermission, // Only enable if editing and has permission
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });


    // Fetch Instances from Supabase
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceInfo[]>({
        queryKey: ['instancesListConfigPage', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        },
        enabled: !!clinicId && hasPermission,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch Services from Supabase
    const { data: servicesList, isLoading: isLoadingServices, error: servicesError } = useQuery<ServiceInfo[]>({
        queryKey: ['servicesListConfigPage', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            const { data, error } = await supabase
                .from('north_clinic_servicos')
                .select('id, nome')
                // Assuming services are also filtered by clinic ID
                .eq('id_clinica', clinicId)
                .order('nome', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        },
        enabled: !!clinicId && hasPermission,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });


    // Effect to populate form when messageData is loaded (for editing)
    useEffect(() => {
        if (messageData) {
            setFormData({
                id: messageData.id,
                categoria: messageData.categoria || '',
                modelo_mensagem: messageData.modelo_mensagem || '',
                midia_mensagem: messageData.midia_mensagem || '',
                id_instancia: messageData.id_instancia !== null && messageData.id_instancia !== undefined ? String(messageData.id_instancia) : '',
                grupo: messageData.grupo || '',
                ativo: messageData.ativo,
                hora_envio: messageData.hora_envio,
                intervalo: messageData.intervalo,
                para_funcionario: messageData.para_funcionario,
                para_grupo: messageData.para_grupo,
                para_cliente: messageData.para_cliente,
                url_arquivo: messageData.url_arquivo || '',
                prioridade: messageData.prioridade,
            });

            // Set TimePicker date if hora_envio exists
            if (messageData.hora_envio) {
                try {
                    // Parse HH:mm:ss string into a Date object (date part will be arbitrary, only time matters)
                    const [hours, minutes, seconds] = messageData.hora_envio.split(':').map(Number);
                    let date = new Date();
                    date = setHours(date, hours);
                    date = setMinutes(date, minutes);
                    date = setSeconds(date, seconds || 0); // Handle optional seconds
                    setTimePickerDate(date);
                } catch (e) {
                    console.error("Error parsing hora_envio:", messageData.hora_envio, e);
                    setTimePickerDate(undefined);
                }
            } else {
                 setTimePickerDate(undefined);
            }
        } else if (messageId) {
             // If messageId exists but messageData is null, it means message was not found or error occurred
             // Keep form empty, maybe show a message? Error state from useQuery handles this.
        }
    }, [messageData, messageId]);

    // Effect to populate selectedServices when messageServicesData is loaded (for editing)
    useEffect(() => {
        if (messageServicesData) {
            setSelectedServices(messageServicesData.map(link => link.id_servico));
        } else {
            setSelectedServices([]);
        }
    }, [messageServicesData]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSelectChange = (id: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleNumberInputChange = (id: string, value: string) => {
        const numValue = parseInt(value, 10);
        setFormData(prev => ({
            ...prev,
            [id]: isNaN(numValue) ? null : numValue // Save as number or null
        }));
    };

    const handleTimeChange = (date: Date | undefined) => {
        setTimePickerDate(date);
        // Format time as HH:mm:ss string for hora_envio
        const timeString = date ? format(date, 'HH:mm:ss') : null;
        setFormData(prev => ({
            ...prev,
            hora_envio: timeString
        }));
    };

    const handleServiceSelectChange = (selected: number[]) => {
        setSelectedServices(selected);
    };


    const saveMessageMutation = useMutation({
        mutationFn: async (dataToSave: Partial<MessageItem> & { selectedServices: number[] }) => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");

            const { selectedServices, ...messageDataToSave } = dataToSave;

            // Ensure id_instancia is saved as number or null
            const instanceIdNum = messageDataToSave.id_instancia ? parseInt(String(messageDataToSave.id_instancia), 10) : null;
            const finalMessageData = {
                 ...messageDataToSave,
                 id_clinica: clinicId, // Ensure clinic ID is included
                 id_instancia: isNaN(instanceIdNum as number) ? null : instanceIdNum, // Save as number or null
                 // Ensure boolean values are actually boolean
                 ativo: Boolean(messageDataToSave.ativo),
                 para_funcionario: Boolean(messageDataToSave.para_funcionario),
                 para_grupo: Boolean(messageDataToSave.para_grupo),
                 para_cliente: Boolean(messageDataToSave.para_cliente),
                 // Ensure prioridade is number
                 prioridade: messageDataToSave.prioridade !== undefined && messageDataToSave.prioridade !== null ? Number(messageDataToSave.prioridade) : 1,
                 // Ensure interval is number or null
                 intervalo: messageDataToSave.intervalo !== undefined && messageDataToSave.intervalo !== null ? Number(messageDataToSave.intervalo) : null,
                 // Ensure hora_envio is string or null (already handled by handleTimeChange)
                 hora_envio: messageDataToSave.hora_envio || null,
            };

            console.log("Saving message data:", finalMessageData);

            const response = await fetch(GENERIC_SAVE_WEBHOOK_URL, { // Using generic save webhook
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalMessageData)
            });

            if (!response.ok) {
                let errorText = await response.text();
                try { const errorJson = JSON.parse(errorText); errorText = errorJson.message || JSON.stringify(errorJson); } catch (e) { /* ignore */ }
                throw new Error(`Erro ${response.status}: ${errorText.substring(0, 200)}...`);
            }

            const result = await response.json();
            console.log("Save message webhook response:", result);

            // Assuming the webhook returns the saved message object, including its ID
            const savedMessageId = result?.id || messageData?.id; // Use new ID or existing ID

            if (!savedMessageId) {
                 console.warn("Save message webhook did not return an ID. Cannot save services.");
                 return result; // Return success for message, but warn about services
            }

            // --- Handle Message-Service Links ---
            console.log(`Handling service links for message ID: ${savedMessageId}`);

            // 1. Get current links from DB (if editing)
            const currentLinks = messageServicesData || [];
            const currentServiceIds = new Set(currentLinks.map(link => link.id_servico));
            const newServiceIds = new Set(selectedServices);

            const servicesToAdd = selectedServices.filter(serviceId => !currentServiceIds.has(serviceId));
            const servicesToRemove = currentLinks.filter(link => !newServiceIds.has(link.id_servico));

            console.log("Services to add:", servicesToAdd);
            console.log("Links to remove:", servicesToRemove);


            // 2. Delete links for services that are no longer selected
            for (const linkToRemove of servicesToRemove) {
                 console.log(`Deleting message_service link ID: ${linkToRemove.id}`);
                 const deleteResponse = await fetch(GENERIC_DELETE_WEBHOOK_URL, { // Using generic delete webhook
                     method: 'POST', // Assuming POST for delete webhook
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ id: linkToRemove.id }) // Send the link ID to delete
                 });
                 if (!deleteResponse.ok) {
                     let errorText = await deleteResponse.text();
                     try { const errorJson = JSON.parse(errorText); errorText = errorJson.message || JSON.stringify(errorJson); } catch (e) { /* ignore */ }
                     console.error(`Failed to delete message_service link ${linkToRemove.id}: ${errorText}`);
                     // Decide if you want to throw here or continue
                 } else {
                     console.log(`Deleted message_service link ID: ${linkToRemove.id}`);
                 }
            }

            // 3. Add links for newly selected services
            for (const serviceIdToAdd of servicesToAdd) {
                 console.log(`Adding message_service link for message ${savedMessageId} and service ${serviceIdToAdd}`);
                 const addResponse = await fetch(GENERIC_SAVE_WEBHOOK_URL, { // Using generic save webhook
                     method: 'POST', // Assuming POST for add webhook
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                         id_mensagem: savedMessageId,
                         id_servico: serviceIdToAdd,
                         // Add other required fields for north_clinic_mensagens_servicos if any
                     })
                 });
                 if (!addResponse.ok) {
                     let errorText = await addResponse.text();
                     try { const errorJson = JSON.parse(errorText); errorText = errorJson.message || JSON.stringify(errorJson); } catch (e) { /* ignore */ }
                     console.error(`Failed to add message_service link for message ${savedMessageId}, service ${serviceIdToAdd}: ${errorText}`);
                     // Decide if you want to throw here or continue
                 } else {
                     console.log(`Added message_service link for message ${savedMessageId}, service ${serviceIdToAdd}`);
                 }
            }

            return result; // Return the result from the main message save
        },
        onSuccess: () => {
            showSuccess(`Mensagem ${messageId ? 'atualizada' : 'configurada'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['messagesList', clinicId] }); // Invalidate list cache
            queryClient.invalidateQueries({ queryKey: ['messageConfig', messageId, clinicId] }); // Invalidate this message's cache
            queryClient.invalidateQueries({ queryKey: ['messageServices', messageId] }); // Invalidate services cache
            navigate('/dashboard/11'); // Navigate back to the list page (assuming 11 is the menu ID for the list)
        },
        onError: (error: Error) => {
            showError(`Erro ao salvar mensagem: ${error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation
        if (!formData.categoria || !formData.modelo_mensagem || formData.id_instancia === undefined || formData.id_instancia === null || formData.id_instancia === '') {
            showError("Por favor, preencha Categoria, Modelo da Mensagem e Instância.");
            return;
        }
        if (formData.prioridade === undefined || formData.prioridade === null || isNaN(Number(formData.prioridade)) || Number(formData.prioridade) < 1) {
             showError("Por favor, informe uma Prioridade válida (número maior que 0).");
             return;
        }

        // Include selectedServices in the data passed to the mutation
        saveMessageMutation.mutate({ ...formData, selectedServices });
    };

    const isLoading = isLoadingMessage || isLoadingInstances || isLoadingServices || isLoadingMessageServices || saveMessageMutation.isLoading;
    const fetchError = messageError || instancesError || servicesError || messageServicesError;

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


    return (
        <div className="config-message-container max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="config-header flex items-center justify-between mb-6">
                <h1 className="config-title text-2xl font-bold text-primary">
                    {messageId ? 'Editar Mensagem Automática' : 'Configurar Nova Mensagem'}
                </h1>
            </div>

            {isLoading && !fetchError ? (
                 <div className="loading-indicator flex flex-col items-center justify-center p-12 text-primary">
                     <Loader2 className="h-12 w-12 animate-spin mb-6" />
                     <span className="text-xl font-medium">Carregando dados da mensagem...</span>
                 </div>
            ) : fetchError ? (
                 <div className="error-message flex items-center gap-2 p-4 mb-6 bg-red-100 text-red-700 border border-red-300 rounded-md shadow-sm">
                     <TriangleAlert className="h-6 w-6 flex-shrink-0" />
                     <span className="text-lg font-semibold">Erro ao carregar dados: {fetchError.message}</span>
                     {/* Add retry button if needed */}
                 </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="form-group">
                            <Label htmlFor="categoria">Categoria <span className="text-red-500">*</span></Label>
                            <Select value={formData.categoria} onValueChange={(value) => handleSelectChange('categoria', value)} disabled={isLoading}>
                                <SelectTrigger id="categoria">
                                    <SelectValue placeholder="Selecione a categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Dynamically generated from CATEGORY_OPTIONS */}
                                    {CATEGORY_OPTIONS.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="form-group">
                            <Label htmlFor="id_instancia">Instância WhatsApp <span className="text-red-500">*</span></Label>
                            <Select value={String(formData.id_instancia)} onValueChange={(value) => handleSelectChange('id_instancia', value)} disabled={isLoadingInstances || isLoading}>
                                <SelectTrigger id="id_instancia">
                                    <SelectValue placeholder="Selecione a instância" />
                                </SelectTrigger>
                                <SelectContent>
                                    {instancesList?.map(instance => (
                                        <SelectItem key={instance.id} value={String(instance.id)}>
                                            {instance.nome_exibição || `ID ${instance.id}`} ({instance.telefone ? String(instance.telefone).slice(-4) : 'S/Tel'})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {instancesError && <p className="text-red-500 text-xs mt-1">Erro ao carregar instâncias.</p>}
                        </div>
                    </div>

                    <div className="form-group">
                        <Label htmlFor="modelo_mensagem">Modelo da Mensagem <span className="text-red-500">*</span></Label>
                        <Textarea
                            id="modelo_mensagem"
                            placeholder="Digite o texto da mensagem aqui. Use *texto* para negrito, _texto_ para itálico e \n para quebra de linha."
                            value={formData.modelo_mensagem || ''}
                            onChange={handleInputChange}
                            rows={6}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="form-group">
                            <Label htmlFor="prioridade">Prioridade <span className="text-red-500">*</span></Label>
                            <Input
                                id="prioridade"
                                type="number"
                                placeholder="1"
                                value={formData.prioridade ?? ''}
                                onChange={(e) => handleNumberInputChange('prioridade', e.target.value)}
                                disabled={isLoading}
                                min="1"
                            />
                            <p className="text-xs text-gray-500 mt-1">Mensagens com menor número são enviadas primeiro.</p>
                        </div>
                         <div className="form-group">
                            <Label htmlFor="intervalo">Intervalo (minutos)</Label>
                            <Input
                                id="intervalo"
                                type="number"
                                placeholder="Ex: 60"
                                value={formData.intervalo ?? ''}
                                onChange={(e) => handleNumberInputChange('intervalo', e.target.value)}
                                disabled={isLoading}
                                min="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">Tempo em minutos para reenviar a mensagem se não houver resposta (apenas para algumas categorias).</p>
                        </div>
                    </div>

                    {/* Conditional fields based on category */}
                    {formData.categoria === 'Confirmar Agendamento' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="form-group">
                                <Label htmlFor="hora_envio">Horário de Envio <span className="text-red-500">*</span></Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !timePickerDate && "text-muted-foreground"
                                            )}
                                            disabled={isLoading}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {timePickerDate ? format(timePickerDate, "HH:mm") : <span>Selecione o horário</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <TimePicker date={timePickerDate} setDate={handleTimeChange} />
                                    </PopoverContent>
                                </Popover>
                                {formData.categoria === 'Confirmar Agendamento' && !formData.hora_envio && (
                                     <p className="text-red-500 text-xs mt-1">Horário de envio é obrigatório para esta categoria.</p>
                                )}
                            </div>
                             {/* Add other fields specific to Confirmar Agendamento if needed */}
                        </div>
                    )}

                    {/* Services Multi-Select */}
                    <div className="form-group">
                        <Label htmlFor="selectedServices">Serviços Relacionados</Label>
                        {isLoadingServices ? (
                             <div className="flex items-center gap-2 text-gray-600">
                                 <Loader2 className="h-4 w-4 animate-spin" /> Carregando serviços...
                             </div>
                        ) : servicesError ? (
                             <div className="flex items-center gap-2 text-red-600">
                                 <TriangleAlert className="h-4 w-4" /> Erro ao carregar serviços.
                             </div>
                        ) : (
                            <MultiSelectServices
                                options={servicesList || []}
                                selectedIds={selectedServices}
                                onChange={handleServiceSelectChange}
                                disabled={isLoading}
                            />
                        )}
                         <p className="text-xs text-gray-500 mt-1">Selecione os serviços que disparam ou estão relacionados a esta mensagem.</p>
                    </div>


                    {/* Checkboxes for recipients */}
                    <div className="form-group space-y-2">
                        <Label>Enviar Para:</Label>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="para_cliente"
                                    checked={formData.para_cliente}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, para_cliente: Boolean(checked) }))}
                                    disabled={isLoading}
                                />
                                <Label htmlFor="para_cliente">Cliente</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="para_funcionario"
                                    checked={formData.para_funcionario}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, para_funcionario: Boolean(checked) }))}
                                    disabled={isLoading}
                                />
                                <Label htmlFor="para_funcionario">Funcionário</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="para_grupo"
                                    checked={formData.para_grupo}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, para_grupo: Boolean(checked) }))}
                                    disabled={isLoading}
                                />
                                <Label htmlFor="para_grupo">Grupo (se aplicável)</Label>
                            </div>
                        </div>
                    </div>

                    {/* Optional fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="form-group">
                            <Label htmlFor="midia_mensagem">URL da Mídia (Opcional)</Label>
                            <Input
                                id="midia_mensagem"
                                placeholder="Ex: https://exemplo.com/imagem.jpg"
                                value={formData.midia_mensagem || ''}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                             <p className="text-xs text-gray-500 mt-1">URL de uma imagem, vídeo ou documento para enviar com a mensagem.</p>
                        </div>
                         <div className="form-group">
                            <Label htmlFor="grupo">Nome do Grupo (Opcional)</Label>
                            <Input
                                id="grupo"
                                placeholder="Nome do grupo para envio"
                                value={formData.grupo || ''}
                                onChange={handleInputChange}
                                disabled={isLoading || !formData.para_grupo} // Disable if 'Para Grupo' is not checked
                            />
                             <p className="text-xs text-gray-500 mt-1">Nome do grupo se a mensagem for enviada para um grupo.</p>
                        </div>
                    </div>


                    <div className="form-actions flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/11')} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading || saveMessageMutation.isLoading}>
                            {saveMessageMutation.isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                messageId ? 'Atualizar Mensagem' : 'Configurar Mensagem'
                            )}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default MensagensConfigPage;