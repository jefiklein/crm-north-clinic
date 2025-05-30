import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; 
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch"; 
import { Search, Plus, MessagesSquare, Trash2, RefreshCw, QrCode, Info, TriangleAlert, Loader2, CheckCircle2, XCircle, Save } from 'lucide-react'; 
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn, formatPhone } from '@/lib/utils'; 
import { showSuccess, showError } from '@/utils/toast'; 
import { supabase } from '@/integrations/supabase/client'; 

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface InstanceInfo {
    id: number; 
    nome_exibição: string;
    telefone: number | null;
    tipo: string | null;
    nome_instancia_evolution: string | null; 
    trackeamento: boolean;
    historico: boolean;
    id_server_evolution: number | null;
    confirmar_agendamento: boolean;
    id_funcionario?: number | null; 
}

interface InstanceStatus {
    instance?: {
        state: string; 
        status: string; 
    };
}

interface QrCodeResponse {
    qrCodeBase64?: string; 
    message?: string; 
}

interface EmployeeInfo {
    id: number;
    nome: string;
}

interface WhatsappInstancesPageProps {
    clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const INSTANCE_STATUS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/2392af84-3d33-4526-a64b-d1b7fd78dddc`; 
const INSTANCE_QR_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/e55ad937-44fc-4571-ac17-8b71d610d7c3`; 
const INSTANCE_DELETE_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/0f301331-e090-4d26-b15d-960ef0d518c8`; 
const INSTANCE_CREATE_EVOLUTION_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/c5c567ef-6cdf-4144-86cb-909cf92102e7`; 
const INSTANCE_CREATE_DB_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/dc047481-f110-42dc-b444-7790bcc5b977`; 
const INSTANCE_UPDATE_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/5508f715-27a5-447c-86d4-2026e1517a21`; 

const REQUIRED_PERMISSION_LEVEL = 1; 

const POLLING_INTERVAL_MS = 5000; 
const POLLING_TIMEOUT_MS = 120000; 


function validatePhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 13;
}

function normalizeText(text: string | null): string {
    if(!text) return '';
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const WhatsappInstancesPage: React.FC<WhatsappInstancesPageProps> = ({ clinicData }) => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [qrTimer, setQrTimer] = useState(30);
    const [currentInstanceForQr, setCurrentInstanceForQr] = useState<InstanceInfo | null>(null);
    const [isAddInstanceModalOpen, setIsAddInstanceModalOpen] = useState(false);
    const [addInstanceFormData, setAddInstanceFormData] = useState({ nome_exibição: '', telefone: '', tipo: '' });
    const [addInstanceAlert, setAddInstanceAlert] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

    const [instanceEmployeeLinks, setInstanceEmployeeLinks] = useState<Record<number, number | null>>({});
    const [isSavingInstance, setIsSavingInstance] = useState<Record<number, boolean>>({});

    const qrTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const connectionCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clinicId = clinicData?.id;
    const userPermissionLevel = parseInt(String(clinicData?.id_permissao), 10);
    const hasPermission = !isNaN(userPermissionLevel) && userPermissionLevel >= REQUIRED_PERMISSION_LEVEL;

    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError, refetch: refetchInstances } = useQuery<InstanceInfo[]>({
        queryKey: ['whatsappInstances', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log("[WhatsappInstancesPage] Fetching instance list directly from Supabase...");

            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, tipo, nome_instancia_evolution, trackeamento, historico, id_server_evolution, confirmar_agendamento, id_funcionario') 
                .eq('id_clinica', clinicId) 
                .order('nome_exibição', { ascending: true }); 

            console.log('[WhatsappInstancesPage] Supabase instance list fetch result:', { data, error });

            if (error) {
                 console.error('[WhatsappInstancesPage] Supabase instance list fetch error:', error);
                 throw new Error(`Erro ao buscar instâncias: ${error.message}`);
            }
            return data || [];
        },
        enabled: hasPermission && !!clinicId, 
        staleTime: 60 * 1000, 
        refetchOnWindowFocus: false,
    });

    const { data: employeesList, isLoading: isLoadingEmployees, error: employeesError } = useQuery<EmployeeInfo[]>({
        queryKey: ['clinicEmployees', clinicId],
        queryFn: async () => {
            if (!clinicId) throw new Error("ID da clínica não disponível.");
            console.log("[WhatsappInstancesPage] Fetching employees list directly from Supabase...");

            const { data, error } = await supabase
                .from('north_clinic_funcionarios')
                .select('id, nome') 
                .eq('id_clinica', clinicId) 
                .order('nome', { ascending: true }); 

            console.log('[WhatsappInstancesPage] Supabase employees list fetch result:', { data, error });

            if (error) {
                 console.error('[WhatsappInstancesPage] Supabase employees list fetch error:', error);
                 throw new Error(`Erro ao buscar funcionários: ${error.message}`);
            }
            return data || [];
        },
        enabled: hasPermission && !!clinicId, 
        staleTime: 5 * 60 * 1000, 
        refetchOnWindowFocus: false,
    });

    const linkedEmployeeIds = useMemo(() => {
        const ids = new Set<number>();
        instancesList?.forEach(instance => {
            if (instance.id_funcionario !== null && instance.id_funcionario !== undefined) {
                ids.add(instance.id_funcionario);
            }
        });
        console.log("[WhatsappInstancesPage] Linked employee IDs:", ids);
        return ids;
    }, [instancesList]);

    useEffect(() => {
        console.log("[WhatsappInstancesPage] Initializing instanceEmployeeLinks state...");
        if (instancesList) {
            const initialLinks: Record<number, number | null> = {};
            instancesList.forEach(instance => {
                initialLinks[instance.id] = instance.id_funcionario ?? null;
            });
            setInstanceEmployeeLinks(initialLinks);
            console.log("[WhatsappInstancesPage] instanceEmployeeLinks initialized:", initialLinks);
        } else {
             setInstanceEmployeeLinks({}); 
             console.log("[WhatsappInstancesPage] instanceEmployeeLinks cleared as instancesList is null/undefined.");
        }
    }, [instancesList]); 

    const [instanceStatuses, setInstanceStatuses] = useState<Record<string, InstanceStatus>>({});

    const fetchInstanceStatus = async (instanceIdentifier: string): Promise<InstanceStatus | null> => {
        try {
            const response = await fetch(INSTANCE_STATUS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome_instancia: instanceIdentifier })
            });

            if (!response.ok && response.status !== 404) {
                const errorText = await response.text();
                console.error(`[WhatsappInstancesPage] Status fetch failed for ${instanceIdentifier}: ${response.status} - ${errorText}`);
                return null;
            }
            if (response.status === 404) {
                return { instance: { state: 'not_found', status: 'not_found' } };
            }

            const statusData: InstanceStatus[] = await response.json();
            if (Array.isArray(statusData) && statusData.length > 0 && statusData[0]?.instance?.state) {
                return statusData[0];
            } else {
                console.warn(`[WhatsappInstancesPage] Unexpected status response format for ${instanceIdentifier}:`, statusData);
                return { instance: { state: 'unknown', status: 'unknown' } };
            }
        } catch (error) {
            console.error(`[WhatsappInstancesPage] Error fetching status for ${instanceIdentifier}:`, error);
            return null;
        }
    };

    useEffect(() => {
        if (!instancesList || instancesList.length === 0) {
            setInstanceStatuses({});
            return;
        }

        const fetchAllStatuses = async () => {
            const statusEntries = await Promise.all(
                instancesList.map(async (instance) => {
                    const identifier = instance.nome_instancia_evolution || instance.nome_instancia || '';
                    if (!identifier) return null;
                    const status = await fetchInstanceStatus(identifier);
                    return status ? [identifier, status] : null;
                })
            );

            const statusMap: Record<string, InstanceStatus> = {};
            statusEntries.forEach(entry => {
                if (entry) {
                    const [id, status] = entry;
                    statusMap[id] = status;
                }
            });

            setInstanceStatuses(statusMap);
        };

        fetchAllStatuses();
    }, [instancesList]);

    const qrCodeMutation = useMutation({
        mutationFn: async (instanceIdentifier: string) => {
            console.log(`[WhatsappInstancesPage] Requesting QR Code for: ${instanceIdentifier}`);
            const response = await fetch(INSTANCE_QR_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome_instancia: instanceIdentifier })
            });

            const contentType = response.headers.get('content-type');
            if (!response.ok) {
                let errorMsg = `Erro ${response.status}`;
                try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
                throw new Error(errorMsg);
            }

            if (contentType && contentType.includes('image/png')) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                return { qrCodeUrl: url, message: 'QR Code gerado.' };
            } else if (contentType && contentType.includes('application/json')) {
                const data: QrCodeResponse = await response.json();
                if (data.qrCodeBase64) {
                    const url = `data:image/png;base64,${data.qrCodeBase64}`;
                    return { qrCodeUrl: url, message: data.message || 'QR Code (base64) gerado.' };
                } else {
                    throw new Error(data.message || 'Resposta JSON sem QR Code.');
                }
            } else {
                 const textResponse = await response.text();
                 console.warn("[WhatsappInstancesPage] Unexpected QR response content type:", contentType, "Response text:", textResponse.substring(0, 100));
                throw new Error('Formato de resposta do QR Code inesperado.');
            }
        },
        onSuccess: (data, instanceIdentifier) => {
            setQrCodeUrl(data.qrCodeUrl);
            setIsQrModalOpen(true);
            startQrTimer();
            startConnectionPolling(instanceIdentifier);
        },
        onError: (error: Error, instanceIdentifier) => {
            showError(`Erro ao gerar QR Code para ${instanceIdentifier}: ${error.message}`);
        },
    });

    const checkStatusMutation = useMutation({
        mutationFn: async (instanceIdentifier: string) => {
            console.log(`[WhatsappInstancesPage] Polling status for: ${instanceIdentifier}`);
            const response = await fetch(INSTANCE_STATUS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome_instancia: instanceIdentifier })
            });

            if (!response.ok && response.status !== 404) { 
                const errorText = await response.text();
                console.error(`[WhatsappInstancesPage] Polling status check failed for ${instanceIdentifier}: ${response.status} - ${errorText}`);
                throw new Error(`Erro ${response.status}`);
            }
            if (response.status === 404) {
                console.log(`[WhatsappInstancesPage] Status 404 for ${instanceIdentifier}, likely not ready yet.`);
                return { instance: { state: 'not_found', status: 'not_found' } } as InstanceStatus;
            }

            const statusData: InstanceStatus[] = await response.json();
            if (Array.isArray(statusData) && statusData.length > 0 && statusData[0]?.instance?.state) {
                return statusData[0]; 
            } else {
                console.warn(`[WhatsappInstancesPage] Unexpected status response format for ${instanceIdentifier}:`, statusData);
                return { instance: { state: 'unknown', status: 'unknown' } } as InstanceStatus;
            }
        },
        onSuccess: (data, instanceIdentifier) => {
            setInstanceStatuses(prev => ({
                ...prev,
                [instanceIdentifier]: data
            }));

            const state = data?.instance?.state;
            console.log(`[WhatsappInstancesPage] Polling status received for ${instanceIdentifier}: ${state}`);

            if (state === "open") {
                stopConnectionPolling();
                stopQrTimer();
                setIsQrModalOpen(false); 
                showSuccess(`Instância "${currentInstanceForQr?.nome_exibição || instanceIdentifier}" conectada com sucesso!`);
                refetchInstances(); 
            }
        },
        onError: (error: Error, instanceIdentifier) => {
            console.error(`[WhatsappInstancesPage] Polling status error for ${instanceIdentifier}:`, error.message);
        },
    });

    const deleteInstanceMutation = useMutation({
        mutationFn: async (instanceId: number) => {
            console.log(`[WhatsappInstancesPage] Attempting to delete instance with ID: ${instanceId}`);
            const deleteWebhookUrl = `${N8N_BASE_URL}/webhook/0f301331-e090-4d26-b15d-960ef0d518c8`; 
            const response = await fetch(deleteWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: instanceId }) 
            });

            if (!response.ok) {
                let errorMsg = `Erro ${response.status}`;
                try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
                throw new Error(errorMsg);
            }
            return response.json(); 
        },
        onSuccess: (_, instanceId) => {
            showSuccess(`Instância excluída com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['whatsappInstances', clinicId] });
        },
        onError: (error: Error, instanceId) => {
            const instance = instancesList?.find(inst => inst.id === instanceId);
            const instanceName = instance?.nome_exibição || `ID ${instanceId}`;
            showError(`Erro ao excluir instância "${instanceName}": ${error.message}`);
        },
    });

    const createInstanceMutation = useMutation({
        mutationFn: async (instanceData: { nome_exibição: string; telefone: string; tipo: string }) => {
            if (!clinicId) throw new Error("ID da clínica não definido.");

            const normalizedType = normalizeText(instanceData.tipo);
            const normalizedName = normalizeText(instanceData.nome_exibição);
            const uniqueIdentifier = `${clinicId}_${normalizedType}_${normalizedName}`;

            console.log("[WhatsappInstancesPage] Attempting to create Evolution instance via webhook:", uniqueIdentifier);
            const evolutionWebhookUrl = `${N8N_BASE_URL}/webhook/c5c567ef-6cdf-4144-86cb-909cf92102e7`; 
            const evolutionResponse = await fetch(evolutionWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome_instancia: uniqueIdentifier }) 
            });

            if (!evolutionResponse.ok) {
                let evolutionErrorMsg = `Erro ${evolutionResponse.status} API Criação`;
                try { const errorData = await evolutionResponse.json(); evolutionErrorMsg = errorData.message || JSON.stringify(errorData) || evolutionErrorMsg; } catch (e) { evolutionErrorMsg = `${evolutionErrorMsg}: ${await evolutionResponse.text()}`; }
                throw new Error(`Falha ao criar instância na API Evolution: ${evolutionErrorMsg}`);
            }

            const dbWebhookUrl = `${N8N_BASE_URL}/webhook/dc047481-f110-42dc-b444-7790bcc5b977`; 
            const dbResponse = await fetch(dbWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_clinica: clinicId,
                    nome_exibição: instanceData.nome_exibição,
                    nome_instancia_evolution: uniqueIdentifier, 
                    telefone: instanceData.telefone,
                    tipo: instanceData.tipo,
                    trackeamento: false,
                    historico: false,
                    confirmar_agendamento: false,
                    id_server_evolution: null,
                })
            };

            if (!dbResponse.ok) {
                let dbErrorMsg = `Erro ${dbResponse.status} ao salvar no DB`;
                try { const dbErrorData = await dbResponse.json(); dbErrorMsg = dbErrorData.message || JSON.stringify(dbErrorData) || dbErrorMsg; } catch(e) { dbErrorMsg = `${dbErrorMsg}: ${await dbResponse.text()}`; }
                throw new Error(`Instância criada na API Evolution, mas falhou ao salvar no banco de dados: ${dbErrorMsg}`);
            }

            const dbData = await dbResponse.json();
            console.log("[WhatsappInstancesPage] Instance saved to DB:", dbData);

            const qrResponse = await fetch(INSTANCE_QR_WEBHOOK_URL, {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ nome_instancia: uniqueIdentifier }) 
            });

            let qrCodeUrl = null;
            if (qrResponse.ok) {
                 const contentType = qrResponse.headers.get('content-type');
                 if (contentType && contentType.includes('image/png')) {
                     const blob = await qrResponse.blob();
                     qrCodeUrl = URL.createObjectURL(blob);
                 } else if (contentType && contentType.includes('application/json')) {
                     const qrData: QrCodeResponse = await qrResponse.json();
                     if (qrData.qrCodeBase64) {
                         qrCodeUrl = `data:image/png;base64,${qrData.qrCodeBase64}`;
                     }
                 }
            } else {
                 console.warn("[WhatsappInstancesPage] Failed to get QR code immediately after creation:", qrResponse.status);
            }

            return { success: true, message: 'Instância criada e salva.', qrCodeUrl: qrCodeUrl, instanceIdentifier: uniqueIdentifier, dbData: dbData };
        },
        onSuccess: (data) => {
            showSuccess(data.message || 'Instância criada com sucesso!');
            setIsAddInstanceModalOpen(false);
            setAddInstanceFormData({ nome_exibição: '', telefone: '', tipo: '' });
            queryClient.invalidateQueries({ queryKey: ['whatsappInstances', clinicId] });

            if (data.qrCodeUrl && data.instanceIdentifier && data.dbData?.id) { 
                 const newInstanceInfo: InstanceInfo = {
                     id: data.dbData.id, 
                     nome_exibição: addInstanceFormData.nome_exibição,
                     telefone: Number(addInstanceFormData.telefone),
                     tipo: addInstanceFormData.tipo,
                     nome_instancia_evolution: data.instanceIdentifier,
                     trackeamento: false, historico: false, id_server_evolution: null, confirmar_agendamento: false,
                     id_funcionario: null 
                 };
                 setCurrentInstanceForQr(newInstanceInfo);
                 setQrCodeUrl(data.qrCodeUrl);
                 setIsQrModalOpen(true);
                 startQrTimer();
                 startConnectionPolling(data.instanceIdentifier);
            } else {
                 showError("Instância criada, mas não foi possível gerar o QR Code automaticamente. Gere manualmente na lista.");
            }
        },
        onError: (error: Error) => {
            showError(`Erro ao criar instância: ${error.message}`);
        },
    });

    const updateInstanceMutation = useMutation({
        mutationFn: async (updateData: { instanceId: number; id_funcionario?: number | null; trackeamento?: boolean }) => { 
            if (!clinicId) throw new Error("ID da clínica não definido.");
            
            const { instanceId, id_funcionario, trackeamento } = updateData;
            let payload: any = { id: instanceId, id_clinica: clinicId };

            if (id_funcionario !== undefined) {
                payload.id_funcionario = id_funcionario;
                console.log(`[WhatsappInstancesPage] Attempting to update instance ${instanceId}: Linking to employee ID ${id_funcionario} via webhook`);
            }
            if (trackeamento !== undefined) {
                payload.trackeamento = trackeamento;
                console.log(`[WhatsappInstancesPage] Attempting to update instance ${instanceId}: Setting trackeamento to ${trackeamento} via webhook`);
            }
            
            const response = await fetch(INSTANCE_UPDATE_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorMsg = `Erro ${response.status} ao atualizar instância`;
                try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
                throw new Error(errorMsg);
            }
            return response.json();
        },
        onSuccess: (_, variables) => {
            let successMessage = `Instância ${variables.instanceId} atualizada!`;
            if (variables.id_funcionario !== undefined) {
                successMessage = `Vínculo de funcionário para instância ${variables.instanceId} salvo!`;
            }
            if (variables.trackeamento !== undefined) {
                successMessage = `Configuração 'Recebe Leads' para instância ${variables.instanceId} salva!`;
            }
            showSuccess(successMessage);
            queryClient.invalidateQueries({ queryKey: ['whatsappInstances', clinicId] });
            setIsSavingInstance(prev => ({ ...prev, [variables.instanceId]: false }));
        },
        onError: (error: Error, variables) => {
            showError(`Erro ao atualizar instância ${variables.instanceId}: ${error.message}`);
            setIsSavingInstance(prev => ({ ...prev, [variables.instanceId]: false }));
        },
    });

    const stopQrTimer = () => {
        if (qrTimerIntervalRef.current) {
            clearInterval(qrTimerIntervalRef.current);
            qrTimerIntervalRef.current = null;
        }
    };

    const startQrTimer = () => {
        stopQrTimer();
        setQrTimer(30);
        qrTimerIntervalRef.current = setInterval(() => {
            setQrTimer(prev => {
                if (prev <= 1) {
                    stopQrTimer();
                    if (currentInstanceForQr) {
                        const instanceIdentifier = currentInstanceForQr.nome_instancia_evolution || currentInstanceForQr.nome_instancia || '';
                        if (instanceIdentifier) {
                            qrCodeMutation.mutate(instanceIdentifier);
                        } else {
                            showError("Não foi possível renovar o QR Code: Identificador da instância ausente.");
                            setQrCodeUrl(null);
                            setIsQrModalOpen(false);
                        }
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopConnectionPolling = () => {
        if (connectionCheckIntervalRef.current) {
            clearInterval(connectionCheckIntervalRef.current);
            connectionCheckIntervalRef.current = null;
        }
        if (connectionCheckTimeoutRef.current) {
            clearTimeout(connectionCheckTimeoutRef.current);
            connectionCheckTimeoutRef.current = null;
        }
    };

    const startConnectionPolling = (instanceIdentifier: string) => {
        stopConnectionPolling();

        connectionCheckIntervalRef.current = setInterval(async () => {
            try {
                const status = await checkStatusMutation.mutateAsync(instanceIdentifier);
                if (status?.instance?.state === "open") {
                    stopConnectionPolling();
                    stopQrTimer();
                    setIsQrModalOpen(false); 
                    showSuccess(`Instância "${currentInstanceForQr?.nome_exibição || instanceIdentifier}" conectada com sucesso!`);
                    refetchInstances(); 
                }
            } catch (error) {
                
            }
        }, POLLING_INTERVAL_MS);

        connectionCheckTimeoutRef.current = setTimeout(() => {
            stopConnectionPolling();
            showError(`Tempo limite para conectar a instância "${currentInstanceForQr?.nome_exibição || instanceIdentifier}" excedido. Tente reconectar manualmente.`);
        }, POLLING_TIMEOUT_MS);
    };

    useEffect(() => {
        return () => {
            stopQrTimer();
            stopConnectionPolling();
            if (qrCodeUrl && qrCodeUrl.startsWith('blob:')) {
                URL.revokeObjectURL(qrCodeUrl);
            }
        };
    }, [qrCodeUrl]);


    const handleReconnectClick = (instanceIdentifier: string) => {
        const instance = instancesList?.find(inst => (inst.nome_instancia_evolution || inst.nome_instancia) === instanceIdentifier);
        if (instance) {
            setCurrentInstanceForQr(instance);
            qrCodeMutation.mutate(instanceIdentifier);
        } else {
            showError("Dados da instância não encontrados para reconectar.");
        }
    };

    const handleDeleteClick = (instanceId: number, instanceName: string) => {
        if (window.confirm(`Tem certeza que deseja excluir a instância "${instanceName}" (ID: ${instanceId})?\n\nATENÇÃO: Esta ação não pode ser desfeita!`)) {
            deleteInstanceMutation.mutate(instanceId);
        }
    };

    const handleEmployeeChange = (instanceId: number, employeeId: string) => {
        const id = employeeId === 'none' ? null : parseInt(employeeId, 10);
        setInstanceEmployeeLinks(prev => ({
            ...prev,
            [instanceId]: id
        }));
        console.log(`[WhatsappInstancesPage] Employee link changed for instance ${instanceId} to employee ID: ${id}`);
    };

    const handleSaveEmployeeLink = (instance: InstanceInfo) => {
        const instanceId = instance.id;
        const newEmployeeId = instanceEmployeeLinks[instanceId];

        if ((newEmployeeId === null && instance.id_funcionario === null) || newEmployeeId === instance.id_funcionario) {
            console.log(`[WhatsappInstancesPage] No change detected for instance ${instanceId} employee link. Save skipped.`);
            return; 
        }

        console.log(`[WhatsappInstancesPage] Saving employee link for instance ${instanceId}: New employee ID is ${newEmployeeId}`);
        setIsSavingInstance(prev => ({ ...prev, [instanceId]: true })); 
        updateInstanceMutation.mutate({ instanceId: instanceId, id_funcionario: newEmployeeId }); 
    };

    const handleTrackeamentoChange = (instance: InstanceInfo, checked: boolean) => {
        const instanceId = instance.id;
        console.log(`[WhatsappInstancesPage] Changing 'Recebe Leads' for instance ${instanceId} to ${checked}`);
        setIsSavingInstance(prev => ({ ...prev, [instanceId]: true }));
        updateInstanceMutation.mutate({ instanceId: instanceId, trackeamento: checked });
    };

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

    const overallLoading = isLoadingInstances || isLoadingEmployees;
    const overallError = instancesError || employeesError;

    return (
        <div className="whatsapp-instances-container flex flex-col h-full p-6 bg-gray-100">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                    Instâncias WhatsApp 
                </h1>
                <div className="search-wrapper flex items-center gap-4 flex-grow min-w-[250px]">
                    <div className="relative flex-grow max-w-sm">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                         <Input
                            type="text"
                            placeholder="Buscar instâncias..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                         />
                    </div>
                    <span id="recordsCount" className="text-sm text-gray-600 whitespace-nowrap">
                        {overallLoading ? 'Carregando...' : `${instancesList?.length || 0} registro(s)`}
                    </span>
                </div>
                <Button onClick={() => setIsAddInstanceModalOpen(true)} className="flex-shrink-0">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Instância
                </Button>
            </div>

            <Card className="instances-list-container h-full flex flex-col">
                <CardContent className="p-0 flex-grow overflow-y-auto">
                    {overallLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-primary p-8">
                            <Loader2 className="h-12 w-12 animate-spin mb-4" />
                            <span className="text-lg">Carregando dados...</span>
                        </div>
                    ) : overallError ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 p-8 bg-red-50 rounded-md">
                            <TriangleAlert className="h-12 w-12 mb-4" />
                            <span className="text-lg text-center">Erro ao carregar dados: {overallError.message}</span>
                            <Button variant="outline" onClick={() => { refetchInstances(); queryClient.invalidateQueries({ queryKey: ['clinicEmployees', clinicId] }); }} className="mt-4">Tentar Novamente</Button>
                        </div>
                    ) : (instancesList?.length || 0) === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-gray-600 p-8 bg-gray-50 rounded-md">
                            <Info className="h-16 w-16 mb-6 mx-auto text-gray-400" />
                            <span className="text-lg text-center">Nenhuma instância encontrada.</span>
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            {instancesList.filter(instance => 
                                (instance.nome_exibição || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (instance.telefone?.toString() || '').includes(searchTerm)
                            ).map(instance => { 
                                const instanceIdentifier = instance.nome_instancia_evolution || instance.nome_instancia || '';
                                const instanceDbId = instance.id;
                                const status = instanceStatuses[instanceIdentifier];
                                let statusContent = (
                                    <span className="flex items-center gap-1 text-sm font-medium text-gray-500">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando status...
                                    </span>
                                );

                                if (status) {
                                    const state = status.instance?.state || 'unknown';
                                    if (state === 'open') {
                                        statusContent = (
                                            <span className="flex items-center gap-1 text-green-600 font-semibold">
                                                <CheckCircle2 className="h-4 w-4" /> Conectado
                                            </span>
                                        );
                                    } else if (state === 'close' || state === 'connecting') {
                                        statusContent = (
                                            <span className="flex items-center gap-1 text-red-600 font-semibold">
                                                <XCircle className="h-4 w-4" /> Desconectado
                                            </span>
                                        );
                                    } else if (state === 'not_found') {
                                        statusContent = (
                                            <span className="flex items-center gap-1 text-gray-600 font-semibold">
                                                <XCircle className="h-4 w-4" /> Não Encontrado
                                            </span>
                                        );
                                    } else {
                                        statusContent = (
                                            <span className="flex items-center gap-1 text-gray-600 font-semibold">
                                                <XCircle className="h-4 w-4" /> {state}
                                            </span>
                                        );
                                    }
                                }

                                const showReconnectButton = status && (status.instance?.state === 'close' || status.instance?.state === 'connecting');
                                const originalEmployeeId = instance.id_funcionario ?? null;
                                const currentSelectedEmployeeId = instanceEmployeeLinks[instanceDbId] ?? null;
                                const hasChanges = currentSelectedEmployeeId !== originalEmployeeId;
                                const isSavingThisInstance = isSavingInstance[instanceDbId] ?? false;


                                return (
                                    <div
                                        key={instanceDbId}
                                        className="whatsapp-item grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_minmax(0,auto)] items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors gap-x-4 gap-y-3" 
                                    >
                                        <MessagesSquare className="h-8 w-8 text-green-600 flex-shrink-0 md:row-span-2 self-center" /> 
                                        
                                        <div className="whatsapp-info flex flex-col flex-grow min-w-[150px] md:col-start-2"> 
                                            <span className="display-name text-base font-semibold">{instance.nome_exibição || 'Sem nome'}</span>
                                            <span className="instance-phone text-sm text-gray-600">{formatPhone(instance.telefone)}</span>
                                            {instance.tipo && (
                                                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 select-none w-fit">
                                                    Tipo: {instance.tipo}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-start gap-1 min-w-[120px] md:col-start-3"> 
                                            <Label htmlFor={`trackeamento-${instanceDbId}`} className="text-xs font-medium text-gray-700 whitespace-nowrap">
                                                Recebe Leads
                                            </Label>
                                            <Switch
                                                id={`trackeamento-${instanceDbId}`}
                                                checked={instance.trackeamento}
                                                onCheckedChange={(checked) => handleTrackeamentoChange(instance, checked)}
                                                disabled={isSavingThisInstance || updateInstanceMutation.isLoading && updateInstanceMutation.variables?.instanceId === instanceDbId && updateInstanceMutation.variables?.trackeamento !== undefined}
                                                className="data-[state=checked]:bg-green-500"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1 min-w-[150px] md:col-start-4"> 
                                            <Label htmlFor={`employee-link-${instanceDbId}`} className="text-xs font-medium text-gray-700">
                                                Funcionário Vinculado
                                            </Label>
                                            {isLoadingEmployees ? (
                                                 <span className="text-sm text-gray-500 flex items-center gap-1">
                                                     <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                                                 </span>
                                            ) : employeesError ? (
                                                 <span className="text-sm text-red-600">Erro ao carregar funcionários.</span>
                                            ) : (employeesList?.length ?? 0) === 0 ? (
                                                 <span className="text-sm text-orange-600">Nenhum funcionário disponível.</span>
                                            ) : (
                                                <Select
                                                    value={instanceEmployeeLinks[instanceDbId]?.toString() || 'none'} 
                                                    onValueChange={(value) => handleEmployeeChange(instanceDbId, value)}
                                                    disabled={isSavingThisInstance} 
                                                >
                                                    <SelectTrigger id={`employee-link-${instanceDbId}`} className="h-8 text-sm">
                                                        <SelectValue placeholder="Vincular funcionário" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">-- Nenhum --</SelectItem> 
                                                        {employeesList?.map(employee => (
                                                            <SelectItem key={employee.id} value={employee.id.toString()}>
                                                                <div className="flex items-center gap-2"> 
                                                                    <span>{employee.nome}</span>
                                                                    {linkedEmployeeIds && linkedEmployeeIds.has(employee.id) && instance.id_funcionario !== employee.id && ( 
                                                                        <MessagesSquare className="h-3 w-3 text-green-600" title="Vinculado a outra instância" />
                                                                    )}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>

                                        <div className="whatsapp-status flex items-center gap-2 text-sm font-medium flex-shrink-0 md:col-start-5 md:ml-auto"> 
                                            {statusContent}
                                        </div>
                                        
                                        <div className="actions-group flex flex-wrap gap-2 items-center md:col-start-2 md:col-span-5 mt-2 md:mt-0"> 
                                            {showReconnectButton && instanceIdentifier && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReconnectClick(instanceIdentifier)}
                                                    className="flex items-center gap-1 text-xs h-auto py-1 px-2 flex-shrink-0"
                                                    disabled={isSavingThisInstance}
                                                >
                                                    Reconectar
                                                </Button>
                                            )}
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleSaveEmployeeLink(instance)}
                                                className="flex items-center gap-1 text-xs h-auto py-1 px-2 flex-shrink-0"
                                                disabled={!hasChanges || isSavingThisInstance || (updateInstanceMutation.isLoading && updateInstanceMutation.variables?.instanceId === instanceDbId && updateInstanceMutation.variables?.id_funcionario !== undefined)}
                                            >
                                                {isSavingThisInstance && updateInstanceMutation.variables?.id_funcionario !== undefined ? ( 
                                                    <><Loader2 className="h-3 w-3 animate-spin mr-1" />Salvar</>
                                                ) : (
                                                    <><Save className="h-3 w-3 mr-1" />Salvar</>
                                                )}
                                            </Button>
                                            {instanceDbId ? (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDeleteClick(instanceDbId, instance.nome_exibição || `ID ${instanceDbId}`)}
                                                    className="flex items-center gap-1 text-xs h-auto py-1 px-2 flex-shrink-0"
                                                    disabled={deleteInstanceMutation.isLoading || isSavingThisInstance}
                                                >
                                                    {deleteInstanceMutation.isLoading ? (
                                                         <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                         <Trash2 className="h-3 w-3" />
                                                    )}
                                                    Excluir
                                                </Button>
                                            ) : (
                                                 <Button variant="secondary" size="sm" className="flex items-center gap-1 text-xs h-auto py-1 px-2 flex-shrink-0" disabled title="ID não encontrado">
                                                    <Trash2 className="h-3 w-3" /> Excluir
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
                <DialogContent className="sm:max-w-[425px] text-center">
                    <DialogHeader>
                        <DialogTitle>Conectar Whatsapp</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-4">
                        <p className="text-gray-700 mb-4">Leia o QR Code com o seu Whatsapp:</p>
                        {qrCodeMutation.isLoading ? (
                             <div className="flex flex-col items-center">
                                 <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                                 <span>Gerando QR Code...</span>
                             </div>
                        ) : qrCodeUrl ? (
                            <img src={qrCodeUrl} alt="QR Code" className="max-w-[250px] h-auto mx-auto" />
                        ) : (
                             <div className="text-red-500">Falha ao carregar QR Code.</div>
                        )}
                        <div id="qrTimer" className="mt-4 text-lg font-bold text-primary">
                            {qrTimer > 0 ? `Novo QR Code em: ${qrTimer}s` : 'Gerando novo QR...'}
                        </div>
                         {qrCodeMutation.error && (
                             <div className="text-red-500 text-sm mt-2">Erro: {(qrCodeMutation.error as Error).message}</div>
                         )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" onClick={() => { stopQrTimer(); stopConnectionPolling(); setCurrentInstanceForQr(null); setQrCodeUrl(null); }}>
                                Fechar
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddInstanceModalOpen} onOpenChange={setIsAddInstanceModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Adicionar Nova Instância</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        setAddInstanceAlert(null);

                        const { nome_exibição, telefone, tipo } = addInstanceFormData;

                        if (!nome_exibição || !telefone || !tipo) {
                            setAddInstanceAlert({ message: 'Por favor, preencha todos os campos obrigatórios.', type: 'error' });
                            return;
                        }
                        if (!validatePhone(telefone)) {
                            setAddInstanceAlert({ message: 'Número de telefone inválido. Use o formato 55 + DDD + Número (Ex: 5511999999999).', type: 'error' });
                            return;
                        }
                        
                        const trimmedNewName = nome_exibição.trim().toLowerCase();
                        const isDuplicateName = instancesList?.some(instance =>
                            instance.nome_exibição?.trim().toLowerCase() === trimmedNewName
                        );

                        if (isDuplicateName) {
                            setAddInstanceAlert({ message: `Já existe uma instância com o nome "${nome_exibição}". Por favor, use um nome diferente.', type: 'error' });
                            return;
                        }
                        
                        createInstanceMutation.mutate(addInstanceFormData);
                    }}>
                        <div className="grid gap-4 py-4">
                            {addInstanceAlert && (
                                <div className={cn(
                                    "p-3 rounded-md text-sm",
                                    addInstanceAlert.type === 'error' && 'bg-red-100 text-red-700 border border-red-200',
                                    addInstanceAlert.type === 'success' && 'bg-green-100 text-green-700 border border-green-200',
                                    addInstanceAlert.type === 'warning' && 'bg-yellow-100 text-yellow-700 border border-yellow-200',
                                )}>
                                    {addInstanceAlert.message}
                                </div>
                            )}
                            <div className="form-group">
                                <Label htmlFor="instanceName">Nome de Exibição</Label>
                                <Input
                                    id="instanceName"
                                    placeholder="Ex: Recepção Matriz"
                                    value={addInstanceFormData.nome_exibição}
                                    onChange={(e) => setAddInstanceFormData({ ...addInstanceFormData, nome_exibição: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <Label htmlFor="instancePhone">Número do WhatsApp</Label>
                                <Input
                                    id="instancePhone"
                                    placeholder="Ex: 5511999999999"
                                    value={addInstanceFormData.telefone}
                                    onChange={(e) => setAddInstanceFormData({ ...addInstanceFormData, telefone: e.target.value })}
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Digite o número completo com código do país (55) e DDD</p>
                            </div>
                            <div className="form-group">
                                <Label htmlFor="instanceType">Tipo</Label>
                                <Select value={addInstanceFormData.tipo} onValueChange={(value) => setAddInstanceFormData({ ...addInstanceFormData, tipo: value })} required>
                                    <SelectTrigger id="instanceType">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Recepção">Recepção</SelectItem>
                                        <SelectItem value="Vendas">Vendas</SelectItem>
                                        <SelectItem value="Prospecção">Prospecção</SelectItem>
                                        <SelectItem value="Nutricionista">Nutricionista</SelectItem>
                                        <SelectItem value="Outros">Outros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsAddInstanceModalOpen(false)} disabled={createInstanceMutation.isLoading}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={createInstanceMutation.isLoading}>
                                {createInstanceMutation.isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Criando...
                                    </>
                                ) : (
                                    'Criar Instância'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WhatsappInstancesPage;