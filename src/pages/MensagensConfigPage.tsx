/* ... (manter todo o código existente acima) ... */

{/* Dentro do JSX do componente, substituir a parte do botão Gerenciar Variações por um comentário para esconder: */}

{/* 
<div className="mt-6 pt-6 border-t border-gray-200">
  <Button type="button" variant="outline" size="sm" onClick={() => setShowVariations(!showVariations)} id="manageVariationsBtn">
    <MessagesSquare className="h-4 w-4 mr-2" /> Gerenciar Variações (<span id="variationsCount">0</span>/5)
  </Button>
  <p className="text-xs text-gray-500 mt-1">Clique para exibir/editar versões alternativas desta mensagem.</p>

  {showVariations && (
    <div id="variationsContainer" className="border border-dashed border-gray-300 rounded-md p-4 mt-4 bg-gray-50">
      {/* Conteúdo das variações */}
    </div>
  )}
</div>
*/}

{/* Para o Select do grupo, ajustar o value para ser null ou undefined quando for string vazia, e garantir que o placeholder tenha value="" */}

<Select
  id="grupo"
  value={formData.grupo === '' ? undefined : formData.grupo}
  onValueChange={(value) => handleSelectChange('grupo', value)}
  disabled={isLoading || isLoadingGroups || !formData.id_instancia || formData.para_grupo === false} // Disable if loading groups, no instance, or target is not group
>
  <SelectTrigger>
    <SelectValue placeholder={isLoadingGroups ? "-- Carregando Grupos --" : "-- Selecione --"} />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="" disabled>-- Selecione o Grupo * --</SelectItem>
    {groupsList?.map(group => (
      <SelectItem key={group.id_grupo} value={String(group.id_grupo)}>{group.nome_grupo}</SelectItem>
    ))}
    {!isLoadingGroups && groupsList?.length === 0 && (
      <SelectItem value="" disabled>Nenhum grupo disponível</SelectItem>
    )}
    {groupsError && (
      <SelectItem value="" disabled>Erro ao carregar grupos</SelectItem>
    )}
  </SelectContent>
</Select>

{/* Isso deve evitar o erro do Radix UI Select e esconder o botão de variações. */}