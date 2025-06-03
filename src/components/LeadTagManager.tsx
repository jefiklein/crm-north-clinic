"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, PlusCircle, X, Tag as TagIconLucide } from "lucide-react"; // Added TagIconLucide
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
  const inputRef = useRef<HTMLInputElement>(null); // Ref for the CommandInput

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

  // Focus the input when the popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div className="space-y-3">
      <Label className="block text-sm font-medium text-gray-700">Tags do Lead</Label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            role="combobox"
            aria-expanded={open}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] cursor-pointer"
            onClick={() => setOpen(true)} // Open popover on click
          >
            <div className="flex flex-wrap items-center gap-1">
              {currentLeadTags.length === 0 && !isLoadingTags && !open && (
                <span className="text-muted-foreground">Adicionar tags...</span>
              )}
              {currentLeadTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1 text-sm"
                  onClick={(e) => e.stopPropagation()} // Prevent popover from closing when clicking badge
                >
                  {tag.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onTagRemove(leadId, tag.id)}
                    disabled={isSavingTags}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {isLoadingTags && (
                <span className="flex items-center text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
                </span>
              )}
              {open && ( // Render CommandInput directly when popover is open
                <CommandInput
                  ref={inputRef}
                  placeholder="Buscar ou criar tag..."
                  value={inputValue}
                  onValueChange={setInputValue}
                  className="h-auto flex-grow border-none shadow-none focus:ring-0"
                  disabled={isSavingTags}
                />
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          {open && ( // Conditionally render Command
            <Command>
              {/* CommandInput is now rendered inside PopoverTrigger */}
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
                      <TagIconLucide className="mr-2 h-4 w-4 text-gray-500" /> {tag.name}
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
          )}
        </PopoverContent>
      </Popover>
      {isSavingTags && (
        <div className="flex items-center text-sm text-gray-500 mt-2">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando tags...
        </div>
      )}
    </div>
  );
};

export default LeadTagManager;