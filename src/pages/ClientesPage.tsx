// ... (mantenha todos os imports e interfaces anteriores)

const ClientesPage: React.FC<ClientesPageProps> = ({ clinicData }) => {
    // ... (mantenha todo o código anterior até o return)

    // Verificação de clinicData movida para dentro do JSX principal
    if (!clinicData) {
        return (
            <div className="text-center text-red-500 p-6">
                Erro: Dados da clínica não disponíveis. Faça login novamente.
            </div>
        );
    }

    return (
        <div className="clientes-container flex flex-col h-full p-6 bg-gray-100">
            {/* Restante do JSX */}
            <div className="content-header flex flex-col sm-flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
                    {clinicData?.nome} | Clientes
                </h1>
                {/* Restante do conteúdo */}
            </div>
            {/* ... */}
        </div>
    );
};

export default ClientesPage;