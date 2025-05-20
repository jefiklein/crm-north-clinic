import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, LineChart, MessageSquare, CalendarDays, ShoppingCart, Loader2, BadgeDollarSign, Scale, CalendarClock, CalendarHeart } from "lucide-react"; // Added CalendarClock and CalendarHeart icons
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, getDay, isAfter, startOfDay } from 'date-fns';

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Define the structure for the sales data received from the webhook
interface SalesData {
    count_id_north: number;
    sum_valor_venda: number;
}

// Define the structure for the leads data received from the webhook
interface LeadsData {
    count_remoteJid: number;
}

// Define the structure for the appointments data received from the new webhook
// UPDATED: Changed structure to match the new webhook output
interface AppointmentsData {
    sum_total_agendamentos: number;
    sum_total_realizados: number;
}


interface DashboardPageProps {
    clinicData: ClinicData | null;
    onLogout: () => void;
}

// Function to calculate remaining business days (Mon-Sat) in the current month
const calculateRemainingBusinessDays = (): number => {
    const today = startOfDay(new Date());
    const lastDayOfMonth = endOfMonth(today);
    let businessDays = 0;
    let currentDate = today;

    while (isAfter(lastDayOfMonth, currentDate) || currentDate.toDateString() === lastDayOfMonth.toDateString()) {
        const dayOfWeek = getDay(currentDate); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        if (dayOfWeek !== 0) { // Exclude Sunday
            businessDays++;
        }
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return businessDays;
};

const SALES_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/43a4753b-b7c2-48c0-b57a-61ba5256d5b7';
const LEADS_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/c12975eb-6e96-4a61-b19c-5e47b62ca642';
const APPOINTMENTS_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/72d5e8a4-eb58-4cdd-a784-5f8cfc9ee739'; // New webhook URL for appointments

const DashboardPage: React.FC<DashboardPageProps> = ({ clinicData }) => {
    // Removed simulated data state

    const [remainingBusinessDays, setRemainingBusinessDays] = useState<number>(0);
    useEffect(() => {
        setRemainingBusinessDays(calculateRemainingBusinessDays());
    }, []);

    // Fetch sales data from webhook using react-query
    const { data: salesData, isLoading: isLoadingSales, error: salesError } = useQuery<SalesData | null>({
        queryKey: ['salesData', clinicData?.code, new Date().getMonth() + 1, new Date().getFullYear()],
        queryFn: async () => {
            if (!clinicData?.code) {
                throw new Error("Código da clínica não disponível para buscar dados de vendas.");
            }
            
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            console.log(`Chamando webhook de vendas para:`, {
                clinic_code: clinicData.code,
                mes: currentMonth,
                ano: currentYear
            });

            try {
                const response = await fetch(SALES_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        clinic_code: clinicData.code,
                        mes: currentMonth,
                        ano: currentYear
                    })
                });

                console.log('Resposta do webhook de vendas:', {
                    status: response.status,
                    statusText: response.statusText
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Sales webhook error response:", errorText);
                    throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
                }

                const data = await response.json();
                console.log('Dados recebidos do webhook de vendas:', data);
                
                // Expecting an array with one object: [{ "count_id_north": N, "sum_valor_venda": V }]
                if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
                    const result = data[0];
                    if (result.count_id_north !== undefined && result.sum_valor_venda !== undefined) {
                        return {
                            count_id_north: Number(result.count_id_north), // Ensure it's a number
                            sum_valor_venda: Number(result.sum_valor_venda) // Ensure it's a number
                        } as SalesData;
                    }
                }
                
                throw new Error("Formato de resposta inesperado do webhook de vendas. Esperado: [{ count_id_north: N, sum_valor_venda: V }]");
                
            } catch (error) {
                console.error('Erro na chamada ao webhook de vendas:', error);
                throw error;
            }
        },
        enabled: !!clinicData?.code,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch leads data from webhook using react-query
    const { data: leadsData, isLoading: isLoadingLeads, error: leadsError } = useQuery<LeadsData | null>({
        queryKey: ['leadsData', clinicData?.code, new Date().getMonth() + 1, new Date().getFullYear()],
        queryFn: async () => {
            if (!clinicData?.code) {
                throw new Error("Código da clínica não disponível para buscar dados de leads.");
            }
            
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            console.log(`Chamando webhook de leads para:`, {
                clinic_code: clinicData.code,
                mes: currentMonth,
                ano: currentYear
            });

            try {
                const response = await fetch(LEADS_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        clinic_code: clinicData.code,
                        mes: currentMonth,
                        ano: currentYear
                    })
                });

                console.log('Resposta do webhook de leads:', {
                    status: response.status,
                    statusText: response.statusText
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Leads webhook error response:", errorText);
                    throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
                }

                const data = await response.json();
                console.log('Dados recebidos do webhook de leads:', data);
                
                // Expecting an array with one object: [{ "count_remoteJid": N }]
                if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object' && data[0].count_remoteJid !== undefined) {
                    return { count_remoteJid: Number(data[0].count_remoteJid) } as LeadsData; // Return the object with the count
                }
                
                throw new Error("Formato de resposta inesperado do webhook de leads. Esperado: [{ count_remoteJid: N }]");
                
            } catch (error) {
                console.error('Erro na chamada ao webhook de leads:', error);
                throw error;
            }
        },
        enabled: !!clinicData?.code,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch appointments data from webhook using react-query
    const { data: appointmentsData, isLoading: isLoadingAppointments, error: appointmentsError } = useQuery<AppointmentsData | null>({
        queryKey: ['appointmentsData', clinicData?.code, new Date().getMonth() + 1, new Date().getFullYear()],
        queryFn: async () => {
            if (!clinicData?.code) {
                throw new Error("Código da clínica não disponível para buscar dados de avaliações.");
            }
            
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            console.log(`Chamando webhook de avaliações para:`, {
                clinic_code: clinicData.code,
                mes: currentMonth,
                ano: currentYear
            });

            try {
                const response = await fetch(APPOINTMENTS_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        clinic_code: clinicData.code,
                        mes: currentMonth,
                        ano: currentYear
                    })
                });

                console.log('Resposta do webhook de avaliações:', {
                    status: response.status,
                    statusText: response.statusText
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Appointments webhook error response:", errorText);
                    throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
                }

                const data = await response.json();
                console.log('Dados recebidos do webhook de avaliações:', data);
                
                // Detailed check for the expected format: [{ "sum_total_agendamentos": N, "sum_total_realizados": M }]
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error(`Resposta inesperada do webhook de avaliações: Esperado um array não vazio, mas recebeu ${Array.isArray(data) ? 'um array vazio' : typeof data}. Dados recebidos: ${JSON.stringify(data).substring(0, 200)}...`);
                }

                const result = data[0];

                if (typeof result !== 'object' || result === null) {
                     throw new Error(`Resposta inesperada do webhook de avaliações: O primeiro item do array não é um objeto. Recebeu: ${typeof result}. Dados recebidos: ${JSON.stringify(data).substring(0, 200)}...`);
                }

                // Check for the specific properties
                const agendamentos = result.sum_total_agendamentos;
                const realizados = result.sum_total_realizadas;

                console.log("DashboardPage: Checking appointment keys. agendamentos:", agendamentos, "realizados:", realizados); // Added log
                console.log("DashboardPage: Type of agendamentos:", typeof agendamentos, "Type of realizados:", typeof realizados); // Added log
                console.log("DashboardPage: Result object keys:", Object.keys(result)); // Added log

                if (agendamentos === undefined || realizados === undefined) {
                     console.error("DashboardPage: Keys are undefined despite data log. Result object:", result); // Added log inside error block
                     throw new Error(`Resposta inesperada do webhook de avaliações: Objeto não contém as chaves 'sum_total_agendamentos' ou 'sum_total_realizadas'. Chaves encontradas: ${Object.keys(result).join(', ')}. Dados recebidos: ${JSON.stringify(data).substring(0, 200)}...`);
                }

                // Ensure they can be converted to numbers
                 const numAgendamentos = Number(agendamentos);
                 const numRealizados = Number(realizados);

                 console.log("DashboardPage: Checking appointment values. numAgendamentos:", numAgendamentos, "numRealizados:", numRealizados); // Added log

                 if (isNaN(numAgendamentos) || isNaN(numRealizados)) {
                     console.error("DashboardPage: Values are NaN despite data log. Agendados:", agendamentos, "Realizados:", realizados); // Added log inside error block
                     throw new Error(`Resposta inesperada do webhook de avaliações: Os valores para 'sum_total_agendamentos' ou 'sum_total_realizados' não são números. Recebeu: Agendados=${agendamentos}, Realizados=${realizados}. Dados recebidos: ${JSON.stringify(data).substring(0, 200)}...`);
                 }


                return {
                    sum_total_agendamentos: numAgendamentos,
                    sum_total_realizados: numRealizados
                } as AppointmentsData;

            } catch (error: any) {
                console.error('Erro na chamada ao webhook de avaliações:', error);
                // Re-throw the error with a more specific message if it's a known type
                if (error.message.startsWith('Resposta inesperada do webhook de avaliações:')) {
                     throw error; // Keep the detailed error message
                }
                throw new Error(`Falha ao buscar dados de avaliações: ${error.message}`); // Generic error for others
            }
        },
        enabled: !!clinicData?.code,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });


    // Calculate Average Ticket
    const averageTicket = salesData && salesData.count_id_north > 0
        ? salesData.sum_valor_venda / salesData.count_id_north
        : 0; // Handle division by zero

    // Removed simulated data useEffect

    if (!clinicData) {
        return <div className="text-center text-red-500">Erro: Dados da clínica não disponíveis.</div>;
    }

    return (
        <div className="welcome-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">Bem-vindo ao CRM {clinicData.nome}</h2>
            <p className="text-gray-700 mb-6">Utilize o menu lateral para navegar pelas funcionalidades disponíveis para seu acesso.</p>

            {/* Section: Leads and Appointments */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3 className="text-xl font-semibold text-blue-800 mb-4">Resumo de Leads e Avaliações</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Adjusted grid for 3 cards */}
                    {/* Card: Total de Leads - Now fetched from webhook */}
                    <Card className="text-center">
                        <CardHeader className="pb-2">
                            <Users className="mx-auto h-8 w-8 text-primary" />
                            <CardTitle className="text-md font-medium">Total de Leads</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingLeads ? (
                                <div className="flex justify-center items-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : leadsError ? (
                                <div className="text-sm text-destructive">Erro ao carregar leads.</div>
                            ) : (
                                <div className="text-2xl font-bold text-primary">
                                    {/* Display the count_remoteJid */}
                                    {leadsData?.count_remoteJid !== undefined && leadsData.count_remoteJid !== null ? leadsData.count_remoteJid : 'N/A'}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Card: Avaliações Agendadas (Fetched) */}
                    <Card className="text-center">
                        <CardHeader className="pb-2">
                            <CalendarClock className="mx-auto h-8 w-8 text-primary" /> {/* Using CalendarClock icon */}
                            <CardTitle className="text-md font-medium">Avaliações Agendadas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingAppointments ? (
                                <div className="flex justify-center items-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : appointmentsError ? (
                                <div className="text-sm text-destructive">Erro ao carregar agendamentos.</div>
                            ) : (
                                <div className="text-2xl font-bold text-primary">
                                    {/* UPDATED: Use sum_total_agendamentos */}
                                    {appointmentsData?.sum_total_agendamentos !== undefined && appointmentsData.sum_total_agendamentos !== null ? appointmentsData.sum_total_agendamentos : 'N/A'}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Card: Avaliações Realizadas (Fetched) */}
                    <Card className="text-center">
                        <CardHeader className="pb-2">
                            <CalendarCheck className="mx-auto h-8 w-8 text-primary" /> {/* Using CalendarCheck icon */}
                            <CardTitle className="text-md font-medium">Avaliações Realizadas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingAppointments ? (
                                <div className="flex justify-center items-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : appointmentsError ? (
                                <div className="text-sm text-destructive">Erro ao carregar realizadas.</div>
                            ) : (
                                <div className="text-2xl font-bold text-primary">
                                    {/* UPDATED: Use sum_total_realizados */}
                                    {appointmentsData?.sum_total_realizados !== undefined && appointmentsData.sum_total_realizados !== null ? appointmentsData.sum_total_realizados : 'N/A'}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Section: Sales */}
            <div className="bg-green-50 p-4 rounded-lg mb-6">
                <h3 className="text-xl font-semibold text-green-800 mb-4">Resumo de Vendas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Adjusted grid for 3 cards */}
                    {/* Card: Número de Vendas (Fetched) */}
                    <Card className="text-center">
                        <CardHeader className="pb-2">
                            <ShoppingCart className="mx-auto h-8 w-8 text-primary" /> {/* ShoppingCart icon for sales count */}
                            <CardTitle className="text-md font-medium">Número de Vendas (Mês)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingSales ? (
                                <div className="flex justify-center items-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : salesError ? (
                                <div className="text-sm text-destructive">Erro ao carregar vendas.</div>
                            ) : (
                                <div className="text-2xl font-bold text-primary">
                                    {salesData?.count_id_north !== undefined && salesData.count_id_north !== null ? salesData.count_id_north : 'N/A'}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Card: Total de Vendas (Mês) - Fetched */}
                    <Card className="text-center">
                        <CardHeader className="pb-2">
                            <BadgeDollarSign className="mx-auto h-8 w-8 text-primary" />
                            <CardTitle className="text-md font-medium">Total de Vendas (Mês)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingSales ? (
                                <div className="flex justify-center items-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : salesError ? (
                                <div className="text-sm text-destructive">Erro ao carregar vendas.</div>
                            ) : (
                                <div className="text-2xl font-bold text-primary">
                                    {salesData?.sum_valor_venda !== undefined && salesData.sum_valor_venda !== null ?
                                        `R$ ${salesData.sum_valor_venda.toFixed(2).replace('.', ',')}` :
                                        'N/A'
                                    }
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Card: Ticket Médio (Calculated from fetched sales) */}
                    <Card className="text-center">
                        <CardHeader className="pb-2">
                            <Scale className="mx-auto h-8 w-8 text-primary" /> {/* Scale icon for average ticket */}
                            <CardTitle className="text-md font-medium">Ticket Médio (Mês)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingSales ? (
                                <div className="flex justify-center items-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : salesError ? (
                                <div className="text-sm text-destructive">Erro ao carregar ticket médio.</div>
                            ) : (
                                <div className="text-2xl font-bold text-primary">
                                    {averageTicket !== undefined && averageTicket !== null ?
                                        `R$ ${averageTicket.toFixed(2).replace('.', ',')}` :
                                        'N/A'
                                    }
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Section: Contexto Mensal */}
            <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="text-xl font-semibold text-yellow-800 mb-4">Contexto Mensal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"> {/* Can use a different grid or just one card */}
                    {/* Card: Dias Úteis Restantes */}
                    <Card className="text-center">
                        <CardHeader className="pb-2">
                            <CalendarDays className="mx-auto h-8 w-8 text-primary" />
                            <CardTitle className="text-md font-medium">Dias Úteis Restantes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">{remainingBusinessDays}</div>
                        </CardContent>
                    </Card>
                </div>
            </div>

        </div>
    );
};

export default DashboardPage;