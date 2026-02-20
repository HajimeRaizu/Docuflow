import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
// Using the service role key to bypass RLS and allow saving documents on behalf of users
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // Only handle POST requests from OnlyOffice
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();

    // The document key (which we set to the document ID or a new temporary ID)
    const documentKey = body.key;
    const status = body.status;
    const url = body.url; // URL to the edited document provided by Document Server
    const users = body.users; // Array of user IDs who edited

    // Status 2 means the document is ready for saving (all users disconnected)
    // Status 3 means saving error
    // Status 6 means the document is being edited, but a force save was triggered

    if (status === 2 || status === 6) {
      if (!url) {
        console.error("No URL provided in callback payload for status", status);
        return new Response(JSON.stringify({ error: 1 }), { status: 400 });
      }

      console.log(`Document ${documentKey} is ready for saving. Downloading from ${url}`);

      // 1. Download the document blob from the Document Server
      const documentResponse = await fetch(url);
      if (!documentResponse.ok) {
        throw new Error(`Failed to download document from OnlyOffice: ${documentResponse.statusText}`);
      }
      const documentBlob = await documentResponse.blob();

      // 2. Determine file path and versioning
      // The key is generally `doc_12345` or an existing UUID. Let's extract clean ID.
      const baseId = documentKey.replace("doc_", "");
      const timestamp = new Date().getTime();
      const fileName = `${baseId}_v${timestamp}.docx`;
      const filePath = `documents/${fileName}`;

      // 3. Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, documentBlob, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false // Keep versions separate
        });

      if (uploadError) {
        console.error("Supabase Storage Upload Error:", uploadError);
        throw uploadError;
      }

      console.log(`Successfully uploaded to storage path: ${filePath}`);

      // Get public URL for the new version
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // 4. Update Database Record

      // Determine user ID (we take the first user in the array if available)
      const modifierId = (users && users.length > 0) ? users[0] : 'system';

      // We need to fetch the existing document to append to its versions array
      const { data: existingDoc, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', baseId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Rows not found" - ignore if new doc
        console.error("Error fetching existing document:", fetchError);
      }

      const currentVersions = existingDoc ? (existingDoc.versions || []) : [];

      const newVersion = {
        id: timestamp.toString(),
        content_url: publicUrl, // Store URL instead of raw text
        savedAt: new Date().toISOString(),
        versionNumber: currentVersions.length + 1,
        modifiedBy: { id: modifierId, name: modifierId } // We only have the ID here, name would need another fetch
      };

      const updatedVersions = [...currentVersions, newVersion];

      const docUpdatePayload = {
        updated_at: new Date().toISOString(),
        versions: updatedVersions,
        // If it's a completely new document (not yet created via React),
        // we might not have all the metadata (title, type, etc.). 
        // We ensure React creates the row FIRST, so docxEditor always uses an existing ID.
      };

      const { error: updateError } = await supabase
        .from('documents')
        .update(docUpdatePayload)
        .eq('id', baseId);

      if (updateError) {
        console.error("Database Update Error:", updateError);
        // OnlyOffice will retry if we don't return {"error": 0}
        throw updateError;
      }

      console.log(`Document ${baseId} database record updated successfully.`);
    }

    // Must return this exact JSON to signal success to OnlyOffice
    return new Response(JSON.stringify({ error: 0 }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Callback Error:", err);
    // Returning error != 0 tells Document Server to retry later
    return new Response(JSON.stringify({ error: 1, message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
