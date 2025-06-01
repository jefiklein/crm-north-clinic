"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const SetNewPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(true); // Start as loading to process URL hash
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionSet, setSessionSet] = useState(false); // Track if session has been successfully set

  useEffect(() => {
    const handleAuthTokens = async () => {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1)); // Remove '#' and parse

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        try {
          // Set the session using the tokens from the URL hash
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            console.error("Erro ao definir sessão:", setSessionError);
            throw new Error(setSessionError.message);
          }

          if (data.session) {
            setSessionSet(true);
            setSuccess("Sessão estabelecida. Agora defina sua nova senha.");
            showSuccess("Sessão iniciada!");
          } else {
            throw new Error("Sessão não retornada após definir tokens.");
          }

        } catch (err: any) {
          console.error("Erro no processamento dos tokens de sessão:", err);
          setError(err.message || "Ocorreu um erro ao processar seus tokens de sessão. O link pode ser inválido ou ter expirado.");
          showError(err.message || "Erro no link de ativação.");
        } finally {
          // Clear the URL hash for security and cleaner URLs
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsLoading(false);
        }
      } else {
        setError("Tokens de sessão não encontrados na URL. Por favor, use o link completo do e-mail.");
        setIsLoading(false);
      }
    };

    handleAuthTokens();
  }, []); // Run only once on mount

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!sessionSet) {
      setError("Sessão não estabelecida. Por favor, recarregue a página ou use o link do e-mail novamente.");
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
      // Update the user's password
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
        navigate('/', { replace: true }); // Redirect to login after setting password
      }, 3000);

    } catch (err: any) {
      console.error("Erro no processo de definição de senha:", err);
      setError(err.message || "Ocorreu um erro ao definir sua senha.");
      showError(err.message || "Erro ao definir senha.");
    } finally {
      setIsLoading(false);
    }
  };

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

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-gray-700">Carregando sessão...</p>
            </div>
          ) : sessionSet ? (
            <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
              <p className="text-sm text-gray-600 text-center">
                Sua conta foi ativada. Por favor, defina sua nova senha.
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
            <div className="flex flex-col items-center justify-center py-8">
              <TriangleAlert className="h-12 w-12 text-orange-500 mb-4" />
              <p className="text-lg text-gray-700 text-center">
                Não foi possível carregar a página de definição de senha.
              </p>
              <p className="text-sm text-gray-600 text-center mt-2">
                Por favor, verifique se você clicou no link completo do e-mail de ativação.
              </p>
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