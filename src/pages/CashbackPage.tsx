import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, DollarSign, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale'; // Import locale for month names

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for a sale item from the webhook
interface SaleData {
    id_north: number;
    data_venda: string; // Assuming ISO date string
    codigo_cliente_north: number | null;
    nome_cliente_north: string | null; // Assuming this field exists based on request
    cod_funcionario_north: number | null;
    nome_funcionario_north: string | null; // Assuming this field exists based on request
    valor_venda: number | null;
    // Add other fields if needed from the webhook response
}

interface CashbackPageProps {
    clinicData: ClinicData | null;
}

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host';
const SALES_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/0ddb4be8-65ee-486b-8b29-86a9a2eafb92`;

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
    const [currentDate, setCurrentDate] = useState<Date>(startOfMonth(new Date()));
    // State to hold manual cashback data (simple example, not persisted)
    const [manualCashbackData, setManualCashbackData] = useState<{ [saleId: number]: { valor: string, validade: string } }>({});

    const clinicId = clinicData?.id;
    const currentMonth = format(currentDate, 'MM');
    const currentYear = format(currentDate, 'yyyy');

    // Fetch sales data using react-query
    const { data: salesData, isLoading, error, refetch } = useQuery<SaleData[]>({
        queryKey: ['monthlySales', clinicId, currentMonth, currentYear],
        queryFn: async () => {
            if (!clinicId) {
                throw new Error("ID da clínica não disponível.");
            }

            console.log(`Fetching sales for clinic ${clinicId}, month ${currentMonth}, year ${currentYear}`);

            const payload = {
                clinic_code: clinicData.code, // Use clinic code for webhook
                mes: parseInt(currentMonth, 10),
                ano: parseInt(currentYear, 10)
            };

            try {
                const response = await fetch(SALES_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify(payload)
                });

                console.log('Sales webhook response:', { status: response.status, statusText: response.statusText });

                if (!response.ok) {
                    let errorDetail = response.statusText;
                     try {
                        const errorBody = await response.text();
                        errorDetail = errorBody.substring(0, 200) + (errorBody.length > 200 ? '...' : '');
                        try {
                            const errorJson = JSON.parse(errorBody);
                            errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                        } catch(e) { /* ignore parse error */ }
                    } catch(readError) { /* ignore read error */ }
                    throw new Error(`Falha API Vendas (${response.status}): ${errorDetail}`);
                }

                const data = await response.json();
                console.log("Sales data received:", data);

                if (!Array.isArray(data)) {
                     console.warn("API Vendas não retornou array:", data);
                     // Depending on webhook behavior, might need to check data[0] if it returns [{ json: [...] }]
                     if (data && typeof data === 'object' && Array.isArray(data.json)) {
                         // Sort by data_venda before returning
                         return (data.json as SaleData[]).sort((a, b) => {
                             const dateA = new Date(a.data_venda).getTime();
                             const dateB = new Date(b.data_venda).getTime();
                             return dateA - dateB; // Ascending order
                         });
                     }
                     throw new Error("Resposta inesperada API Vendas.");
                }

                // Sort by data_venda before returning
                return (data as SaleData[]).sort((a, b) => {
                    const dateA = new Date(a.data_venda).getTime();
                    const dateB = new Date(b.data_venda).getTime();
                    return dateA - dateB; // Ascending order
                });

            } catch (err: any) {
                console.error('Erro ao buscar dados de vendas:', err);
                throw err; // Re-throw to be caught by react-query
            }
        },
        enabled: !!clinicId, // Only fetch if clinicId is available
        staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes
        refetchOnWindowFocus: false,
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
    const handleCashbackInputChange = (saleId: number, field: 'valor' | 'validade', value: string) => {
        setManualCashbackData(prev => ({
            ...prev,
            [saleId]: {
                ...prev[saleId],
                [field]: value
            }
        }));
    };


    if (!clinicData) {
        return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
    }

    return (
        <div className="cashback-container max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="page-title text-2xl font-bold text-primary">Gerenciar Cashback</h1>
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
                                        const cashbackValidity = manualCashbackData[saleId]?.validade || '';

                                        return (
                                            <TableRow key={saleId}>
                                                <TableCell className="whitespace-nowrap">{formatDate(sale.data_venda)}</TableCell>
                                                <TableCell className="whitespace-nowrap">{sale.nome_cliente_north || 'N/D'}</TableCell>
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
                                                <TableCell className="w-[150px]"> {/* Fixed width for input */}
                                                    <Input
                                                        type="date" // Use date type for validity
                                                        value={cashbackValidity}
                                                        onChange={(e) => handleCashbackInputChange(saleId, 'validade', e.target.value)}
                                                        className="h-8" // Smaller input
                                                    />
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
        </div>
    );
};

export default CashbackPage;