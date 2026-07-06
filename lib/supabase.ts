import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nkizuxrzcqaqzxbukezw.supabase.co";
// Fallback to dummy key to prevent throwing during module import at build time
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-role-key";
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Uploads a file to the 'menu-uploads' bucket in Supabase Storage.
 * Make sure the 'menu-uploads' bucket is created in your Supabase project.
 */
export async function uploadToSupabaseStorage(storagePath: string, file: File): Promise<string> {
  const { data, error } = await supabase.storage
    .from("menu-uploads")
    .upload(storagePath, file, { cacheControl: "3600", upsert: true });

  if (error) {
    console.error("Supabase Storage Upload Error:", error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from("menu-uploads")
    .getPublicUrl(storagePath);

  return publicUrl;
}
