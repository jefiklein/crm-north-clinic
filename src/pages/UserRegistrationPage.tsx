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

// Webhook URL para atribuir o papel do usuário na clínica
const ASSIGN_ROLE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/25f39e3a-d410-4327-98e8-cf23dc324902';

const UserRegistrationPage: React.FC = () => {
    const { clinicData, isLoadingAuth } = useAuth();
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

    const generateRandomPassword = (length = 12) => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    };

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
        const tempPassword = generateRandomPassword(); // Generate a temporary password

        try {
            console.log("[UserRegistrationPage] Step 1: Attempting to register user in Supabase Auth...");
            // 1. Register user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password: tempPassword, // Use a temporary password
                options: {
                    data: {
                        first_name: firstName.trim() || null,
                        last_name: lastName.trim() || null,
                    },
                },
            });

            if (authError) {
                console.error("[UserRegistrationPage] Supabase Auth SignUp Error:", authError);
                throw new Error(authError.message);
            }

            if (!authData.user) {
                console.error("[UserRegistrationPage] User not returned after signup, authData:", authData);
                throw new Error("Usuário não retornado após o cadastro. Verifique o email e tente novamente.");
            }

            const newUserId = authData.user.id;
            console.log("[UserRegistrationPage] Step 1 Success: User registered in Auth. New User ID:", newUserId);

            // Introduce a small delay to ensure user is fully committed in auth.users
            console.log("[UserRegistrationPage] Introducing 500ms delay to ensure user record propagation...");
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
            console.log("[UserRegistrationPage] Delay finished. Proceeding to Step 2.");

            // 2. Call webhook to insert into user_clinic_roles table
            console.log("[UserRegistrationPage] Step 2: Calling webhook to assign role to user in clinic...", {
                userId: newUserId,
                clinicId: clinicData.id,
                permissionLevelId: parseInt(selectedPermissionLevel, 10),
                email: email.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });

            const webhookResponse = await fetch(ASSIGN_ROLE_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: newUserId,
                    clinicId: clinicData.id,
                    permissionLevelId: parseInt(selectedPermissionLevel, 10),
                    email: email.trim(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                }),
            });

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text();
                console.error("[UserRegistrationPage] Webhook Error Response:", errorText);
                let parsedError = errorText;
                try {
                    const jsonError = JSON.parse(errorText);
                    parsedError = jsonError.message || jsonError.error || errorText;
                } catch (parseErr) {
                    // Not a JSON error, use raw text
                }
                throw new Error(`Erro ao vincular usuário à clínica via backend: ${parsedError}. Por favor, remova o usuário criado manualmente no Supabase Auth se necessário.`);
            }

            const webhookData = await webhookResponse.json();
            console.log("[UserRegistrationPage] Step 2 Success: Webhook returned:", webhookData);

            // 3. Trigger password reset email for the newly created user
            console.log("[UserRegistrationPage] Step 3: Triggering password reset email for new user...");
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/verify-reset-code?email=${encodeURIComponent(email.trim())}`,
            });

            if (resetError) {
                console.error("[UserRegistrationPage] Error sending password reset email for new user:", resetError);
                throw new Error(`Usuário cadastrado, mas falha ao enviar e-mail de redefinição de senha: ${resetError.message}`);
            }
            console.log("[UserRegistrationPage] Step 3 Success: Password reset email sent.");

            showSuccess("Usuário cadastrado com sucesso! Um email de redefinição de senha foi enviado para o usuário definir a senha inicial.");
            setEmail('');
            setFirstName('');
            setLastName('');
            setSelectedPermissionLevel('');
        } catch (err: any) {
            console.error("[UserRegistrationPage] Registration process error:", err);
            setError(err.message || "Ocorreu um erro ao cadastrar o usuário.");
            showError(`Erro: ${err.message}`);
        } finally {
            setIsRegistering(false);
            console.log("[UserRegistrationPage] Registration process finished.");
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
                    Após o cadastro, um email de redefinição de senha será enviado para o usuário definir sua senha inicial.
                </p>
            </CardContent>
        </div>
    );
};

export default UserRegistrationPage;