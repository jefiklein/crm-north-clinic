// ... (código anterior permanece igual)

// Fetch sales data from webhook using react-query
const { data: salesData, isLoading: isLoadingSales, error: salesError } = useQuery({
    queryKey: ['salesData', clinicData?.code, new Date().getMonth() + 1, new Date().getFullYear()],
    queryFn: async () => {
        if (!clinicData?.code) {
            throw new Error("Código da clínica não disponível para buscar dados de vendas.");
        }
        
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        console.log(`Chamando webhook de vendas para:`, {
            clinic_code: clinicData.code,
            mes: currentMonth,
            ano: currentYear
        });

        try {
            const response = await fetch(SALES_WEBHOOK_URL, {
                method: 'POST',
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    clinic_code: clinicData.code,
                    mes: currentMonth,
                    ano: currentYear
                })
            });

            console.log('Resposta do webhook:', {
                status: response.status,
                statusText: response.statusText
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
            }

            const data = await response.json();
            console.log('Dados recebidos do webhook:', data);
            
            // Verifica se a resposta contém o campo esperado
            if (data && typeof data === 'object') {
                // Tenta encontrar o valor de vendas em diferentes formatos de resposta
                const vendas = data.total_vendas || data.vendas || data.total || data.value;
                if (vendas !== undefined) {
                    return vendas;
                }
            }
            
            throw new Error("Formato de resposta inesperado do webhook");
            
        } catch (error) {
            console.error('Erro na chamada ao webhook:', error);
            throw error;
        }
    },
    enabled: !!clinicData?.code,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
});

// ... (restante do código permanece igual)