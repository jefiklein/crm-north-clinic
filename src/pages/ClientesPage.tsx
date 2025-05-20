// Certifique-se que esta importação está no topo
import React from 'react';

const ClientesPage = () => {
  return (
    <div className="clientes-container flex flex-col h-full p-6 bg-gray-100">
      <div className="content-header flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
        <h1 className="page-title text-2xl font-bold text-primary whitespace-nowrap">
          Clientes
        </h1>
      </div>
    </div>
  );
};

export default ClientesPage;