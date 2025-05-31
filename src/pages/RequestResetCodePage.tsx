import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, MailOpen } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const RequestResetCodePage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Por favor, insira seu endereço de e-mail.");
      return;
    }

    setIsLoading(true);
    try {
      // O redirectTo é importante para que o Supabase saiba para onde redirecionar
      // após o usuário clicar no link do e-mail (se for um magic link) ou para onde
      // a página de verificação de código deve estar.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/verify-reset-code?email=${encodeURIComponent(email.trim())}`,
      });

      if (resetError) {
        console.error("Erro ao solicitar código de redefinição:", resetError);
        throw new Error(resetError.message);
      }

      setMessage("Um e-mail com as instruções de redefinição de senha (ou um código) foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada e spam.");
      showSuccess("E-mail enviado!");

    } catch (err: any) {
      console.error("Erro na solicitação de código:", err);
      setError(err.message || "Ocorreu um erro ao solicitar o código de redefinição.");
      showError(err.message || "Erro ao enviar e-mail.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-primary text-3xl font-bold mb-2">Solicitar Redefinição de Senha</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <img
            src="/north-crm-azul.jpeg"
            alt="Logo North CRM"
            className="mx-auto h-32 w-auto mb-4"
          />

          <p className="text-sm text-gray-600 text-center">
            Insira seu e-mail para receber um código ou link de redefinição de senha.
          </p>

          <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
            <div className="form-group">
              <Label htmlFor="email">Seu Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
                <TriangleAlert className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {message && (
              <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2">
                <MailOpen className="h-4 w-4" />
                <p className="text-sm">{message}</p>
              </div>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Código/Link"
              )}
            </Button>
            <Button variant="link" onClick={() => navigate('/')} disabled={isLoading}>
              Voltar para o Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RequestResetCodePage;