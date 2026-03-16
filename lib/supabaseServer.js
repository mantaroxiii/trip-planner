import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function getAuthUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return user
}
