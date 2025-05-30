import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TriangleAlert, Home, Loader2, Building } from 'lucide-react'; // Added Building icon
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

const SelectClinicPage: React.FC = () => {
    const navigate = useNavigate();
    const { logout, availableClinics, selectClinic, isLoadingAuth, clinicData } = useAuth(); // Get availableClinics and selectClinic

    // Redirect to dashboard if a clinic is already selected and availableClinics are loaded
    useEffect(() => {
        if (!isLoadingAuth && clinicData && availableClinics && availableClinics.length > 0) {
            // If a clinic is already selected and it's in the available list, go to dashboard
            if (availableClinics.some(c => String(c.id) === String(clinicData.id))) {
                navigate('/dashboard');
            }
        }
    }, [isLoadingAuth, clinicData, availableClinics, navigate]);


    const handleGoToLogin = async () => {
        await logout(); // Perform logout to clear session
        navigate('/'); // Navigate to login page
    };

    const handleSelectClinic = (clinicId: number | string) => {
        selectClinic(clinicId);
    };

    if (isLoadingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <Loader2 className="mx-auto h-12 w-12 text-primary mb-4 animate-spin" />
                        <CardTitle className="text-2xl font-bold text-primary">Carregando Clínicas...</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-700">Por favor, aguarde enquanto carregamos suas clínicas disponíveis.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    {availableClinics && availableClinics.length > 0 ? (
                        <Building className="mx-auto h-12 w-12 text-primary mb-4" />
                    ) : (
                        <TriangleAlert className="mx-auto h-12 w-12 text-orange-500 mb-4" />
                    )}
                    <CardTitle className="text-2xl font-bold text-primary">
                        {availableClinics && availableClinics.length > 0 ? "Selecione sua Clínica" : "Clínica Não Associada"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {availableClinics && availableClinics.length > 0 ? (
                        <>
                            <p className="text-gray-700 mb-4">
                                Você tem acesso a múltiplas clínicas. Por favor, selecione uma para continuar:
                            </p>
                            <div className="grid gap-3">
                                {availableClinics.map(clinic => (
                                    <Button
                                        key={clinic.id}
                                        variant="outline"
                                        className="w-full py-3 text-lg"
                                        onClick={() => handleSelectClinic(clinic.id!)}
                                    >
                                        {clinic.nome}
                                    </Button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-gray-700 mb-4">
                                Seu usuário não está associado a nenhuma clínica ativa ou não foi possível carregar os dados da clínica.
                            </p>
                            <p className="text-gray-600 text-sm mb-6">
                                Por favor, entre em contato com o administrador do sistema para verificar suas permissões.
                            </p>
                        </>
                    )}
                    <Button onClick={handleGoToLogin} className="w-full mt-6">
                        <Home className="h-4 w-4 mr-2" /> Voltar para o Login
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default SelectClinicPage;