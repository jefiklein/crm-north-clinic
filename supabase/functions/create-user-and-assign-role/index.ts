import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, clinicId, permissionLevelId } = await req.json();

    if (!email || !clinicId || !permissionLevelId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, clinicId, permissionLevelId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase client with service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Create the user in Supabase Auth
    const { data: userCreationData, error: userCreationError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true, // Confirm email automatically
      user_metadata: {
        first_name: firstName?.trim() || null,
        last_name: lastName?.trim() || null,
      },
    });

    if (userCreationError) {
      console.error("Edge Function: Error creating user:", userCreationError.message);
      return new Response(JSON.stringify({ error: userCreationError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const newUserId = userCreationData.user.id;

    // 2. Generate and send the password reset link
    const { data: resetLinkData, error: resetLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'password_reset',
      email: email.trim(),
      options: {
        redirectTo: `${req.headers.get('origin')}/login`, // Use the origin from the request for redirectTo
      },
    });

    if (resetLinkError) {
      console.error("Edge Function: Error generating reset link:", resetLinkError.message);
      // Even if link generation fails, we might still want to proceed with role assignment
      // but inform the user. For now, we'll treat it as a critical error.
      return new Response(JSON.stringify({ error: resetLinkError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 3. Call the webhook to assign the user's role in user_clinic_roles
    const ASSIGN_ROLE_WEBHOOK_URL = 'https://n8n-n8n.sbw0pc.easypanel.host/webhook/25f39e3a-d410-4327-98e8-cf23dc324902';
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
      console.error("Edge Function: Error assigning role via webhook:", assignRoleResponse.status, errorText);
      // Consider if you want to delete the user if role assignment fails
      return new Response(JSON.stringify({ error: `Failed to assign role: ${errorText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'User created and role assigned successfully.', resetLink: resetLinkData.properties.action_link }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function: Unexpected error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});