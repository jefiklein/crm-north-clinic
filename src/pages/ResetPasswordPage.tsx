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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // --- LOGS DETALHADOS DA URL ---
    console.log("[ResetPasswordPage] URL Completa:", window.location.href);
    console.log("[ResetPasswordPage] Hash da URL:", window.location.hash);
    console.log("[ResetPasswordPage] Query String da URL:", window.location.search);
    // --- FIM DOS LOGS DETALHADOS ---

    const checkSession = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Tenta obter a sessão. Supabase DEVERIA processar o hash da URL aqui.
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Se uma sessão foi encontrada, verifica se é do tipo recuperação
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = hashParams.get('type');
          
          if (type === 'recovery') {
            setIsSessionReady(true);
            console.log("[ResetPasswordPage] Sessão encontrada e é do tipo recuperação.");
          } else {
            // Se houver sessão mas não for de recuperação, pode ser um acesso indevido
            setError("Esta página é apenas para redefinição de senha. Redirecionando para o login.");
            showError("Acesso inválido à página de redefinição.");
            setTimeout(() => navigate('/', { replace: true }), 3000);
          }
        } else {
          // Se nenhuma sessão foi encontrada, pode ser que o token não esteja no hash
          setError("Sessão de redefinição de senha não encontrada. Por favor, use o link do e-mail novamente.");
          showError("Sessão de redefinição ausente.");
        }
      } catch (err: any) {
        console.error("[ResetPasswordPage] Erro ao verificar sessão:", err);
        setError("Erro ao verificar sessão: " + err.message);
        showError("Erro ao verificar sessão.");
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
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
        console.error("Erro ao atualizar senha:", updateError);
        throw new Error(updateError.message);
      }

      setSuccess("Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login.");
      showSuccess("Senha redefinida com sucesso!");

      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

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