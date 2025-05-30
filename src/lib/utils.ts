import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to format phone number
export function formatPhone(phone: number | string | null): string {
    if (!phone) return 'S/ Tel.';
    let s = String(phone).replace(/\D/g, '');

    // Remove "55" prefix for visual formatting if it exists
    if (s.startsWith('55') && s.length > 2) {
        s = s.substring(2); // Remove the "55"
    }

    // Now apply formatting rules to the (potentially) modified string 's'
    // These rules now effectively operate on a number without the "55" prefix
    if (s.length === 11) { return `(${s.substring(0,2)}) ${s.substring(2,7)}-${s.substring(7)}`; } 
    if (s.length === 10) { return `(${s.substring(0,2)}) ${s.substring(2,6)}-${s.substring(6)}`; } 
    
    // Fallback for numbers that don't fit the common Brazilian formats after stripping "55"
    // or for numbers that didn't have "55" initially and don't match 10/11 digits.
    // This will also catch very short numbers or international numbers not starting with 55.
    return String(phone); // Return original (unformatted) if no specific rule matches
}