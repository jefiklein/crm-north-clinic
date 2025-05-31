import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'; // Updated to latest stable version

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
    
    console.log(`Edge Function: SUPABASE_URL present: ${!!SUPABASE_URL}`);
    console.log(`Edge Function: SUPABASE_SERVICE_ROLE_KEY present: ${!!SUPABASE_SERVICE_ROLE_KEY} (masked: ${SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10)}...)`);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Edge Function: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. Cannot initialize admin client.");
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

    console.log(`Edge Function: supabaseAdmin.auth.admin object keys: ${JSON.stringify(Object.keys(supabaseAdmin.auth.admin || {}))}`);
    console.log(`Edge Function: typeof supabaseAdmin.auth.admin.createUser: ${typeof supabaseAdmin.auth.admin.createUser}`);

    if (!supabaseAdmin.auth.admin || typeof supabaseAdmin.auth.admin.createUser !== 'function') {
      console.error("Edge Function: supabaseAdmin.auth.admin is not fully initialized or createUser is not a function. This indicates a problem with the Supabase client initialization or an incorrect service role key.");
      return new Response(JSON.stringify({ error: 'Server configuration error: Supabase admin client methods not available. Please verify your SUPABASE_SERVICE_ROLE_KEY in Supabase dashboard.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let targetUserId: string;
    let successMessage = 'Usuário cadastrado e papel atribuído/atualizado com sucesso.';
    let resetLink = null;

    // 1. Directly attempt to create the user in Supabase Auth
    console.log(`Edge Function: Attempting to create new user ${email}.`);
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
    console.log(`Edge Function: Attempting to generate invite link for ${email} with redirectTo: ${redirectToUrl}`);
    const { data: inviteLinkData, error: inviteLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite', // <-- ALTERADO AQUI para 'invite'
      email: email.trim(),
      options: {
        redirectTo: redirectToUrl,
      },
    });

    if (inviteLinkError) {
      console.error(`Edge Function: Error generating invite link: ${inviteLinkError.message || JSON.stringify(inviteLinkError)}`);
      successMessage += ` No entanto, houve um erro ao enviar o email de convite: ${inviteLinkError.message}. O usuário pode usar a opção 'Esqueceu sua senha?' na tela de login para definir a senha.`;
      // Do NOT return a non-2xx status here, as the user was successfully created/updated in the DB.
    } else {
      console.log("Edge Function: Invite link generated successfully.");
      resetLink = inviteLinkData.properties.action_link;
    }

    return new Response(JSON.stringify({ success: true, message: successMessage, resetLink: resetLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Always return 200 OK if user and role operations succeeded
    });

  } catch (error: any) {
    console.error(`Edge Function: Unexpected error in main try-catch block: ${error.message || JSON.stringify(error)}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});