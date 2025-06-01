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

const VerifyResetCodePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailFromUrl = params.get('email');
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
    } else {
      // If email is not in query params, check for it in the hash (from password reset link)
      const hashParams = new URLSearchParams(location.hash.substring(1)); // Remove '#'
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        console.log("[VerifyResetCodePage] Detected access_token in URL hash. Attempting to set session.");
        setIsLoading(true);
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error: sessionError }) => {
            if (sessionError) {
              console.error("[VerifyResetCodePage] Error setting session from hash:", sessionError);
              setError(sessionError.message || "Erro ao autenticar via link de redefinição.");
              showError(sessionError.message || "Erro de autenticação.");
            } else if (data.session) {
              console.log("[VerifyResetCodePage] Session set successfully from hash. User:", data.session.user?.email);
              setIsOtpVerified(true); // Mark as verified, proceed to password change
              setSuccess("Autenticado via link! Agora você pode definir sua nova senha.");
              // Try to get email from session if not already set
              if (!emailFromUrl && data.session.user?.email) {
                setEmail(data.session.user.email);
              }
              // Clear hash from URL to prevent re-processing on refresh
              window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            } else {
              setError("Sessão não estabelecida via link de redefinição.");
            }
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        // If no email in query params and no valid access_token in hash, show error
        setError("E-mail não encontrado na URL. Por favor, retorne à página anterior ou insira o e-mail manualmente.");
      }
    }
  }, [location.search, location.hash, email]); // Depend on location.search and location.hash

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !otpCode.trim()) {
      setError("Por favor, insira o e-mail e o código OTP.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'recovery',
      });

      if (verifyError) {
        console.error("Erro ao verificar código OTP:", verifyError);
        throw new Error(verifyError.message);
      }

      if (data.user) {
        setIsOtpVerified(true);
        setSuccess("Código verificado com sucesso! Agora você pode definir sua nova senha.");
        showSuccess("Código verificado!");
      } else {
        throw new Error("Verificação de código falhou. Usuário não encontrado.");
      }

    } catch (err: any) {
      console.error("Erro na verificação do OTP:", err);
      setError(err.message || "Ocorreu um erro ao verificar o código.");
      showError(err.message || "Erro ao verificar código.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isOtpVerified) {
      setError("Por favor, verifique o código OTP primeiro.");
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
      // updateUser requires an active session, which should be set by verifyOtp or setSession from hash
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        throw new Error(updateError.message);
      }

      setSuccess("Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login.");
      showSuccess("Senha redefinida com sucesso!");

      // Clear query params and hash from URL after successful reset
      window.history.replaceState({}, document.title, window.location.pathname);

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);

    } catch (err: any) {
      console.error("Erro no processo de redefinição:", err);
      setError(err.message || "Ocorreu um erro ao redefinir sua senha.");
      showError(err.message || "Erro ao redefinir senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-primary text-3xl font-bold mb-2">Redefinir Senha</CardTitle>
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

          {!isOtpVerified ? (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <p className="text-sm text-gray-600 text-center">
                Insira o código que você recebeu por e-mail para redefinir sua senha.
              </p>
              <div className="form-group">
                <Label htmlFor="email">Seu Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || (!!email && !error)} {/* Disable if email is pre-filled and no error */}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="otpCode">Código de Redefinição</Label>
                <Input
                  id="otpCode"
                  type="text"
                  placeholder="Digite o código de 6 dígitos"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando Código...
                  </>
                ) : (
                  "Verificar Código"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <p className="text-sm text-gray-600 text-center">
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
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir Senha"
                )}
              </Button>
            </form>
          )}
          <Button variant="link" onClick={() => navigate('/')} disabled={isLoading}>
            Voltar para o Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyResetCodePage;