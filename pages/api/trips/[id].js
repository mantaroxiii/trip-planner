import { getAuthUser, createAdminClient } from '../../../lib/supabaseServer'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'nathakorn.ted@gmail.com').split(',').map(e => e.trim().toLowerCase())

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  const { id } = req.query
  const admin = createAdminClient()

  const { data: trip, error: fetchError } = await admin
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !trip) return res.status(404).json({ error: 'Not found' })

  // Determine access level
  const isOwner = user && trip.owner_id === user.id
  let isMember = false

  if (user && !isOwner) {
    // Check if already a member
    const { data: membership } = await admin
      .from('trip_members')
      .select('id')
      .eq('trip_id', id)
      .eq('user_id', user.id)
      .single()
    isMember = !!membership
  }

  if (req.method === 'GET') {
    // Anyone can view a trip via share link (GET)
    // If logged in user is not owner and not yet a member → auto-join
    // BUT skip auto-join if admin is viewing in admin mode
    const isAdminView = req.query.adminView === 'true' && ADMIN_EMAILS.includes(user?.email?.toLowerCase())
    if (user && !isOwner && !isMember && !user.is_anonymous && !isAdminView) {
      await admin.from('trip_members').insert({
        trip_id: id,
        user_id: user.id,
        role: 'member',
      }).select().single()
      isMember = true
    }

    // Fetch members list
    let members = []
    const { data: memberRows } = await admin
      .from('trip_members')
      .select('user_id, role, created_at')
      .eq('trip_id', id)

    if (memberRows?.length > 0) {
      // Fetch user emails from auth.users
      const { data: { users } } = await admin.auth.admin.listUsers()
      const userMap = {}
      users?.forEach(u => { userMap[u.id] = { email: u.email, name: u.user_metadata?.full_name || u.email?.split('@')[0] } })

      members = memberRows.map(m => ({
        userId: m.user_id,
        role: m.role,
        joinedAt: m.created_at,
        email: userMap[m.user_id]?.email || 'Unknown',
        name: userMap[m.user_id]?.name || 'Unknown',
      }))
    }

    return res.json({
      trip,
      role: isOwner ? 'owner' : isMember ? 'member' : isAdminView ? 'admin-viewer' : 'viewer',
      members,
    })
  }

  // For write operations, require auth
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Only owner can PATCH/DELETE
  if (!isOwner) {
    return res.status(403).json({ error: 'Only the trip owner can modify this trip' })
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
