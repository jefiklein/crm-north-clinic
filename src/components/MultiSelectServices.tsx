"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ServiceOption {
  id: number;
  nome: string;
}

interface MultiSelectServicesProps {
  options: ServiceOption[];
  selectedIds: number[];
  onChange: (selected: number[]) => void;
  disabled?: boolean;
}

const MultiSelectServices: React.FC<MultiSelectServicesProps> = ({
  options,
  selectedIds,
  onChange,
  disabled = false,
}) => {
  // Convert selectedIds to strings for Select component
  const selectedValues = selectedIds.map(String);

  const handleValueChange = (values: string | string[]) => {
    if (Array.isArray(values)) {
      const selectedNumbers = values.map((v) => parseInt(v, 10)).filter((n) => !isNaN(n));
      onChange(selectedNumbers);
    } else if (typeof values === "string") {
      // Single value (should not happen in multiple mode)
      const n = parseInt(values, 10);
      onChange(isNaN(n) ? [] : [n]);
    } else {
      onChange([]);
    }
  };

  return (
    <Select
      multiple
      value={selectedValues}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue
          placeholder="Selecione um ou mais serviços"
          // Display selected count or names
          // The SelectValue component will show comma separated values by default
        />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Serviços Disponíveis</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.nome}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default MultiSelectServices;