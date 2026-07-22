type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

function readRequiredEnv(name: string, value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return trimmed;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    anonKey: readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey),
  };
}

export type { SupabasePublicEnv };
