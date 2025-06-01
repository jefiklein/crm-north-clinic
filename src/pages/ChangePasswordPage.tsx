"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, CheckCircle2, Key, User } from 'lucide-react'; // Added User icon
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Import query hooks

// Define the structure for user profile data
interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // Initialize query client
  const { session } = useAuth(); // Get the current session from AuthContext

  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Profile update states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Fetch user profile data
  const { data: userProfile, isLoading: isLoadingProfile, error: fetchProfileError } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', session.user.id)
        .single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means "No rows found"
        throw new Error(error.message);
      }
      return data || null;
    },
    enabled: !!session?.user?.id, // Only fetch if user ID is available
    staleTime: 5 * 60 * 1000, // Cache profile data for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Populate form fields when profile data is loaded
  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.first_name || '');
      setLastName(userProfile.last_name || '');
    }
  }, [userProfile]);

  // Mutation for updating password
  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw new Error(error.message);
      return true;
    },
    onMutate: () => {
      setIsPasswordUpdating(true);
      setPasswordError(null);
      setPasswordSuccess(null);
    },
    onSuccess: () => {
      setPasswordSuccess("Sua senha foi atualizada com sucesso!");
      showSuccess("Senha atualizada com sucesso!");
      setNewPassword('');
      setConfirmNewPassword('');
    },
    onError: (error: Error) => {
      setPasswordError(error.message || "Ocorreu um erro ao definir sua senha.");
      showError(error.message || "Erro ao definir senha.");
    },
    onSettled: () => {
      setIsPasswordUpdating(false);
    },
  });

  // Mutation for updating profile (first_name, last_name)
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: { first_name: string; last_name: string }) => {
      if (!session?.user?.id) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: profileData.first_name, last_name: profileData.last_name, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (error) throw new Error(error.message);
      return true;
    },
    onMutate: () => {
      setIsProfileUpdating(true);
      setProfileError(null);
      setProfileSuccess(null);
    },
    onSuccess: () => {
      setProfileSuccess("Seus dados foram atualizados com sucesso!");
      showSuccess("Dados do perfil atualizados!");
      queryClient.invalidateQueries({ queryKey: ['userProfile', session?.user?.id] }); // Invalidate to refetch latest data
    },
    onError: (error: Error) => {
      setProfileError(error.message || "Ocorreu um erro ao atualizar seus dados.");
      showError(error.message || "Erro ao atualizar perfil.");
    },
    onSettled: () => {
      setIsProfileUpdating(false);
    },
  });

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    updatePasswordMutation.mutate(newPassword);
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) {
      setProfileError("Pelo menos o nome ou sobrenome deve ser preenchido.");
      return;
    }
    updateProfileMutation.mutate({ first_name: firstName.trim(), last_name: lastName.trim() });
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex flex-col items-center justify-center bg-gray-100 p-4 space-y-6">
      {/* Card for Change Password */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-primary text-2xl font-bold mb-2 flex items-center justify-center gap-2">
            <Key className="h-6 w-6" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {passwordError && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">{passwordError}</p>
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm">{passwordSuccess}</p>
            </div>
          )}
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <div className="form-group">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isPasswordUpdating}
              />
            </div>
            <div className="form-group">
              <Label htmlFor="confirmNewPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                placeholder="••••••••"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                disabled={isPasswordUpdating}
              />
            </div>
            <Button type="submit" disabled={isPasswordUpdating}>
              {isPasswordUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Nova Senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card for Profile Details */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-primary text-2xl font-bold mb-2 flex items-center justify-center gap-2">
            <User className="h-6 w-6" /> Meus Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoadingProfile ? (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="animate-spin" />
              Carregando dados do perfil...
            </div>
          ) : fetchProfileError ? (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">Erro ao carregar perfil: {fetchProfileError.message}</p>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
              {profileError && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4" />
                  <p className="text-sm">{profileError}</p>
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-sm">{profileSuccess}</p>
                </div>
              )}
              <div className="form-group">
                <Label htmlFor="firstName">Primeiro Nome</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Seu primeiro nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isProfileUpdating}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Seu sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isProfileUpdating}
                />
              </div>
              <Button type="submit" disabled={isProfileUpdating}>
                {isProfileUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Dados"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full max-w-md">
        Voltar para o Dashboard
      </Button>
    </div>
  );
};

export default ChangePasswordPage;