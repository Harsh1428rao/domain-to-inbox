/**
 * Stage 2 — Hunter.io only (replaces Prospeo completely)
 * Uses Hunter domain-search to get people + emails in one call.
 * No Prospeo needed at all.
 */

const { log } = require("../utils/logger");
const { sleep } = require("../utils/helpers");

const HUNTER_URL = "https://api.hunter.io/v2";
const MAX_PER_DOMAIN = parseInt(process.env.PROSPEO_MAX_PER_DOMAIN || "3");

async function findDecisionMakers(domains) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("HUNTER_API_KEY is not set in .env");

  const allProspects = [];

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    log.step(`[${i + 1}/${domains.length}] Hunter lookup → ${domain}`);

    try {
      const prospects = await searchDomain(domain, apiKey);
      log.info(`  → ${prospects.length} people found with emails`);
      prospects.forEach(p => log.item(`    • ${p.firstName} ${p.lastName} — ${p.title} | ${p.email}`));
      allProspects.push(...prospects);
    } catch (err) {
      log.warn(`  ✗ Skipping ${domain}: ${err.message}`);
    }

    if (i < domains.length - 1) await sleep(1500);
  }

  const seen = new Set();
  return allProspects.filter((p) => {
    if (seen.has(p.email)) return false;
    seen.add(p.email);
    return true;
  });
}

async function searchDomain(domain, apiKey) {
  const url = `${HUNTER_URL}/domain-search?domain=${domain}&limit=10&api_key=${apiKey}`;
  const response = await fetch(url);

  if (response.status === 429) {
    log.warn("  Hunter rate limit — waiting 10s...");
    await sleep(10000);
    return searchDomain(domain, apiKey);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  const data    = await response.json();
  const emails  = data?.data?.emails ?? [];
  const orgName = data?.data?.organization || domain;

  // Filter for decision makers: department or seniority signals
  const decisionMakers = emails.filter(e =>
    !e.department || ["executive", "management", "it", "finance", "sales", "marketing"].includes(e.department?.toLowerCase())
  );

  return decisionMakers.slice(0, MAX_PER_DOMAIN).map(e => ({
    firstName:   e.first_name || "",
    lastName:    e.last_name  || "",
    title:       e.position   || e.department || "",
    company:     orgName,
    domain,
    linkedinUrl: e.linkedin   || "",
    email:       e.value      || null,
    emailStatus: e.confidence >= 70 ? "valid" : "catch-all",
  })).filter(p => p.email);
}

module.exports = { findDecisionMakers };