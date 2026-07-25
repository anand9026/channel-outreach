# Reelax Outreach — Complete v2 + Quick Send Pro

## New capabilities in this iteration
### Scheduled sends
- Timing card: **Send now** | **Schedule for later** segmented control
- When "later" selected: `<input type="datetime-local">` picker (defaults to +15 min)
- Send button label switches to "Schedule for N numbers" with calendar icon
- Scheduled batches appear in the Recent Send Batches panel with:
  - Blue "Scheduled" pill + `Fires <date/time>` label + `N queued` count
  - **Cancel** button (replaces Export CSV for scheduled state)
  - Delete icon (permanently removes)
- Timers registered via `setTimeout` on mount + when a schedule is created
- Long delays capped at 2h chunks (browser throttle-safe), timer re-arms itself
- Missed schedules (page closed past due time) auto-execute on next load; marked as "Missed" if template no longer available
- Cancelled state shown with grey badge; missed shown with red badge

### Rate limiting + Pause/Resume/Stop
- Automatic 250ms throttle between sends when batch > 50 recipients
- Help text appears when batch crosses threshold: "Batches over 50 recipients auto-throttle to 250ms between sends to respect Meta's messaging tier limits."
- **Send controller bar** (coral accent, visible only during send):
  - Live "Sending / Paused — N of M" status
  - Throttle info line
  - **Pause** button (turns into Resume when paused)
  - **Stop** button (danger style; cancels remaining recipients, saves batch as `cancelled`)
  - Full-width progress bar
- Pause check runs between each recipient via `gate()` awaiter
- On Stop: remaining recipients marked `failed` with error `"Cancelled"`, batch saved with `status: 'cancelled'`

## Full architecture (all features shipped in this session)

### 4-item nav model
Campaigns · Quick Send · Inbox · Messages · Results + Settings drawer + Onboarding sheet

### Quick Send pipeline
- Recipient input: paste (validation + dedup) or CSV upload (auto-detects phone column)
- Variable auto-mapping: `first_name`/`name` → `{{1}}`, `last_name`/`brand` → `{{2}}`; per-slot `Fixed | From CSV` toggle
- Per-recipient live preview using the actual first CSV row
- Timing: Send now or Schedule for later (datetime picker)
- Sending: pause/resume/stop, auto rate-limit for large batches
- Real Meta WhatsApp Cloud API (`api.dev.getreelax.com`)
- Successful sends flow into unified Inbox via `logWhatsAppSends`
- Every batch saved to localStorage; Export CSV per batch

### Persistence
- `reelax-outreach-v2` — full store state
- `rx-quicksend-v2` — Quick Send draft (template, bindings, CSV state, recipients)
- `rx-quicksend-batches-v1` — up to 20 completed / scheduled / cancelled batches with full recipient snapshots

## Testing verified
- testing_agent iteration 1: base app 100% pass
- testing_agent iteration 2: batch history + export 100% functional (medium pill bug found + fixed + re-verified)
- Manual verification: Timing card, scheduled batch appearance, Cancel button, Pause controller UI, throttle help text

## Nothing pushed to git
As always requested. Use **Save to GitHub** when ready.

## Backlog
- Wire real WhatsApp Cloud API into Inbox thread (currently in-memory demo)
- Command palette (⌘K)
- Dark mode
- Extract `RecentBatches` + `BatchRow` into submodules (QuickSendPage.tsx is ~1500 LOC)
- Batch retry: "Resend failed only" button per completed batch
