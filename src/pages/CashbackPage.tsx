import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, DollarSign, CalendarDays, Settings, MessageSquare } from "lucide-react"; // Added Settings and MessageSquare icons
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation and useQueryClient
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
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
    // The client name comes from the joined table
    north_clinic_clientes: { nome_north: string | null } | null; // Nested client data
    // Add other fields if needed from the Supabase query
}

// Define the structure for instance details from Supabase
interface InstanceDetails {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

// Define the structure for the data sent to the save webhook
// Using Portuguese names to match the database columns
interface SaveConfigPayload {
    id_clinica: number | string;
    cashback_percentual: number | null; // Corrected name
    cashback_validade: number | null; // Corrected name
    default_sending_instance_id: number | null;
}

// Define the structure for the data fetched from Supabase config table
// Using Portuguese names to match the database columns
interface FetchedConfig {
    cashback_percentual: number | null; // Corrected name
    cashback_validade: number | null; // Corrected name
    default_sending_instance_id: number | null;
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


const CashbackPage: React.FC<CashbackPageProps> = ({ clinicData }) => {
    const navigate = useNavigate(); // Initialize navigate hook
    const queryClient = useQueryClient(); // Get query client instance
    const [currentDate, setCurrentDate] = useState<Date>(startOfMonth(new Date()));
    // State to hold manual cashback data (simple example, not persisted)
    const [manualCashbackData, setManualCashbackData] = useState<{ [saleId: number]: { valor: string, validade: Date | null } }>({});

    // State for the automatic cashback configuration modal
    const [isAutoCashbackModalOpen, setIsAutoCashbackModalOpen] = useState(false);
    const [autoCashbackConfig, setAutoCashbackConfig] = useState({
        percentual: '', // Corrected state name
        validadeDias: '', // Corrected state name
        sendingInstanceId: null as number | null,
    });


    const clinicId = clinicData?.id;
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
                    .select('id_north, data_venda, codigo_cliente_north, cod_funcionario_north, nome_funcionario_north, valor_venda, north_clinic_clientes(nome_north)') // Select sales data and join client name
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

    // Fetch instance details from Supabase for the select input
    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceDetails[]>({
        queryKey: ['instancesListCashbackPage', clinicId],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }
            console.log(`Fetching instance details for clinic ${clinicId} from Supabase for cashback config`);

            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });

            if (error) {
                console.error("Error fetching instances from Supabase for cashback config:", error);
                throw new Error(error.message);
            }

            return data || [];
        },
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch existing automatic cashback configuration from Supabase
    const { data: existingConfig, isLoading: isLoadingConfig, error: configError } = useQuery<FetchedConfig | null>({
        queryKey: ['cashbackConfig', clinicId],
        queryFn: async () => {
            if (!clinicId) return null;
            console.log(`Fetching existing cashback config for clinic ${clinicId} from Supabase`);
            const { data, error } = await supabase
                .from('north_clinic_config_clinicas')
                .select('cashback_percentual, cashback_validade, default_sending_instance_id') // Corrected column names
                .eq('id', clinicId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                console.error("Error fetching existing cashback config:", error);
                throw new Error(error.message);
            }

            console.log("Existing cashback config fetched:", data);
            return data || null;
        },
        enabled: !!clinicId && isAutoCashbackModalOpen, // Only fetch when clinicId is available and modal is open
        staleTime: 0, // Always refetch when modal opens
        refetchOnWindowFocus: false,
    });

    // Effect to populate modal state when existingConfig is loaded
    useEffect(() => {
        if (existingConfig) {
            setAutoCashbackConfig({
                percentual: existingConfig.cashback_percentual?.toString() || '', // Corrected state name
                validadeDias: existingConfig.cashback_validade?.toString() || '', // Corrected state name
                sendingInstanceId: existingConfig.default_sending_instance_id || null,
            });
        } else {
             // Reset state if no existing config is found (for new clinics or if config was deleted)
             setAutoCashbackConfig({
                 percentual: '',
                 validadeDias: '',
                 sendingInstanceId: null,
             });
        }
    }, [existingConfig]);


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
        },
        onError: (error: Error) => {
            showError(`Falha ao salvar configurações: ${error.message}`);
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
        // Navigate to the Mensagens List page (menu item ID 11)
        navigate(`/dashboard/11?clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    // Handle saving automatic cashback configuration
    const handleSaveAutoCashbackConfig = () => {
        if (!clinicId) {
            showError("ID da clínica não disponível para salvar.");
            return;
        }

        // Prepare payload, converting string inputs to numbers
        const payload: SaveConfigPayload = {
            id_clinica: clinicId,
            cashback_percentual: autoCashbackConfig.percentual ? parseFloat(autoCashbackConfig.percentual) : null, // Corrected payload name
            cashback_validade: autoCashbackConfig.validadeDias ? parseInt(autoCashbackConfig.validadeDias, 10) : null, // Corrected payload name
            default_sending_instance_id: autoCashbackConfig.sendingInstanceId,
        };

        // Basic validation (can be more robust in webhook)
        if (payload.cashback_percentual !== null && (isNaN(payload.cashback_percentual) || payload.cashback_percentual < 0)) {
             showError("Percentual de Cashback inválido.");
             return;
        }
         if (payload.cashback_validade !== null && (isNaN(payload.cashback_validade) || payload.cashback_validade < 0)) {
             showError("Validade em dias inválida.");
             return;
         }
         // Note: We allow null for percentage and validity days if the user leaves them empty,
         // meaning the automatic rule might be partially configured or inactive.
         // The webhook should handle the logic of when to apply the rule based on these values.

        saveConfigMutation.mutate(payload); // Trigger the mutation
    };


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
                        <div className="status-message loading-message flex flex-col items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <span className="text-gray-700">Carregando vendas para {format(currentDate, 'MMMM yyyy', { locale: ptBR })}...</span>
                        </div>
                    ) : error ? (
                        <div className="status-message error-message flex flex-col items-center justify-center p-8 text-red-600">
                            <TriangleAlert className="h-8 w-8 mb-4" />
                            <span>Erro ao carregar vendas: {error.message}</span>
                            <Button variant="outline" onClick={() => refetch()} className="mt-4">Tentar Novamente</Button>
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {salesData?.map(sale => {
                                        const saleId = sale.id_north; // Use id_north as unique key
                                        const cashbackValue = manualCashbackData[saleId]?.valor || '';
                                        const cashbackValidity = manualCashbackData[saleId]?.validade || null;

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
                                                    <Input
                                                        type="number" // Use number type for value
                                                        placeholder="R$ 0.00"
                                                        value={cashbackValue}
                                                        onChange={(e) => handleCashbackInputChange(saleId, 'valor', e.target.value)}
                                                        className="h-8 text-right" // Smaller input, right align text
                                                    />
                                                </TableCell>
                                                <TableCell className="w-[150px]"> {/* Fixed width for date picker */}
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className="w-full h-8 text-left"
                                                            >
                                                                {cashbackValidity ? format(cashbackValidity, 'dd/MM/yyyy') : 'Selecione a data'}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={cashbackValidity}
                                                                onSelect={(date) => {
                                                                    handleCashbackInputChange(saleId, 'validade', date);
                                                                }}
                                                                disabled={(date) => date < startOfMonth(new Date())} // Disable dates before the current month
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
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
                    {isLoadingConfig ? (
                         <div className="flex items-center justify-center gap-2 text-primary py-8">
                             <Loader2 className="animate-spin" />
                             Carregando configurações...
                         </div>
                    ) : configError ? (
                         <div className="text-red-600 font-semibold py-8">{configError.message}</div>
                    ) : (
                        <div className="grid gap-4 py-4">
                            <p className="text-sm text-gray-600">Defina regras para preencher automaticamente o valor e a validade do cashback para novas vendas.</p>
                            <div className="form-group">
                                <Label htmlFor="cashbackPercentual">Percentual de Cashback (%)</Label> {/* Corrected label htmlFor */}
                                <Input
                                    id="cashbackPercentual" // Corrected id
                                    type="number"
                                    placeholder="Ex: 5"
                                    value={autoCashbackConfig.percentual} // Corrected state name
                                    onChange={(e) => setAutoCashbackConfig({ ...autoCashbackConfig, percentual: e.target.value })} // Corrected state name
                                />
                            </div>
                            {/* Changed Validity field */}
                            <div className="form-group">
                                <Label htmlFor="cashbackValidadeDias">Validade (dias após a venda)</Label> {/* Corrected label htmlFor */}
                                <Input
                                    id="cashbackValidadeDias" // Corrected id
                                    type="number"
                                    placeholder="Ex: 30"
                                    value={autoCashbackConfig.validadeDias} // Corrected state name
                                    onChange={(e) => setAutoCashbackConfig({ ...autoCashbackConfig, validadeDias: e.target.value })} // Corrected state name
                                />
                                 <p className="text-xs text-gray-500 mt-1">O cashback será válido por este número de dias a partir da data da venda.</p>
                            </div>
                            {/* Added Sending Instance field */}
                             <div className="form-group">
                                <Label htmlFor="sendingInstance">Instância de Envio Padrão</Label>
                                {isLoadingInstances ? (
                                    <div className="flex items-center text-gray-500 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando instâncias...
                                    </div>
                                ) : instancesError ? (
                                    <p className="text-sm text-red-600">Erro ao carregar instâncias.</p>
                                ) : (instancesList?.length ?? 0) === 0 ? (
                                    <p className="text-sm text-orange-600">Nenhuma instância disponível.</p>
                                ) : (
                                    <Select
                                        value={autoCashbackConfig.sendingInstanceId?.toString() || ''}
                                        onValueChange={(value) => setAutoCashbackConfig({ ...autoCashbackConfig, sendingInstanceId: value ? parseInt(value, 10) : null })}
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
                                 <p className="text-xs text-gray-500 mt-1">Esta é a instância padrão para enviar mensagens automáticas de cashback. A seleção manual por venda ainda não está disponível.</p> {/* Clarified text */}
                            </div>
                             {/* Add more configuration fields here as needed */}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsAutoCashbackModalOpen(false)} disabled={saveConfigMutation.isLoading || isLoadingConfig || !!configError}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveAutoCashbackConfig} disabled={saveConfigMutation.isLoading || isLoadingConfig || !!configError}>
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

        </div>
    );
};

export default CashbackPage;