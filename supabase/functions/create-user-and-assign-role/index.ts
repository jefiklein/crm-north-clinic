import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.5'; // Alterado para a versão 2.38.5

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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log(`Edge Function: SUPABASE_URL present: ${!!SUPABASE_URL}, SUPABASE_SERVICE_ROLE_KEY present: ${!!SUPABASE_SERVICE_ROLE_KEY}`);

    // Adicionando uma verificação explícita para as variáveis de ambiente
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Edge Function: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    let targetUserId: string;
    let userAlreadyExistsInAuth = false;

    // 1. Check if user already exists in Supabase Auth
    console.log(`Edge Function: Checking if user ${email} already exists in auth.`);
    const { data: existingUserData, error: existingUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email.trim());

    if (existingUserData?.user) {
      console.log(`Edge Function: User ${email} found in auth. ID: ${existingUserData.user.id}`);
      targetUserId = existingUserData.user.id;
      userAlreadyExistsInAuth = true;
    } else if (existingUserError && existingUserError.message === 'User not found') {
      // User does not exist, proceed to create
      console.log(`Edge Function: User ${email} not found in auth. Creating new user.`);
      const { data: userCreationData, error: userCreationError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        email_confirm: true,
        user_metadata: {
          first_name: firstName?.trim() || null,
          last_name: lastName?.trim() || null,
        },
      });

      if (userCreationError) {
        console.error(`Edge Function: Error creating new user: ${userCreationError.message || JSON.stringify(userCreationError)}`);
        return new Response(JSON.stringify({ error: userCreationError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      console.log("Edge Function: New user created successfully. ID:", userCreationData.user.id);
      targetUserId = userCreationData.user.id;
    } else {
      // Other error when fetching user by email
      console.error(`Edge Function: Unexpected error fetching user by email: ${existingUserError?.message || JSON.stringify(existingUserError)}`);
      return new Response(JSON.stringify({ error: existingUserError?.message || 'Failed to check existing user.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 2. Check and assign/update role in public.user_clinic_roles
    console.log(`Edge Function: Checking existing role for user ${targetUserId} in clinic ${clinicId}.`);
    const { data: existingRole, error: roleFetchError } = await supabaseAdmin
      .from('user_clinic_roles')
      .select('id, permission_level_id, is_active')
      .eq('user_id', targetUserId)
      .eq('clinic_id', clinicId)
      .single();

    if (roleFetchError && roleFetchError.code !== 'PGRST116') { // PGRST116 means "No rows found"
      console.error(`Edge Function: Error fetching existing role: ${roleFetchError.message || JSON.stringify(roleFetchError)}`);
      return new Response(JSON.stringify({ error: roleFetchError.message || 'Failed to check existing role.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (existingRole) {
      // Role exists, update it if necessary
      console.log(`Edge Function: Existing role found for user ${targetUserId} in clinic ${clinicId}.`);
      if (existingRole.permission_level_id !== permissionLevelId || !existingRole.is_active) {
        console.log(`Edge Function: Updating existing role ID ${existingRole.id}.`);
        const { error: updateError } = await supabaseAdmin
          .from('user_clinic_roles')
          .update({
            permission_level_id: permissionLevelId,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRole.id);

        if (updateError) {
          console.error(`Edge Function: Error updating existing role: ${updateError.message || JSON.stringify(updateError)}`);
          return new Response(JSON.stringify({ error: updateError.message || 'Failed to update existing role.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }
        console.log("Edge Function: Existing role updated successfully.");
      } else {
        console.log("Edge Function: Existing role is already active and has the correct permission level. No update needed.");
      }
    } else {
      // No existing role, insert a new one
      console.log(`Edge Function: No existing role found. Inserting new role for user ${targetUserId} in clinic ${clinicId}.`);
      const { error: insertError } = await supabaseAdmin
        .from('user_clinic_roles')
        .insert({
          user_id: targetUserId,
          clinic_id: clinicId,
          permission_level_id: permissionLevelId,
          is_active: true,
        });

      if (insertError) {
        console.error(`Edge Function: Error inserting new role: ${insertError.message || JSON.stringify(insertError)}`);
        return new Response(JSON.stringify({ error: insertError.message || 'Failed to insert new role.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      console.log("Edge Function: New role inserted successfully.");
    }

    // 3. Generate and send the password reset link (or invite link for new users)
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
      console.error(`Edge Function: Error generating reset link: ${resetLinkError.message || JSON.stringify(resetLinkError)}`);
      return new Response(JSON.stringify({ error: resetLinkError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    console.log("Edge Function: Password reset link generated successfully.");

    return new Response(JSON.stringify({ success: true, message: 'User processed and role assigned/updated successfully.', resetLink: resetLinkData.properties.action_link }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`Edge Function: Unexpected error in main try-catch block: ${error.message || JSON.stringify(error)}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});