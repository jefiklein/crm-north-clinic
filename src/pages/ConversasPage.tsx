import React, { useState, useMemo, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/integrations/supabase/client';

// Define the structure for clinic data
interface ClinicData {
  code: string;
  nome: string;
  id: string | number | null;
  acesso_crm: boolean;
  acesso_config_msg: boolean;
  id_permissao: number;
}

// Conversation summary (grouped by remoteJid)
interface ConversationSummary {
  remoteJid: string;
  nome: string | null;
  lastMessage: string | null;
  lastTimestamp: number | null;
}

interface ConversasPageProps {
  clinicData: ClinicData | null;
}

// Helper to format timestamp as dd/MM hh:mm or 'Hoje hh:mm'
function formatTimestampSimple(unixTimestampInSeconds: number | null): string {
  if (!unixTimestampInSeconds && unixTimestampInSeconds !== 0) return 'Sem data';
  try {
    const timestampNum = Number(unixTimestampInSeconds);
    if (isNaN(timestampNum)) return 'Sem data';
    const date = new Date(timestampNum * 1000);
    const today = new Date();
    today.setHours(0,0,0,0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0,0,0,0);
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (dateOnly.getTime() === today.getTime()) {
      return `Hoje ${timeStr}`;
    }
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${dateStr} ${timeStr}`;
  } catch {
    return 'Sem data';
  }
}

const ConversasPage: React.FC<ConversasPageProps> = ({ clinicData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicData?.id) {
      setConversations([]);
      return;
    }

    const fetchConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all messages for this clinic's instances
        // For simplicity, fetch all messages and group by remoteJid here
        const { data, error } = await supabase
          .from('whatsapp_historico')
          .select('remoteJid, nome, mensagem, message_timestamp')
          .eq('id_clinica', clinicData.id)
          .order('message_timestamp', { ascending: false });

        if (error) {
          setError(error.message);
          setConversations([]);
          setLoading(false);
          return;
        }

        if (!data) {
          setConversations([]);
          setLoading(false);
          return;
        }

        // Group by remoteJid, keep latest message and timestamp
        const grouped = new Map<string, ConversationSummary>();
        for (const msg of data) {
          const existing = grouped.get(msg.remoteJid);
          if (!existing || (msg.message_timestamp && msg.message_timestamp > (existing.lastTimestamp || 0))) {
            grouped.set(msg.remoteJid, {
              remoteJid: msg.remoteJid,
              nome: msg.nome,
              lastMessage: msg.mensagem,
              lastTimestamp: msg.message_timestamp,
            });
          }
        }

        setConversations(Array.from(grouped.values()));
      } catch (e: any) {
        setError(e.message || 'Erro desconhecido');
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [clinicData]);

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    const lower = searchTerm.toLowerCase();
    return conversations.filter(c =>
      (c.nome?.toLowerCase().includes(lower) ?? false) ||
      c.remoteJid.toLowerCase().includes(lower) ||
      (c.lastMessage?.toLowerCase().includes(lower) ?? false)
    );
  }, [conversations, searchTerm]);

  if (!clinicData) {
    return <div className="p-4 text-center text-red-600">Erro: Dados da clínica não disponíveis. Faça login.</div>;
  }

  return (
    <div className="flex flex-col h-full p-4 bg-white rounded shadow overflow-hidden">
      <h1 className="text-2xl font-bold mb-4">Conversas - {clinicData.nome}</h1>
      <Input
        type="text"
        placeholder="Buscar conversas..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="mb-4"
      />
      {loading && <div>Carregando conversas...</div>}
      {error && <div className="text-red-600">Erro: {error}</div>}
      {!loading && !error && filteredConversations.length === 0 && (
        <div>Nenhuma conversa encontrada.</div>
      )}
      {!loading && !error && filteredConversations.length > 0 && (
        <ScrollArea className="flex-grow border rounded p-2">
          <ul>
            {filteredConversations.map(conv => (
              <li key={conv.remoteJid} className="border-b py-2">
                <div><strong>{conv.nome || conv.remoteJid}</strong></div>
                <div className="text-sm text-gray-600">{formatTimestampSimple(conv.lastTimestamp)}</div>
                <div className="text-sm text-gray-800 truncate">{conv.lastMessage || '(Sem mensagem)'}</div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
};

export default ConversasPage;