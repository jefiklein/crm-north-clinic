import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Save, XCircle, Smile, Tags, FileText, Video, Music, Download, Zap } from 'lucide-react'; // Added icons
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils'; // Utility for class names
import { showSuccess, showError, showToast } from '@/utils/toast'; // Using our toast utility
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { MultiSelect } from '@/components/MultiSelect'; // Import new MultiSelect component

// ... (keep all previous interface and constants definitions as before)

// Inside the component MensagensConfigPage:

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  // ... all previous state and queries as before, except remove Choices.js refs and related useEffect

  // State for selected services as array of ServiceInfo
  const [selectedServices, setSelectedServices] = useState<ServiceInfo[]>([]);

  // When servicesList or linkedServicesList change, update selectedServices state
  useEffect(() => {
    if (servicesList) {
      if (isEditing && linkedServicesList) {
        // Map linked service IDs to service objects
        const linkedIds = new Set(linkedServicesList.map(ls => ls.id_servico));
        const selected = servicesList.filter(s => linkedIds.has(s.id));
        setSelectedServices(selected);
      } else {
        setSelectedServices([]);
      }
    }
  }, [servicesList, linkedServicesList, isEditing]);

  // When selectedServices changes, update formData.servicos_vinculados (optional, for save)
  useEffect(() => {
    // No direct formData field for services, but we can keep in state for save
  }, [selectedServices]);

  // ... rest of the component code, including handleSave, etc.

  // In the render, replace the old select with MultiSelect:

  return (
    <div className="config-container max-w-6xl mx-auto p-6 bg-gray-100 min-h-screen">
      {/* ... header and loading/error as before */}

      {!isLoadingPage && !pageError && (
        <form id="messageConfigForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* ... other form sections ... */}

          <div className="form-section bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary border-b border-gray-200 pb-3 mb-4">Disparador e Condições</h3>

            {/* Replace service selection group */}
            <div className="form-group" id="serviceSelectionGroup">
              <Label htmlFor="serviceSelect">Serviços Vinculados *</Label>
              {isLoadingServices ? (
                <p className="text-gray-600"><Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Carregando serviços...</p>
              ) : servicesError ? (
                <p className="text-red-600">Erro: {servicesError.message}</p>
              ) : (
                <MultiSelect<ServiceInfo>
                  options={servicesList || []}
                  value={selectedServices}
                  onChange={setSelectedServices}
                  labelKey="nome"
                  valueKey="id"
                  placeholder="Selecione os serviços..."
                  disabled={isLoading || isLoadingLinkedServices}
                />
              )}
              <p className="text-xs text-gray-500 mt-1">Quais agendamentos de serviço ativarão esta mensagem.</p>
            </div>

            {/* ... rest of the form ... */}
          </div>

          {/* ... rest of the form and buttons ... */}
        </form>
      )}

      {/* ... emoji picker ... */}
    </div>
  );
};

export default MensagensConfigPage;