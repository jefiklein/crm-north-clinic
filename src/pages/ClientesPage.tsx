const { data: clientsData, isLoading: isLoadingClients, error: clientsError } = useQuery<ClientLead[]>({
    queryKey: ['funnelClients', clinicId, funnelIdForWebhook],
    queryFn: async () => {
        console.log('Iniciando busca de clientes...');
        console.log('Clinic ID:', clinicId);
        console.log('Funnel ID:', funnelIdForWebhook);
        
        if (!clinicId) {
            console.error('ID da clínica não disponível');
            throw new Error("ID da clínica não disponível");
        }

        try {
            console.log('Chamando webhook:', CLIENTS_WEBHOOK_URL);
            const response = await fetch(CLIENTS_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    funnel_id: funnelIdForWebhook, 
                    clinic_id: clinicId 
                })
            });

            console.log('Status da resposta:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro na resposta:', errorText);
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Dados recebidos:', data);
            
            if (!Array.isArray(data)) {
                console.error('Dados não são um array:', data);
                throw new Error("Formato de resposta inválido");
            }

            console.log('Número de clientes recebidos:', data.length);
            return data;
        } catch (error) {
            console.error('Erro na busca de clientes:', error);
            throw error;
        }
    },
    enabled: !!clinicId,
    staleTime: 60 * 1000,
});