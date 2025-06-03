"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput, // Keeping CommandInput for potential future use or if needed for accessibility, but using a regular Input for visual control
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Tag {
  id: number;
  name: string;
}

interface LeadTagManagerProps {
  clinicId: number | string | null;
  leadId: number;
  availableTags: Tag[];
  currentLeadTags: Tag[];
  isLoadingTags: boolean;
  isSavingTags: boolean;
  onTagAdd: (leadId: number, tagId: number) => void;
  onTagRemove: (leadId: number, tagId: number) => void;
  onNewTagCreate: (tagName: string, clinicId: number | string) => Promise<Tag | null>;
}

const LeadTagManager: React.FC<LeadTagManagerProps> = ({
  clinicId,
  leadId,
  availableTags,
  currentLeadTags,
  isLoadingTags,
  isSavingTags,
  onTagAdd,
  onTagRemove,
  onNewTagCreate,
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null); // Ref para o campo de input

  const filteredAvailableTags = useMemo(() => {
    const lowerInputValue = inputValue.toLowerCase();
    return availableTags.filter(tag =>
      tag.name.toLowerCase().includes(lowerInputValue) &&
      !currentLeadTags.some(t => t.id === tag.id) // Não mostra tags já vinculadas nas sugestões
    );
  }, [availableTags, inputValue, currentLeadTags]);

  const handleCreateNewTag = async () => {
    if (!inputValue.trim() || !clinicId) return;

    setIsCreatingNewTag(true);
    try {
      const newTag = await onNewTagCreate(inputValue.trim(), clinicId);
      if (newTag) {
        // Se a tag foi criada com sucesso, vincule-a imediatamente ao lead
        onTagAdd(leadId, newTag.id);
        setInputValue("");
        setOpen(false); // Fecha o popover após criar e adicionar
      }
    } finally {
      setIsCreatingNewTag(false);
    }
  };

  const isTagAlreadyLinked = (tagId: number) =>
    currentLeadTags.some((t) => t.id === tagId);

  const isNewTagOption = inputValue.trim() && !availableTags.some(tag => tag.name.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div className="space-y-3">
      <Label className="block text-sm font-medium text-gray-700">Tags do Lead</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* Este div atua como a área de input visível, contendo as tags selecionadas e o campo de input real */}
          <div
            className="flex h-auto min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => inputRef.current?.focus()} // Foca o input ao clicar em qualquer lugar na área do trigger
          >
            <div className="flex flex-wrap gap-1 items-center w-full">
              {currentLeadTags.map((tag) => (
                <Badge
                  key={tag.id}
                  className="flex items-center gap-1 pr-1 text-sm bg-primary text-primary-foreground border border-primary rounded-full"
                >
                  {tag.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 text-primary-foreground hover:bg-primary/80 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation(); // Previne que o popover feche
                      onTagRemove(leadId, tag.id);
                    }}
                    disabled={isSavingTags}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              <Input
                ref={inputRef}
                placeholder={currentLeadTags.length === 0 ? "Buscar ou criar tag..." : ""}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setOpen(true)} // Abre o popover ao focar
                className="flex-1 h-auto bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:outline-none p-0"
                disabled={isSavingTags || isLoadingTags}
              />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            {/* Não há CommandInput aqui, pois usamos um Input regular no trigger */}
            <CommandList>
              <CommandEmpty>
                {inputValue.trim() ? (
                  <div className="p-2 text-center text-sm text-gray-500">
                    Nenhuma tag encontrada.
                  </div>
                ) : (
                  "Nenhuma tag."
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredAvailableTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name} // Valor para navegação/seleção por teclado
                    onSelect={() => {
                      if (!isTagAlreadyLinked(tag.id)) {
                        onTagAdd(leadId, tag.id);
                      } else {
                        onTagRemove(leadId, tag.id);
                      }
                      setInputValue("");
                      setOpen(false); // Fecha o popover após a seleção
                    }}
                    disabled={isSavingTags}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isTagAlreadyLinked(tag.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {tag.name}
                  </CommandItem>
                ))}
                {isNewTagOption && (
                  <CommandItem
                    onSelect={handleCreateNewTag}
                    disabled={isCreatingNewTag || isSavingTags}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {isCreatingNewTag ? "Criando..." : `Criar nova tag: "${inputValue}"`}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default LeadTagManager;