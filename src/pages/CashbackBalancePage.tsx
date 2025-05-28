import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Define the type for the aggregated cashback data
interface ClientCashback {
  id: number;
  nome_north: string;
  telefone_north: string | null;
  total_cashback: number;
  nearest_expiry: string | null; // Date string from DB
}

// This is a placeholder. In a real app, clinicId would come from user context or similar.
const CLINIC_ID = 1; // Replace with actual clinic ID logic

const CashbackBalancePage = () => {
  const [searchTerm, setSearchTerm] = useState("");

  // Use react-query to fetch data
  const { data: clientsCashback, isLoading, error } = useQuery<ClientCashback[]>({
    queryKey: ["clientsCashback", CLINIC_ID],
    queryFn: async () => {
      // SQL query to aggregate cashback by client
      const { data, error } = await supabase.rpc('get_clients_cashback', {
        p_clinic_id: CLINIC_ID
      });

      if (error) {
        console.error("Error fetching clients cashback:", error);
        throw error;
      }

      // Ensure total_cashback is a number and nearest_expiry is a date string or null
      return data.map(item => ({
        ...item,
        total_cashback: parseFloat(item.total_cashback),
        nearest_expiry: item.nearest_expiry ? item.nearest_expiry : null,
      }));
    },
  });

  const filteredClients = clientsCashback?.filter(client =>
    client.nome_north?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.telefone_north?.toString().includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando saldos de cashback...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        Erro ao carregar saldos de cashback: {error.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Saldo de Cashback por Cliente</h1>

      <Input
        placeholder="Buscar por nome ou telefone..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Saldo Total (R$)</TableHead>
              <TableHead>Validade Mais Próxima</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients && filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nome_north}</TableCell>
                  <TableCell>{client.telefone_north}</TableCell>
                  <TableCell>{client.total_cashback.toFixed(2)}</TableCell>
                  <TableCell>
                    {client.nearest_expiry
                      ? format(new Date(client.nearest_expiry), "dd/MM/yyyy")
                      : "Sem Validade"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Nenhum saldo de cashback encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CashbackBalancePage;