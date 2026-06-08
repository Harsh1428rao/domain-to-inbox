/**
 * Stage 4 — Brevo (formerly Sendinblue)
 * Input : array of Contact objects (with verified email)
 * Output: send results array
 *
 * Docs  : https://developers.brevo.com/reference/sendtransacemail
 * Auth  : api-key header via BREVO_API_KEY env var
 */

const { log } = require("../utils/logger");
const { sleep } = require("../utils/helpers");

const BASE_URL = "https://api.brevo.com/v3/smtp/email";
const REQUEST_DELAY_MS = 500; // Brevo is generous, but still be polite

/**
 * Sends personalized outreach emails to all valid contacts.
 *
 * @param {import('./03_eazyreach').Contact[]} contacts
 * @param {string} seedDomain  - used to personalize sender context
 * @returns {Promise<Array<{email: string, success: boolean, messageId?: string, error?: string}>>}
 */
async function sendOutreach(contacts, seedDomain) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set in .env");

  const senderName = process.env.SENDER_NAME || "Your Name";
  const senderEmail = process.env.SENDER_EMAIL;
  if (!senderEmail) throw new Error("SENDER_EMAIL is not set in .env");

  const results = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    log.step(`[${i + 1}/${contacts.length}] Sending to ${contact.email}...`);

    const result = await sendOne(contact, seedDomain, senderName, senderEmail, apiKey);
    results.push(result);

    if (result.success) log.info(`  ✓ Sent (ID: ${result.messageId})`);
    else log.warn(`  ✗ Failed: ${result.error}`);

    if (i < contacts.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  return results;
}

/**
 * Sends a single personalized email via Brevo transactional API.
 */
async function sendOne(contact, seedDomain, senderName, senderEmail, apiKey) {
  const { subject, htmlContent, textContent } = buildEmail(contact, seedDomain, senderName);

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: contact.email, name: `${contact.firstName} ${contact.lastName}`.trim() }],
        subject,
        htmlContent,
        textContent,
        tags: ["outreach-pipeline", seedDomain],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { email: contact.email, success: false, error: `HTTP ${response.status}: ${body}` };
    }

    const data = await response.json();
    return { email: contact.email, success: true, messageId: data.messageId };
  } catch (err) {
    return { email: contact.email, success: false, error: err.message };
  }
}

/**
 * Builds a personalized email for a contact.
 * Edit the copy here — this is the "yours to keep" creative part.
 */
function buildEmail(contact, seedDomain, senderName) {
  const firstName = contact.firstName || "there";
  const company = contact.company || contact.domain;
  const title = contact.title ? `, ${contact.title}` : "";

  const subject = `Quick question, ${firstName} — scaling ${company}'s pipeline?`;

  const textContent = `
Hi ${firstName},

I came across ${company} while researching companies in a similar space to ${seedDomain}, and your work stood out immediately.

I'm reaching out because we help companies like yours automate their go-to-market motions — specifically the sourcing-to-outreach workflow that usually eats 10+ hours a week from sales teams.

Most ${company}-sized teams we talk to are doing this manually. We've built tooling that collapses that whole loop — finding the right accounts, surfacing decision-makers, and reaching them with copy that actually converts — into a single automated pipeline.

Would a 20-minute call make sense this week? Happy to show you exactly what the workflow looks like and whether it maps to what you're building at ${company}.

Best,
${senderName}

P.S. No decks, no demos unless you want one — just a conversation.
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; font-size: 16px; color: #1a1a1a; line-height: 1.7; max-width: 560px; margin: 0 auto; padding: 24px; }
    p { margin: 0 0 16px; }
    .sig { margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 16px; font-size: 14px; color: #555; }
    .ps { font-size: 14px; color: #666; margin-top: 12px; font-style: italic; }
  </style>
</head>
<body>
  <p>Hi ${firstName},</p>

  <p>I came across <strong>${company}</strong> while researching companies in a similar space to ${seedDomain}, and your work stood out immediately.</p>

  <p>I'm reaching out because we help companies like yours automate their go-to-market motions — specifically the sourcing-to-outreach workflow that usually eats 10+ hours a week from sales teams.</p>

  <p>Most ${company}-sized teams we talk to are doing this manually. We've built tooling that collapses that whole loop — finding the right accounts, surfacing decision-makers, and reaching them with copy that actually converts — into a single automated pipeline.</p>

  <p>Would a <strong>20-minute call</strong> make sense this week? Happy to show you exactly what the workflow looks like and whether it maps to what you're building at ${company}.</p>

  <div class="sig">
    Best,<br>
    <strong>${senderName}</strong>
  </div>

  <p class="ps">P.S. No decks, no demos unless you want one — just a conversation.</p>
</body>
</html>
`.trim();

  return { subject, htmlContent, textContent };
}

module.exports = { sendOutreach };
