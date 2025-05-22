import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MultiSelectServices from '@/components/MultiSelectServices';

// Defina a interface para os dados da clínica
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

interface MensagensConfigPageProps {
  clinicData: ClinicData | null;
}

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  // Estado local para serviços selecionados (teste)
  const [selectedServices, setSelectedServices] = useState<number[]>([]);

  // Opções fixas para teste
  const serviceOptions = [
    { id: 1, nome: 'Consulta' },
    { id: 2, nome: 'Exame' },
    { id: 3, nome: 'Retorno' },
  ];

  if (!clinicData) {
    return <div className="text-center text-red-500 p-6">Erro: Dados da clínica não disponíveis. Faça login novamente.</div>;
  }

  return (
    <div className="mensagens-config-container max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Mensagens Automáticas</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Exemplo simples de input */}
          <Input placeholder="Nome da Mensagem" className="mb-4" />

          {/* Aqui está o componente MultiSelectServices para teste */}
          <MultiSelectServices
            options={serviceOptions}
            selectedIds={selectedServices}
            onChange={(selected) => {
              console.log('Serviços selecionados:', selected);
              setSelectedServices(selected);
            }}
          />

          {/* Botão para simular envio */}
          <Button className="mt-6" onClick={() => alert(`Serviços selecionados: ${selectedServices.join(', ')}`)}>
            Testar Seleção
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensConfigPage;