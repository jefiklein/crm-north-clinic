// ... (mantenha todos os imports anteriores)

const ClientesPage: React.FC<ClientesPageProps> = ({ clinicData }) => {
    // ... (mantenha o estado e outras declarações)

    // Fetch Clients/Leads - Vamos modificar esta parte
    const { data: clientsData, isLoading: isLoadingClients, error: clientsError } = useQuery<ClientLead[]>({
        queryKey: ['funnelClients', clinicId, funnelIdForWebhook],
        queryFn: async () => {
            if (!clinicId) {
                console.error('ID da clínica não disponível');
                throw new Error("ID da clínica não disponível");
            }

            console.log('Iniciando chamada ao webhook de clientes...');
            
            try {
                const response = await fetch(CLIENTS_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        funnel_id: funnelIdForWebhook, 
                        clinic_id: clinicId 
                    })
                });

                console.log('Resposta recebida, status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Erro na resposta:', errorText);
                    throw new Error(`Erro ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                console.log('Dados recebidos do webhook:', data);
                
                if (!Array.isArray(data)) {
                    console.error('Dados não são um array:', data);
                    throw new Error("Formato de resposta inválido");
                }

                console.log('Número de clientes recebidos:', data.length);
                return data;
            } catch (error) {
                console.error('Erro na chamada ao webhook:', error);
                throw error;
            }
        },
        enabled: !!clinicId,
        staleTime: 60 * 1000,
    });

    // ... (restante do código permanece igual)
};