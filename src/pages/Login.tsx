import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client'; // Importa o cliente Supabase
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const Login: React.FC<IndexProps> = () => { // Remove onLogin do destructuring, pois não será usado diretamente
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-primary">Acesse sua conta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Auth
            supabaseClient={supabase}
            providers={[]} // Não usaremos provedores de terceiros por enquanto
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))', // Cor primária do Tailwind
                    brandAccent: 'hsl(var(--primary-foreground))', // Cor de destaque
                  },
                },
              },
            }}
            theme="light"
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Seu email',
                  password_label: 'Sua senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Entrar',
                  social_provider_text: 'Entrar com {{provider}}',
                  link_text: 'Já tem uma conta? Entrar',
                },
                sign_up: {
                  email_label: 'Seu email',
                  password_label: 'Crie uma senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Cadastrar',
                  social_provider_text: 'Cadastrar com {{provider}}',
                  link_text: 'Não tem uma conta? Cadastre-se',
                },
                forgotten_password: {
                  email_label: 'Seu email',
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar instruções de redefinição',
                  link_text: 'Esqueceu sua senha?',
                },
                update_password: {
                  password_label: 'Nova senha',
                  password_input_placeholder: '••••••••',
                  button_label: 'Atualizar senha',
                },
                magic_link: {
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar link mágico',
                  link_text: 'Enviar um link mágico por email',
                },
                verify_otp: {
                  email_input_placeholder: 'Seu email',
                  phone_input_placeholder: 'Seu telefone',
                  token_input_placeholder: 'Código OTP',
                  button_label: 'Verificar código OTP',
                  link_text: 'Já tem um código OTP?',
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