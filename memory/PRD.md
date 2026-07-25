# Reelax Outreach — Full v2 + Quick Send suite

## Product scope delivered
End-to-end SaaS UX for creator outreach — designed & shipped in this session:
- Onboarding sheet (first-run WA/Email connect + demo-data skip)
- 5-item primary nav: Campaigns · Quick Send · Inbox · Messages · Results
- Settings drawer (Channels · Brands · Team) — not in top nav
- SendDrawer wizard (4-step canonical send flow for campaigns)
- Campaigns hub + Campaign detail
- Unified Inbox with 24h-window awareness
- Merged Messages (WA templates + email scripts) library with create-modal
- Results page (per-channel + per-campaign analytics)
- **Quick Send sandbox** with paste + CSV upload + variable auto-mapping
- **Send batch history + CSV export** — production-grade audit trail
- **Full localStorage persistence** — store + Quick Send state

## Quick Send capabilities
### Recipients
- Paste (newline / comma), 10+ digit validation, auto-dedup
- CSV upload with auto-detection of phone / mobile / whatsapp / number column

### Variable personalization
- Per-slot Fixed | From CSV toggle
- **Auto-mapping heuristic** on CSV upload: `first_name`/`name` → `{{1}}`, `last_name`/`surname`/`company`/`brand` → `{{2}}`; falls back to template's own example values
- Per-recipient live preview (renders row-specific values)

### Send + audit
- Sequential send with live status per row (queued → sending → sent / failed)
- Per-recipient error surfaced
- Successful sends land in unified Inbox via `logWhatsAppSends`

### Send batch history (`rx-quicksend-batches-v1`, max 20)
- Every completed batch saved to localStorage with full recipient snapshot (phone, name, row, status, wamid, error, rendered body, timestamp)
- **Recent send batches** panel with:
  - Template name + `N sent` pill + `N failed` red pill / `All delivered` green pill
  - Relative timestamp, source phone, total count
  - Expand/collapse table (Phone / Name / Status / Message ID / Error)
  - **Export CSV** per batch (columns: phone, name, status, wamid, error, body, sent_at, + any original CSV row columns)
  - Delete single batch / Clear all history

### Persistence
- Template selection, variable bindings, CSV headers, phone column, recipients — all restored on reload
- Store state (channels, campaigns, messages, analytics, etc.) restored under `reelax-outreach-v2`

## Testing verified
- testing_agent iteration 1: 100% pass on base app
- testing_agent iteration 2: 100% functional on new batch/export flows; found + fixed one medium bug (sent-count pill was showing totalCount)

## Files
### New
- `pages/QuickSendPage.tsx` — 1100 LOC, full Quick Send experience
- `pages/CampaignsHub.tsx`, `CampaignDetail.tsx`, `InboxV2.tsx`, `TemplatesLib.tsx`, `ResultsV2.tsx`
- `components/Drawer.tsx`, `PageHeader.tsx`, `EmptyState.tsx`
- `components/SendDrawer.tsx`, `SettingsDrawer.tsx`, `OnboardingSheet.tsx`
- `/app/sample-creators.csv` — sample CSV for testing

### Rewritten (behavior preserved)
- `App.tsx`, `App.css`, `index.css`, `index.html`
- `components/Layout.tsx`, `Toast.tsx`, `CreateTemplateModal.tsx`
- `store/WhatsAppStore.tsx` — additive persistence

### Additive only
- `types.ts` — `'quicksend'` in `TabId` union

### Untouched
- `src/lib/**`, `src/data/**`, all store business logic

## Nothing pushed to git
As always requested. Use **Save to GitHub** in the chat input when ready.

## Backlog / next
- Extract `RecentBatches` + `BatchRow` + csv helpers into `pages/quicksend/` submodules (code hygiene — file is 1100 LOC)
- Wire real WhatsApp Cloud API messages into `InboxV2` (currently in-memory demo)
- Command palette (⌘K)
- Dark mode (tokens are CSS-var driven — trivial to add)
- Rate-limiting on batch send loop for very large batches to avoid Meta throttling
