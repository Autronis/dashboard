import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "administratie";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL en SUPABASE_SERVICE_KEY zijn vereist");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function uploadToStorage(
  filePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await getSupabase().storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return filePath;
}

export async function getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function downloadFromStorage(filePath: string): Promise<Buffer> {
  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .download(filePath);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFromStorage(filePath: string): Promise<void> {
  const { error } = await getSupabase().storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
