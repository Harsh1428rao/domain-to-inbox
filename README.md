# Automated Cold-Outreach Pipeline

```
One domain in → Lookalikes → Decision-makers → Emails resolved → Outreach sent
    (you)       Ocean.io       Prospeo          Eazyreach          Brevo
```

Zero humans in the loop after the first keypress.

---

## Prerequisites

- Node.js ≥ 18 (`node -v` to check)
- Accounts on: Ocean.io · Prospeo · Eazyreach · Brevo
- A company domain + verified sender email on Brevo

---

## Setup (5 minutes)

### 1 · Clone / download the project

```bash
git clone <your-repo-url>
cd outreach-pipeline
```

### 2 · Install dependencies

```bash
npm install
```

### 3 · Copy and fill in your `.env`

```bash
cp .env.example .env
# Open .env in your editor and fill in all API keys
```

| Variable | Where to find it |
|---|---|
| `OCEAN_API_KEY` | ocean.io → Settings → API |
| `PROSPEO_API_KEY` | app.prospeo.io/api → Your API Key |
| `EAZYREACH_API_KEY` | eazyreach.app → Settings → API Token |
| `BREVO_API_KEY` | app.brevo.com → Settings → API Keys → Create |
| `SENDER_EMAIL` | Must be a **verified sender** in Brevo |
| `SENDER_NAME` | Your name as it appears in outgoing emails |

### 4 · Verify your Brevo sender

In Brevo → Senders & IPs → add and verify `you@yourdomain.com`.  
Without this, Brevo will reject every send.

---

## Running the Pipeline

```bash
# Interactive — prompts you for the seed domain
node pipeline.js

# Direct — pass the domain as an argument
node pipeline.js stripe.com
```

### What happens, step by step:

```
1. You type:  stripe.com
              ↓
2. Ocean.io   → finds 10 similar companies → [acme.com, beta.io, ...]
              ↓
3. Prospeo    → finds C-suite / VP per company → [John CEO, Jane VP Sales, ...]
              ↓
4. Eazyreach  → resolves LinkedIn URLs → verified work emails
              ↓
5. ⚠ CHECKPOINT — shows you a summary. You type "yes" to proceed.
              ↓
6. Brevo      → fires personalized emails to each contact
              ↓
7. Done. Results printed to terminal.
```

---

## Project Structure

```
outreach-pipeline/
├── pipeline.js          ← Entry point — orchestrates all 4 stages
├── stages/
│   ├── 01_ocean.js      ← Stage 1: Ocean.io lookalike search
│   ├── 02_prospeo.js    ← Stage 2: Prospeo decision-maker lookup
│   ├── 03_eazyreach.js  ← Stage 3: Eazyreach email resolution
│   └── 04_brevo.js      ← Stage 4: Brevo transactional send
├── utils/
│   ├── logger.js        ← Coloured terminal output
│   └── helpers.js       ← sleep(), chunkArray(), validateDomain()
├── .env.example         ← Copy this to .env and fill in keys
├── package.json
└── README.md
```

---

## Tuning

Edit `.env` to change behaviour without touching code:

| Variable | Default | Effect |
|---|---|---|
| `OCEAN_MAX_LOOKALIKES` | 10 | How many similar companies to find |
| `PROSPEO_MAX_PER_DOMAIN` | 3 | Max decision-makers per company |

---

## Edge Cases Handled

| Scenario | Behaviour |
|---|---|
| API rate limit (429) | Automatic retry with back-off |
| Domain returns no contacts | Skipped with warning, pipeline continues |
| Email not resolved | Contact excluded from send list |
| Network error on one contact | Logged and skipped; others still send |
| User declines at checkpoint | Pipeline exits cleanly, zero emails sent |

---

## Customising the Email Copy

Open `stages/04_brevo.js` → `buildEmail()` function.  
Edit `subject`, `textContent`, and `htmlContent`.  
The template already injects `firstName`, `company`, and `seedDomain` dynamically.

---

## Common Errors

**"OCEAN_API_KEY is not set"** — you forgot to copy `.env.example` to `.env` or left a key blank.

**Brevo 400 "Sender not found"** — verify your sender email in Brevo's dashboard first.

**Eazyreach returns no emails** — check your credit balance in the Eazyreach dashboard.

**Prospeo returns empty array** — the domain may be too small to be indexed; the pipeline skips it gracefully.
