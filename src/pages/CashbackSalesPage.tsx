import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, DollarSign, CalendarDays, Settings, MessageSquare, ListChecks } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPhone } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from '@/utils/toast';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    servico: string | null;
    produto: string | null;
    pacote: string | null;
    north_clinic_clientes: { nome_north: string | null } | null; // Nested client data
}

// Define the structure for instance details from Supabase
interface InstanceDetails {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    nome_instancia_evolution: string | null;
}

// Define the structure for the data sent to the save webhook
interface SaveConfigPayload {
    id_clinica: number | string;
    cashback_percentual: number | null;
    cashback_validade: number | null;
    default_sending_instance_id: number | null;
    apply_to_current_month_sales?: boolean;
}

// Define the structure for the data fetched from Supabase config table
interface FetchedConfig {
    cashback_percentual: number | null;
    cashback_validade: number | null;
    cashback_instancia_padrao: number | null;
}

// Define the structure for the payload sent to the manual save webhook
interface ManualSavePayload {
    id_clinica: number | string;
    vendas: {
        id_north: number;
        valor_cashback: number | null;
        validade_cashback: string | null; // ISO date string or null
    }[];
}

interface CashbackPageProps {
  clinicData: ClinicData | null;
}

// Helper function to clean salesperson name (remove leading numbers and hyphen)
function cleanSalespersonName(name: string | null): string {
    if (!name) return 'N/D';
    const cleaned = name.replace(/^\d+\s*-\s*/, '').trim();
    return cleaned || 'N/D';
}

// Helper to format date string
const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/D';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
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
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [currentDate, setCurrentDate] = useState<Date>(startOfMonth(new Date()));
    const [manualCashbackData, setManualCashbackData] = useState<{ [saleId: number]: { valor?: string, validade?: Date | null } }>({});

    const [isAutoCashbackModalOpen, setIsAutoCashbackModalOpen] = useState(false);
    const [autoCashbackConfig, setAutoCashbackConfig] = useState({
        percentual: '',
        validadeDias: '',
        idInstanciaEnvioPadrao: null as number | null,
    });
    const [applyToCurrentMonthSales, setApplyToCurrentMonthSales] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    useEffect(() => {
        if (!isAutoCashbackModalOpen) {
            setAutoCashbackConfig({
                percentual: '',
                validadeDias: '',
                idInstanciaEnvioPadrao: null,
            });
            setApplyToCurrentMonthSales(false);
            setIsSavingConfig(false);
        }
    }, [isAutoCashbackModalOpen]);

    const clinicId = clinicData?.id;
    const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const { data: salesData, isLoading, error, refetch } = useQuery<{ id_north: any; data_venda: any; codigo_cliente_north: any; cod_funcionario_north: any; nome_funcionario_north: any; valor_venda: any; valor_cashback: any; validade_cashback: any; servico: any; produto: any; pacote: any; north_clinic_clientes: { nome_north: any; }[]; }[]>({
        queryKey: ['monthlySalesSupabase', clinicId, startDate, endDate],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }
            try {
                const { data, error } = await supabase
                    .from('north_clinic_vendas')
                    .select('id_north, data_venda, codigo_cliente_north, cod_funcionario_north, nome_funcionario_north, valor_venda, valor_cashback, validade_cashback, servico, produto, pacote, north_clinic_clientes(nome_north)')
                    .eq('id_clinica', clinicId)
                    .eq('brinde', false)
                    .gte('data_venda', startDate)
                    .lte('data_venda', endDate)
                    .order('data_venda', { ascending: true });

                if (error) {
                    throw new Error(`Erro ao buscar dados de vendas: ${error.message}`);
                }
                return data || [];
            } catch (err: any) {
                throw err;
            }
        },
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: instancesList, isLoading: isLoadingInstances, error: instancesError } = useQuery<InstanceDetails[]>({
        queryKey: ['instancesListCashbackPage', clinicId],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }
            const { data, error } = await supabase
                .from('north_clinic_config_instancias')
                .select('id, nome_exibição, telefone, nome_instancia_evolution')
                .eq('id_clinica', clinicId)
                .order('nome_exibição', { ascending: true });
            if (error) {
                throw new Error(error.message);
            }
            return data || [];
        },
        enabled: !!clinicId && isAutoCashbackModalOpen,
        staleTime: 0,
        refetchOnWindowFocus: false,
    });

    const { data: existingConfig, isLoading: isLoadingConfig, error: configError } = useQuery<FetchedConfig | null>({
        queryKey: ['cashbackConfig', clinicId],
        queryFn: async () => {
            if (!clinicId) return null;
            const { data, error } = await supabase
                .from('north_clinic_config_clinicas')
                .select('cashback_percentual, cashback_validade, cashback_instancia_padrao')
                .eq('id', clinicId)
                .single();
            if (error && error.code !== 'PGRST116') {
                throw new Error(error.message);
            }
            return data || null;
        },
        enabled: !!clinicId && isAutoCashbackModalOpen,
        staleTime: 0,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (isAutoCashbackModalOpen && !isLoadingConfig && !configError && !isLoadingInstances && !instancesError) {
            const loadedPercentual = existingConfig?.cashback_percentual?.toString() || '';
            const loadedValidade = existingConfig?.cashback_validade?.toString() || '';
            const loadedInstanceId = existingConfig?.cashback_instancia_padrao || null;
            setAutoCashbackConfig({
                percentual: loadedPercentual,
                validadeDias: loadedValidade,
                idInstanciaEnvioPadrao: loadedInstanceId,
            });
        }
    }, [isAutoCashbackModalOpen, existingConfig, instancesList, isLoadingConfig, configError, isLoadingInstances, instancesError]);

    const saveConfigMutation = useMutation({
        mutationFn: async (configData: SaveConfigPayload) => {
            const webhookUrl = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/salvar-cashback';
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
            return response.json();
        },
        onSuccess: () => {
            showSuccess('Configurações de cashback salvas com sucesso!');
            setIsAutoCashbackModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['cashbackConfig', clinicId] });
            if (applyToCurrentMonthSales) {
                 queryClient.invalidateQueries({ queryKey: ['monthlySalesSupabase', clinicId, startDate, endDate] });
            }
        },
        onError: (error: Error) => {
            showError(`Falha ao salvar configurações: ${error.message}`);
        },
        onSettled: () => {
            setIsSavingConfig(false);
        }
    });

    const saveManualCashbackMutation = useMutation({
        mutationFn: async (payload: ManualSavePayload) => {
            const webhookUrl = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/salvar-cashback-completo';
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                let errorMsg = `Erro ${response.status} ao salvar cashback manual`;
                try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData) || errorMsg; } catch (e) { errorMsg = `${errorMsg}: ${await response.text()}`; }
                throw new Error(errorMsg);
            }
            return response.json();
        },
        onSuccess: () => {
            showSuccess('Cashback manual salvo com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['monthlySalesSupabase', clinicId, startDate, endDate] });
            setManualCashbackData({});
        },
        onError: (error: Error) => {
            showError(`Falha ao salvar cashback manual: ${error.message}`);
        },
    });

    const goToPreviousMonth = () => {
        setCurrentDate(startOfMonth(subMonths(currentDate, 1)));
        setManualCashbackData({});
    };

    const goToNextMonth = () => {
        const today = startOfMonth(new Date());
        const nextMonth = startOfMonth(addMonths(currentDate, 1));
        if (!isAfter(nextMonth, today)) {
            setCurrentDate(nextMonth);
            setManualCashbackData({});
        }
    };

    const isNextMonthDisabled = !isBefore(currentDate, startOfMonth(new Date()));

    const handleCashbackInputChange = (saleId: number, field: 'valor' | 'validade', value: string | Date | null) => {
        setManualCashbackData(prev => ({
            ...prev,
            [saleId]: {
                ...prev[saleId],
                [field]: value
            }
        }));
    };

    const handleConfigMessagesClick = () => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        navigate(`/dashboard/14/messages?clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    const handleViewBalanceClick = () => { 
         if (!clinicData?.code) {
             showError("Erro: Código da clínica não disponível.");
             return;
         }
         navigate(`/dashboard/14?clinic_code=${encodeURIComponent(clinicData.code)}`); 
    };

    const handleSaveAutoCashbackConfig = () => {
        if (!clinicId) {
            showError("ID da clínica não disponível para salvar.");
            return;
        }
        setIsSavingConfig(true);

        const percentualNum = parseFloat(autoCashbackConfig.percentual);
        const validadeDiasNum = parseInt(autoCashbackConfig.validadeDias, 10);

        if (autoCashbackConfig.percentual.trim() === '' || isNaN(percentualNum) || percentualNum < 0) {
            showError("Por favor, informe um Percentual de Cashback válido (número >= 0).");
            setIsSavingConfig(false);
            return;
        }
        if (autoCashbackConfig.validadeDias.trim() === '' || isNaN(validadeDiasNum) || validadeDiasNum < 0) {
             showError("Por favor, informe uma Validade em dias válida (número inteiro >= 0).");
             setIsSavingConfig(false);
             return;
        }

        const payload: SaveConfigPayload = {
            id_clinica: clinicId,
            cashback_percentual: percentualNum,
            cashback_validade: validadeDiasNum,
            default_sending_instance_id: autoCashbackConfig.idInstanciaEnvioPadrao,
            apply_to_current_month_sales: applyToCurrentMonthSales,
        };
        saveConfigMutation.mutate(payload);
    };

    const handleSaveManualCashback = () => {
        if (!clinicId) {
            showError("ID da clínica não disponível para salvar.");
            return;
        }
        if (!salesData || salesData.length === 0) {
             showError("Nenhuma venda para salvar.");
             return;
        }

        const salesToSave = salesData.map(sale => {
            const saleId = sale.id_north;
            const manualChanges = manualCashbackData[saleId];

            let valorCashback: number | null = null;
            if (manualChanges?.valor !== undefined && manualChanges.valor !== '') {
                 const parsedValue = parseFloat(manualChanges.valor.replace(',', '.'));
                 valorCashback = isNaN(parsedValue) ? null : parsedValue;
            } else {
                 valorCashback = sale.valor_cashback;
            }

            let validadeCashback: string | null = null;
            if (manualChanges?.validade !== undefined) {
                 if (manualChanges.validade instanceof Date && !isNaN(manualChanges.validade.getTime())) {
                     validadeCashback = format(manualChanges.validade, 'yyyy-MM-dd');
                 } else {
                     validadeCashback = null;
                 }
            } else {
                 validadeCashback = sale.validade_cashback;
            }

            return {
                id_north: saleId,
                valor_cashback: valorCashback,
                validade_cashback: validadeCashback,
            };
        });

        const payload: ManualSavePayload = {
            id_clinica: clinicId,
            vendas: salesToSave,
        };
        saveManualCashbackMutation.mutate(payload);
    };

    const isDataReady = !isLoadingConfig && !configError && !isLoadingInstances && !instancesError;

    if (!clinicData) {
        return <div className="text-center text-red-500">Erro: Dados da clínica não disponíveis.</div>;
    }

    return (
        <div className="cashback-container max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="page-title text-2xl font-bold text-primary">Gerenciar Cashback - Vendas</h1>
                <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
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
                    <div className="action-buttons flex items-center gap-4">
                        <Button variant="outline" onClick={handleViewBalanceClick} className="flex items-center gap-2">
                            <ChevronLeft className="h-4 w-4" /> Voltar
                        </Button>
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
                        <div className="overflow-x-auto">
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
                                    <TooltipProvider>
                                        {salesData?.map(sale => {
                                            const saleId = sale.id_north;
                                            const currentCashbackValue = manualCashbackData[saleId]?.valor ?? sale.valor_cashback?.toFixed(2).replace('.', ',') ?? '';
                                            const currentCashbackValidity = manualCashbackData[saleId]?.validade ?? (sale.validade_cashback ? new Date(sale.validade_cashback) : null);
                                            const itemName = sale.servico || sale.produto || sale.pacote || 'N/D';

                                            return (
                                                <Tooltip key={saleId}>
                                                    <TooltipTrigger asChild>
                                                        <TableRow data-sale-id={saleId}>
                                                            <TableCell className="whitespace-nowrap">{formatDate(sale.data_venda)}</TableCell>
                                                            <TableCell className="whitespace-nowrap">{sale.north_clinic_clientes?.nome_north || 'N/D'}</TableCell>
                                                            <TableCell className="whitespace-nowrap">{cleanSalespersonName(sale.nome_funcionario_north)}</TableCell>
                                                            <TableCell className="text-right whitespace-nowrap">
                                                                {(sale.valor_venda !== null && sale.valor_venda !== undefined) ?
                                                                    `R$ ${sale.valor_venda.toFixed(2).replace('.', ',')}` :
                                                                    'R$ 0,00'
                                                                }
                                                            </TableCell>
                                                            <TableCell className="w-[150px]">
                                                                <div className="flex items-center">
                                                                    <span className="mr-1 text-gray-600 text-sm">R$</span>
                                                                    <Input
                                                                        type="text"
                                                                        placeholder="0,00"
                                                                        value={currentCashbackValue}
                                                                        onChange={(e) => {
                                                                            const rawValue = e.target.value;
                                                                            if (rawValue === '') {
                                                                                 handleCashbackInputChange(saleId, 'valor', '');
                                                                                 return;
                                                                            }
                                                                            const valueWithDot = rawValue.replace(',', '.');
                                                                            const validRegex = /^\d*\.?\d{0,2}$/;
                                                                            if (validRegex.test(valueWithDot)) {
                                                                                 handleCashbackInputChange(saleId, 'valor', valueWithDot.replace('.', ','));
                                                                             } else if (rawValue === ',') {
                                                                                 handleCashbackInputChange(saleId, 'valor', '0,');
                                                                             }
                                                                        }}
                                                                        className="h-8 text-right flex-grow"
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="w-[150px]">
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            className="w-full h-8 text-left"
                                                                        >
                                                                            {currentCashbackValidity ? format(currentCashbackValidity, 'dd/MM/yyyy') : 'Selecione a data'}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0" align="start">
                                                                            <Calendar
                                                                                mode="single"
                                                                                selected={currentCashbackValidity ?? undefined}
                                                                                onSelect={(date) => {
                                                                                    handleCashbackInputChange(saleId, 'validade', date);
                                                                                }}
                                                                                disabled={(date) => date < startOfMonth(new Date())}
                                                                                initialFocus
                                                                            />
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </TableCell>
                                                        </TableRow>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Item: {itemName}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </TooltipProvider>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
             {salesData && salesData.length > 0 && (
                 <div className="mt-6 text-right">
                     <Button onClick={handleSaveManualCashback} disabled={isLoading || saveManualCashbackMutation.isLoading}>
                         {saveManualCashbackMutation.isLoading ? (
                             <>
                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                 Salvando...
                             </>
                         ) : (
                             'Salvar Cashback Manual'
                         )}
                     </Button>
                 </div>
             )}

            <Dialog open={isAutoCashbackModalOpen} onOpenChange={setIsAutoCashbackModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Regras de Cashback</DialogTitle>
                    </DialogHeader>
                    {isLoadingConfig || isLoadingInstances ? (
                         <div className="flex items-center justify-center gap-2 text-primary py-8">
                             <Loader2 className="animate-spin" />
                             Carregando configurações...
                         </div>
                    ) : configError || instancesError ? (
                         <div className="text-red-600 font-semibold py-8">{configError?.message || instancesError?.message || 'Erro ao carregar dados.'}</div>
                    ) : (
                        <div className={cn("grid gap-4 py-4", saveConfigMutation.isLoading && "opacity-50 pointer-events-none")}>
                            <p className="text-sm text-gray-600">Defina regras para preencher automaticamente o valor e a validade do cashback para novas vendas.</p>
                            <div className="form-group">
                                <Label htmlFor="cashbackPercentual">Percentual de Cashback (%) *</Label>
                                <Input
                                    id="cashbackPercentual"
                                    type="number"
                                    placeholder="Ex: 5"
                                    value={autoCashbackConfig.percentual}
                                    onChange={(e) => setAutoCashbackConfig({ ...autoCashbackConfig, percentual: e.target.value })}
                                    disabled={saveConfigMutation.isLoading}
                                />
                            </div>
                            <div className="form-group">
                                <Label htmlFor="cashbackValidadeDias">Validade (dias após a venda) *</Label>
                                <Input
                                    id="cashbackValidadeDias"
                                    type="number"
                                    placeholder="Ex: 30"
                                    value={autoCashbackConfig.validadeDias}
                                    onChange={(e) => setAutoCashbackConfig({ ...autoCashbackConfig, validadeDias: e.target.value })}
                                    disabled={saveConfigMutation.isLoading}
                                />
                                 <p className="text-xs text-gray-500 mt-1">O cashback será válido por este número de dias a partir da data da venda.</p>
                            </div>
                             <div className="form-group">
                                <Label htmlFor="idInstanciaEnvioPadrao">Instância de Envio Padrão (Fallback)</Label>
                                {(instancesList?.length ?? 0) === 0 ? (
                                    <p className="text-sm text-orange-600">Nenhuma instância disponível para seleção.</p>
                                ) : (
                                    <Select
                                        key={isDataReady ? 'data-ready' : 'loading'}
                                        value={autoCashbackConfig.idInstanciaEnvioPadrao?.toString() || 'none'}
                                        onValueChange={(value) => {
                                            setAutoCashbackConfig({ ...autoCashbackConfig, idInstanciaEnvioPadrao: value === 'none' ? null : parseInt(value, 10) });
                                        }}
                                        disabled={saveConfigMutation.isLoading}
                                    >
                                        <SelectTrigger id="idInstanciaEnvioPadrao">
                                            <SelectValue placeholder="Selecione a instância padrão" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- Nenhuma instância padrão --</SelectItem>
                                            {instancesList?.map(inst => (
                                                <SelectItem key={inst.id} value={inst.id.toString()}>
                                                    {inst.nome_exibição} ({formatPhone(inst.telefone)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                 <p className="text-xs text-gray-500 mt-1">Esta instância será usada para enviar mensagens automáticas de cashback *apenas* se a instância da venda não tiver um funcionário vinculado. Se nenhuma for selecionada aqui e a instância da venda também não tiver funcionário, as mensagens automáticas de cashback não serão enviadas.</p>
                            </div>

                            <div className="flex items-center space-x-2 mt-4">
                                <Checkbox
                                    id="applyToCurrentMonthSales"
                                    checked={applyToCurrentMonthSales}
                                    onCheckedChange={(checked) => setApplyToCurrentMonthSales(!!checked)}
                                    disabled={saveConfigMutation.isLoading}
                                />
                                <Label
                                    htmlFor="applyToCurrentMonthSales"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Aplicar esta regra para todas as vendas do mês atual
                                </Label>
                            </div>
                             <p className="text-xs text-gray-500 mt-1">Marque esta opção para recalcular e aplicar o cashback para todas as vendas já registradas neste mês, usando as regras acima.</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsAutoCashbackModalOpen(false)} disabled={saveConfigMutation.isLoading || isLoadingConfig || !!configError || isLoadingInstances || !!instancesError}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveAutoCashbackConfig} disabled={saveConfigMutation.isLoading || isLoadingConfig || !!configError || isLoadingInstances || !!instancesError}>
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