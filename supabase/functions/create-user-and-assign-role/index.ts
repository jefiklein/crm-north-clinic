import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

    if (!supabaseAdmin.auth.admin || typeof supabaseAdmin.auth.admin.createUser !== 'function' || typeof supabaseAdmin.auth.admin.getUserByEmail !== 'function' || typeof supabaseAdmin.auth.admin.generateLink !== 'function') {
      console.error("Edge Function: Supabase admin client methods not fully available. This indicates a problem with the Supabase client initialization or an incorrect service role key.");
      return new Response(JSON.stringify({ error: 'Server configuration error: Supabase admin client methods not available. Please verify your SUPABASE_SERVICE_ROLE_KEY in Supabase dashboard.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let targetUserId: string;
    let successMessage = 'Usuário cadastrado e papel atribuído/atualizado com sucesso.';
    let linkType: 'invite' | 'recovery';
    let userExists = false;

    // 1. Check if user already exists by email
    console.log(`Edge Function: Checking if user ${email} already exists.`);
    const { data: existingUserData, error: existingUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email.trim());

    if (existingUserData?.user) {
      userExists = true;
      targetUserId = existingUserData.user.id;
      linkType = 'recovery'; // Send recovery link for existing users
      successMessage = 'Usuário já cadastrado. Papel atualizado e link de redefinição de senha enviado.';
      console.log(`Edge Function: User ${email} already exists with ID: ${targetUserId}. Will send recovery link.`);

      // Optionally update user metadata for existing users
      if (firstName || lastName) {
        console.log(`Edge Function: Updating user metadata for existing user ${targetUserId}.`);
        const { error: updateMetadataError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {
            first_name: firstName?.trim() || existingUserData.user.user_metadata.first_name || null,
            last_name: lastName?.trim() || existingUserData.user.user_metadata.last_name || null,
          },
        });
        if (updateMetadataError) {
          console.warn(`Edge Function: Failed to update metadata for existing user ${targetUserId}: ${updateMetadataError.message}`);
        }
      }

    } else {
      // User does not exist, proceed to create
      linkType = 'invite'; // Send invite link for new users
      console.log(`Edge Function: User ${email} does not exist. Attempting to create new user.`);
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
      targetUserId = userCreationData.user.id;
      console.log("Edge Function: New user created successfully. ID:", targetUserId);
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

    // 3. Generate and send the appropriate link (invite or recovery)
    // Use the primary domain provided by the user
    const redirectToUrl = `https://app.northcrm.com.br/login`; 
    console.log(`Edge Function: Attempting to generate ${linkType} link for ${email} with redirectTo: ${redirectToUrl}`);
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: linkType,
      email: email.trim(),
      options: {
        redirectTo: redirectToUrl,
      },
    });

    if (linkError) {
      console.error(`Edge Function: Error generating ${linkType} link: ${linkError.message || JSON.stringify(linkError)}`);
      successMessage += ` No entanto, houve um erro ao enviar o email de ${linkType === 'invite' ? 'convite' : 'redefinição de senha'}: ${linkError.message}. O usuário pode usar a opção 'Esqueceu sua senha?' na tela de login para definir a senha.`;
      // Do NOT return a non-2xx status here, as the user was successfully created/updated in the DB.
    } else {
      console.log(`Edge Function: ${linkType} link generated successfully.`);
    }

    return new Response(JSON.stringify({ success: true, message: successMessage }), {
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