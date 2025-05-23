import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to format phone number
export function formatPhone(phone: number | string | null): string {
    if (!phone) return 'S/ Tel.';
    const s = String(phone).replace(/\D/g, '');
    if (s.length === 13 && s.startsWith('55')) { return `+${s.substring(0,2)} (${s.substring(2,4)}) ${s.substring(4,9)}-${s.substring(9)}`; }
    if (s.length === 12 && s.startsWith('55')) { return `+${s.substring(0,2)} (${s.substring(2,4)}) ${s.substring(4,8)}-${s.substring(8)}`; }
    if (s.length === 11) { return `(${s.substring(0,2)}) ${s.substring(2,7)}-${s.substring(7)}`; }
    if (s.length === 10) { return `(${s.substring(0,2)}) ${s.substring(2,6)}-${s.substring(6)}`; }
    return String(phone); // Return original if format doesn't match
}