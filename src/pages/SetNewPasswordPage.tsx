"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get session directly

const SetNewPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, isLoadingAuth } = useAuth(); // Get session and loading state from AuthContext
  const location = useLocation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoadingPage, setIsLoadingPage] = useState(true); // Local loading for this page's checks
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailFromUrl, setEmailFromUrl] = useState<string | null>(null); // To display email

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    setEmailFromUrl(emailParam ? decodeURIComponent(emailParam) : null);

    // If AuthContext is still loading, wait.
    if (isLoadingAuth) {
      setIsLoadingPage(true);
      return;
    }

    // If a session exists, the user is ready to set password.
    if (session) {
      console.log("[SetNewPasswordPage] Session found. User is ready to set new password.");
      setError(null); // Clear any previous errors
      setSuccess("Sua sessão foi verificada. Agora você pode definir sua nova senha.");
    } else {
      console.log("[SetNewPasswordPage] No active session found. User needs to request a reset link.");
      setError("Sua sessão expirou ou o link é inválido. Por favor, solicite um novo link de redefinição de senha.");
    }
    setIsLoadingPage(false);

    // Clean up URL fragment if any (though Edge Function should prevent it)
    if (location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname + location.search);
    }

  }, [session, isLoadingAuth, location.search, location.hash, navigate]); // Depend on session and isLoadingAuth

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!session) { // Check if session is still active before attempting update
      setError("Sua sessão expirou. Por favor, solicite um novo link de redefinição.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoadingPage(true); // Use local loading state
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        throw new Error(updateError.message);
      }

      setSuccess("Sua senha foi definida com sucesso! Você será redirecionado para a página de login.");
      showSuccess("Senha definida com sucesso!");

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);

    } catch (err: any) {
      console.error("Erro no processo de definição de senha:", err);
      setError(err.message || "Ocorreu um erro ao definir sua senha.");
      showError(err.message || "Erro ao definir senha.");
    } finally {
      setIsLoadingPage(false);
    }
  };

  // Render loading state for the page itself
  if (isLoadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-center text-primary text-3xl font-bold mb-2">Carregando...</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-gray-700 text-center">Verificando sessão...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-primary text-3xl font-bold mb-2">Definir Nova Senha</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <img
            src="/north-crm-azul.jpeg"
            alt="Logo North CRM"
            className="mx-auto h-32 w-auto mb-4"
          />

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm">{success}</p>
            </div>
          )}

          {session ? ( // Only show password fields if a session is active
            <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
              <p className="text-sm text-gray-600 text-center">
                {emailFromUrl && `Para o e-mail: ${emailFromUrl}`}
                <br/>
                Defina sua nova senha.
              </p>
              <div className="form-group">
                <Label htmlFor="password">Nova Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoadingPage} // Use local loading state
                />
              </div>
              <div className="form-group">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoadingPage} // Use local loading state
                />
              </div>
              <Button type="submit" disabled={isLoadingPage}>
                {isLoadingPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Definindo Senha...
                  </>
                ) : (
                  "Definir Senha"
                )}
              </Button>
            </form>
          ) : (
            <div className="text-center text-gray-600">
              <p>Não foi possível carregar a tela de definição de senha.</p>
              <p className="mt-2">Por favor, solicite um novo link de redefinição de senha.</p>
              <Button variant="link" onClick={() => navigate('/request-reset-code')} className="mt-4">
                Solicitar Novo Link
              </Button>
            </div>
          )}
          <Button variant="link" onClick={() => navigate('/')} disabled={isLoadingPage}>
            Voltar para o Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetNewPasswordPage;