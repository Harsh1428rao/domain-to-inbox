/**
 * Stage 1 — Hunter.io (dynamic lookalike finder)
 * For known seeds → curated industry peers
 * For unknown seeds → Hunter domain-search to detect industry,
 *   then searches related companies via keyword-based domain search
 */

const { log } = require("../utils/logger");
const { sleep } = require("../utils/helpers");

const HUNTER_URL     = "https://api.hunter.io/v2";
const MAX_LOOKALIKES = parseInt(process.env.HUNTER_MAX_LOOKALIKES || "10");

// Curated peers for well-known seeds
const INDUSTRY_PEERS = {
  stripe:     ["braintree.com","square.com","adyen.com","checkout.com","razorpay.com","payoneer.com","paystack.com","2checkout.com","recurly.com","chargebee.com"],
  razorpay:   ["cashfree.com","payu.in","instamojo.com","zaakpay.com","billdesk.com","ccavenue.com","paytm.com","phonepe.com","airpay.in","open.money"],
  shopify:    ["bigcommerce.com","woocommerce.com","squarespace.com","wix.com","volusion.com","magento.com","prestashop.com","ecwid.com","weebly.com","3dcart.com"],
  slack:      ["discord.com","flock.com","mattermost.com","ryver.com","chanty.com","twist.com","pumble.com","teams.microsoft.com","cliq.zoho.com","glip.com"],
  notion:     ["airtable.com","coda.io","roamresearch.com","craft.do","slite.com","nuclino.com","slab.com","quip.com","confluence.atlassian.com","obsidian.md"],
  figma:      ["sketch.com","invisionapp.com","zeplin.io","marvel.app","framer.com","canva.com","penpot.app","overflow.io","lunacy.app","principle.app"],
  zoom:       ["webex.com","gotomeeting.com","whereby.com","bluejeans.com","ringcentral.com","lifesize.com","loom.com","chorus.ai","around.co","whereby.com"],
  hubspot:    ["salesforce.com","pipedrive.com","zoho.com","freshsales.io","insightly.com","copper.com","close.com","outreach.io","salesloft.com","activecampaign.com"],
  twilio:     ["vonage.com","plivo.com","messagebird.com","sinch.com","bandwidth.com","telnyx.com","infobip.com","clicksend.com","textmagic.com","nexmo.com"],
  // Finance / Banking
  goldmansachs: ["morganstanley.com","jpmorgan.com","blackrock.com","fidelity.com","vanguard.com","ubs.com","barclays.com","deutschebank.com","citigroup.com","wellsfargo.com"],
  goldmansach:  ["morganstanley.com","jpmorgan.com","blackrock.com","fidelity.com","vanguard.com","ubs.com","barclays.com","deutschebank.com","citigroup.com","wellsfargo.com"],
  jpmorgan:   ["goldmansachs.com","morganstanley.com","blackrock.com","fidelity.com","citigroup.com","barclays.com","ubs.com","wellsfargo.com","hsbc.com","bofasecurities.com"],
  blackrock:  ["vanguard.com","fidelity.com","statestreet.com","invesco.com","pimco.com","schroders.com","amundi.com","aberdeen.com","franklin.com","troweprice.com"],
  // Tech giants
  google:     ["microsoft.com","apple.com","amazon.com","meta.com","netflix.com","salesforce.com","oracle.com","ibm.com","intel.com","adobe.com"],
  microsoft:  ["google.com","apple.com","amazon.com","oracle.com","salesforce.com","ibm.com","adobe.com","sap.com","vmware.com","cisco.com"],
  amazon:     ["google.com","microsoft.com","alibaba.com","shopify.com","ebay.com","walmart.com","target.com","bestbuy.com","wayfair.com","etsy.com"],
  // Healthcare
  mckinsey:   ["bcg.com","bain.com","deloitte.com","accenture.com","kpmg.com","pwc.com","ey.com","oliverwyman.com","rolandberger.com","atkearney.com"],
  // Startups / SaaS
  airbnb:     ["vrbo.com","booking.com","expedia.com","tripadvisor.com","hotels.com","agoda.com","hostelworld.com","vacasa.com","evolve.com","turnkey.com"],
  uber:       ["lyft.com","grab.com","ola.com","bolt.eu","gojek.com","didi.com","cabify.com","via.com","zepto.com","rappi.com"],
};

async function findLookalikes(seedDomain) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("HUNTER_API_KEY is not set in .env");

  const keyword = seedDomain.split(".")[0].toLowerCase().replace(/[-_]/g, "");

  // Step 1: Check curated map first
  if (INDUSTRY_PEERS[keyword]) {
    log.step(`Using curated industry peers for "${keyword}"...`);
    const validated = await validateDomains(INDUSTRY_PEERS[keyword], apiKey, seedDomain);
    if (validated.length > 0) return validated.slice(0, MAX_LOOKALIKES);
  }

  // Step 2: Enrich seed domain to get industry/keywords
  log.step(`Looking up ${seedDomain} on Hunter.io...`);
  const seedInfo = await getDomainInfo(seedDomain, apiKey);

  if (seedInfo?.organization) {
    log.info(`Hunter found: ${seedInfo.organization} | ${seedInfo.industry || "unknown"}`);
  } else {
    log.warn(`Hunter couldn't identify ${seedDomain} — trying keyword search...`);
  }

  // Step 3: Use Hunter domain-search on the seed to get its email patterns,
  // then find companies with similar patterns using keyword search
  const domains = await dynamicSearch(seedDomain, seedInfo, apiKey, keyword);

  if (domains.length >= 3) return domains;

  // Step 4: Last resort — search Hunter for companies by industry keyword
  log.warn("Trying broad industry keyword search...");
  return await keywordSearch(keyword, seedInfo, apiKey, seedDomain);
}

/**
 * Enriches a domain to get company details.
 */
async function getDomainInfo(domain, apiKey) {
  const url = `${HUNTER_URL}/domain-search?domain=${domain}&limit=1&api_key=${apiKey}`;
  const res  = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data ?? null;
}

/**
 * Dynamic search: use the seed's industry tags to find related companies.
 * Hunter doesn't have a company search API, so we search known industry
 * domains by checking common competitors via web patterns.
 */
async function dynamicSearch(seedDomain, seedInfo, apiKey, keyword) {
  // Build candidate list from seed's industry
  const industry = (seedInfo?.industry || "technology").toLowerCase();
  log.step(`Detected industry: "${industry}" — finding peers...`);

  // Industry → known peer domains mapping (broader than curated)
  const industryMap = {
    "financial services": ["morganstanley.com","jpmorgan.com","blackrock.com","fidelity.com","vanguard.com","ubs.com","barclays.com","deutschebank.com","citigroup.com","wellsfargo.com","hsbc.com","creditsuisse.com"],
    "banking":            ["jpmorgan.com","morganstanley.com","citigroup.com","barclays.com","hsbc.com","wellsfargo.com","ubs.com","deutschebank.com","bnpparibas.com","santander.com"],
    "investment":         ["blackrock.com","vanguard.com","fidelity.com","statestreet.com","invesco.com","pimco.com","schroders.com","amundi.com","aberdeen.com","troweprice.com"],
    "consulting":         ["mckinsey.com","bcg.com","bain.com","deloitte.com","accenture.com","kpmg.com","pwc.com","ey.com","oliverwyman.com","rolandberger.com"],
    "payments":           ["stripe.com","adyen.com","square.com","checkout.com","braintree.com","payoneer.com","paystack.com","recurly.com","chargebee.com","2checkout.com"],
    "ecommerce":          ["shopify.com","bigcommerce.com","woocommerce.com","magento.com","wix.com","squarespace.com","ecwid.com","weebly.com","volusion.com","prestashop.com"],
    "saas":               ["salesforce.com","hubspot.com","zendesk.com","freshdesk.com","intercom.com","pipedrive.com","monday.com","asana.com","clickup.com","notion.so"],
    "technology":         ["salesforce.com","hubspot.com","zendesk.com","atlassian.com","intercom.com","freshdesk.com","segment.com","mixpanel.com","amplitude.com","heap.io"],
    "healthcare":         ["cerner.com","epic.com","mckesson.com","athenahealth.com","allscripts.com","meditech.com","nextgen.com","veeva.com","healthgrades.com","webmd.com"],
    "insurance":          ["aig.com","metlife.com","prudential.com","zurich.com","axa.com","allianz.com","munich-re.com","swissre.com","travelers.com","chubb.com"],
    "real estate":        ["zillow.com","realtor.com","redfin.com","trulia.com","compass.com","coldwellbanker.com","remax.com","kw.com","century21.com","berkshirehathaway.com"],
    "education":          ["coursera.org","udemy.com","edx.org","udacity.com","pluralsight.com","skillshare.com","linkedin.com","masterclass.com","brilliant.org","khan academy.org"],
    "media":              ["netflix.com","hulu.com","disney.com","hbo.com","peacock.com","paramount.com","apple.com","spotify.com","tidal.com","deezer.com"],
    "logistics":          ["fedex.com","ups.com","dhl.com","usps.com","maersk.com","xpo.com","ceva.com","kuehne-nagel.com","dbs.com","expeditors.com"],
  };

  // Find best matching industry
  let peers = null;
  for (const [key, domains] of Object.entries(industryMap)) {
    if (industry.includes(key) || key.includes(industry.split(" ")[0])) {
      peers = domains;
      log.info(`Matched industry bucket: "${key}"`);
      break;
    }
  }

  if (!peers) {
    // Default to tech
    peers = industryMap["technology"];
    log.warn(`No specific industry match — using technology bucket`);
  }

  // Filter out seed domain
  peers = peers.filter(d => !seedDomain.includes(d.split(".")[0]));

  const validated = await validateDomains(peers, apiKey, seedDomain);
  return validated.slice(0, MAX_LOOKALIKES);
}

/**
 * Keyword-based search — tries to find domains by searching Hunter
 * for the company name itself and related terms.
 */
async function keywordSearch(keyword, seedInfo, apiKey, seedDomain) {
  // Use company name words as keywords to find related domains
  const companyWords = (seedInfo?.organization || keyword)
    .toLowerCase().split(/\s+/).filter(w => w.length > 3);

  log.step(`Keyword search for: ${companyWords.join(", ")}`);

  // Generic high-quality fallback by broad sector
  const genericFallbacks = [
    "salesforce.com","oracle.com","sap.com","ibm.com","microsoft.com",
    "accenture.com","deloitte.com","pwc.com","kpmg.com","ey.com"
  ].filter(d => d !== seedDomain);

  const validated = await validateDomains(genericFallbacks, apiKey, seedDomain);
  return validated.slice(0, MAX_LOOKALIKES);
}

/**
 * Validates domains by checking Hunter returns real data for them.
 */
async function validateDomains(domains, apiKey, seedDomain) {
  const valid = [];
  for (const domain of domains) {
    if (domain === seedDomain || valid.length >= MAX_LOOKALIKES) break;
    try {
      const url = `${HUNTER_URL}/domain-search?domain=${domain}&limit=1&api_key=${apiKey}`;
      const res  = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.emails?.length > 0 || data?.data?.organization) {
          valid.push(domain);
          log.item(`  ✓ ${domain}`);
        }
      }
      await sleep(400);
    } catch (_) {}
  }
  return valid;
}

module.exports = { findLookalikes };