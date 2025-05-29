// ... (rest of the code remains the same until the end)

const MensagensConfigPage: React.FC<{ clinicData: ClinicData | null }> = ({
  clinicData,
}) => {
  // ... (rest of the code remains the same until the end)

  return (
    // ... (rest of the code remains the same until the end)
    <div className="min-h-[calc(100vh-70px)] bg-gray-100 p-6 overflow-auto">
      <Card className="w-full"> 
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isLoadingData ? ( 
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="animate-spin" />
              Carregando dados...
            </div>
          ) : currentFetchError ? ( 
            <div className="text-red-600 font-semibold flex items-center gap-2">
                <TriangleAlert className="h-5 w-5" />
                {typeof currentFetchError === 'string' ? currentFetchError : "Erro ao carregar dados."}
            </div>
          ) : (
            <>
              {/* Category field */}
              {showCategoryGeneral && (
                  <div>
                    <Label htmlFor="category" className="block mb-1 font-medium text-gray-700">Categoria *</Label>
                    <Select
                      value={category || ""}
                      onValueChange={handleCategoryChange}
                      disabled={messageId !== null} 
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {orderedCategoriesGeneral.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                     {messageId !== null && (
                         <p className="text-sm text-gray-500 mt-1">A categoria não pode ser alterada após a criação.</p>
                     )}
                  </div>
              )}

              {/* Funnel and Stage fields */}
              {showFunnelStageSelectLeads && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <Label htmlFor="funnel" className="block mb-1 font-medium text-gray-700">Funil *</Label>
                          <Select
                            value={selectedFunnelId?.toString() || ''}
                            onValueChange={(value) => setSelectedFunnelId(value ? parseInt(value, 10) : null)}
                            disabled={isLoadingFunnels || !!funnelsError}
                          >
                            <SelectTrigger id="funnel">
                              <SelectValue placeholder="Selecione o funil" />
                            </SelectTrigger>
                            <SelectContent>
                              {allFunnels?.map(funnel => (
                                  <SelectItem key={funnel.id} value={funnel.id.toString()}>{funnel.nome_funil}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                           {funnelsError && <p className="text-sm text-red-600 mt-1">{funnelsError.message}</p>}
                      </div>
                      <div>
                          <Label htmlFor="stage" className="block mb-1 font-medium text-gray-700">Etapa *</Label>
                          <Select
                            value={selectedStageId?.toString() || ''}
                            onValueChange={(value) => setSelectedStageId(value ? parseInt(value, 10) : null)}
                            disabled={selectedFunnelId === null || isLoadingStages || !!stagesError || (stagesForSelectedFunnel?.length ?? 0) === 0}
                          >
                            <SelectTrigger id="stage">
                              <SelectValue placeholder="Selecione a etapa" />
                            </SelectTrigger>
                            <SelectContent>
                               {(stagesForSelectedFunnel?.length ?? 0) === 0 && !isLoadingStages && !stagesError ? (
                                   <SelectItem value="none" disabled>Nenhuma etapa disponível</SelectItem>
                               ) : (
                                   stagesForSelectedFunnel?.map(stage => (
                                       <SelectItem key={stage.id} value={stage.id.toString()}>{stage.nome_etapa}</SelectItem>
                                   ))
                               )}
                            </SelectContent>
                          </Select>
                           {stagesError && <p className="text-sm text-red-600 mt-1">{stagesError.message}</p>}
                           {selectedFunnelId !== null && (stagesForSelectedFunnel?.length ?? 0) === 0 && !isLoadingStages && !stagesError && (
                                <p className="text-sm text-orange-600 mt-1">Nenhuma etapa encontrada para este funil.</p>
                           )}
                      </div>
                  </div>
              )}

              {/* Instance field */}
              <div>
                <Label htmlFor="instance" className="block mb-1 font-medium text-gray-700">Instância (Número Enviador) *</Label>
                <Select
                  value={instanceId?.toString() || ""}
                  onValueChange={(v) => setInstanceId(v ? parseInt(v, 10) : null)}
                >
                  <SelectTrigger id="instance">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id.toString()}>
                        {inst.nome_exibicao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Type field */}
              {showTargetTypeSelectGeneral && (
                <div>
                  <Label htmlFor="targetType" className="block mb-1 font-medium text-gray-700">Enviar Para *</Label>
                  <Select
                    value={targetType || ""}
                    onValueChange={(v) => setTargetType(v as "Grupo" | "Cliente" | "Funcionário")}
                  >
                    <SelectTrigger id="targetType">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Grupo">Grupo do WhatsApp</SelectItem>
                      <SelectItem value="Cliente">Cliente (Mensagem Direta)</SelectItem>
                      <SelectItem value="Funcionário">Funcionário (Mensagem Direta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Group Select field */}
              {showGroupSelectGeneral && (
                <div>
                  <Label htmlFor="group" className="block mb-1 font-medium text-gray-700">Grupo Alvo *</Label>
                  <Select
                    value={selectedGroup ?? undefined} 
                    onValueChange={(v) => setSelectedGroup(v || null)}
                    disabled={groups.length === 0}
                  >
                    <SelectTrigger id="group">
                      <SelectValue placeholder="Selecione o grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                            <SelectItem key={g.id_grupo} value={g.id_grupo}> 
                              {g.nome_grupo}
                            </SelectItem>
                          )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Scheduled Time field */}
              {(showScheduledTimeGeneral || showScheduledTimeCashback) && ( 
                <div>
                  <Label htmlFor="scheduledTime" className="block mb-1 font-medium text-gray-700">Hora Programada *</Label>
                  <Select
                    value={scheduledTime || ""}
                    onValueChange={setScheduledTime}
                  >
                    <SelectTrigger id="scheduledTime">
                      <SelectValue placeholder="Selecione a hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Cashback Timing fields */}
              {showCashbackTiming && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <Label htmlFor="diasMensagemCashback" className="block mb-1 font-medium text-gray-700">Dias *</Label>
                          <Input
                              id="diasMensagemCashback"
                              type="number"
                              placeholder="Ex: 3"
                              value={diasMensagemCashback || ""}
                              onChange={(e) => setDiasMensagemCashback(e.target.value)}
                              min="0"
                          />
                          <p className="text-sm text-gray-500 mt-1">Número de dias para o agendamento.</p>
                      </div>
                      <div>
                          <Label htmlFor="tipoMensagemCashback" className="block mb-1 font-medium text-gray-700">Agendar Para *</Label>
                          <RadioGroup
                              value={tipoMensagemCashback || ""}
                              onValueChange={setTipoMensagemCashback}
                              id="tipoMensagemCashback"
                              className="flex flex-col space-y-1"
                          >
                              <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="apos_venda" id="apos_venda" />
                                  <Label htmlFor="apos_venda">Dias após a venda</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="antes_validade" id="antes_validade" />
                                  <Label htmlFor="antes_validade">Dias antes da validade do cashback</Label>
                              </div>
                          </RadioGroup>
                          <p className="text-sm text-gray-500 mt-1">Referência para o cálculo da data de envio.</p>
                      </div>
                  </div>
              )}

              {/* Leads Timing fields */}
              {showTimingFieldsLeads && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                          <Label htmlFor="timingType" className="block mb-1 font-medium text-gray-700">Agendar Envio *</Label>
                          <Select
                              value={timingType || ""}
                              onValueChange={setTimingType}
                          >
                              <SelectTrigger id="timingType">
                                  <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="immediate">Imediatamente ao entrar na etapa</SelectItem>
                                  <SelectItem value="delay">Com atraso após entrar na etapa</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      {timingType === 'delay' && (
                          <>
                              <div>
                                  <Label htmlFor="delayValue" className="block mb-1 font-medium text-gray-700">Valor do Atraso *</Label>
                                  <Input
                                      id="delayValue"
                                      type="number"
                                      placeholder="Ex: 2"
                                      value={delayValue || ""}
                                      onChange={(e) => setDelayValue(e.target.value)}
                                      min="0"
                                  />
                              </div>
                              <div>
                                  <Label htmlFor="delayUnit" className="block mb-1 font-medium text-gray-700">Unidade do Atraso *</Label>
                                  <Select
                                      value={delayUnit || ""}
                                      onValueChange={setDelayUnit}
                                  >
                                      <SelectTrigger id="delayUnit">
                                          <SelectValue placeholder="Selecione a unidade" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="minutes">Minutos</SelectItem>
                                          <SelectItem value="hours">Horas</SelectItem>
                                          <SelectItem value="days">Dias</SelectItem>
                                      </SelectContent>
                                  </Select>
                              </div>
                          </>
                      )}
                  </div>
              )}

              {/* Message Text field */}
              <div>
                <Label htmlFor="messageText" className="block mb-1 font-medium text-gray-700">Texto da Mensagem Principal *</Label>
                <div className="relative">
                  <Textarea
                    id="messageText"
                    rows={6}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    ref={messageTextRef}
                    placeholder="Digite a mensagem principal. Use {variaveis}, *para negrito*, _para itálico_..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={toggleEmojiPicker}
                    type="button"
                    aria-label="Inserir emoji"
                  >
                    <Smile />
                  </Button>
                  {showEmojiPicker && (
                    <div className="absolute z-50 top-full right-0 mt-1">
                      <EmojiPicker
                        onEmojiClick={onEmojiSelect}
                        width={300}
                        height={300}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Placeholder List */}
              {availablePlaceholders.length > 0 && (
                  <div className="placeholder-list mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Placeholders disponíveis (clique para inserir):</p> 
                      <div className="flex flex-wrap gap-2 text-sm text-gray-800">
                          {availablePlaceholders.map(placeholder => (
                              <span
                                  key={placeholder}
                                  className="bg-gray-200 px-2 py-1 rounded font-mono text-xs cursor-pointer hover:bg-gray-300 transition-colors" 
                                  onClick={() => handlePlaceholderClick(placeholder)} 
                               >
                                  {"{"}{placeholder}{"}"}
                              </span>
                          ))}
                      </div>
                       {isLeadsContext && (
                           <p className="text-xs text-gray-500 mt-2">
                               *A disponibilidade de alguns placeholders pode depender da configuração da etapa e dos dados do lead.
                           </p>
                       )}
                  </div>
              )}

              {/* Services Vinculados */}
              {showServicesLinkedGeneral && (
                <div>
                  <Label htmlFor="services" className="block mb-1 font-medium text-gray-700">Serviços Vinculados *</Label>
                  <MultiSelectServices
                    options={services}
                    selectedIds={linkedServices}
                    onChange={setLinkedServices}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Quais agendamentos de serviço ativarão esta mensagem.
                  </p>
                </div>
              )}

              {/* Media File field */}
              <div>
                <Label htmlFor="mediaFile" className="block mb-1 font-medium text-gray-700">Anexar Mídia (Opcional)</Label>
                <Input
                  type="file"
                  id="mediaFile"
                  accept="image/*,video/*,audio/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setMediaFile(e.target.files[0]);
                    } else {
                      setMediaFile(null);
                    }
                  }}
                />
                {mediaPreviewUrl && (
                  <div className="mt-2">
                    {mediaFile?.type.startsWith("image/") && (
                      <img src={mediaPreviewUrl} alt="Preview da mídia" className="max-w-xs rounded" />
                    )}
                    {mediaFile?.type.startsWith("video/") && (
                      <video src={mediaPreviewUrl} controls className="max-w-xs rounded" />
                    )}
                    {mediaFile?.type.startsWith("audio/") && (
                      <audio src={mediaPreviewUrl} controls />
                    )}
                  </div>
                )}
                {!mediaPreviewUrl && mediaSavedUrl && (
                  <p className="text-sm text-gray-600 mt-1">Mídia salva: {mediaSavedUrl}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Imagem (JPG, PNG, GIF, WEBP - máx 5MB), Vídeo (MP4, WEBM, MOV - máx 10MB), Áudio (MP3, OGG, WAV - máx 10MB).
                </p>
              </div>

              {/* Sending Order field */}
              {showSendingOrder && (
                  <div>
                      <Label htmlFor="sendingOrder" className="block mb-1 font-medium text-gray-700">Ordem de Envio (Texto e Mídia) *</Label>
                      <Select
                          value={sendingOrder || ""}
                          onValueChange={setSendingOrder}
                      >
                          <SelectTrigger id="sendingOrder">
                              <SelectValue placeholder="Selecione a ordem" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="both">Texto e Mídia Juntos</SelectItem>
                              <SelectItem value="text_first">Texto Primeiro, Depois Mídia</SelectItem>
                              <SelectItem value="media_first">Mídia Primeiro, Depois Texto</SelectItem>
                          </SelectContent>
                      </Select>
                       <p className="text-sm text-gray-500 mt-1">Define a ordem em que o texto e o anexo serão enviados.</p>
                  </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || isLoadingData || !!currentFetchError}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : ( "Salvar Alterações" )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 

export default MensagensConfigPage;