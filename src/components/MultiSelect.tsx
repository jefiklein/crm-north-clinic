"use client";

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectProps<T> {
  options: T[];
  value: T[];
  onChange: (values: T[]) => void;
  labelKey: keyof T;
  valueKey: keyof T;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect<T extends Record<string, any>>({
  options,
  value,
  onChange,
  labelKey,
  valueKey,
  placeholder = "Select...",
  disabled = false,
  className,
}: MultiSelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Filter options based on inputValue
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options;
    return options.filter((option) =>
      String(option[labelKey])
        .toLowerCase()
        .includes(inputValue.toLowerCase())
    );
  }, [inputValue, options, labelKey]);

  // Toggle selection of an option
  const toggleOption = (option: T) => {
    const optionValue = option[valueKey];
    const isSelected = value.some(
      (v) => v[valueKey] === optionValue
    );
    if (isSelected) {
      onChange(value.filter((v) => v[valueKey] !== optionValue));
    } else {
      onChange([...value, option]);
    }
  };

  // Display selected labels joined by comma
  const displayValue = value.map((v) => String(v[labelKey])).join(", ");

  return (
    <div className={cn("relative w-full", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={cn(
          "w-full border border-input bg-background py-2 px-3 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          !displayValue && "text-muted-foreground"
        )}
      >
        {displayValue || placeholder}
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" />
      </button>

      {open && (
        <Command
          className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover text-popover-foreground shadow-lg"
          onValueChange={() => {}}
        >
          <CommandInput
            autoFocus
            placeholder="Buscar..."
            value={inputValue}
            onValueChange={setInputValue}
            className="border-b border-input"
          />
          <CommandList>
            {filteredOptions.length === 0 && (
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => {
                const optionValue = option[valueKey];
                const isSelected = value.some(
                  (v) => v[valueKey] === optionValue
                );
                return (
                  <CommandItem
                    key={String(optionValue)}
                    onSelect={() => {
                      toggleOption(option);
                    }}
                    className="flex items-center justify-between"
                  >
                    {String(option[labelKey])}
                    {isSelected && <Check className="h-4 w-4" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  );
}