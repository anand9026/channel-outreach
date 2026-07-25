# Reelax Outreach v2 — Full production suite

## Session summary
Complete UX + IA redesign of Reelax Outreach + Quick Send sandbox with 5 major production polish features.

## Nav model
Campaigns · Quick Send · Inbox · Messages · Results + Settings drawer + Onboarding sheet.
Command palette (⌘K) provides fast navigation & primary actions from anywhere.

## Feature inventory
### Send flows
- **SendDrawer wizard** — canonical 4-step Audience → Message → Strategy → Review
- **Quick Send sandbox** — paste / CSV upload, per-slot variable auto-mapping, per-recipient rendering
- **Real Meta WhatsApp Cloud API** — `api.dev.getreelax.com` (listTemplates + sendTemplate)
- **Scheduled sends** — Send now | Schedule for later with `datetime-local` picker, timer registration, cancel from batches panel
- **Rate limiting** — auto 250ms throttle for batches > 50 recipients
- **Pause / Resume / Stop** controller during active send with live progress bar
- **Send test to yourself** — sends current template to your own connected WA number for a safety-net preview
- **Batch retry** — "Resend failed only" hydrates failed recipients back into the draft with the same template + bindings

### Data & audit
- **Send batch history** — persisted (`rx-quicksend-batches-v1`, max 20) with full per-recipient snapshot
- **Export CSV** per batch (columns: phone, name, status, wamid, error, body, sent_at + any original CSV row columns)
- **localStorage persistence** — store + Quick Send draft state (template, bindings, recipients)

### Inbox
- **Unified inbox** (WhatsApp + Email) with per-creator threads
- **Optimistic reply** — input clears instantly; error only if store rejects (24h window closed)
- **24h WhatsApp reply window** indicator with warning state
- **Campaign context** shown on threads (multi-campaign safe)
- **Simulate inbound** for demo testing

### Discoverability & polish
- **Command palette (⌘K / Ctrl+K)** — navigate to any page, run "New outreach", jump to any campaign or conversation via search
- **Sparklines on Results page** — 30-day per-metric trend for Sent / Delivered / Read / Replies; coral accent on the Replies card
- **Refresh** button on Quick Send template list; live loading state
- **Onboarding sheet** — first-run channel connect with "Explore with demo data" skip

## Testing verified
- testing_agent iteration 1: base app 100% pass
- testing_agent iteration 2: batch history + export 100% pass (medium bug fixed & re-verified)
- Manual verification: schedule / cancel / pause / retry / test send / ⌘K palette / sparklines all working
- HMR clean, zero JS console errors

## Files
### New
- `src/components/CommandPalette.tsx` — global ⌘K palette
- `src/components/Sparkline.tsx` — dependency-free SVG sparkline
- `src/pages/QuickSendPage.tsx` — 1500+ LOC Quick Send experience
- `src/pages/CampaignsHub.tsx`, `CampaignDetail.tsx`, `InboxV2.tsx`, `TemplatesLib.tsx`, `ResultsV2.tsx`
- `src/components/Drawer.tsx`, `PageHeader.tsx`, `EmptyState.tsx`
- `src/components/SendDrawer.tsx`, `SettingsDrawer.tsx`, `OnboardingSheet.tsx`
- `/app/sample-creators.csv`

### Rewritten (behavior preserved)
- `App.tsx`, `App.css`, `index.css`, `index.html`
- `components/Layout.tsx`, `Toast.tsx`, `CreateTemplateModal.tsx`
- `store/WhatsAppStore.tsx` — additive persistence only

### Additive
- `types.ts` — `'quicksend'` in `TabId`

## Nothing pushed to git
Use **Save to GitHub** in the chat input when ready.

## Backlog (still non-blocking)
- Wire real WhatsApp Cloud API messages into `InboxV2` thread body (currently in-memory demo except for QuickSend sends which do land there via `logWhatsAppSends`)
- Dark mode
- Extract `RecentBatches` + `BatchRow` into submodules (QuickSendPage.tsx approaching 1600 LOC)
- Error boundary + skeleton loaders
- Onboarding interactive tour
