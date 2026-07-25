# Reelax Outreach — Product & Design Redesign (v2 + Quick Send)

## Problem
Redesign the Reelax Outreach product UX end-to-end. Preserve every backend/API capability
while inventing a clearer product experience with better IA, one canonical send flow,
and a sandbox for ad-hoc sends to arbitrary phone numbers.

## New IA (5 primary nav + Settings drawer)
- **Campaigns** — landing; hub + detail
- **Quick Send** *(NEW)* — sandbox to send any approved WA template to any phone or CSV
- **Inbox** — unified conversations
- **Messages** — templates (WA Meta + email scripts)
- **Results** — analytics
- **Settings** (drawer, not top nav) — channels / brands / team
- **Onboarding sheet** — first-run channel connect

## Canonical Send flows
1. **SendDrawer wizard** (from Campaigns / campaign detail): 4-step Audience → Message → Strategy → Review
2. **Quick Send page** (from nav): pick approved Meta template, paste phones or upload CSV, live variable preview, per-recipient send status; successful sends land in Inbox via `logWhatsAppSends`

## Production polish
- **localStorage persistence** — full store persisted under `reelax-outreach-v2`, volatile UI flags stripped; loads on boot via `loadPersisted`
- **Onest + JetBrains Mono** typography (distinctive, non-cliché)
- Cool neutrals + near-black CTA + restrained coral accent `#ff5c39`
- Channel colors = badges/dots only, never themes
- Motion: drawer slide, message enter, spinner, hover transitions
- Mobile-responsive shell
- Every interactive element has `data-testid`

## Files (net)
### New
- `src/pages/QuickSendPage.tsx` — sandbox using real Meta API
- `src/pages/CampaignsHub.tsx`, `CampaignDetail.tsx`, `InboxV2.tsx`, `TemplatesLib.tsx`, `ResultsV2.tsx`
- `src/components/Drawer.tsx`, `PageHeader.tsx`, `EmptyState.tsx`
- `src/components/SendDrawer.tsx`, `SettingsDrawer.tsx`, `OnboardingSheet.tsx`

### Rewritten (behavior preserved)
- `src/App.tsx`, `App.css`, `index.css`, `index.html`
- `src/components/Layout.tsx`, `Toast.tsx`, `CreateTemplateModal.tsx`
- `src/store/WhatsAppStore.tsx` — only add-only: `loadPersisted` + `persistState` + persistence `useEffect`
- `src/types.ts` — additive: `'quicksend'` added to `TabId`

### Untouched
- `src/lib/**`, `src/data/**`, remaining store logic, deploy workflow

## Verified end-to-end (testing_agent iteration 1)
- Onboarding sheet renders on fresh localStorage
- 'Explore with demo data' skips to Campaigns
- 5-item nav order + all testids present
- Settings drawer opens / ESC closes
- Quick Send: paste parsing, dedup, error toast, disabled state, real Meta API dropdown populated (10 approved templates observed)
- localStorage survives reload — no re-onboarding
- Campaigns hub / campaign detail / inbox / messages / results all render + interact correctly
- SendDrawer wizard steps work
- 0 JS console errors
- **Frontend success rate: 100%**

## Next / backlog (all non-blocking)
- Persist QuickSend recipient list across page nav
- Per-CSV-row variable mapping (currently uniform samples)
- Command palette (⌘K) for quick actions
- Dark mode variant (design tokens already CSS-var driven)
- Wire real WhatsApp Cloud API inbox into `InboxV2`
