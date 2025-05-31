import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input }
from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true);
      setError(null);
      setSuccess(null); // Clear success message on new check

      console.log("[ResetPasswordPage] Início da verificação de sessão.");
      console.log("URL atual:", window.location.href);
      console.log("Hash da URL:", window.location.hash);
      console.log("Query String da URL:", window.location.search);

      try {
        let { data: { session } } = await supabase.auth.getSession();
        console.log("[ResetPasswordPage] Resultado inicial de getSession():", session ? "Sessão encontrada" : "Nenhuma sessão encontrada");

        // Se nenhuma sessão foi encontrada pelo hash, tenta buscar na query string
        if (!session) {
          console.log("[ResetPasswordPage] Nenhuma sessão no hash. Verificando query string...");
          const queryParams = new URLSearchParams(window.location.search);
          const accessToken = queryParams.get('access_token');
          const refreshToken = queryParams.get('refresh_token');
          const type = queryParams.get('type');

          console.log("[ResetPasswordPage] Query Params - access_token:", accessToken ? "presente" : "ausente", "refresh_token:", refreshToken ? "presente" : "ausente", "type:", type);

          if (accessToken && refreshToken && type === 'recovery') {
            console.log("[ResetPasswordPage] Tokens de redefinição encontrados na query string. Tentando definir sessão com setSession()...");
            const { data: newSessionData, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setSessionError) {
              console.error("[ResetPasswordPage] Erro ao definir sessão a partir da query string com setSession():", setSessionError);
              throw new Error(setSessionError.message);
            }
            session = newSessionData.session; // Usa a sessão recém-definida
            console.log("[ResetPasswordPage] setSession() concluído. Nova sessão:", session ? "definida" : "não definida");

            // Limpa os parâmetros da query string da URL para evitar reprocessamento em refresh
            // Isso também ajuda a evitar que os tokens fiquem visíveis na URL após o uso.
            window.history.replaceState({}, document.title, window.location.pathname);
            console.log("[ResetPasswordPage] Query string limpa da URL.");

            // Tenta obter a sessão novamente após setSession para confirmar
            const { data: { session: confirmedSession } } = await supabase.auth.getSession();
            console.log("[ResetPasswordPage] getSession() após setSession():", confirmedSession ? "Sessão confirmada" : "Sessão não confirmada");
            session = confirmedSession; // Usa a sessão confirmada
          }
        }

        if (session) {
          setIsSessionReady(true);
          console.log("[ResetPasswordPage] Sessão encontrada e pronta para redefinição de senha.");
        } else {
          setError("Sessão de redefinição de senha não encontrada. Por favor, use o link do e-mail novamente.");
          showError("Sessão de redefinição ausente.");
          console.warn("[ResetPasswordPage] Nenhuma sessão válida encontrada para redefinição.");
        }
      } catch (err: any) {
        console.error("[ResetPasswordPage] Erro geral ao verificar/definir sessão:", err);
        setError("Erro ao verificar/definir sessão: " + err.message);
        showError("Erro ao verificar/definir sessão.");
      } finally {
        setIsLoading(false);
        console.log("[ResetPasswordPage] Fim da verificação de sessão. isLoading:", isLoading, "isSessionReady:", isSessionReady, "error:", error);
      }
    };

    checkSession();
  }, []); // Dependências vazias para rodar apenas uma vez na montagem

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
    console.log("[ResetPasswordPage] Tentando redefinir senha...");
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("[ResetPasswordPage] Erro ao atualizar senha:", updateError);
        throw new Error(updateError.message);
      }

      setSuccess("Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login.");
      showSuccess("Senha redefinida com sucesso!");
      console.log("[ResetPasswordPage] Senha redefinida com sucesso. Redirecionando...");

      // Limpa o hash e a query string da URL após a redefinição bem-sucedida
      window.history.replaceState({}, document.title, window.location.pathname);

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);

    } catch (err: any) {
      console.error("[ResetPasswordPage] Erro no processo de redefinição:", err);
      setError(err.message || "Ocorreu um erro ao redefinir sua senha.");
      showError(err.message || "Erro ao redefinir senha.");
    } finally {
      setIsLoading(false);
      console.log("[ResetPasswordPage] Fim do processo de redefinição.");
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

          {isLoading && !error && (
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