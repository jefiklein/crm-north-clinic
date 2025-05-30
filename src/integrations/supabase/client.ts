// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase URL and public key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Optional: Add a check to ensure variables are loaded (Vite handles this during build, but good practice)
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("Supabase URL or Public Key environment variables are not set!");
  // Depending on your app's needs, you might want to throw an error or handle this differently
}


// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Expose supabase client globally for debugging in development
if (import.meta.env.DEV) {
  (window as any).supabase = supabase;
}