import { getAuthUser, createAdminClient } from '../../../lib/supabaseServer'

export default async function handler(req, res) {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const admin = createAdminClient()

    // GET — เจ้าของดู proposals ของ trip ตัวเอง
    if (req.method === 'GET') {
        const { tripId } = req.query
        if (!tripId) return res.status(400).json({ error: 'tripId required' })

        // ตรวจว่าเป็นเจ้าของ trip
        const { data: trip } = await admin.from('trips').select('owner_id').eq('id', tripId).single()
        if (!trip || trip.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

        const { data, error } = await admin
            .from('trip_proposals')
            .select('*')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false })

        if (error) return res.status(500).json({ error: error.message })
        return res.json({ proposals: data })
    }

    // POST — เพื่อนส่ง proposal
    if (req.method === 'POST') {
        const { trip_id, plan_json, description } = req.body
        if (!trip_id || !plan_json) return res.status(400).json({ error: 'trip_id and plan_json required' })

        // ตรวจว่า trip มี share_code (อนุญาตให้ propose ได้)
        const { data: trip } = await admin.from('trips').select('share_code, owner_id').eq('id', trip_id).single()
        if (!trip) return res.status(404).json({ error: 'Trip not found' })
        if (!trip.share_code) return res.status(403).json({ error: 'Trip is not shared' })
        if (trip.owner_id === user.id) return res.status(400).json({ error: 'Owner cannot propose to own trip' })

        const proposer_name = user.email || user.user_metadata?.name || 'Anonymous'

        const { data, error } = await admin.from('trip_proposals').insert({
            trip_id,
            proposer_id: user.id,
            proposer_name,
            description: description || 'เสนอแก้ไข plan',
            plan_json,
            status: 'pending',
        }).select().single()

        if (error) return res.status(500).json({ error: error.message })
        return res.json({ proposal: data })
    }

    return res.status(405).end()
}
