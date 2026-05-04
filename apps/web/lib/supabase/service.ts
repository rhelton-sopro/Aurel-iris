/**
 * Server-only Supabase client backed by SUPABASE_SERVICE_ROLE_KEY.
 *
 * Use ONLY from server-side code paths that intentionally bypass RLS:
 *   - app/api/readings/[id]/process/route.ts (signed URL generation + status update)
 *   - app/api/vision/webhook/route.ts (atomic UPDATE on `readings`, RLS-bypass per CONTEXT D-T4/D-F5)
 *
 * Never import this module from a client component or from any code path
 * that runs in the browser. The service-role key grants full table access.
 */
import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

export function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
