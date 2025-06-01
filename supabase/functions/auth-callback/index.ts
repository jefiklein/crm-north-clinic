import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const access_token = url.searchParams.get('access_token');
  const refresh_token = url.searchParams.get('refresh_token');
  // 'next' parameter tells the Edge Function where to redirect in the client app
  const next = url.searchParams.get('next') || '/set-new-password'; 

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase environment variables not set in Edge Function.');
    // Redirect to a generic error page or login if config is missing
    return Response.redirect(`${url.origin}/?error=${encodeURIComponent('Configuração do servidor ausente.')}`, 302);
  }

  // Create a Supabase client with the service role key
  // This client has elevated privileges and can set session cookies.
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false, // We handle refresh manually here
      persistSession: false,   // We don't want to persist session in the function itself
    },
  });

  if (access_token && refresh_token) {
    try {
      // Set the session using the admin client. This will set secure cookies in the browser.
      const { data, error } = await supabaseAdmin.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error('Error setting session in Edge Function:', error);
        // Redirect to an error page or login with an error message
        return Response.redirect(`${url.origin}/?error=${encodeURIComponent(error.message)}`, 302);
      }

      // Redirect back to the client application.
      // The client-side app will now find the session in its cookies.
      return Response.redirect(`${url.origin}${next}`, 302);

    } catch (e) {
      console.error('Unexpected error in Edge Function during session setting:', e);
      return Response.redirect(`${url.origin}/?error=${encodeURIComponent('Erro inesperado durante a configuração da sessão.')}`, 302);
    }
  } else {
    console.warn('Missing access_token or refresh_token in Edge Function callback.');
    // Redirect to login or an error page if tokens are missing
    return Response.redirect(`${url.origin}/?error=${encodeURIComponent('Tokens de autenticação ausentes.')}`, 302);
  }
});