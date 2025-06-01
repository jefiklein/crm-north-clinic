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

const SetNewPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(true); // Start loading to check session/token
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isReadyToSetPassword, setIsReadyToSetPassword] = useState(false);
  const [emailFromUrl, setEmailFromUrl] = useState<string | null>(null); // To display email

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    setEmailFromUrl(emailParam ? decodeURIComponent(emailParam) : null);

    // Check for access_token and type=recovery in URL fragment (hash)
    const fragmentParams = new URLSearchParams(location.hash.substring(1)); // Remove '#'
    const accessToken = fragmentParams.get('access_token');
    const tokenType = fragmentParams.get('type'); // Should be 'recovery'

    console.log("[SetNewPasswordPage] useEffect: Checking URL. emailParam:", emailParam, "accessToken:", !!accessToken, "tokenType:", tokenType);

    if (accessToken && tokenType === 'recovery') {
      // Supabase has already handled the token exchange and set the session
      // We just need to confirm the session is active.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          console.log("[SetNewPasswordPage] Session found after recovery link. Ready to set password.");
          setIsReadyToSetPassword(true);
          setSuccess("Link verificado com sucesso! Agora você pode definir sua nova senha.");
        } else {
          console.error("[SetNewPasswordPage] No session found after recovery link. Token might be expired or invalid.");
          setError("Link de redefinição inválido ou expirado. Por favor, solicite um novo.");
        }
        setIsLoading(false);
      }).catch(err => {
        console.error("[SetNewPasswordPage] Error getting session:", err);
        setError("Erro ao verificar sessão. Por favor, tente novamente.");
        setIsLoading(false);
      });
    } else {
      // If no access_token/recovery type in hash, check if already logged in (e.g., direct navigation after login)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // User is already logged in, but not necessarily from a reset link.
          // This page is specifically for setting a *new* password via a reset/invite flow.
          // If they are just logged in normally, they shouldn't be here.
          console.warn("[SetNewPasswordPage] User is already logged in, but not from a recovery link. Redirecting to dashboard.");
          navigate('/dashboard', { replace: true }); // Redirect if already logged in normally
        } else {
          console.log("[SetNewPasswordPage] No session or recovery token. User needs to request a reset.");
          setError("Para definir sua senha, por favor, solicite um link de redefinição.");
        }
        setIsLoading(false);
      }).catch(err => {
        console.error("[SetNewPasswordPage] Error getting session (no token):", err);
        setError("Erro ao verificar sessão. Por favor, tente novamente.");
        setIsLoading(false);
      });
    }

    // Clean up URL fragment after processing to prevent re-triggering
    if (location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname + location.search);
    }

  }, [location.search, location.hash, navigate]);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isReadyToSetPassword) {
      setError("A página não está pronta para definir a senha. Por favor, recarregue ou solicite um novo link.");
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

    setIsLoading(true);
    try {
      // This requires an active session, which should be present if isReadyToSetPassword is true
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
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-center text-primary text-3xl font-bold mb-2">Carregando...</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-gray-700 text-center">Verificando link de redefinição...</p>
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

          {isReadyToSetPassword ? (
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
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
          <Button variant="link" onClick={() => navigate('/')} disabled={isLoading}>
            Voltar para o Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetNewPasswordPage;