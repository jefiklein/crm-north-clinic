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
  const [isOtpVerified, setIsOtpVerified] = useState(false); // New state to control flow

  useEffect(() => {
    // Extract email from URL on component mount
    const params = new URLSearchParams(location.search);
    const emailFromUrl = params.get('email');
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
    } else {
      // If no email in URL, prompt user to go back or enter manually
      setError("E-mail não encontrado na URL. Por favor, retorne à página anterior ou insira o e-mail manualmente.");
    }
  }, [location.search]);

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
      // Verify the OTP code
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'recovery', // Important: specify 'recovery' type
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
      // Update the user's password (session should be active after verifyOtp)
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        throw new Error(updateError.message);
      }

      setSuccess("Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login.");
      showSuccess("Senha redefinida com sucesso!");

      // Clear URL parameters to prevent re-use on refresh
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
                  disabled={isLoading || !!email} {/* Disable if email is already pre-filled */}
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