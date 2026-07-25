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
- **Live WhatsApp Cloud API polling** — 15s poll of `/whatsapp-outreach/inbox` merges threads + messages into local state without breaking mock data
- **Live indicator** in Inbox header (pulsing dot, last-synced label, error surface, sync-now + pause/resume)
- **LIVE badge** on threads sourced from the WhatsApp Cloud API
- **Real WhatsApp send** — replying in a LIVE thread hits `/whatsapp-outreach/messages/text`; failure marks message failed + toasts
- **Optimistic reply** — input clears instantly; error only if store rejects (24h window closed)
- **24h WhatsApp reply window** indicator with warning state
- **Campaign context** shown on threads (multi-campaign safe)
- **Simulate inbound** for demo testing (only on non-live threads)
- **Auto-scroll to newest** on message/thread change

### Templates & connection
- **Real Meta template listing** in Messages page (`listWhatsAppTemplates`) with META source badge and Refresh button
- **Auto-detect WhatsApp connection** on mount (`getWhatsAppConnection`) — injects the real `phone_number_id` as a synthetic WhatsAppNumber so onboarding auto-dismisses and Quick Send picks up the live sender

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
- Canned replies + thread labels in the Inbox
- Bulk inbox actions (Resolve all / Assign)
- Dark mode toggle
- Extract `RecentBatches` + `BatchRow` into submodules (QuickSendPage.tsx approaching 1600 LOC)
- WhatsAppStore.tsx (~1900 LOC) — extract live-inbox slice
- Error boundary + skeleton loaders
- Onboarding interactive tour

## Changelog
- **2026-07-25** — Wired real WhatsApp Cloud API into Inbox: 15s polling loop + optimistic merge + real reply sends; auto-detects connection; Meta templates surface in Messages page. Updated files: `src/store/WhatsAppStore.tsx`, `src/pages/InboxV2.tsx`, `src/pages/TemplatesLib.tsx`, `src/types.ts`, `src/index.css`.
