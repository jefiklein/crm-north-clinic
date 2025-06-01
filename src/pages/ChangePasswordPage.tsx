"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TriangleAlert, CheckCircle2, Key } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      // Atualizar a senha do usuário logado
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        throw new Error(updateError.message);
      }

      setSuccess("Sua senha foi atualizada com sucesso!");
      showSuccess("Senha atualizada com sucesso!");
      setNewPassword('');
      setConfirmNewPassword('');

      // Opcional: Redirecionar para o dashboard após um tempo
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error("Erro no processo de definição de senha:", err);
      setError(err.message || "Ocorreu um erro ao definir sua senha.");
      showError(err.message || "Erro ao definir senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-primary text-2xl font-bold mb-2 flex items-center justify-center gap-2">
            <Key className="h-6 w-6" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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

          <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
            <div className="form-group">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Nova Senha"
              )}
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')} disabled={isLoading}>
              Cancelar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;