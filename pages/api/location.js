import { getAuthUser, createAdminClient } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const tripId = req.query.tripId || req.body?.tripId
    if (!tripId) return res.status(400).json({ error: 'Missing tripId' })

    const supabase = createAdminClient()

    if (req.method === 'POST') {
        // Save user's location
        const { lat, lng } = req.body
        if (!lat || !lng) return res.status(400).json({ error: 'Missing lat/lng' })

        // Get current trip
        const { data: trip, error: fetchErr } = await supabase
            .from('trips').select('plan_json').eq('id', tripId).single()
        if (fetchErr) return res.status(500).json({ error: fetchErr.message })

        const planJson = trip.plan_json || {}
        const locations = planJson._memberLocations || {}

        // Update this user's location
        locations[user.id] = {
            lat, lng,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || '?',
            email: user.email,
            updatedAt: new Date().toISOString()
        }

        planJson._memberLocations = locations

        const { error: updateErr } = await supabase
            .from('trips').update({ plan_json: planJson }).eq('id', tripId)
        if (updateErr) return res.status(500).json({ error: updateErr.message })

        return res.status(200).json({ ok: true, location: locations[user.id] })
    }

    if (req.method === 'GET') {
        // Get all member locations
        const { data: trip, error } = await supabase
            .from('trips').select('plan_json').eq('id', tripId).single()
        if (error) return res.status(500).json({ error: error.message })

        const locations = trip?.plan_json?._memberLocations || {}
        return res.status(200).json({ locations })
    }

    return res.status(405).end()
}
