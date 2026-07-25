# Reelax Outreach — v2 + Quick Send + CSV variable mapping

## New capabilities delivered
### Quick Send sandbox (nav item with lightning icon)
Send any Meta-approved WhatsApp template to any phone number(s). No campaigns / collections / creators required. Uses the real `api.dev.getreelax.com` WhatsApp Cloud API.

**Recipient input**
- Paste phone numbers (newline / comma-separated, 10+ digit validation, auto-dedup)
- CSV upload (auto-detects phone column: phone / mobile / whatsapp / number)

**Per-recipient variable personalization (CSV mode)**
- Each template slot `{{n}}` has a `Fixed | From CSV` toggle
- **Auto-mapping heuristic** on CSV upload:
  - `first_name` / `name` → `{{1}}`
  - `last_name` / `surname` / `company` / `brand` → `{{2}}`
  - Others fall back to template's own example values
- User can override any mapping — pick a different CSV column or type a fixed value
- Preview shows the actual render for the first recipient (per-row values applied)

**Send flow**
- Concurrent per-recipient loop with live status per row (queued → sending → sent / failed)
- Progress counter in the CTA (`Sending N/M`)
- Failed recipients keep their specific error message
- Successful sends flow into the unified Inbox via `logWhatsAppSends`

### Full localStorage persistence
- **Store**: `WhatsAppStore` state under `reelax-outreach-v2` (channels, campaigns, templates, conversations, messages, analytics, brand filter, active tab) — volatile UI fields (toasts, modal flags) stripped
- **Quick Send**: recipients, variable bindings, CSV headers, phone column, selected template under `rx-quicksend-v2`
- Survives full page reloads and cross-navigation. No re-onboarding.

## Architecture
| Layer | File | Purpose |
|---|---|---|
| Store persistence | `store/WhatsAppStore.tsx` | `loadPersisted` + `persistState` + `useEffect` idle-persist |
| Quick Send | `pages/QuickSendPage.tsx` | Two-panel layout, `VarBinding` (literal|column), `autoMapColumns`, per-recipient `renderBody` |
| CSV | `lib/csv.ts` | Reused unchanged — `parseCsv`, `parsePhoneList`, `findPhoneColumn` |
| Template slots | `lib/templateSlots.ts` | Reused — `extractMetaSlots` |
| API | `lib/api.ts` | Reused — `listWhatsAppTemplates('APPROVED')`, `sendWhatsAppTemplate` |
| Nav | `components/Layout.tsx` | 5-item nav: Campaigns · Quick Send · Inbox · Messages · Results |
| Router | `App.tsx` | Adds `quicksend` case → `QuickSendPage` |

## Verified end-to-end
- ✅ testing_agent iteration 1: 100% pass on base app (onboarding, nav, drawers, wizards, inbox, etc.)
- ✅ Manual verification: CSV auto-map (first_name → `{{1}}`, brand → `{{2}}`), per-recipient preview rendering
- ✅ Manual verification: Same-session reload restores template + bindings + all 3 recipients + column mapping
- ✅ No JS console errors

## Sample CSV for testing
`/app/sample-creators.csv`:
```
first_name,brand,phone,email
Priya,Glow Lab,+919876543210,priya@example.com
Ananya,Glow Lab,+919123456789,ananya@example.com
Meera,Nova Hair,+918887776655,meera@example.com
```

## Files
### New in this iteration
- `pages/QuickSendPage.tsx` — completely rewritten with CSV mapping + persistence
- `/app/sample-creators.csv` — sample for testing CSV flow

### Previously new
- `pages/CampaignsHub.tsx`, `CampaignDetail.tsx`, `InboxV2.tsx`, `TemplatesLib.tsx`, `ResultsV2.tsx`
- `components/Drawer.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `SendDrawer.tsx`, `SettingsDrawer.tsx`, `OnboardingSheet.tsx`

### Rewritten
- `App.tsx`, `App.css`, `index.css`, `index.html`
- `components/Layout.tsx`, `Toast.tsx`, `CreateTemplateModal.tsx`
- `store/WhatsAppStore.tsx` — additive persistence hooks

### Additive
- `types.ts` — `'quicksend'` in `TabId` union

## Nothing pushed to git
User asked to review before push. Use **Save to GitHub** in the chat input when ready.

## Backlog (all non-blocking)
- Wire real WhatsApp Cloud API messages into `InboxV2` (currently in-memory demo)
- Command palette (⌘K)
- Dark mode (tokens already CSS-var driven)
- Export send results as CSV
- Rate-limit send loop to avoid Meta throttling on very large batches
