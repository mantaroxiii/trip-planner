import { getAuthUser, createAdminClient } from '../../../lib/supabaseServer'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const admin = createAdminClient()

  if (req.method === 'GET') {
    // 1. Trips I own
    const { data: ownTrips, error: e1 } = await admin
      .from('trips')
      .select('id, title, destination, dates, plan_json, created_at, updated_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })

    if (e1) return res.status(500).json({ error: e1.message })

    // 2. Trips I'm a member of (joined via share link)
    const { data: memberships } = await admin
      .from('trip_members')
      .select('trip_id, role, joined_at')
      .eq('user_id', user.id)

    let sharedTrips = []
    if (memberships && memberships.length > 0) {
      const tripIds = memberships.map(m => m.trip_id)
      const { data: shared } = await admin
        .from('trips')
        .select('id, title, destination, dates, plan_json, created_at, updated_at')
        .in('id', tripIds)
        .order('updated_at', { ascending: false })

      if (shared) {
        sharedTrips = shared.map(t => {
          const m = memberships.find(m => m.trip_id === t.id)
          return { ...t, _role: m?.role || 'member', _shared: true }
        })
      }
    }

    // Mark own trips
    const own = (ownTrips || []).map(t => ({ ...t, _role: 'owner', _shared: false }))

    return res.json({ trips: [...own, ...sharedTrips] })
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
