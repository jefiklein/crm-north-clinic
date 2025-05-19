import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, LineChart, MessageSquare } from "lucide-react"; // Using Lucide React for icons

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

const DashboardPage: React.FC<DashboardPageProps> = ({ clinicData }) => {
    const [dashboardData, setDashboardData] = useState({
        leads: '...',
        avaliacoes: '...',
        conversoes: '...',
        mensagens: '...'
    });

    // Simulate loading data
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
                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <Users className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Total de Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.leads}</div>
                    </CardContent>
                </Card>

                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <CalendarCheck className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Avaliações</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.avaliacoes}</div>
                    </CardContent>
                </Card>

                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <LineChart className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Conversões</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.conversoes}</div>
                    </CardContent>
                </Card>

                <Card className="text-center">
                    <CardHeader className="pb-2">
                        <MessageSquare className="mx-auto h-8 w-8 text-primary" />
                        <CardTitle className="text-md font-medium">Mensagens</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{dashboardData.mensagens}</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;