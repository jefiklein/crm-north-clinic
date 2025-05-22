"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"; // Import Command components
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Plus, Eye, EyeOff, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, TriangleAlert, Info, MessagesSquare, Save, XCircle, Smile, Tags, FileText, Video, Music, Download, ChevronDown } from 'lucide-react'; // Added ChevronDown
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from '@/lib/utils'; // Utility for class names
import { showSuccess, showError, showToast } from '@/utils/toast'; // Using our toast utility
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client

// Ensure the emoji picker element is defined
import 'emoji-picker-element';

// ... rest of the component code remains unchanged ...

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  // ... component implementation ...
  return (
    // ... JSX ...
    <div> {/* ... */} </div>
  );
};

export default MensagensConfigPage;