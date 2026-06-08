/**
 * Logger — coloured terminal output
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const WHITE = "\x1b[37m";

const log = {
  info: (msg) => console.log(`${CYAN}ℹ${RESET}  ${msg}`),
  success: (msg) => console.log(`${GREEN}${BOLD}✓${RESET}  ${msg}`),
  warn: (msg) => console.log(`${YELLOW}⚠${RESET}  ${msg}`),
  error: (msg) => console.error(`${RED}${BOLD}✗  ${msg}${RESET}`),
  step: (msg) => console.log(`${DIM}→${RESET}  ${msg}`),
  item: (msg) => console.log(`${DIM}${msg}${RESET}`),
};

function logSection(tag, title) {
  const bar = "─".repeat(58);
  console.log(`\n${BLUE}${BOLD}${bar}${RESET}`);
  console.log(`${BLUE}${BOLD}  ${tag}${RESET}  ${WHITE}${BOLD}${title}${RESET}`);
  console.log(`${BLUE}${BOLD}${bar}${RESET}\n`);
}

function logSummary(seedDomain, domains, contacts) {
  console.log(`
  Seed domain   : ${BOLD}${seedDomain}${RESET}
  Lookalikes    : ${domains.length} companies
  Contacts      : ${contacts.length} decision-makers with verified emails
  `);

  console.log(`  ${BOLD}Contacts to be emailed:${RESET}`);
  contacts.forEach((c, i) => {
    console.log(`    ${i + 1}. ${c.firstName} ${c.lastName} — ${c.title} @ ${c.company}`);
    console.log(`       ${CYAN}${c.email}${RESET}`);
  });
}

module.exports = { log, logSection, logSummary };
