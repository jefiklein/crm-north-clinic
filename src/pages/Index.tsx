import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react"; // Using Lucide React for icons

// Define the structure for clinic data (should match the one in App.tsx)
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

const N8N_BASE_URL = 'https://n8n-n8n.sbw0pc.easypanel.host'; // Keep the base URL

const Index: React.FC<IndexProps> = ({ onLogin }) => {
  const [clinicCode, setClinicCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Using shadcn/ui toast

  const validateClinicCode = async () => {
    setError(null);
    if (clinicCode.trim() === "") {
      setError('Por favor, informe o código da clínica.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${N8N_BASE_URL}/webhook/db403a25-d074-4b14-ae02-bc55272b7200`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_code: clinicCode.trim() })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erro ${response.status}: ${text || response.statusText}`);
      }

      const data = await response.json();

      let clinica = null;
      if (Array.isArray(data) && data.length > 0) {
        clinica = data[0];
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        clinica = data;
      }

      if (clinica && clinica.nome_da_clinica && typeof clinica.id_permissao !== 'undefined') {
        const acesso_crm = clinica.acesso_crm === true || String(clinica.acesso_crm).toLowerCase() === 'true';
        const acesso_config_msg = clinica.acesso_config_msg === true || String(clinica.acesso_config_msg).toLowerCase() === 'true';

        // Basic check for any access or permission level > 0
        if (!acesso_crm && !acesso_config_msg && (isNaN(parseInt(clinica.id_permissao, 10)) || parseInt(clinica.id_permissao, 10) < 1)) {
             throw new Error('Acesso não permitido (sem permissões válidas).');
        }

        const parsedPermission = parseInt(clinica.id_permissao, 10);
         if (isNaN(parsedPermission)) {
             throw new Error("Nível de permissão inválido recebido.");
         }


        const clinicData: ClinicData = {
          code: clinicCode.trim(),
          nome: clinica.nome_da_clinica,
          id: clinica.id || clinica.id_clinica || null,
          acesso_crm: acesso_crm,
          acesso_config_msg: acesso_config_msg,
          id_permissao: parsedPermission // Save permission
        };

        onLogin(clinicData); // Call the onLogin prop to update state in App.tsx
        toast({
          title: "Login bem-sucedido!",
          description: `Bem-vindo, ${clinicData.nome}.`,
        });

      } else {
        if (clinica && !clinica.nome_da_clinica) throw new Error('Dados da clínica inválidos.');
        else if (clinica && typeof clinica.id_permissao === 'undefined') throw new Error('Nível de permissão não configurado.');
        else throw new Error('Código da clínica inválido ou não encontrado.');
      }
    } catch (err: any) {
      console.error('Erro ao validar clínica:', err);
      setError(`${err.message}. Tente novamente.`);
      toast({
        title: "Erro de Login",
        description: err.message || "Ocorreu um erro ao validar o código.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      validateClinicCode();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center text-primary">Informe o código da clínica</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            type="text"
            placeholder="Código da clínica"
            value={clinicCode}
            onChange={(e) => setClinicCode(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            autoComplete="off"
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button onClick={validateClinicCode} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;