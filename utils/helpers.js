/**
 * Shared helpers
 */

/** Pause execution for ms milliseconds */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Split an array into chunks of size n */
function chunkArray(arr, n) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
  return chunks;
}

/** Basic domain validation */
function validateDomain(domain) {
  // Must look like something.tld — no protocol, no path required
  return /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(domain);
}

module.exports = { sleep, chunkArray, validateDomain };
