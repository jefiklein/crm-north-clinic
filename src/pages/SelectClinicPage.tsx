import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TriangleAlert, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

const SelectClinicPage: React.FC = () => {
    const navigate = useNavigate();
    const { logout } = useAuth(); // Get logout function from AuthContext

    const handleGoToLogin = async () => {
        await logout(); // Perform logout to clear session
        navigate('/'); // Navigate to login page
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <TriangleAlert className="mx-auto h-12 w-12 text-orange-500 mb-4" />
                    <CardTitle className="text-2xl font-bold text-primary">Clínica Não Associada</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700 mb-4">
                        Seu usuário não está associado a nenhuma clínica ativa ou não foi possível carregar os dados da clínica.
                    </p>
                    <p className="text-gray-600 text-sm mb-6">
                        Por favor, entre em contato com o administrador do sistema para verificar suas permissões.
                    </p>
                    <Button onClick={handleGoToLogin} className="w-full">
                        <Home className="h-4 w-4 mr-2" /> Voltar para o Login
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default SelectClinicPage;