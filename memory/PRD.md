# Reelax Outreach — Product & Design Redesign (v2)

## Problem statement
Redesign the entire product UX for Reelax Outreach — a creator outreach SaaS for brands.
Rethink information architecture, navigation, page structure, and user flows, without breaking
any underlying capability (WhatsApp + Email send, templates, campaigns, unified inbox, cascade
sending, analytics, Meta template approval via `api.dev.getreelax.com`).

## Constraints delivered
- ✅ **Zero backend/API/store changes** — `WhatsAppStore`, `lib/api.ts`, `types.ts`, `data/seed.ts`
  fully untouched. All capabilities preserved.
- ✅ **GitHub Pages deploy** unchanged (`.github/workflows/deploy.yml` untouched).
- ✅ Meta WhatsApp Cloud API integration still active (create template, send, inbox).

## New information architecture
- **Campaigns** (default landing) — hub + detail. Absorbs the old "Home / Floor".
- **Inbox** — unified conversations (single/dual-channel), per-creator threads.
- **Messages** — merged template library (WhatsApp Meta + email scripts).
- **Results** — analytics (per-channel + per-campaign).
- **Settings** (drawer, not top nav) — Channels, Brands, Team.
- **Onboarding sheet** — first-run channel connect (auto-shown until 1 channel is live).

Old tabs removed / merged:
- `floor` (Home) → merged into Campaigns
- `connect` (Channels page) → moved to Settings drawer + first-run onboarding

## Canonical "first outreach" flow (one path)
Campaigns → "New outreach" → **SendDrawer** wizard (4 steps):
1. **Audience** — name + collections / creators / existing campaign
2. **Message** — channel(s) + template picker + live preview
3. **Strategy** — Send now OR Smart sequence (cascade, smart defaults, advanced hidden by default)
4. **Review** — recipient count + what happens + previews → Send

SendDrawer is the single send UI, reused from: Campaigns hub, Campaign detail "Send again".

## Visual language (v2)
- Typography: **Onest** (variable) + **JetBrains Mono** for numerals — distinctive, not Inter/Roboto/Geist
- Palette: cool near-neutrals, near-black `#111` as primary CTA, restrained **coral `#ff5c39`** accent
- Channel colors are **dots and badges only** — never full themes
- Motion: subtle drawer slide, message enter animation, hover transitions
- No gradients, no glow, no glass, no serif editorial

## Files
### New
- `src/components/Drawer.tsx`, `PageHeader.tsx`, `EmptyState.tsx`
- `src/components/SendDrawer.tsx` (canonical wizard)
- `src/components/SettingsDrawer.tsx`
- `src/components/OnboardingSheet.tsx`
- `src/pages/CampaignsHub.tsx`, `CampaignDetail.tsx`
- `src/pages/InboxV2.tsx`, `TemplatesLib.tsx`, `ResultsV2.tsx`

### Rewritten (behavior preserved)
- `src/components/Layout.tsx` — new 4-item nav
- `src/components/Toast.tsx` — new visual style
- `src/components/CreateTemplateModal.tsx` — new visual style, same submit logic
- `src/App.tsx` — new router mapping
- `src/index.css` — full new design system (single source of truth)
- `index.html` — Onest + JetBrains Mono
- `src/App.css` — cleared

### Preserved as-is (functional)
- `src/store/WhatsAppStore.tsx`
- `src/lib/**`
- `src/data/seed.ts`
- `src/types.ts`
- `src/components/CascadeControls.tsx`, `SendWizard.tsx` (legacy, unused now)
- `src/components/StatusBadge.tsx`, `VariableMapper.tsx`

## What's implemented (Jul 2025 → complete)
- Onboarding sheet with WA + Email connect drawers
- Campaigns Hub with live counters, filter, per-campaign metrics + engagement bars
- Campaign Detail with 5 metrics, split channel breakdown, live activity feed
- SendDrawer 4-step wizard (audience / message / strategy / review) w/ progressive disclosure
- InboxV2 two-panel layout, unified WA + Email, 24h window notice, reply composer, simulate inbound
- TemplatesLib table view with search + tabs + New template modal
- ResultsV2 top-line + per-channel + per-campaign performance table
- SettingsDrawer for Channels / Brands / Team
- Mobile-responsive layout collapse

## What functional flows still work (verified)
- Connect WA / Email → store actions unchanged
- Prepare & send (single + cascade) → uses `actions.prepareAndSend`
- Send reply within 24h window → uses `actions.sendReply` + `canFreeformReply`
- Simulate inbound → cancels scheduled cascade follow-ups (existing store behavior)
- Create template (WA via Meta API + local email) → `createWhatsAppTemplate` + `submitTemplate`
- Analytics roll-up per campaign per channel

## Next / backlog
- Persist store to localStorage so demo state survives reload
- Wire real WhatsApp Cloud API inbox in `InboxV2` (currently only in-memory demo threads)
- Command palette (`⌘K`) for quick actions
- CSV import path inside SendDrawer (currently only collections / creators / existing campaign)
- Dark mode variant of the design system (tokens already CSS-var based)
