# WhatsApp AI Admissions Automation

An AI admissions agent that answers inbound WhatsApp messages, qualifies the
enquiry, and books a demo class — writing the booking, moving the Enquiry to
`demo_scheduled`, and alerting an admin.

**Status:** built and tested, **never enabled**. Lives on
`feature/whatsapp-ai-admissions`, not merged to `main`. The feature defaults
OFF and is inert until the env vars below are set. Read
"[Not built yet](#not-built-yet)" before turning it on — some of it matters.

---

## The kill switch

`config/whatsappAutomation.ts` is the single on/off gate, checked at the very
top of the webhook handler. When it returns false: no persistence, no AI call,
no CRM mutation, no booking, no notification. The request is acked with a 200
and dropped.

```ts
isWhatsAppAutomationEnabled() =
  WHATSAPP_AUTOMATION_ENABLED
  && WHATSAPP_PHONE_NUMBER_ID && WHATSAPP_ACCESS_TOKEN
  && WHATSAPP_WEBHOOK_VERIFY_TOKEN && ANTHROPIC_API_KEY
  && WHATSAPP_APP_SECRET
```

The credentials are part of the gate on purpose. A flag flipped on with one
credential missing fails as *"automation not enabled"* — safe and visible,
every message acked and ignored — rather than *"enabled but every webhook
403s"*, which looks broken and silently drops every lead. Flipping the flag to
`false` and restarting disables everything instantly.

The GET verification handshake deliberately does **not** consult this gate, so
the webhook can be registered with Meta before automation is ever turned on.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `WHATSAPP_AUTOMATION_ENABLED` | `false` | The kill switch. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | `''` | Any random string you choose; Meta echoes it back on verification. |
| `WHATSAPP_APP_SECRET` | `''` | Meta **App Secret** (App Dashboard → Settings → Basic), not the access token. Verifies `X-Hub-Signature-256`. |
| `ANTHROPIC_API_KEY` | `''` | console.anthropic.com → API Keys. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | |
| `DEMO_FEE_AMOUNT` | `0` | Rupees. `0` = free demo. Read at booking time, never hardcoded. |
| `WHATSAPP_BUSINESS_NUMBER` | `''` | Cosmetic only — what the conversation log displays as "our" number. Sends use `WHATSAPP_PHONE_NUMBER_ID`. |

`WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` already existed for the
outbound `whatsappService`.

## Request flow

```
Meta  ──POST /api/webhooks/whatsapp──►  whatsappWebhook.controller
                                          │
                    kill switch off? ─────┴─► 200, drop
                                          │
              X-Hub-Signature-256 bad? ───┴─► 403
                                          │
                                   parse body (whatsappInboundParser)
                                          │
                    insert WhatsAppWebhookEvent  ── duplicate? ─► skip
                                          │
                       ┌──────────────────┴─ 200 to Meta (immediately)
                       │
              handleInboundMessage()  (fire-and-forget)
                       │
                 find/create Enquiry (source: 'whatsapp')
                       │
                 load recent messages for context
                       │
                 getNextAdmissionsAction()  ──►  Anthropic
                       │
        ┌──────────────┼───────────────┬──────────────────┐
      reply     ask_demo_preference  book_demo        escalate
        │              │                │                 │
    send text      send text      createDemoBooking   flag Enquiry
                                   + stage change     requiresHumanFollowUp
                                   + admin alert      + admin WhatsApp alert
```

**Endpoints** (`routes/webhook.routes.ts`, mounted under `/api`):

- `GET /api/webhooks/whatsapp` — Meta's verification handshake.
- `POST /api/webhooks/whatsapp` — inbound messages and delivery statuses.

Neither uses `protect`. Meta calls them directly; the POST is authenticated by
HMAC signature instead of session/JWT, the same pattern as the Razorpay webhook.

Delivery/read status callbacks are logged and otherwise ignored — they are not
business events, and they must not trigger a notification or CRM write.

### Why Meta gets its 200 before the work happens

Meta treats a slow or non-200 response as a failure and redelivers. An AI call
plus DB writes is far too slow to hold the response open, and this codebase has
no queue to defer to, so processing is in-process fire-and-forget. There is no
HTTP response left to report an error to — failures are logged, and the Enquiry
is flagged for human follow-up inside the handler.

### Two layers of deduplication

1. **`WhatsAppWebhookEvent`** — a unique `waMessageId` row inserted *before* any
   processing. Meta redelivers on timeout, and a duplicate-key error here means
   "already handled": skip. No duplicate Enquiry, AI reply, or booking.
2. **`DemoBooking`** partial unique index on `{enquiryId, status: 'scheduled'}` —
   the last line of defence against two near-simultaneous deliveries racing past
   layer 1. A duplicate-key error is reported as
   `{ ok: false, reason: 'duplicate' }`, not a generic failure.

### The mongoSanitize gotcha

Meta's handshake requires the literal dotted params `hub.mode`,
`hub.verify_token`, `hub.challenge`. The app's global `express-mongo-sanitize()`
strips `.` from every query key on every route, which would silently break this
one handshake. `verifyWhatsAppWebhook` reads the raw query string off
`req.originalUrl` instead — sidestepping it without loosening sanitisation
anywhere else. Don't "simplify" that back to `req.query`.

Signature verification depends on `req.rawBody`, populated globally by the
`express.json({ verify })` hook in `app.ts` (originally added for Razorpay).
Re-serializing `req.body` would not byte-for-byte match what Meta signed.

## The AI layer

`services/aiAdmissionsService.ts` calls Anthropic with a structured-output
schema and returns a typed `AIAdmissionsResult`. It never throws and never
fabricates: every failure path — no API key, knowledge base won't load,
malformed or unparseable response — returns an **escalation** result with
`confidence: 0`.

- **Actions:** `reply`, `ask_demo_preference`, `book_demo`, `escalate`
- **Also extracted:** intent, language (`english` / `hindi` / `hinglish`),
  timeline, customer type, confidence

Course facts come from the live course catalogue rather than a hardcoded
prompt, so the agent can't quote a price or duration the CRM disagrees with.

**Escalation** sets `requiresHumanFollowUp` / `humanFollowUpReason` /
`humanFollowUpAt` on the Enquiry and sends an admin WhatsApp alert.
Deliberately WhatsApp-only, no email — escalations are more frequent than
bookings, and doubling them onto email would be notification fatigue for a
"come look at this" alert. A repeated low-confidence streak escalates on its
own, so the agent can't grind away at a conversation it isn't following.

## Data model

| Model | Purpose |
|---|---|
| `WhatsAppWebhookEvent` | Idempotency ledger, one row per `waMessageId`. |
| `WhatsAppMessage` | Conversation log, inbound and outbound, for AI context and audit. |
| `DemoBooking` | A booked demo. `feeAmount` is captured at booking time, so a later fee change can't retroactively alter what a customer was quoted. |

**`Enquiry` changes are purely additive** — no migration, nothing existing
touched:

- `'whatsapp'` added to `ENQUIRY_SOURCES`. JustDial and Google Ads leads both
  land on the same WhatsApp number with no distinguishing signal in the message,
  so they are *not* split into separate sources — that would fabricate
  attribution. Add per-channel pre-filled `wa.me` links first; `'whatsapp'`
  stays valid either way, so no migration is needed when that happens.
- `requiresHumanFollowUp`, `humanFollowUpReason`, `humanFollowUpAt` — all
  optional, and indexed.

Demo bookings append to `stageHistory` using the same pattern as
`moveEnquiryStage` in `enquiry.controller.ts`, so automated stage changes are
journalled identically to human-driven ones and can't drift apart.

## Not built yet

Read this before enabling.

1. **No admin or CRM surface reads any of this.** `DemoBooking`,
   `WhatsAppMessage`, and `WhatsAppWebhookEvent` are written and never read
   back — no routes, no controllers, no UI. Bookings and conversation threads
   exist only in Mongo, plus the one-shot WhatsApp/email alert.
2. **`requiresHumanFollowUp` has no queue.** The field is set and indexed for
   querying, but nothing filters on it. Escalations are written and then
   invisible. This is the biggest gap — an escalation nobody sees is a lost
   lead.
3. **Paid demos are half-wired.** `DEMO_FEE_AMOUNT > 0` sets
   `paymentStatus: 'pending'`, but nothing generates a payment link or ever
   moves it off pending. Harmless at the shipped default of `0`
   (`not_required`); broken the moment a fee is set. Wire Razorpay first.
4. **The webhook sits behind `apiLimiter`** (100 requests / 15 min per IP,
   applied to all of `/api` in `app.ts`). Meta delivers from a pool of IPs, but
   a busy period could still draw 429s — which Meta treats as failure and
   retries, potentially cascading. Consider exempting `/api/webhooks` before a
   high-volume launch. The Razorpay webhook carries the same pre-existing
   exposure.
5. **No frontend work exists** for any of this.

## Turning it on

Order matters — the handshake has to succeed before automation is enabled.

1. Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET`, leaving
   `WHATSAPP_AUTOMATION_ENABLED=false`. Deploy.
2. Register `https://<host>/api/webhooks/whatsapp` in the Meta App Dashboard and
   subscribe to `messages`. The GET handshake works with automation still off.
3. Set `ANTHROPIC_API_KEY`. Confirm `WHATSAPP_PHONE_NUMBER_ID` and
   `WHATSAPP_ACCESS_TOKEN` are already populated.
4. Address the escalation gap (#2 above), or agree on a manual routine for
   checking flagged enquiries, before real leads are exposed to it.
5. Flip `WHATSAPP_AUTOMATION_ENABLED=true` and restart. Message the business
   number from a personal phone and watch the logs (`[whatsapp]`,
   `[whatsapp-ai]`, `[demo-booking]`).

To roll back: set the flag to `false` and restart. Nothing else is required.

## Tests

`tests/whatsappWebhook.test.ts` and `tests/phoneNormalization.test.ts` cover the
verification handshake, signature rejection, the kill switch, redelivery
dedupe, and phone-format normalisation. `npm test` — 138 passing across 10
suites.

Not covered: a live Meta delivery, a real Anthropic call, or an end-to-end
booking. None of those can run without credentials.
