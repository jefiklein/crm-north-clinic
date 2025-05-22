import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2, TriangleAlert, DollarSign, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale'; // Import locale for month names
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { Calendar } from "@/components/ui/calendar"; // Import shadcn/ui Calendar
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // For date picker popup

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
    const [currentDate, setCurrentDate] = useState<Date>(startOfMonth(new Date()));
    // State to hold manual cashback data (simple example, not persisted)
    const [manualCashbackData, setManualCashbackData] = useState<{ [saleId: number]: { valor: string, validade: Date | null } }>({});

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
                                                                disabled={(date) => date > new Date()} // Optional: disable future dates
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
        </div>
    );
};

export default CashbackPage;