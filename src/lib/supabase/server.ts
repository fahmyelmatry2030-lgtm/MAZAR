import 'server-only';

import { createClient } from '@supabase/supabase-js';

let cachedClient: any = null;

export function getSupabaseServerClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceRoleKey) {
    console.error('[SUPABASE_SERVER] ❌ CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing on Server!');
    return null;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}

