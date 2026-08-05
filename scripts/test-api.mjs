#!/usr/bin/env node
/**
 * Smoke-test deployed APIs the frontend uses (org_id mq3cl6).
 */
const ORG = process.env.VITE_OUTREACH_ORG_ID || 'mq3cl6'
const BASE = (process.env.VITE_API_BASE_URL || 'https://api.dev.getreelax.com').replace(/\/$/, '')

const endpoints = [
  ['Outreach channels', `/outreach/channels?org_id=${ORG}`],
  ['Outreach campaigns', `/outreach/campaigns?org_id=${ORG}`],
  ['Outreach threads', `/outreach/threads?org_id=${ORG}`],
  ['Outreach templates', `/outreach/templates?org_id=${ORG}`],
  ['WhatsApp connection', `/whatsapp-outreach/connection?org_id=${ORG}`],
  ['WhatsApp templates', `/whatsapp-outreach/templates?org_id=${ORG}&limit=5`],
  ['WhatsApp inbox', `/whatsapp-outreach/inbox?org_id=${ORG}`],
  ['Gmail connection', `/gmail-outreach/connection?user_id=demo_user&channel_id=default&org_id=${ORG}`],
  ['Gmail templates', `/gmail-outreach/templates?user_id=demo_user&channel_id=default&org_id=${ORG}`],
  ['Gmail threads', `/gmail-outreach/threads?user_id=demo_user&channel_id=default&org_id=${ORG}`],
]

function summarize(body) {
  if (!body || typeof body !== 'object') return String(body).slice(0, 200)
  const d = body.data ?? body
  const keys = []
  if (Array.isArray(d.channels)) keys.push(`channels=${d.channels.length}`)
  if (Array.isArray(d.campaigns)) keys.push(`campaigns=${d.campaigns.length}`)
  if (Array.isArray(d.threads)) keys.push(`threads=${d.threads.length}`)
  if (Array.isArray(d.templates)) keys.push(`templates=${d.templates.length}`)
  if (Array.isArray(d.messages)) keys.push(`messages=${d.messages.length}`)
  if (d.data && Array.isArray(d.data)) keys.push(`items=${d.data.length}`)
  if (d.connection) keys.push('connection=ok')
  if (d.phone_number_id) keys.push(`pnid=${d.phone_number_id}`)
  if (d.email) keys.push(`email=${d.email}`)
  if (body.success === false) {
    const err = body.err_l?.[0]?.m || body.error?.message || 'unknown error'
    return `FAILED: ${err}`
  }
  return keys.length ? keys.join(', ') : JSON.stringify(body).slice(0, 200)
}

async function run() {
  console.log(`API base: ${BASE}`)
  console.log(`org_id:   ${ORG}\n`)

  const results = []
  for (const [name, path] of endpoints) {
    const url = `${BASE}${path}`
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = text
      }
      const ok = res.ok && !(json && json.success === false)
      results.push({ name, ok, status: res.status, summary: summarize(json) })
      console.log(`${ok ? '✓' : '✗'} ${name} [${res.status}] — ${summarize(json)}`)
    } catch (e) {
      results.push({ name, ok: false, status: 0, summary: e.message })
      console.log(`✗ ${name} [ERR] — ${e.message}`)
    }
  }

  // Optional: create + read campaign round-trip
  console.log('\n--- Write test: create outreach campaign ---')
  try {
    const createRes = await fetch(`${BASE}/outreach/campaigns`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: ORG,
        name: `API smoke test ${new Date().toISOString()}`,
        kind: 'outreach',
        status: 'draft',
        audience_type: 'my_creators',
        created_by_user_id: 'smoke_test',
      }),
    })
    const createJson = await createRes.json()
    const campaignId = createJson?.data?.outreach_campaign_id || createJson?.outreach_campaign_id
    const createOk = createRes.ok && createJson?.success !== false && campaignId
    console.log(`${createOk ? '✓' : '✗'} Create campaign [${createRes.status}] — id=${campaignId || 'none'}`)

    if (campaignId) {
      const getRes = await fetch(
        `${BASE}/outreach/campaign?org_id=${ORG}&outreach_campaign_id=${campaignId}`,
        { headers: { Accept: 'application/json' } },
      )
      const getJson = await getRes.json()
      const getOk = getRes.ok && getJson?.success !== false
      console.log(`${getOk ? '✓' : '✗'} Get campaign [${getRes.status}] — ${getJson?.data?.campaign?.name || summarize(getJson)}`)
    }
  } catch (e) {
    console.log(`✗ Write test [ERR] — ${e.message}`)
  }

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} read endpoints OK`)
  process.exit(passed === results.length ? 0 : 1)
}

run()
