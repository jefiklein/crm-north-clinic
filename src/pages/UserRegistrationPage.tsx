import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TriangleAlert, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client'; // Ainda necessário para buscar níveis de permissão
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext'; // To get clinicData and check permissions
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  id_permissao: number;
}

interface PermissionLevel {
    id: number;
    name: string;
    description: string | null;
}

const REQUIRED_PERMISSION_LEVEL = 4; // Nível 4: Administrador da Clínica (ou superior)
const SUPER_ADMIN_PERMISSION_ID = 5; // ID do nível de permissão para Super Admin

// URL do webhook N8N para atribuição de papel (agora espera user_id)
const N8N_USER_ROLE_ASSIGNMENT_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/25f39e3a-d410-4327-98e8-cf23dc324902';

// URL da nova Edge Function para convidar o usuário
const INVITE_USER_EDGE_FUNCTION_URL = 'https://eencnctntsydevijdhdu.supabase.co/functions/v1/invite-user'; // Substitua 'YOUR_SUPABASE_PROJECT_ID' pelo seu ID de projeto

const UserRegistrationPage: React.FC = () => {
    const { clinicData, isLoadingAuth } = useAuth();
    const navigate = useNavigate(); // Initialize useNavigate
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [selectedPermissionLevel, setSelectedPermissionLevel] = useState<string>('');
    const [permissionLevels, setPermissionLevels] = useState<PermissionLevel[]>([]);
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

    const hasPermission = !isLoadingAuth && clinicData && clinicData.id_permissao >= REQUIRED_PERMISSION_LEVEL;

    useEffect(() => {
        const fetchPermissionLevels = async () => {
            setIsLoadingPermissions(true);
            setError(null);
            try {
                const { data, error } = await supabase
                    .from('permission_levels')
                    .select('id, name, description')
                    .order('id', { ascending: true });

                if (error) throw error;
                
                // Filtrar o nível de permissão Super Admin (ID 5)
                const filteredLevels = (data || []).filter(level => level.id !== SUPER_ADMIN_PERMISSION_ID);

                setPermissionLevels(filteredLevels);
                if (filteredLevels.length > 0) {
                    setSelectedPermissionLevel(String(filteredLevels[0].id)); // Select first available by default
                }
            } catch (err: any) {
                console.error("Error fetching permission levels:", err);
                setError(`Erro ao carregar níveis de permissão: ${err.message}`);
            } finally {
                setIsLoadingPermissions(false);
            }
        };

        if (hasPermission) {
            fetchPermissionLevels();
        }
    }, [hasPermission]);

    const handleRegister = async () => {
        setError(null);
        if (!clinicData?.id) {
            setError("Dados da clínica não disponíveis. Por favor, recarregue a página.");
            return;
        }
        if (!email.trim() || !selectedPermissionLevel) {
            setError("Email e Nível de Permissão são obrigatórios.");
            return;
        }

        setIsRegistering(true);

        try {
            // PASSO 1: Convidar o usuário via Edge Function
            console.log("[UserRegistrationPage] Chamando Edge Function para convidar usuário...");
            const inviteResponse = await fetch(INVITE_USER_EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                }),
            });

            const inviteData = await inviteResponse.json();
            console.log("[UserRegistrationPage] Resposta da Edge Function de convite:", inviteData);

            if (!inviteResponse.ok || inviteData.error) {
                const errorMessage = inviteData.error || `Erro desconhecido ao convidar usuário (Status: ${inviteResponse.status})`;
                setError(errorMessage);
                showError(`Erro ao convidar usuário: ${errorMessage}`);
                return;
            }

            const userId = inviteData.userId;
            if (!userId) {
                setError("ID do usuário não retornado após o convite.");
                showError("Erro: ID do usuário não retornado.");
                return;
            }

            // PASSO 2: Chamar o webhook do N8N para atribuir o papel, passando o userId
            console.log("[UserRegistrationPage] Chamando webhook N8N para atribuir papel com userId:", userId);
            const roleAssignmentPayload = {
                user_id: userId, // O ID do usuário obtido da Edge Function
                email: email.trim(), // Opcional, mas pode ser útil para o N8N
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                clinic_id: clinicData.id,
                permission_level_id: parseInt(selectedPermissionLevel, 10),
            };

            const roleAssignmentResponse = await fetch(N8N_USER_ROLE_ASSIGNMENT_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(roleAssignmentPayload),
            });

            const roleAssignmentData = await roleAssignmentResponse.json();
            console.log("[UserRegistrationPage] Resposta do webhook N8N de atribuição de papel:", roleAssignmentData);

            if (!roleAssignmentResponse.ok || roleAssignmentData.error) {
                const errorMessage = roleAssignmentData.message || roleAssignmentData.error || `Erro desconhecido ao atribuir papel (Status: ${roleAssignmentResponse.status})`;
                setError(errorMessage);
                showError(`Erro ao atribuir papel: ${errorMessage}`);
                // Considere aqui um rollback ou log de erro mais robusto se a atribuição de papel falhar após o convite
                return;
            }

            showSuccess("Usuário cadastrado com sucesso! Um e-mail de convite foi enviado para o usuário definir a senha.");
            setEmail('');
            setFirstName('');
            setLastName('');
            setSelectedPermissionLevel('');
            
            // Navegar para a página de lista de usuários após o registro bem-sucedido
            navigate('/dashboard/15');

        } catch (err: any) {
            console.error("Registration process error:", err);
            setError(err.message || "Ocorreu um erro ao cadastrar o usuário.");
            showError(`Erro: ${err.message}`);
        } finally {
            setIsRegistering(false);
        }
    };

    if (isLoadingAuth) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-100 p-4">
                <Loader2 className="mx-auto h-12 w-12 text-primary mb-4 animate-spin" />
                <CardTitle className="text-2xl font-bold text-primary">Carregando...</CardTitle>
            </div>
        );
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

    return (
        <div className="user-registration-container max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                    <UserPlus className="h-6 w-6" /> Cadastrar Novo Usuário
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {error && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
                        <TriangleAlert className="h-4 w-4" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                <div className="form-group">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="email@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isRegistering}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                        <Label htmlFor="firstName">Primeiro Nome</Label>
                        <Input
                            id="firstName"
                            type="text"
                            placeholder="João"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isRegistering}
                        />
                    </div>
                    <div className="form-group">
                        <Label htmlFor="lastName">Sobrenome</LabeL>
                        <Input
                            id="lastName"
                            type="text"
                            placeholder="Silva"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isRegistering}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <Label htmlFor="permissionLevel">Nível de Permissão *</Label>
                    {isLoadingPermissions ? (
                        <div className="flex items-center gap-2 text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando níveis...
                        </div>
                    ) : (
                        <Select
                            value={selectedPermissionLevel}
                            onValueChange={setSelectedPermissionLevel}
                            disabled={isRegistering || permissionLevels.length === 0}
                        >
                            <SelectTrigger id="permissionLevel">
                                <SelectValue placeholder="Selecione o nível de permissão" />
                            </SelectTrigger>
                            <SelectContent>
                                {permissionLevels.map(level => (
                                    <SelectItem key={level.id} value={String(level.id)}>
                                        {level.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                        {permissionLevels.find(p => String(p.id) === selectedPermissionLevel)?.description || "Selecione um nível para ver a descrição."}
                    </p>
                </div>
                <Button onClick={handleRegister} disabled={isRegistering}>
                    {isRegistering ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cadastrando...
                        </>
                    ) : (
                        "Cadastrar Usuário"
                    )}
                </Button>
                <p className="text-sm text-gray-600 mt-4">
                    Após o cadastro, o usuário receberá um email de convite para definir a senha.
                </p>
            </CardContent>
        </div>
    );
};

export default UserRegistrationPage;