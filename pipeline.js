#!/usr/bin/env node

/**
 * Automated Cold-Outreach Pipeline
 * Input : one seed domain
 * Output: personalized emails sent
 *
 * Stages: Apollo.io → Prospeo (people + emails) → Brevo
 * Note  : Eazyreach removed — Prospeo returns emails directly.
 */

const readline = require("readline");
const { findLookalikes }      = require("./stages/01_ocean");       // Apollo.io
const { findDecisionMakers }  = require("./stages/02_prospeo");     // Prospeo
const { sendOutreach }        = require("./stages/04_brevo");       // Brevo
const { log, logSection, logSummary } = require("./utils/logger");
const { validateDomain }      = require("./utils/helpers");
require("dotenv").config();

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function run() {
  console.clear();
  console.log(`
╔══════════════════════════════════════════════════════════╗
║        AUTOMATED COLD-OUTREACH PIPELINE  v3.0           ║
║        Apollo.io → Prospeo → Brevo                      ║
╚══════════════════════════════════════════════════════════╝
`);

  // ── STEP 0: Seed domain ───────────────────────────────────────────────────
  let seedDomain = process.argv[2];
  if (!seedDomain) {
    seedDomain = await ask("🌱  Enter seed company domain (e.g. razorpay.com): ");
  }
  seedDomain = seedDomain.trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!validateDomain(seedDomain)) {
    log.error(`"${seedDomain}" doesn't look like a valid domain.`);
    process.exit(1);
  }

  log.info(`Seed domain locked: ${seedDomain}`);
  console.log();

  // ── STAGE 1: Apollo.io — Lookalike companies ──────────────────────────────
  logSection("STAGE 1 / 3", "Finding lookalike companies via Apollo.io");
  let lookalikeDomains = [];
  try {
    lookalikeDomains = await findLookalikes(seedDomain);
    log.success(`Found ${lookalikeDomains.length} lookalike companies`);
    lookalikeDomains.forEach((d, i) => log.item(`  ${i + 1}. ${d}`));
  } catch (err) {
    log.error(`Apollo stage failed: ${err.message}`);
    process.exit(1);
  }

  if (lookalikeDomains.length === 0) {
    log.warn("No lookalike companies found. Exiting.");
    process.exit(0);
  }
  console.log();

  // ── STAGE 2: Prospeo — Decision-makers + emails ───────────────────────────
  logSection("STAGE 2 / 3", "Finding decision-makers + emails via Prospeo");
  let prospects = [];
  try {
    prospects = await findDecisionMakers(lookalikeDomains);
    log.success(`Found ${prospects.length} decision-makers`);
    prospects.forEach((p) =>
      log.item(`  • ${p.firstName} ${p.lastName} — ${p.title} @ ${p.company} | ${p.email || "no email"}`)
    );
  } catch (err) {
    log.error(`Prospeo stage failed: ${err.message}`);
    process.exit(1);
  }

  // Filter to only contacts with a valid email
  const validContacts = prospects.filter((p) => p.email);

  if (validContacts.length === 0) {
    log.warn("No contacts with emails found. Exiting.");
    process.exit(0);
  }
  console.log();

  // ── SAFETY CHECKPOINT ─────────────────────────────────────────────────────
  logSection("⚠️  SAFETY CHECKPOINT", "Review before emails fire");
  logSummary(seedDomain, lookalikeDomains, validContacts);

  const confirm = await ask(
    `\n🚦  Send outreach to ${validContacts.length} contacts? [yes/no]: `
  );
  if (!["yes", "y"].includes(confirm.trim().toLowerCase())) {
    log.warn("Aborted by user. No emails sent.");
    rl.close();
    process.exit(0);
  }
  console.log();

  // ── STAGE 3: Brevo — Send outreach ────────────────────────────────────────
  logSection("STAGE 3 / 3", "Sending personalized outreach via Brevo");
  try {
    const results = await sendOutreach(validContacts, seedDomain);
    const sent    = results.filter((r) => r.success).length;
    const failed  = results.filter((r) => !r.success).length;
    log.success(`Emails sent: ${sent} ✓   Failed: ${failed} ✗`);
    results.forEach((r) => {
      if (r.success) log.item(`  ✓ ${r.email}`);
      else           log.warn(`  ✗ ${r.email} — ${r.error}`);
    });
  } catch (err) {
    log.error(`Brevo stage failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║                  PIPELINE COMPLETE  🎉                  ║
╚══════════════════════════════════════════════════════════╝
`);
  rl.close();
}

run().catch((err) => {
  log.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
