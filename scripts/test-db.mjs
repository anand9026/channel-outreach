#!/usr/bin/env node
/** Direct dev DB smoke test for outreach tables (uses reelax-server .env). */
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const mysql = require('mysql2/promise')

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../../reelax-server/.env')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const ORG = process.env.ORG || 'mq3cl6'

const queries = [
  ['outreach_channels', 'SELECT COUNT(*) AS n FROM outreach_channels WHERE org_id = ? AND is_deleted = 0', [ORG]],
  ['outreach_campaigns', 'SELECT COUNT(*) AS n FROM outreach_campaigns WHERE org_id = ? AND is_deleted = 0', [ORG]],
  ['outreach_threads', 'SELECT COUNT(*) AS n FROM outreach_threads WHERE org_id = ? AND is_deleted = 0', [ORG]],
  ['outreach_templates', 'SELECT COUNT(*) AS n FROM outreach_templates WHERE org_id = ? AND is_deleted = 0', [ORG]],
  ['outreach_conversations', 'SELECT COUNT(*) AS n FROM outreach_conversations WHERE org_id = ? AND is_deleted = 0', [ORG]],
  ['outreach_messages', 'SELECT COUNT(*) AS n FROM outreach_messages LIMIT 1', []],
  ['outreach_thread_links', 'SELECT COUNT(*) AS n FROM outreach_thread_links LIMIT 1', []],
  ['outreach_campaign_channels', 'SELECT COUNT(*) AS n FROM outreach_campaign_channels LIMIT 1', []],
]

async function main() {
  console.log(`DB: ${env.DB_HOST}/${env.DB_DATABASE}`)
  console.log(`org_id: ${ORG}\n`)

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_DATABASE,
    port: Number(env.DB_PORT || 3306),
  })

  const [tables] = await conn.query("SHOW TABLES LIKE 'outreach%'")
  console.log('Tables:', tables.map((r) => Object.values(r)[0]).join(', ') || '(none)')
  console.log('')

  for (const [name, sql, params] of queries) {
    try {
      const [rows] = await conn.query(sql, params)
      console.log(`✓ ${name} — count=${rows[0]?.n ?? 'ok'}`)
    } catch (e) {
      console.log(`✗ ${name} — ${e.code || ''} ${e.message}`)
    }
  }

  // Test listChannels column set used by API
  try {
    const [rows] = await conn.query(
      `SELECT outreach_channel_id, org_id, user_id, brand_id, medium, account_label, display_name, account_address, phone_number_id, waba_id, display_phone_number, verified_business_name, email_address, ig_user_id, ig_handle, status, last_sync_at, date_added, date_modified FROM outreach_channels WHERE org_id = ? AND is_deleted = 0 ORDER BY date_modified DESC LIMIT 5`,
      [ORG],
    )
    console.log(`\n✓ listChannels query — ${rows.length} row(s)`)
  } catch (e) {
    console.log(`\n✗ listChannels query — ${e.code || ''} ${e.message}`)
  }

  await conn.end()
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
