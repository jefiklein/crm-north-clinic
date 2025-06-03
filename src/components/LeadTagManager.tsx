"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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

  const filteredAvailableTags = useMemo(() => {
    const lowerInputValue = inputValue.toLowerCase();
    return availableTags.filter(tag =>
      tag.name.toLowerCase().includes(lowerInputValue)
    );
  }, [availableTags, inputValue]);

  const handleCreateNewTag = async () => {
    if (!inputValue.trim() || !clinicId) return;

    setIsCreatingNewTag(true);
    try {
      const newTag = await onNewTagCreate(inputValue.trim(), clinicId);
      if (newTag) {
        onTagAdd(leadId, newTag.id);
        setInputValue("");
        setOpen(false);
      }
    } finally {
      setIsCreatingNewTag(false);
    }
  };

  const isTagAlreadyLinked = (tagId: number) =>
    currentLeadTags.some((t) => t.id === tagId);

  const isNewTagOption = inputValue.trim() && !filteredAvailableTags.some(tag => tag.name.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div className="space-y-3">
      <Label className="block text-sm font-medium text-gray-700">Tags do Lead</Label>
      <div className="flex flex-wrap gap-2 min-h-[38px] items-center">
        {currentLeadTags.length === 0 && !isLoadingTags && (
          <span className="text-sm text-gray-500">Nenhuma tag vinculada.</span>
        )}
        {currentLeadTags.map((tag) => (
          <Badge
            key={tag.id}
            // Updated styling for the badge to match the desired purple/white look
            className="flex items-center gap-1 pr-1 text-sm bg-primary text-primary-foreground border border-primary rounded-full"
          >
            {tag.name}
            <Button
              variant="ghost"
              size="icon"
              // Updated styling for the remove button inside the badge
              className="h-4 w-4 p-0 text-primary-foreground hover:bg-primary/80 rounded-full"
              onClick={() => onTagRemove(leadId, tag.id)}
              disabled={isSavingTags}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {isLoadingTags && (
          <span className="flex items-center text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando tags...
          </span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isSavingTags || isLoadingTags}
          >
            {currentLeadTags.length > 0
              ? `${currentLeadTags.length} tag(s) selecionada(s)`
              : "Selecionar tags..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder="Buscar ou criar tag..."
              value={inputValue}
              onValueChange={setInputValue}
            />
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
                    value={tag.name}
                    onSelect={() => {
                      if (!isTagAlreadyLinked(tag.id)) {
                        onTagAdd(leadId, tag.id);
                      } else {
                        onTagRemove(leadId, tag.id);
                      }
                      setInputValue("");
                      setOpen(false);
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