import { getAuthUser, createAdminClient } from '../../lib/supabaseServer'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'nathakorn.ted@gmail.com').split(',').map(e => e.trim().toLowerCase())

export default async function handler(req, res) {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    // Check admin
    const email = user.email?.toLowerCase()
    if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: 'Forbidden' })

    const admin = createAdminClient()

    if (req.method === 'GET') {
        // Get all trips
        const { data: trips, error: e1 } = await admin
            .from('trips')
            .select('id, title, destination, dates, plan_json, owner_id, created_at, updated_at')
            .order('updated_at', { ascending: false })

        if (e1) return res.status(500).json({ error: e1.message })

        // Get all members count per trip
        const { data: members } = await admin
            .from('trip_members')
            .select('trip_id, user_id')

        const memberCountMap = {}
            ; (members || []).forEach(m => {
                memberCountMap[m.trip_id] = (memberCountMap[m.trip_id] || 0) + 1
            })

        // Get unique owner IDs to fetch emails
        const ownerIds = [...new Set((trips || []).map(t => t.owner_id).filter(Boolean))]
        const ownerMap = {}

        if (ownerIds.length > 0) {
            // Fetch user emails from auth.users via admin API
            for (const oid of ownerIds) {
                try {
                    const { data: { user: u } } = await admin.auth.admin.getUserById(oid)
                    if (u) ownerMap[oid] = u.email || u.phone || 'anonymous'
                } catch { ownerMap[oid] = 'unknown' }
            }
        }

        // Stats
        const uniqueOwners = new Set((trips || []).map(t => t.owner_id)).size
        const tripsWithPlan = (trips || []).filter(t => t.plan_json).length

        const enrichedTrips = (trips || []).map(t => ({
            id: t.id,
            title: t.title,
            destination: t.destination,
            dates: t.dates,
            hasPlan: !!t.plan_json,
            planDays: t.plan_json?.days?.length || 0,
            ownerEmail: ownerMap[t.owner_id] || 'unknown',
            memberCount: memberCountMap[t.id] || 0,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
        }))

        return res.json({
            stats: { totalTrips: trips?.length || 0, totalUsers: uniqueOwners, tripsWithPlan },
            trips: enrichedTrips,
        })
    }

    return res.status(405).end()
}
