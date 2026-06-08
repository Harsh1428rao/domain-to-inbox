# domain-to-inbox

```
One domain in → Lookalikes → Decision-makers + Emails → Outreach sent
    (you)        Hunter.io        Hunter.io               Brevo
```

> Type a domain. Walk away. 25 personalized cold emails sent to CEOs, VPs, and Directors — fully automated.

---

## How it works

| Stage | Tool | What it does |
|---|---|---|
| 1 · Lookalike Discovery | Hunter.io | Finds 10 companies similar to your seed domain |
| 2 · People + Emails | Hunter.io | Finds decision-makers with verified work emails |
| ⚠ Checkpoint | You | Review contact list before anything fires |
| 3 · Outreach | Brevo | Sends personalized HTML email to each contact |

Zero manual steps after the first keypress.

---

## Prerequisites

- Node.js ≥ 18 (`node -v` to check)
- Free accounts on: **Hunter.io** · **Brevo**
- A company domain + verified sender email in Brevo

---

## Setup

### 1 · Clone the repo

```bash
git clone https://github.com/Harsh1428rao/domain-to-inbox.git
cd domain-to-inbox
```

### 2 · Install dependencies

```bash
npm install
```

### 3 · Configure your `.env`

```bash
cp .env.example .env
# Open .env and fill in your keys
```

| Variable | Where to find it |
|---|---|
| `HUNTER_API_KEY` | hunter.io → Dashboard → API |
| `PROSPEO_API_KEY` | app.prospeo.io/api → Your API Key (kept for fallback) |
| `BREVO_API_KEY` | app.brevo.com → Settings → API Keys → Create |
| `SENDER_EMAIL` | Must be a **verified sender** in Brevo |
| `SENDER_NAME` | Your name as it appears in outgoing emails |

### 4 · Verify your Brevo sender

Brevo → Senders & IPs → Add `you@yourdomain.com` → click the verification link.
Without this, Stage 3 will fail.

---

## Run

```bash
# Interactive — prompts you for the seed domain
node pipeline.js

# Direct — pass domain as argument
node pipeline.js stripe.com
```

### What happens step by step

```
1. You type:   stripe.com
               ↓
2. Hunter.io   → detects industry → validates 10 lookalike company domains
               ↓
3. Hunter.io   → finds decision-makers + verified emails per domain
               → [Lisha Wang CEO @ checkout.com, Amandine COO @ paystack.com ...]
               ↓
4. ⚠ CHECKPOINT — shows full contact list. You type "yes" to proceed.
               ↓
5. Brevo       → fires personalized HTML email to each contact
               ↓
6. Done. Results printed. 25 sent ✓  4 skipped ✗ (generic emails with no name)
```

---

## Project Structure

```
domain-to-inbox/
├── pipeline.js           ← Entry point — orchestrates all 3 stages
├── stages/
│   ├── 01_ocean.js       ← Stage 1: Hunter.io lookalike discovery
│   ├── 02_prospeo.js     ← Stage 2: Hunter.io people + email finder
│   └── 04_brevo.js       ← Stage 3: Brevo personalized send
├── utils/
│   ├── logger.js         ← Coloured terminal output
│   └── helpers.js        ← sleep(), validateDomain()
├── .env.example          ← Copy to .env and fill in keys
├── package.json
└── README.md
```

---

## Tuning

Edit `.env` to change behaviour without touching code:

| Variable | Default | Effect |
|---|---|---|
| `HUNTER_MAX_LOOKALIKES` | 10 | How many lookalike companies to find |
| `PROSPEO_MAX_PER_DOMAIN` | 2 | Max people to pull per domain |

---

## Edge Cases Handled

| Scenario | Behaviour |
|---|---|
| API rate limit (429) | Retries once after delay, then skips domain |
| Domain returns no emails | Skipped with warning, pipeline continues |
| Generic role email (no name) | Excluded from send — Brevo requires a name |
| Network error on one contact | Logged and skipped; others still send |
| User declines at checkpoint | Pipeline exits cleanly, zero emails sent |
| Duplicate emails across domains | Deduplicated — each address sent to exactly once |

---

## Customising the Email Copy

Open `stages/04_brevo.js` → `buildEmail()` function.
Edit `subject`, `htmlContent`, and `textContent`.
The template already injects `firstName`, `company`, and `seedDomain` dynamically.

---

## Tool Choices

The original assignment specified Ocean.io → Prospeo → Eazyreach → Brevo.
Three tools were replaced during implementation:

| Assigned | Replaced with | Reason |
|---|---|---|
| Ocean.io | Hunter.io | Ocean.io rejected new domains as disposable; free API returns 403 on all endpoints |
| Prospeo | Hunter.io | New API (March 2025) broke existing calls; free plan rate limits too strict |
| Eazyreach | Removed | VocaLabs officially told candidates to skip it — Prospeo handles emails directly |
| Brevo | Brevo ✓ | Kept — works perfectly |

Hunter.io's `/domain-search` endpoint returns company info + verified employee emails in one call, making it a natural replacement for all three discovery/enrichment stages.

---

## Common Errors

**"HUNTER_API_KEY is not set"** — copy `.env.example` to `.env` and fill in your key.

**Brevo 400 "Sender not found"** — verify your sender email in Brevo's dashboard first.

**Stage 1 returns generic SaaS companies** — your seed domain wasn't recognized. Add it to the `INDUSTRY_PEERS` map in `stages/01_ocean.js` for accurate results.

**0 emails found in Stage 2** — Hunter's free plan has 25 searches/month. Check your usage at hunter.io → Dashboard.
