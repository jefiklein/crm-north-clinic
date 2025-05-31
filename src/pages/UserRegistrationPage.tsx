import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TriangleAlert, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
            // 1. Tentar cadastrar o usuário no Supabase Auth
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password: Math.random().toString(36).substring(2, 15), // Gerar uma senha temporária aleatória
                options: {
                    data: {
                        first_name: firstName.trim(),
                        last_name: lastName.trim(),
                    },
                },
            });

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    setError("Este email já está cadastrado. Por favor, use a opção 'Esqueceu sua senha?' para redefinir.");
                    showError("Este email já está cadastrado.");
                } else {
                    setError(signUpError.message || "Erro desconhecido ao cadastrar usuário.");
                    showError(`Erro: ${signUpError.message}`);
                }
                return;
            }

            const userId = signUpData.user?.id;

            if (!userId) {
                setError("Erro ao obter ID do usuário após o cadastro.");
                showError("Erro ao cadastrar usuário.");
                return;
            }

            // 2. Atribuir o papel na tabela user_clinic_roles
            const { error: roleError } = await supabase
                .from('user_clinic_roles')
                .insert({
                    user_id: userId,
                    clinic_id: clinicData.id,
                    permission_level_id: parseInt(selectedPermissionLevel, 10),
                    is_active: true,
                });

            if (roleError) {
                console.error("Erro ao atribuir papel:", roleError);
                setError(roleError.message || "Erro ao atribuir papel ao usuário.");
                showError(`Erro ao atribuir papel: ${roleError.message}`);
                // Opcional: Se a atribuição de papel falhar, você pode querer deletar o usuário recém-criado no auth.
                // Isso exigiria uma Edge Function ou Service Role Key, então por enquanto, apenas reportamos o erro.
                return;
            }

            showSuccess("Usuário cadastrado com sucesso! Um e-mail de confirmação foi enviado. O usuário precisará confirmar o e-mail e, em seguida, usar a opção 'Esqueceu sua senha?' para definir a senha.");
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
                        <Label htmlFor="lastName">Sobrenome</Label>
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
                    Após o cadastro, o usuário receberá um email de confirmação. Ele precisará confirmar o e-mail e, em seguida, usar a opção "Esqueceu sua senha?" na tela de login para definir a senha.
                </p>
            </CardContent>
        </div>
    );
};

export default UserRegistrationPage;