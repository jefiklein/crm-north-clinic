"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Label } from "@/components/ui/label"; // Import Label
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { cn } from "@/lib/utils"; // Import cn for styling

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

  const handleCheckedChange = (id: number, checked: boolean) => {
    let newSelectedIds;
    if (checked) {
      // Add the ID if it's not already there
      newSelectedIds = [...selectedIds, id];
    } else {
      // Remove the ID
      newSelectedIds = selectedIds.filter(selectedId => selectedId !== id);
    }
    onChange(newSelectedIds);
  };

  return (
    <div className={cn("border rounded-md p-2", disabled && "opacity-50 cursor-not-allowed")}>
      <ScrollArea className="h-40 w-full"> {/* Fixed height scroll area */}
        <div className="flex flex-col space-y-2">
          {options.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-4">Nenhum serviço disponível.</div>
          ) : (
            options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`service-${option.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => handleCheckedChange(option.id, !!checked)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`service-${option.id}`}
                    className={cn(
                      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                      disabled && "cursor-not-allowed"
                    )}
                  >
                    {option.nome}
                  </Label>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MultiSelectServices;