// ... (restante do código permanece igual)

    // --- Handlers ---

    // Handle click on "Configurar Nova Mensagem" button
    const handleAddMessage = () => {
        if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        // Ajustado para usar caminho completo com /dashboard
        navigate(`/dashboard/config-mensagem?clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

    // Handle click on "Editar" button
    const handleEditMessage = (messageId: number) => {
         if (!clinicData?.code) {
            showError("Erro: Código da clínica não disponível.");
            return;
        }
        // Ajustado para usar caminho completo com /dashboard
        navigate(`/dashboard/config-mensagem?id=${messageId}&clinic_code=${encodeURIComponent(clinicData.code)}`);
    };

// ... (restante do código permanece igual)