import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client'; // Importa o cliente Supabase
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Importa CardDescription

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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4"> {/* Fundo com a cor do menu */}
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-primary text-3xl font-bold mb-2">North CRM</CardTitle> {/* Título principal */}
          {/* <CardDescription className="text-center text-gray-600">Acesse sua conta</CardDescription> Removido */}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Adicionando a logo aqui */}
          <img
            src="/north-crm-azul.jpeg"
            alt="Logo North CRM"
            className="mx-auto h-32 w-auto mb-4"
          />
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
            view="sign_in" // Adicionado para exibir apenas a tela de login
            localization={{
              // Mensagens de nível superior
              email_otp_text: '', // Removido o texto para desabilitar o link mágico
              email_password_text: 'Entrar com email e senha',
              loading_text: 'Carregando...',
              no_session_text: 'Nenhuma sessão encontrada.',
              validation_text: 'A senha deve ter pelo menos 6 caracteres.',
              confirmation_text: 'Verifique seu e-mail para o link de confirmação.', // Para confirmação de cadastro

              variables: {
                sign_in: {
                  email_label: 'Seu email',
                  password_label: 'Sua senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Entrar',
                  social_provider_text: 'Entrar com {{provider}}',
                  link_text: '', // Removido o link para cadastro
                },
                sign_up: {
                  email_label: 'Seu email',
                  password_label: 'Crie uma senha',
                  email_input_placeholder: 'email@exemplo.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Cadastrar',
                  social_provider_text: 'Cadastrar com {{provider}}',
                  link_text: '', // Removido o link para login na tela de cadastro (que não será acessada)
                },
                forgotten_password: {
                  email_label: 'Seu email',
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar instruções de redefinição',
                  link_text: 'Esqueceu sua senha?', // Mantido o link para redefinição de senha
                  check_email: 'Verifique seu e-mail para o link de redefinição de senha.',
                },
                magic_link: {
                  email_input_placeholder: 'email@exemplo.com',
                  button_label: 'Enviar link mágico',
                  link_text: 'Entrar com link mágico', // Restaurado o link para link mágico
                  check_email: 'Verifique seu e-mail para o link mágico.', // Adicionado para consistência
                },
                verify_otp: {
                  email_input_placeholder: 'Seu email',
                  phone_input_placeholder: 'Seu telefone',
                  token_input_placeholder: 'Código OTP',
                  button_label: 'Verificar código OTP',
                  link_text: 'Já tem um código OTP?',
                },
                update_password: { // Adicionado para a view de atualização de senha
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