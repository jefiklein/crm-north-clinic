import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button'; // Import Button

interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface IndexProps {
  onLogin: (data: ClinicData) => void;
}

const Login: React.FC<IndexProps> = () => {
  const { session, clinicData, availableClinics, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[Login.tsx] useEffect: Auth state changed. isLoadingAuth:", isLoadingAuth, "session:", !!session, "clinicData:", !!clinicData, "availableClinics:", availableClinics ? availableClinics.length : 'null');

    // Só tenta redirecionar se o carregamento da autenticação estiver completo
    // A verificação de 'isPasswordRecovery' foi movida para App.tsx
    if (!isLoadingAuth) {
      if (session) {
        // Usuário autenticado
        if (clinicData && clinicData.id) {
          // Usuário autenticado E clínica selecionada
          console.log("[Login.tsx] Redirecionando para /dashboard (autenticado, clínica selecionada).");
          navigate('/dashboard', { replace: true });
        } else if (availableClinics && availableClinics.length > 0) {
          // Usuário autenticado, mas precisa selecionar clínica
          console.log("[Login.tsx] Redirecionando para /select-clinic (autenticado, seleção de clínica necessária).");
          navigate('/select-clinic', { replace: true });
        } else if (availableClinics && availableClinics.length === 0) {
          // Usuário autenticado, mas sem clínicas disponíveis
          console.log("[Login.tsx] Usuário autenticado, mas sem clínicas disponíveis. Redirecionando para /select-clinic para exibir mensagem.");
          navigate('/select-clinic', { replace: true });
        }
      } else {
        // Usuário não autenticado. Permanece na página de login para exibir o formulário.
        console.log("[Login.tsx] Usuário não autenticado. Permanecendo na página de login.");
      }
    }
  }, [session, clinicData, availableClinics, isLoadingAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-primary text-3xl font-bold mb-2">North CRM</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <img
            src="/north-crm-azul.jpeg"
            alt="Logo North CRM"
            className="mx-auto h-32 w-auto mb-4"
          />
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary-foreground))',
                  },
                },
              },
            }}
            theme="light"
            localization={{
              email_otp_text: '',
              email_password_text: 'Entrar com email e senha',
              loading_text: 'Carregando...',
              no_session_text: 'Nenhuma sessão encontrada.',
              validation_text: 'A senha deve ter pelo menos 6 caracteres.',
              confirmation_text: 'Verifique seu e-mail para o link de confirmação.',

              variables: {
                sign_in: {
                  email_label: 'Seu email',
                  password_label: 'Sua senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Entrar',
                  social_provider_text: 'Entrar com {{provider}}',
                  link_text: '',
                },
                sign_up: {
                  email_label: 'Seu email',
                  password_label: 'Crie uma senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Cadastrar',
                  social_provider_text: 'Cadastrar com {{provider}}',
                  link_text: '',
                },
                // Removido o forgotten_password padrão para usar nosso próprio fluxo
                magic_link: {
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar link mágico',
                  link_text: 'Entrar com link mágico',
                  check_email: 'Verifique seu e-mail para o link mágico.',
                },
                verify_otp: {
                  email_input_placeholder: 'Seu email',
                  phone_input_placeholder: 'Seu telefone',
                  token_input_placeholder: 'Código OTP',
                  button_label: 'Verificar código OTP',
                  link_text: 'Já tem um código OTP?',
                },
                update_password: {
                  password_label: 'Sua nova senha',
                  password_input_placeholder: 'Sua nova senha',
                  button_label: 'Atualizar senha',
                  link_text: 'Atualizar senha',
                  confirmation_text: 'Sua senha foi atualizada.',
                  no_session_text: 'Nenhuma sessão encontrada.',
                  validation_text: 'A senha deve ter pelo menos 6 caracteres.',
                },
              },
            }}
          />
          <Button variant="link" onClick={() => navigate('/request-reset-code')} className="mt-2">
            Esqueceu sua senha?
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;