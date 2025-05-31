import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Start as loading to check session
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [manualLinkInput, setManualLinkInput] = useState(''); // State for manual link input
  const navigate = useNavigate();

  // Function to attempt session retrieval and setting
  const attemptSessionRetrieval = async (retries = 3, delay = 500) => {
    setError(null); // Clear previous errors
    try {
      let { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log("[ResetPasswordPage] Session found via getSession().");
        setIsSessionReady(true);
        return;
      }

      // If no session, try to extract from URL (hash or query string)
      const url = window.location.href;
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');
      const type = urlParams.get('type') || hashParams.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        console.log("[ResetPasswordPage] Tokens found in URL. Attempting to set session.");
        const { data: newSessionData, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setSessionError) {
          console.error("[ResetPasswordPage] Error setting session from URL tokens:", setSessionError);
          throw new Error(setSessionError.message);
        }
        
        if (newSessionData.session) {
          setIsSessionReady(true);
          console.log("[ResetPasswordPage] Session successfully set from URL tokens.");
          // Clear URL parameters to prevent re-use on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      }

      // If still no session and retries left, try again
      if (retries > 0) {
        console.log(`[ResetPasswordPage] No session found. Retrying in ${delay}ms... (Retries left: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        await attemptSessionRetrieval(retries - 1, delay * 2); // Exponential backoff
      } else {
        console.warn("[ResetPasswordPage] Max retries reached. No session found.");
        setError("Sessão de redefinição de senha não encontrada. Por favor, use o link do e-mail novamente ou cole-o abaixo.");
        showError("Sessão de redefinição ausente.");
      }

    } catch (err: any) {
      console.error("[ResetPasswordPage] General error during session retrieval:", err);
      setError("Erro ao verificar/definir sessão: " + err.message);
      showError("Erro ao verificar/definir sessão.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    attemptSessionRetrieval();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isSessionReady) {
      setError("Sessão de redefinição não está pronta. Por favor, aguarde ou recarregue a página.");
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
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Error updating password:", updateError);
        throw new Error(updateError.message);
      }

      setSuccess("Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login.");
      showSuccess("Senha redefinida com sucesso!");

      // Clear URL parameters after successful reset
      window.history.replaceState({}, document.title, window.location.pathname);

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);

    } catch (err: any) {
      console.error("Error in reset process:", err);
      setError(err.message || "Ocorreu um erro ao redefinir sua senha.");
      showError(err.message || "Erro ao redefinir senha.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessManualLink = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const url = new URL(manualLinkInput);
      const urlParams = new URLSearchParams(url.search);
      const hashParams = new URLSearchParams(url.hash.substring(1));

      const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');
      const type = urlParams.get('type') || hashParams.get('type');

      if (!accessToken || !refreshToken || type !== 'recovery') {
        throw new Error("Link inválido. Certifique-se de colar o link completo de redefinição de senha.");
      }

      console.log("[ResetPasswordPage] Manual link: Tokens extracted. Attempting to set session.");
      const { data: newSessionData, error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setSessionError) {
        console.error("[ResetPasswordPage] Error setting session from manual link:", setSessionError);
        throw new Error(setSessionError.message);
      }

      if (newSessionData.session) {
        setIsSessionReady(true);
        setManualLinkInput(''); // Clear input on success
        showSuccess("Sessão de redefinição ativada. Agora você pode definir sua nova senha.");
      } else {
        throw new Error("Não foi possível ativar a sessão com o link fornecido.");
      }

    } catch (err: any) {
      console.error("[ResetPasswordPage] Error processing manual link:", err);
      setError(err.message || "Erro ao processar o link manual. Verifique se o link está correto e completo.");
      showError(err.message || "Erro ao processar link.");
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

          {isLoading && !error && !success && (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verificando sessão...
            </div>
          )}

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

          {!success && !isSessionReady && !isLoading && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-600 text-center">
                Não foi possível detectar a sessão de redefinição automaticamente.
                Por favor, cole o link completo de redefinição de senha que você recebeu por e-mail:
              </p>
              <div className="form-group">
                <Label htmlFor="manualLink">Link de Redefinição</Label>
                <Input
                  id="manualLink"
                  type="text"
                  placeholder="Cole o link completo aqui..."
                  value={manualLinkInput}
                  onChange={(e) => setManualLinkInput(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleProcessManualLink} disabled={isLoading || !manualLinkInput.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Processar Link Manualmente"
                )}
              </Button>
            </div>
          )}

          {!success && isSessionReady && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;