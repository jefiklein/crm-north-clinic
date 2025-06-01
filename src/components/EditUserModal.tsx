import React, { useState, useEffect } from 'react';
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
import { cn } from '@/lib/utils';

interface UserData {
    id: string; // UUID
    email: string;
    first_name: string | null;
    last_name: string | null;
    user_clinic_roles: {
        id: number; // user_clinic_roles ID
        clinic_id: number;
        permission_level_id: number;
        is_active: boolean;
    }[];
}

interface PermissionLevel {
    id: number;
    name: string;
    description: string | null;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: UserData | null;
  clinicId: string | number | null;
  permissionLevels: PermissionLevel[];
  onSave: (data: {
    userId: string;
    clinicRoleId: number;
    firstName: string;
    lastName: string;
    permissionLevelId: number;
    isActive: boolean;
    clinicId: string | number;
  }) => void;
  isSaving: boolean;
}

const SUPER_ADMIN_PERMISSION_ID = 5; // ID do nível de permissão para Super Admin

const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  userData,
  clinicId,
  permissionLevels,
  onSave,
  isSaving,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedPermissionLevel, setSelectedPermissionLevel] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userData && clinicId) {
      setFirstName(userData.first_name || '');
      setLastName(userData.last_name || '');
      
      const currentClinicRole = userData.user_clinic_roles.find(
        (role) => String(role.clinic_id) === String(clinicId)
      );

      if (currentClinicRole) {
        setSelectedPermissionLevel(String(currentClinicRole.permission_level_id));
        setIsActive(currentClinicRole.is_active);
      } else {
        // Fallback if no role found for this clinic (shouldn't happen if modal is opened correctly)
        setSelectedPermissionLevel('');
        setIsActive(false);
      }
      setError(null);
    }
  }, [isOpen, userData, clinicId]);

  const handleSave = () => {
    setError(null);
    if (!userData || !clinicId) {
      setError("Dados do usuário ou da clínica não disponíveis.");
      return;
    }
    if (!firstName.trim()) {
      setError("O primeiro nome é obrigatório.");
      return;
    }
    if (!selectedPermissionLevel) {
      setError("O nível de permissão é obrigatório.");
      return;
    }

    const currentClinicRole = userData.user_clinic_roles.find(
        (role) => String(role.clinic_id) === String(clinicId)
    );

    if (!currentClinicRole) {
        setError("Vínculo do usuário com a clínica não encontrado. Não é possível salvar.");
        return;
    }

    onSave({
      userId: userData.id,
      clinicRoleId: currentClinicRole.id, // Pass the specific user_clinic_roles ID
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      permissionLevelId: parseInt(selectedPermissionLevel, 10),
      isActive: isActive,
      clinicId: clinicId,
    });
  };

  const filteredPermissionLevels = permissionLevels.filter(
    (level) => level.id !== SUPER_ADMIN_PERMISSION_ID
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário: {userData?.email}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          <div className="form-group">
            <Label htmlFor="editFirstName">Primeiro Nome</Label>
            <Input
              id="editFirstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="form-group">
            <Label htmlFor="editLastName">Sobrenome</Label>
            <Input
              id="editLastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="form-group">
            <Label htmlFor="editPermissionLevel">Nível de Permissão</Label>
            <Select
              value={selectedPermissionLevel}
              onValueChange={setSelectedPermissionLevel}
              disabled={isSaving}
            >
              <SelectTrigger id="editPermissionLevel">
                <SelectValue placeholder="Selecione o nível de permissão" />
              </SelectTrigger>
              <SelectContent>
                {filteredPermissionLevels.map((level) => (
                  <SelectItem key={level.id} value={String(level.id)}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSaving}
            />
            <Label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Usuário Ativo
            </Label>
          </div>
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

export default EditUserModal;