import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("Edge Function: Request received.");
  if (req.method === 'OPTIONS') {
    console.log("Edge Function: Handling OPTIONS request.");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, clinicId, permissionLevelId } = await req.json();
    console.log("Edge Function: Received payload:", { email, firstName, lastName, clinicId, permissionLevelId });

    if (!email || !clinicId || !permissionLevelId) {
      console.error("Edge Function: Missing required fields.");
      return new Response(JSON.stringify({ error: 'Missing required fields: email, clinicId, permissionLevelId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase client with service_role key
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log(`Edge Function: SUPABASE_URL present: ${!!SUPABASE_URL}, SUPABASE_SERVICE_ROLE_KEY present: ${!!SUPABASE_SERVICE_ROLE_KEY}`);

    const supabaseAdmin = createClient(
      SUPABASE_URL ?? '',
      SUPABASE_SERVICE_ROLE_KEY ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Create the user in Supabase Auth
    console.log(`Edge Function: Attempting to create user: ${email}`);
    const { data: userCreationData, error: userCreationError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      user_metadata: {
        first_name: firstName?.trim() || null,
        last_name: lastName?.trim() || null,
      },
    });

    if (userCreationError) {
      // Melhorando o log de erro para garantir que a mensagem apareça
      console.error(`Edge Function: Error creating user: ${userCreationError.message || JSON.stringify(userCreationError)}`);
      return new Response(JSON.stringify({ error: userCreationError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    console.log("Edge Function: User created successfully. New user ID:", userCreationData.user.id);
    const newUserId = userCreationData.user.id;

    // 2. Generate and send the password reset link
    const redirectToUrl = `${req.headers.get('origin')}/login`;
    console.log(`Edge Function: Attempting to generate password reset link for ${email} with redirectTo: ${redirectToUrl}`);
    const { data: resetLinkData, error: resetLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'password_reset',
      email: email.trim(),
      options: {
        redirectTo: redirectToUrl,
      },
    });

    if (resetLinkError) {
      // Melhorando o log de erro para garantir que a mensagem apareça
      console.error(`Edge Function: Error generating reset link: ${resetLinkError.message || JSON.stringify(resetLinkError)}`);
      return new Response(JSON.stringify({ error: resetLinkError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    console.log("Edge Function: Password reset link generated successfully.");

    // 3. Call the webhook to assign the user's role in user_clinic_roles
    const ASSIGN_ROLE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/25f39e3a-d410-4327-98e8-cf23dc324902';
    console.log(`Edge Function: Calling webhook to assign role: ${ASSIGN_ROLE_WEBHOOK_URL}`);
    const assignRoleResponse = await fetch(ASSIGN_ROLE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: newUserId,
        clinicId: clinicId,
        permissionLevelId: permissionLevelId,
      }),
    });

    if (!assignRoleResponse.ok) {
      const errorText = await assignRoleResponse.text();
      // Melhorando o log de erro para garantir que a mensagem apareça
      console.error(`Edge Function: Error assigning role via webhook: Status ${assignRoleResponse.status}, Response: ${errorText}`);
      return new Response(JSON.stringify({ error: `Failed to assign role: ${errorText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    console.log("Edge Function: Role assigned successfully via webhook.");

    return new Response(JSON.stringify({ success: true, message: 'User created and role assigned successfully.', resetLink: resetLinkData.properties.action_link }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    // Melhorando o log de erro para garantir que a mensagem apareça
    console.error(`Edge Function: Unexpected error in main try-catch block: ${error.message || JSON.stringify(error)}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});