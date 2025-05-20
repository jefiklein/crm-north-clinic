import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, LineChart, MessageSquare, CalendarDays, ShoppingCart, Loader2 } from "lucide-react"; // Using Lucide React for icons
import { useQuery } from "@tanstack/react-query"; // Import useQuery
import { endOfMonth, getDay, isAfter, startOfDay } from 'date-fns'; // Import date-fns functions

// Define the structure for clinic data (should match the one in App.tsx)
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface DashboardPageProps {
    clinicData: ClinicData | null; // clinicData is passed from App.tsx via Layout Outlet
    onLogout: () => void; // onLogout is passed from App.tsx via Layout Outlet
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
        // Move to the next day
        currentDate = new Date(currentDate); // Create a new date object to avoid modifying the original
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return businessDays;
};

// Webhook URL for sales data
const SALES_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/43a4753b-b7c2-48c0-b57a-61ba5256d5b7';

const DashboardPage: React.FC<DashboardPageProps> = ({ clinicData }) => {
    const [dashboardData, setDashboardData] = useState({
        leads: '...',
        avaliacoes: '...',
        conversoes: '...',
        mensagens: '...'
    });

    // Calculate remaining business days on component mount
    const [remainingBusinessDays, setRemainingBusinessDays] = useState<number>(0);
    useEffect(() => {
        setRemainingBusinessDays(calculateRemainingBusinessDays());
    }, []);

    // Fetch sales data from webhook using react-query
    const { data: salesData, isLoading: isLoadingSales, error: salesError } = useQuery({
        queryKey: ['salesData', clinicData?.code, new Date().getMonth() + 1, new Date().getFullYear()], // Query key includes dependencies
        queryFn: async () => {
            if (!clinicData?.code) {
                throw new Error("Código da clínica não disponível para buscar dados de vendas.");
            }
            const currentMonth = new Date().getMonth() + 1; // getMonth() is 0-indexed
            const currentYear = new Date().getFullYear();

            console.log(`Fetching sales data for clinic: ${clinicData.code}, month: ${currentMonth}, year: ${currentYear}`);

            const response = await fetch(SALES_WEBHOOK_URL, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clinic_code: clinicData.code,
                    mes: currentMonth,
                    ano: currentYear
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Sales webhook error response:", errorText);
                throw new Error(`Erro ao buscar dados de vendas: ${response.status} - ${errorText || response.statusText}`);
            }

            const data = await response.json();
            console.log("Sales webhook success response:", data);
            // Assuming the webhook returns an object like { total_vendas: number }
            // Adjust this based on the actual webhook response structure
            if (data && typeof data === 'object' && data.total_vendas !== undefined) {
                 return data.total_vendas;
            } else {
                 // If the structure is different, return the raw data or a specific message
                 console.warn("Unexpected sales webhook response structure:", data);
                 return data; // Return raw data for inspection
            }
        },
        enabled: !!clinicData?.code, // Only run query if clinicData.code is available
        staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes
        refetchOnWindowFocus: false, // Do not refetch automatically on window focus
    });


    // Simulate loading data for other cards
    useEffect(() => {
        // In a real app, you would fetch this data from your backend
        const timer = setTimeout(() => {
            setDashboardData({
                leads: "238",
                avaliacoes: "42",
                conversoes: "18%",
                mensagens: "532"
            });
        }, 500); // Simulate network delay

        return () => clearTimeout(timer); // Cleanup timeout
    }, []); // Empty dependency array means this runs once on mount

    if (!clinicData) {
        // This case should ideally not happen due to ProtectedRoute,
        // but it's good practice to handle it.
        return <div className="text-center text-red-500">Erro: Dados da clínica não disponíveis.</div>;
    }

    return (
        <div className="welcome-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">Bem-vindo ao CRM {clinicData.nome}</h2>
            <p className="text-gray-700 mb-6">Utilize o menu lateral para navegar pelas funcionalidades disponíveis para seu acesso.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card: Total de Leads */}
                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <Users className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Total de Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.leads}</div>
                    </CardContent>
                </Card>

                {/* Card: Avaliações */}
                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <CalendarCheck className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Avaliações</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.avaliacoes}</div>
                    </CardContent>
                </Card>

                {/* Card: Conversões */}
                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <LineChart className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Conversões</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.conversoes}</div>
                    </CardContent>
                </Card>

                {/* Card: Mensagens */}
                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <MessageSquare className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Mensagens</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.mensagens}</div>
                    </CardContent>
                </Card>

                {/* NEW Card: Dias Úteis Restantes */}
                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <CalendarDays className="mx-auto h-8 w-8 text-primary" /> {/* Using CalendarDays icon */}
                        <CardTitle className="text-md font-medium">Dias Úteis Restantes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{remainingBusinessDays}</div>
                    </CardContent>
                </Card>

                {/* NEW Card: Vendas */}
                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <BadgeDollarSign className="mx-auto h-8 w-8 text-primary" /> {/* Using BadgeDollarSign icon */}
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
                                {/* Format as currency if it's a number, otherwise display raw data */}
                                {typeof salesData === 'number' ?
                                    `R$ ${salesData.toFixed(2).replace('.', ',')}` :
                                    (salesData !== undefined && salesData !== null ? JSON.stringify(salesData) : 'N/A')
                                }
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};

export default DashboardPage;