import crypto from "node:crypto";
import { Resend } from "resend";

const to = "brainok777@gmail.com";
const from = process.env.RESEND_FROM_EMAIL || "Brainok Licensing <licenses@brainok.net>";
const replyTo = process.env.RESEND_REPLY_TO_EMAIL || "brainok777@gmail.com";
const apiKey = process.env.RESEND_API_KEY;

function testLicenseCode() {
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `BRAINOK-TEST-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

if (!apiKey) {
  console.error("RESEND_API_KEY is required. Use an environment variable or Firebase Functions secret for deployed functions.");
  process.exit(1);
}

const licenseCode = testLicenseCode();
const subject = "Brainok Store test license email";
const text = [
  "Hello,",
  "",
  "Thank you for supporting Brainok.",
  "Your activation code:",
  licenseCode,
  "",
  "Plan: personal",
  "Device limit: 3",
  "",
  "This is a safe test email sent only to brainok777@gmail.com.",
  `Support: ${replyTo}`
].join("\n");
const html = [
  "<p>Hello,</p>",
  "<p>Thank you for supporting Brainok.</p>",
  "<h1>Brainok test license</h1>",
  "<p><strong>Your activation code:</strong></p>",
  `<p><code>${licenseCode}</code></p>`,
  "<ul>",
  "<li>Plan: personal</li>",
  "<li>Device limit: 3</li>",
  "<li>This is a safe test email sent only to brainok777@gmail.com.</li>",
  "</ul>"
].join("");

const resend = new Resend(apiKey);
const result = await resend.emails.send({
  from,
  to: [to],
  replyTo,
  subject,
  text,
  html
});

if (result.error) {
  console.error(result.error.message || "Resend could not send the test email.");
  process.exit(1);
}

console.log(`Sent ${licenseCode} to ${to}. Message id: ${result.data?.id || "unknown"}`);
