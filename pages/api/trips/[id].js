import { getAuthUser, createAdminClient } from '../../../lib/supabaseServer'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  const admin = createAdminClient()

  const { data: trip, error: fetchError } = await admin
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !trip) return res.status(404).json({ error: 'Not found' })
  if (trip.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    return res.json({ trip })
  }

  if (req.method === 'PATCH') {
    const allowed = ['title', 'destination', 'dates', 'notes', 'plan_json']
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => allowed.includes(k))
    )

    const { data, error } = await admin
      .from('trips')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ trip: data })
  }

  if (req.method === 'DELETE') {
    const { error } = await admin.from('trips').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
