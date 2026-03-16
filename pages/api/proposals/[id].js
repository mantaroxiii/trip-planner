import { getAuthUser, createAdminClient } from '../../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'PATCH') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.query
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be approved or rejected' })

    const admin = createAdminClient()

    // โหลด proposal + ตรวจว่า user เป็นเจ้าของ trip
    const { data: proposal } = await admin.from('trip_proposals').select('*, trips(owner_id)').eq('id', id).single()
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    if (proposal.trips.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })
    if (proposal.status !== 'pending') return res.status(400).json({ error: 'Proposal already resolved' })

    // Update proposal status
    await admin.from('trip_proposals').update({ status }).eq('id', id)

    // ถ้า approve → merge plan_json เข้า trip ทันที
    if (status === 'approved') {
        const { error } = await admin.from('trips').update({
            plan_json: proposal.plan_json,
            updated_at: new Date().toISOString(),
        }).eq('id', proposal.trip_id)

        if (error) return res.status(500).json({ error: error.message })
    }

    return res.json({ ok: true, status })
}
