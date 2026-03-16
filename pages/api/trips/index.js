import { getAuthUser, createAdminClient } from '../../../lib/supabaseServer'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const admin = createAdminClient()

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('trips')
      .select('id, title, destination, dates, plan_json, created_at, updated_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ trips: data })
  }

  if (req.method === 'POST') {
    const { title = 'Trip ใหม่' } = req.body || {}
    const { data, error } = await admin
      .from('trips')
      .insert({ title, owner_id: user.id })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ trip: data })
  }

  return res.status(405).end()
}
