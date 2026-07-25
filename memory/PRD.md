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
- **Unified inbox** — WhatsApp + Instagram + Email, per-creator threads
- **Native brand themes per channel** — the thread view retextures the head, background, and message bubbles to feel like the real app:
  - **WhatsApp**: dark green header, cream chat bg with subtle green sheen, mint outbound bubbles + white inbound
  - **Instagram**: authentic purple → pink → orange gradient header, gray inbound + gradient outbound bubbles with soft glow
  - **Gmail**: clean white header, light blue-gray bg, white card bubbles with Gmail red/blue left-border accents
- **Saved views strip** — All / Unread / Hot leads / Unanswered 24h / Replied / Live only (one-click triage)
- **Message reactions** — hover-reveal heart icon, quick-pick emoji strip, reactions render as chips under the bubble; live WhatsApp threads show a friendly gate until proxy adds `messages/reaction`
- **Instagram DM** — connect drawer (Onboarding + Settings), Instagram-live sidebar dot, IG conversations respect the 24h DM window
- **Live WhatsApp Cloud API polling** — 15s poll of `/whatsapp-outreach/inbox` merges threads + messages into local state without breaking mock data
- **Live indicator** in Inbox header (pulsing dot, last-synced label, error surface, sync-now + pause/resume)
- **LIVE badge** on threads sourced from the WhatsApp Cloud API
- **Real WhatsApp send** — replying in a LIVE thread hits `/whatsapp-outreach/messages/text`; failure marks message failed + toasts
- **Desktop notifications** — Notification API opt-in from Inbox header, fires on new inbound (not for actively viewed thread), click focuses the tab and opens that conversation
- **Canned replies** — user-managed quick reply library (Settings) + one-click insert into composer with 3 pre-seeded starters
- **Thread labels** — free-form labels per conversation, chips in list + header, filter row above the list, 6 suggested labels
- **Bulk actions** — multi-select mode toggle, bulk Resolve, bulk Assign to a team member
- **Emoji picker** — dependency-free curated picker (Smileys / Reactions / Work) embedded into the composer
- **Inbound media rendering** — images / video / audio / documents / stickers hydrated from `/whatsapp-outreach/media/:id` and rendered inline in the thread
- **Attachment UI (outbound)** — file picker mounted; non-live channels get a mock preview, live WhatsApp gets a friendly "proxy support pending" toast
- **Optimistic reply** — input clears instantly; error only if store rejects (24h window closed)
- **24h reply-window indicator** for WhatsApp and Instagram
- **Campaign context** shown on threads (multi-campaign safe)
- **Simulate inbound** for demo testing (only on non-live threads)
- **Auto-scroll to newest** on message/thread change

### Templates & connection
- **Real Meta template listing** in Messages page (`listWhatsAppTemplates`) with META source badge and Refresh button
- **Full-fledged Meta template builder** — HEADER (Text / Image / Video / Document with example media URL), BODY with variables + example values, FOOTER with char counter, BUTTONS (Quick Replies up to 3 OR Call-to-Action with URL and Phone up to 2), category, language (10 locales), sticky live preview mirroring the final Meta render
- **Auto-detect WhatsApp connection** on mount (`getWhatsAppConnection`) — injects the real `phone_number_id` as a synthetic WhatsAppNumber so onboarding auto-dismisses and Quick Send picks up the live sender

### Appearance & platform
- **Dark mode** — Light / Dark / System toggle in Settings; CSS variables override cleanly across all components
- **Desktop notifications toggle** in Inbox header

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
- Outbound WhatsApp media send (image / video / doc / audio) — UI is ready; requires the proxy team to expose `/whatsapp-outreach/messages/{image,video,document,audio}` endpoints; the composer's paperclip button will light up automatically once wired
- Outbound WhatsApp reactions on inbound messages — needs proxy endpoint `/whatsapp-outreach/messages/reaction`
- Rich interactive message send (lists / interactive buttons) — proxy support pending
- Bulk delete / archive in Inbox
- WhatsAppStore.tsx (~2200 LOC) — extract live-inbox slice, prefs slice, canned slice
- Extract `RecentBatches` + `BatchRow` into submodules (QuickSendPage.tsx approaching 1600 LOC)
- Error boundary + skeleton loaders
- Onboarding interactive tour

## Changelog
- **2026-07-25** — Wired real WhatsApp Cloud API into Inbox: 15s polling loop + optimistic merge + real reply sends; auto-detects connection; Meta templates surface in Messages page.
- **2026-07-25 (later)** — Full production polish pass:
  - Full Meta template builder (Header/Body/Footer/Buttons + 10 languages + live preview) — verified end-to-end with a Meta submission returning `PENDING`.
  - Desktop notifications on new inbound messages, opt-in from Inbox header, click-to-focus.
  - Canned replies library with 3 seeds + Settings management + composer picker.
  - Thread labels + label filter + bulk resolve/assign.
  - Emoji picker in composer (dependency-free curated set).
  - Inbound media rendering (image / video / audio / document / sticker) via `/whatsapp-outreach/media/:id`.
  - Dark mode (Light / Dark / System) via CSS variables.
  - Attachment button wired (file picker) but gated with a friendly toast until the proxy exposes media-send endpoints.
- **2026-07-25 (final)** — Instagram + native brand themes + reactions:
  - Instagram DM as a first-class channel: connect drawers (Onboarding + Settings), Instagram-live sidebar dot, IG tab in Inbox, IG 24h DM window rule. Sends are local/mocked until the proxy exposes `/instagram-outreach/messages`.
  - Native per-channel Inbox themes — WhatsApp (green + cream), Instagram (purple/pink gradient), Gmail (white + red/blue accents). Driven by `data-channel` on the thread body + CSS variables; works in both light and dark themes.
  - Saved views strip (All / Unread / Hot leads / Unanswered 24h / Replied / Live only).
  - Emoji reactions on individual messages (hover heart → quick-pick), rendered as chips under bubbles.
  - Fixed lucide-react's removed brand icons by shipping tiny inline SVG `IgIcon` / `WaIcon` in `BrandIcons.tsx`.
  - Updated files: `src/types.ts`, `src/data/seed.ts`, `src/store/WhatsAppStore.tsx`, `src/pages/InboxV2.tsx`, `src/components/OnboardingSheet.tsx`, `src/components/SettingsDrawer.tsx`, `src/components/Layout.tsx`, `src/components/BrandIcons.tsx` (new), `src/index.css`.
