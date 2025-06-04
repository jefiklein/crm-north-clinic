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

  try {
    const { fileKey } = await req.json();
    console.log("Edge Function: Received raw fileKey:", fileKey);

    if (!fileKey || typeof fileKey !== 'string') {
      return new Response(JSON.stringify({ error: 'fileKey is required and must be a string' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Extract the path within the bucket.
    // Assuming fileKey is always in the format 'bucket-name/path/to/file.ext'
    // We need to remove 'north-clinic/' from the beginning of the fileKey.
    const bucketName = 'north-clinic';
    const filePathInBucket = fileKey.startsWith(`${bucketName}/`)
      ? fileKey.substring(`${bucketName}/`.length)
      : fileKey; // Fallback if for some reason the prefix isn't there (though it should be)

    console.log("Edge Function: Extracted filePathInBucket:", filePathInBucket);

    // Initialize Supabase client with service role key for secure access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { data, error } = await supabase.storage
      .from(bucketName) // Specify the bucket name
      .createSignedUrl(filePathInBucket, 3600); // Pass only the path within the bucket

    if (error) {
      console.error("Error creating signed URL:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ signedUrl: data.signedUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Unhandled error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});