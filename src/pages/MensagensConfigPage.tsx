{/* Inside your full MensagensConfigPage component's render/return JSX, replace the services select part with this: */}

<div className="form-group" id="serviceSelectionGroup">
  <Label htmlFor="serviceSelect">Serviços Vinculados *</Label>
  <Select
    multiple
    value={selectedServices}
    onValueChange={handleServicesChange}
    disabled={isLoadingServices || isLoadingLinkedServices}
  >
    <SelectTrigger>
      <SelectValue placeholder="Selecione um ou mais serviços" />
    </SelectTrigger>
    <SelectContent>
      {servicesList && servicesList.length > 0 ? (
        servicesList.map(service => (
          <SelectItem key={service.id} value={String(service.id)}>
            {service.nome}
          </SelectItem>
        ))
      ) : (
        <SelectItem value="no-services" disabled>
          {isLoadingServices ? 'Carregando...' : 'Nenhum serviço disponível'}
        </SelectItem>
      )}
    </SelectContent>
  </Select>
  {(isLoadingServices || isLoadingLinkedServices) && (
    <p className="text-sm text-gray-600 mt-1">
      <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Carregando serviços...
    </p>
  )}
  {(servicesError || linkedServicesError) && (
    <p className="text-sm text-red-600 mt-1">
      <TriangleAlert className="inline h-4 w-4 mr-1" /> Erro ao carregar serviços.
    </p>
  )}
</div>