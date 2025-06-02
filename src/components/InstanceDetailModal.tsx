import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, TriangleAlert } from 'lucide-react';
import { formatPhone } from '@/lib/utils';

interface InstanceInfo {
    id: number;
    nome_exibição: string;
    telefone: number | null;
    tipo: string | null;
    nome_instancia_evolution: string | null;
    trackeamento: boolean;
    historico: boolean;
    id_server_evolution: number | null;
    confirmar_agendamento: boolean;
    id_funcionario?: number | null;
    default_lead_stage_id?: number | null; // NEW: Add default_lead_stage_id
}

interface EmployeeInfo {
    id: number;
    nome: string;
}

// NEW: Define structure for Funnel Details
interface FunnelDetails {
    id: number;
    nome_funil: string;
}

// NEW: Define structure for Funnel Stage
interface FunnelStage {
    id: number;
    nome_etapa: string;
    ordem: number | null;
    id_funil: number;
}

interface InstanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceData: InstanceInfo;
  clinicId: string | number | null;
  employeesList: EmployeeInfo[];
  linkedEmployeeIds: Set<number>; // Set of employee IDs already linked to *any* instance
  allFunnels: FunnelDetails[]; // NEW: Pass all funnels
  allStages: FunnelStage[]; // NEW: Pass all stages (filtered by selected funnel in parent)
  stagesMap: Map<number, FunnelStage>; // NEW: Pass stagesMap for quick lookup
  onSave: (data: {
    instanceId: number;
    nome_exibição: string;
    telefone: string;
    tipo: string;
    trackeamento: boolean;
    historico: boolean;
    confirmar_agendamento: boolean;
    id_funcionario: number | null;
    default_lead_stage_id: number | null; // NEW: Add to save data
  }) => void;
  isSaving: boolean;
}

function validatePhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 13;
}

const InstanceDetailModal: React.FC<InstanceDetailModalProps> = ({
  isOpen,
  onClose,
  instanceData,
  clinicId,
  employeesList,
  linkedEmployeeIds,
  allFunnels, // NEW: Receive allFunnels
  allStages, // NEW: Receive allStages
  stagesMap, // NEW: Receive stagesMap
  onSave,
  isSaving,
}) => {
  const [formData, setFormData] = useState({
    nome_exibição: instanceData.nome_exibição,
    telefone: instanceData.telefone ? String(instanceData.telefone) : '',
    tipo: instanceData.tipo?.trim() || '', // Normaliza o tipo aqui para string vazia
    trackeamento: instanceData.trackeamento,
    historico: instanceData.historico,
    confirmar_agendamento: instanceData.confirmar_agendamento,
    id_funcionario: instanceData.id_funcionario ?? null,
    default_lead_stage_id: instanceData.default_lead_stage_id ?? null, // NEW: Initialize
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedFunnelForStage, setSelectedFunnelForStage] = useState<number | null>(null); // NEW: State for selected funnel in stage dropdown

  useEffect(() => {
    if (isOpen) {
      const initialTipo = instanceData.tipo?.trim() || ''; // Normaliza o tipo ao reabrir
      setFormData({
        nome_exibição: instanceData.nome_exibição,
        telefone: instanceData.telefone ? String(instanceData.telefone) : '',
        tipo: initialTipo, // Usa o valor normalizado
        trackeamento: instanceData.trackeamento,
        historico: instanceData.historico,
        confirmar_agendamento: instanceData.confirmar_agendamento,
        id_funcionario: instanceData.id_funcionario ?? null,
        default_lead_stage_id: instanceData.default_lead_stage_id ?? null, // NEW: Initialize
      });
      setError(null);
      // Log para depuração do campo 'tipo'
      console.log("[InstanceDetailModal] Carregando dados da instância. Original Tipo:", instanceData.tipo, "Processed Tipo for form:", initialTipo);

      // NEW: Set initial selected funnel for stage dropdown
      if (instanceData.default_lead_stage_id) {
          const stage = stagesMap.get(instanceData.default_lead_stage_id);
          if (stage) {
              setSelectedFunnelForStage(stage.id_funil);
          } else {
              setSelectedFunnelForStage(null);
          }
      } else {
          setSelectedFunnelForStage(null);
      }
    }
  }, [isOpen, instanceData, stagesMap]); // NEW: Add stagesMap to dependencies

  // NEW: Effect to reset default_lead_stage_id if trackeamento is turned off
  useEffect(() => {
      if (!formData.trackeamento) {
          setFormData(prev => ({ ...prev, default_lead_stage_id: null }));
          setSelectedFunnelForStage(null);
      }
  }, [formData.trackeamento]);

  // NEW: Effect to reset default_lead_stage_id if selected funnel changes and the current stage is not in the new funnel
  useEffect(() => {
      if (formData.trackeamento && selectedFunnelForStage !== null && formData.default_lead_stage_id !== null) {
          const currentStage = stagesMap.get(formData.default_lead_stage_id);
          if (currentStage && currentStage.id_funil !== selectedFunnelForStage) {
              setFormData(prev => ({ ...prev, default_lead_stage_id: null }));
          }
      }
  }, [selectedFunnelForStage, formData.trackeamento, formData.default_lead_stage_id, stagesMap]);


  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    let digits = input.replace(/\D/g, '');
    // Allow up to 13 digits (55 + 2 DDD + 9 + 8 digits)
    if (digits.length > 13) {
      digits = digits.substring(0, 13);
    }
    setFormData((prev) => ({ ...prev, telefone: digits }));
  };

  const handleSave = () => {
    setError(null);
    if (!formData.nome_exibição.trim()) {
      setError("O nome de exibição é obrigatório.");
      return;
    }
    // Phone validation is still needed for initial creation, but not for editing if disabled
    // if (!validatePhone(formData.telefone)) {
    //   setError("Número de telefone inválido. Use o formato 55 + DDD + Número (Ex: 5511999999999).");
    //   return;
    // }
    if (!formData.tipo) {
      setError("O tipo da instância é obrigatório.");
      return;
    }

    // NEW: Validate default_lead_stage_id if trackeamento is true
    if (formData.trackeamento && formData.default_lead_stage_id === null) {
        setError("Se 'Recebe Leads' está ativo, a etapa padrão para leads é obrigatória.");
        return;
    }

    onSave({
      instanceId: instanceData.id,
      nome_exibição: formData.nome_exibição.trim(),
      telefone: formData.telefone, // Send current value, even if disabled
      tipo: formData.tipo,
      trackeamento: formData.trackeamento,
      historico: formData.historico,
      confirmar_agendamento: formData.confirmar_agendamento,
      id_funcionario: formData.id_funcionario,
      default_lead_stage_id: formData.default_lead_stage_id, // NEW: Pass to onSave
    });
  };

  // Filter stages based on selected funnel
  const filteredStages = useMemo(() => {
      if (selectedFunnelForStage === null) return [];
      return allStages.filter(stage => stage.id_funil === selectedFunnelForStage);
  }, [allStages, selectedFunnelForStage]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Instância: {instanceData.nome_exibição}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          <div className="form-group">
            <Label htmlFor="editInstanceName">Nome de Exibição</Label>
            <Input
              id="editInstanceName"
              value={formData.nome_exibição}
              onChange={(e) => setFormData({ ...formData, nome_exibição: e.target.value })}
              disabled={isSaving}
            />
          </div>
          <div className="form-group">
            <Label htmlFor="editInstancePhone">Número do WhatsApp</Label>
            <Input
              id="editInstancePhone"
              value={formData.telefone}
              onChange={handlePhoneChange}
              disabled={true} // Campo de telefone desabilitado para edição
              placeholder="Ex: 5511999999999"
            />
            <p className="text-xs text-gray-500 mt-1">Número completo com código do país (55) e DDD</p>
          </div>
          <div className="form-group">
            <Label htmlFor="editInstanceType">Tipo</Label>
            <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })} disabled={isSaving}>
              <SelectTrigger id="editInstanceType">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Recepção">Recepção</SelectItem>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Prospecção">Prospecção</SelectItem>
                <SelectItem value="Nutricionista">Nutricionista</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="form-group">
            <Label htmlFor="employee-link">Funcionário Vinculado</Label>
            {(employeesList?.length ?? 0) === 0 ? (
                <p className="text-sm text-orange-600">Nenhum funcionário disponível.</p>
            ) : (
                <Select
                    value={formData.id_funcionario?.toString() || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, id_funcionario: value === 'none' ? null : parseInt(value, 10) })}
                    disabled={isSaving}
                >
                    <SelectTrigger id="employee-link" className="h-9 text-sm">
                        <SelectValue placeholder="Vincular funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">-- Nenhum --</SelectItem>
                        {employeesList?.map(employee => (
                            <SelectItem key={employee.id} value={employee.id.toString()} disabled={linkedEmployeeIds.has(employee.id) && employee.id !== instanceData.id_funcionario}>
                                <div className="flex items-center gap-2">
                                    <span>{employee.nome}</span>
                                    {linkedEmployeeIds.has(employee.id) && employee.id !== instanceData.id_funcionario && (
                                        <TriangleAlert className="h-3 w-3 text-yellow-600" title="Já vinculado a outra instância" />
                                    )}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <p className="text-xs text-gray-500 mt-1">Vincule um funcionário a esta instância para direcionamento de mensagens.</p>
          </div>

          <div className="flex items-center space-x-2 mt-2">
            <Switch
              id="trackeamento"
              checked={formData.trackeamento}
              onCheckedChange={(checked) => setFormData({ ...formData, trackeamento: checked })}
              disabled={isSaving}
            />
            <Label htmlFor="trackeamento" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Recebe Leads (Trackeamento)
            </Label>
          </div>
          <p className="text-xs text-gray-500 mt-1">Se ativado, esta instância terá um monitoramento e trackeamento de leads. Ative somente se essa instância é usada para prospecção e venda para leads.</p>

          {/* NEW: Conditional Funnel and Stage selection */}
          {formData.trackeamento && (
              <>
                  <div className="form-group">
                      <Label htmlFor="default-lead-funnel">Funil Padrão para Novos Leads *</Label>
                      <Select
                          value={selectedFunnelForStage?.toString() || ''}
                          onValueChange={(value) => {
                              setSelectedFunnelForStage(value ? parseInt(value, 10) : null);
                              setFormData(prev => ({ ...prev, default_lead_stage_id: null })); // Reset stage when funnel changes
                          }}
                          disabled={isSaving || (allFunnels?.length ?? 0) === 0}
                      >
                          <SelectTrigger id="default-lead-funnel">
                              <SelectValue placeholder="Selecione o funil" />
                          </SelectTrigger>
                          <SelectContent>
                              {allFunnels?.map(funnel => (
                                  <SelectItem key={funnel.id} value={funnel.id.toString()}>{funnel.nome_funil}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      {(allFunnels?.length ?? 0) === 0 && (
                          <p className="text-sm text-orange-600 mt-1">Nenhum funil disponível.</p>
                      )}
                  </div>
                  <div className="form-group">
                      <Label htmlFor="default-lead-stage">Etapa Padrão para Novos Leads *</Label>
                      <Select
                          value={formData.default_lead_stage_id?.toString() || ''}
                          onValueChange={(value) => setFormData({ ...formData, default_lead_stage_id: value === 'none' ? null : parseInt(value, 10) })}
                          disabled={isSaving || selectedFunnelForStage === null || (filteredStages?.length ?? 0) === 0}
                      >
                          <SelectTrigger id="default-lead-stage">
                              <SelectValue placeholder="Selecione a etapa" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none">-- Nenhuma --</SelectItem>
                              {filteredStages?.map(stage => (
                                  <SelectItem key={stage.id} value={stage.id.toString()}>{stage.nome_etapa}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      {selectedFunnelForStage !== null && (filteredStages?.length ?? 0) === 0 && (
                          <p className="text-sm text-orange-600 mt-1">Nenhuma etapa encontrada para o funil selecionado.</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Novos leads recebidos por esta instância serão automaticamente cadastrados nesta etapa.</p>
                  </div>
              </>
          )}

          {/* Ocultando o campo Salvar Histórico de Conversas */}
          {false && (
            <>
              <div className="flex items-center space-x-2 mt-2">
                <Switch
                  id="historico"
                  checked={formData.historico}
                  onCheckedChange={(checked) => setFormData({ ...formData, historico: checked })}
                  disabled={isSaving}
                />
                <Label htmlFor="historico" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Salvar Histórico de Conversas
                </Label>
              </div>
              <p className="text-xs text-gray-500 mt-1">Se ativado, as mensagens desta instância serão salvas no histórico de conversas.</p>
            </>
          )}

          {/* Ocultando o campo Confirmar Agendamento Automático */}
          {false && (
            <>
              <div className="flex items-center space-x-2 mt-2">
                <Switch
                  id="confirmar_agendamento"
                  checked={formData.confirmar_agendamento}
                  onCheckedChange={(checked) => setFormData({ ...formData, confirmar_agendamento: checked })}
                  disabled={isSaving}
                />
                <Label htmlFor="confirmar_agendamento" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Confirmar Agendamento Automático
                </Label>
              </div>
              <p className="text-xs text-gray-500 mt-1">Se ativado, esta instância enviará mensagens automáticas de confirmação de agendamento.</p>
            </>
          )}

        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InstanceDetailModal;