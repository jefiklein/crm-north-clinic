import React, { useEffect } from 'react'; // Import useEffect
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// A interface ClinicData e IndexProps não serão mais usadas diretamente aqui,
// pois o AuthContext se encarregará de buscar os dados da clínica após o login do usuário.
// Mantemos as interfaces para evitar erros de tipo em outros lugares por enquanto.
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface IndexProps {
  onLogin: (data: ClinicData) => void; // Este prop será removido do uso direto aqui
}

const Login: React.FC<IndexProps> = () => { // Removed IndexProps from here, as it's not used
  const { session, clinicData, availableClinics, isLoadingAuth } = useAuth(); // Get auth state from context
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[Login.tsx] useEffect: Auth state changed. isLoadingAuth:", isLoadingAuth, "session:", !!session, "clinicData:", !!clinicData, "availableClinics:", availableClinics ? availableClinics.length : 'null');

    // Only attempt redirect if auth loading is complete
    if (!isLoadingAuth) {
      if (session) {
        // User is authenticated
        if (clinicData && clinicData.id) {
          // User is authenticated AND a clinic is selected
          console.log("[Login.tsx] Redirecting to /dashboard (authenticated, clinic selected).");
          navigate('/dashboard', { replace: true });
        } else if (availableClinics && availableClinics.length > 0) {
          // User is authenticated but no clinic selected, and there are available clinics
          console.log("[Login.tsx] Redirecting to /select-clinic (authenticated, clinic selection needed).");
          navigate('/select-clinic', { replace: true });
        } else if (availableClinics && availableClinics.length === 0) {
          // User is authenticated but no available clinics (or none active)
          console.log("[Login.tsx] User authenticated but no available clinics. Staying on login to show message.");
          // Stay on this page, the SelectClinicPage will show the "no clinics" message.
          // Or, if they are on the login page, they will see the Auth UI.
          // If they try to go to /dashboard, App.tsx will redirect them back to /.
          // The SelectClinicPage handles the "no clinics" message better.
          navigate('/select-clinic', { replace: true }); // Force redirect to select clinic page to show the message
        }
        // If session exists but availableClinics is null, it means clinics are still loading in AuthContext.
        // We wait for availableClinics to be set (either to [] or actual clinics).
      } else {
        // User is not authenticated. Stay on this page to show login form.
        console.log("[Login.tsx] User not authenticated. Staying on login page.");
      }
    }
  }, [session, clinicData, availableClinics, isLoadingAuth, navigate]);

  // Render the Auth UI. The useEffect above will handle redirects.
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
                forgotten_password: {
                  email_label: 'Seu email',
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar instruções de redefinição',
                  link_text: 'Esqueceu sua senha?',
                  check_email: 'Verifique seu e-mail para o link de redefinição de senha.',
                },
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;