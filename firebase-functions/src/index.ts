import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import {
  DocumentSnapshot,
  FieldValue,
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  onRequest
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const region = process.env.FUNCTION_REGION || "asia-northeast3";
const qnaSmtpPassword = defineSecret("QNA_SMTP_PASSWORD");
const resendApiKey = defineSecret("RESEND_API_KEY");
const adminEmail = "brainok777@gmail.com";
const defaultLicenseFromEmail = "Brainok Licensing <licenses@brainok.net>";

type InviteBenefit = "beta_access";
type AccountRole = "admin" | "user";
type AppRole = "owner" | "admin" | "user";
type AppVisibility = "public" | "private";
type AppType = "application" | "web_app";
type AppPricingMode = "invite_only" | "free" | "paid";
type AppBillingInterval = "one_time" | "monthly" | "yearly" | "pay_what_you_want";
type ActivationStatus = "not_found" | "trial" | "active" | "expired" | "revoked";
type BrainokLicensePlan = "personal" | "pro" | "lab" | "friend";
type BrainokLicenseStatus = "active" | "disabled" | "expired";
type ResendMailType =
  | "license_delivery"
  | "license_resend"
  | "license_test"
  | "license_request"
  | "app_announcement";
type PaymentProviderId = "manual" | "toss" | "legacy_external";
type PaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "paid_needs_license"
  | "refunded"
  | "partially_refunded"
  | "failed"
  | "cancelled";

interface PaymentProvider {
  id: PaymentProviderId;
  displayName: string;
  supportsCheckout: boolean;
  supportsWebhooks: boolean;
}

const paymentProviders: Record<PaymentProviderId, PaymentProvider> = {
  manual: {
    id: "manual",
    displayName: "Manual",
    supportsCheckout: false,
    supportsWebhooks: false
  },
  toss: {
    id: "toss",
    displayName: "Toss Payments",
    supportsCheckout: false,
    supportsWebhooks: true
  },
  legacy_external: {
    id: "legacy_external",
    displayName: "Legacy payment import",
    supportsCheckout: false,
    supportsWebhooks: false
  }
};

const trialLengthMs = 30 * 24 * 60 * 60 * 1000;

const defaultSiteSettings = {
  brandName: "Brainok App",
  brandInitial: "B",
  heroEyebrow: "Trial-first desktop software",
  heroTitle: "Useful desktop tools, released like real products.",
  heroDescription:
    "Publish apps with thumbnails, demos, installers, and universal Brainok licenses in one place. Every app can start with a 30-day trial.",
  primaryCtaLabel: "Free Download",
  secondaryCtaLabel: "View Apps",
  downloadTitle: "Download Brainok App",
  downloadSubtitle: "Free download. No account required.",
  downloadBody: "Choose the installer for your operating system. The desktop app starts a 30-day trial and accepts a Brainok License inside the app.",
  supportResources: [
    {
      id: "tutorials",
      title: "Tutorials",
      description: "Follow along, step by step",
      url: ""
    },
    {
      id: "help-center",
      title: "Help Center",
      description: "Find answers fast",
      url: ""
    },
    {
      id: "software-keys",
      title: "Software Keys",
      description: "Find your activation key",
      url: ""
    }
  ]
};

function requireUid(request: { auth?: { uid?: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }
  return uid;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const raw = asString(value);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function optionalUrl(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported URL protocol.");
    }

    return url.toString();
  } catch {
    throw new HttpsError("invalid-argument", "Use a valid http or https URL.");
  }
}

function normalizeCurrency(value: unknown, fallback = "USD"): string {
  const raw = asString(value) || fallback;
  return raw.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || fallback;
}

function normalizePriceCents(value: unknown): number {
  const price = asNumber(value) ?? 0;
  return Math.max(0, Math.round(price));
}

function emailLower(email: string | null | undefined): string | null {
  return email ? email.trim().toLowerCase() : null;
}

function profileEmailLower(profile: Record<string, unknown>): string | null {
  return emailLower(asString(profile.emailLower) || asString(profile.email));
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "app";
}

function compactMap(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

function boundedString(value: unknown, fallback: string, maxLength = 500): string {
  const raw = asString(value) ?? fallback;
  return raw.slice(0, maxLength);
}

function textField(value: unknown, fallback: string, maxLength = 500): string {
  if (value === undefined) {
    return fallback.slice(0, maxLength);
  }

  if (typeof value === "string") {
    return value.slice(0, maxLength);
  }

  return (asString(value) ?? fallback).slice(0, maxLength);
}

function emailPreviewText(value: unknown, maxLength = 6000): string {
  const text = textField(value, "", maxLength).trim();
  if (!text) {
    return "";
  }

  return text.length >= maxLength ? `${text.slice(0, maxLength - 20)}\n...` : text;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlAttribute(value: string): string {
  return htmlEscape(value).replace(/`/g, "&#96;");
}

function markdownImageLinks(markdown: string): Array<{ alt: string; url: string }> {
  const images: Array<{ alt: string; url: string }> = [];
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(markdown)) !== null && images.length < 4) {
    images.push({
      alt: match[1]?.trim() || "README image",
      url: match[2]
    });
  }

  return images;
}

function stripMarkdownImages(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\(https?:\/\/[^)\s]+(?:\s+"[^"]*")?\)/g, "").trim();
}

function inlineMarkdownToHtml(value: string): string {
  const escaped = htmlEscape(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  return escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_match, label: string, url: string) => `<a href="${htmlAttribute(url)}">${label}</a>`
  );
}

function markdownToEmailHtml(markdown: string): string {
  const clean = stripMarkdownImages(markdown);
  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 24);

  if (lines.length === 0) {
    return "";
  }

  const html: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    html.push(`<ul style="margin:10px 0 16px;padding-left:22px">${listItems.join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      html.push(`<h3 style="margin:18px 0 8px;font-size:18px;line-height:1.35;color:#0f1f3a">${inlineMarkdownToHtml(heading[2])}</h3>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (bullet) {
      listItems.push(`<li style="margin:6px 0;line-height:1.55">${inlineMarkdownToHtml(bullet[1])}</li>`);
      continue;
    }

    flushList();
    html.push(`<p style="margin:0 0 12px;line-height:1.65">${inlineMarkdownToHtml(line)}</p>`);
  }

  flushList();
  return html.join("");
}

function readmeImageLinksHtml(images: Array<{ alt: string; url: string }>, label: string): string {
  if (images.length === 0) {
    return "";
  }

  return [
    `<p style="margin:14px 0 8px;color:#536174;font-size:13px;font-weight:700">${htmlEscape(label)}</p>`,
    '<div style="display:block;margin:0 0 16px">',
    ...images.slice(0, 2).map((image, index) => [
      `<a href="${htmlAttribute(image.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 12px;border-radius:10px;background:#eef4ff;color:#174ea6;text-decoration:none;font-weight:700">`,
      `${htmlEscape(image.alt || `Image ${index + 1}`)}`,
      "</a>"
    ].join("")),
    "</div>"
  ].join("");
}

function secretOrEnv(secret: ReturnType<typeof defineSecret>, envName: string): string | undefined {
  try {
    return secret.value() || process.env[envName];
  } catch {
    return process.env[envName];
  }
}

function resendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || defaultLicenseFromEmail;
}

function resendReplyToEmail(): string {
  return process.env.RESEND_REPLY_TO_EMAIL || adminEmail;
}

function testLicenseCode(): string {
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `BRAINOK-TEST-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function licenseEmailContent({
  licenseCode,
  plan,
  maxDevices,
  recipientName
}: {
  licenseCode: string;
  plan: BrainokLicensePlan;
  maxDevices: number;
  recipientName?: string | null;
}) {
  const subject = "Your Brainok License";
  const greeting = recipientName ? `Hello ${recipientName},` : "Hello,";
  const text = [
    greeting,
    "",
    "Thank you for supporting Brainok.",
    "Your activation code:",
    licenseCode,
    "",
    `Plan: ${plan}`,
    `Device limit: ${maxDevices}`,
    "",
    "Download any Brainok app for free, use the 30-day trial, then enter this license code inside the app.",
    "Activation requires Internet once. After activation, the app can keep working offline.",
    "",
    `Support: ${adminEmail}`
  ].join("\n");
  const html = [
    `<p>${htmlEscape(greeting)}</p>`,
    "<p>Thank you for supporting Brainok.</p>",
    "<h1>Your Brainok License</h1>",
    "<p>Use this license code inside any Brainok app after the 30-day trial.</p>",
    "<p><strong>Your activation code:</strong></p>",
    `<p><code>${htmlEscape(licenseCode)}</code></p>`,
    "<ul>",
    `<li>Plan: ${htmlEscape(plan)}</li>`,
    `<li>Device limit: ${maxDevices}</li>`,
    "<li>Activation requires Internet once.</li>",
    "<li>After activation, Brainok apps can keep working offline.</li>",
    "</ul>",
    `<p>Support: <a href="mailto:${adminEmail}">${adminEmail}</a></p>`
  ].join("");

  return { subject, text, html };
}

function normalizePublicLicensePlan(value: unknown): BrainokLicensePlan {
  const raw = (asString(value) || "").toLowerCase();
  if (raw.includes("lab")) {
    return "lab";
  }

  if (raw.includes("pro")) {
    return "pro";
  }

  if (raw.includes("friend")) {
    return "friend";
  }

  return "personal";
}

function licenseRequestEmailContent({
  requestId,
  name,
  email,
  plan,
  requestedPlanLabel,
  devices,
  message
}: {
  requestId: string;
  name: string | null;
  email: string;
  plan: BrainokLicensePlan;
  requestedPlanLabel: string;
  devices: number;
  message: string | null;
}) {
  const subject = `[Brainok License Request] ${requestedPlanLabel} - ${email}`;
  const text = [
    "Brainok License Request",
    "",
    `Request ID: ${requestId}`,
    `Name: ${name || ""}`,
    `Email: ${email}`,
    `Plan: ${requestedPlanLabel}`,
    `Plan key: ${plan}`,
    `Devices: ${devices}`,
    "",
    "Message:",
    message || "",
    "",
    "Next step:",
    "Open Account > Brainok Licenses, confirm payment/request, then Create License with this buyer email."
  ].join("\n");
  const html = [
    "<h1>Brainok License Request</h1>",
    "<ul>",
    `<li><strong>Request ID:</strong> ${htmlEscape(requestId)}</li>`,
    `<li><strong>Name:</strong> ${htmlEscape(name || "")}</li>`,
    `<li><strong>Email:</strong> ${htmlEscape(email)}</li>`,
    `<li><strong>Plan:</strong> ${htmlEscape(requestedPlanLabel)}</li>`,
    `<li><strong>Plan key:</strong> ${htmlEscape(plan)}</li>`,
    `<li><strong>Devices:</strong> ${devices}</li>`,
    "</ul>",
    "<p><strong>Message:</strong></p>",
    `<p>${htmlEscape(message || "").replace(/\n/g, "<br>")}</p>`,
    "<p>Next step: open Account &gt; Brainok Licenses, confirm payment/request, then Create License with this buyer email.</p>"
  ].join("");

  return { subject, text, html };
}

function appAnnouncementEmailContent({
  appName,
  appType,
  category,
  latestVersion,
  shortDescriptionKo,
  shortDescriptionEn,
  readmeKo,
  readmeEn,
  appUrl
}: {
  appName: string;
  appType: AppType;
  category: string | null;
  latestVersion: string | null;
  shortDescriptionKo: string;
  shortDescriptionEn: string;
  readmeKo: string;
  readmeEn: string;
  appUrl: string;
}) {
  const productType = appType === "web_app" ? "web app" : "app";
  const subject = `[Brainok] New ${productType}: ${appName}`;
  const koReadmeImages = markdownImageLinks(readmeKo);
  const enReadmeImages = markdownImageLinks(readmeEn);
  const koReadmeHtml = markdownToEmailHtml(readmeKo);
  const enReadmeHtml = markdownToEmailHtml(readmeEn);
  const textReadmeKo = stripMarkdownImages(readmeKo) || "(Open Brainok Store to view the Korean README and screenshots.)";
  const textReadmeEn = stripMarkdownImages(readmeEn) || "(Open Brainok Store to view the English README and screenshots.)";
  const versionLine = latestVersion ? `Version: ${latestVersion}` : "";
  const categoryLine = category ? `Category: ${category}` : "";
  const text = [
    `A new Brainok ${productType} is available.`,
    "",
    appName,
    versionLine,
    categoryLine,
    "",
    "Korean summary:",
    shortDescriptionKo || "(No Korean summary yet.)",
    "",
    "English summary:",
    shortDescriptionEn || "(No English summary yet.)",
    "",
    "Korean README preview:",
    textReadmeKo,
    "",
    "English README preview:",
    textReadmeEn,
    "",
    `Open Brainok Store: ${appUrl}`,
    "",
    `Support: ${adminEmail}`
  ].filter((line) => line !== "").join("\n");
  const html = [
    '<div style="margin:0;padding:28px;background:#f5f7fb;font-family:system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#162033">',
    '<div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d9e2ef;border-radius:18px;overflow:hidden">',
    '<div style="padding:28px 30px;background:#0f1f3a;color:#ffffff">',
    `<p style="margin:0 0 10px;color:#a9c7ff;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase">New Brainok ${htmlEscape(productType)}</p>`,
    `<h1 style="margin:0;font-size:34px;line-height:1.15">${htmlEscape(appName)}</h1>`,
    '<div style="margin-top:16px;color:#dbe7ff;font-size:14px">',
    latestVersion ? `<span style="display:inline-block;margin:0 12px 8px 0">Version ${htmlEscape(latestVersion)}</span>` : "",
    category ? `<span style="display:inline-block;margin:0 12px 8px 0">${htmlEscape(category)}</span>` : "",
    "</div>",
    "</div>",
    '<div style="padding:28px 30px">',
    '<h2 style="margin:0 0 10px;font-size:22px;color:#0f1f3a">한국어 요약</h2>',
    `<p style="margin:0 0 24px;line-height:1.65;color:#334155">${htmlEscape(shortDescriptionKo || "아직 한국어 요약이 없습니다.").replace(/\n/g, "<br>")}</p>`,
    '<h2 style="margin:0 0 10px;font-size:22px;color:#0f1f3a">English Summary</h2>',
    `<p style="margin:0 0 26px;line-height:1.65;color:#334155">${htmlEscape(shortDescriptionEn || "No English summary yet.").replace(/\n/g, "<br>")}</p>`,
    '<div style="border-top:1px solid #e5edf7;padding-top:22px">',
    '<h2 style="margin:0 0 12px;font-size:20px;color:#0f1f3a">README Preview</h2>',
    koReadmeHtml ? '<h3 style="margin:16px 0 8px;font-size:16px;color:#174ea6">한국어</h3>' : "",
    koReadmeHtml || '<p style="margin:0 0 12px;color:#536174">한국어 README는 Brainok Store에서 확인하세요.</p>',
    readmeImageLinksHtml(koReadmeImages, "한국어 README images"),
    enReadmeHtml ? '<h3 style="margin:16px 0 8px;font-size:16px;color:#174ea6">English</h3>' : "",
    enReadmeHtml || '<p style="margin:0 0 12px;color:#536174">View the English README in Brainok Store.</p>',
    readmeImageLinksHtml(enReadmeImages, "English README images"),
    "</div>",
    `<p style="margin:26px 0 10px"><a href="${htmlAttribute(appUrl)}" style="display:inline-block;background:#174ea6;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:800">Open Brainok Store</a></p>`,
    `<p style="margin:20px 0 0;color:#536174;font-size:13px">Support: <a href="mailto:${adminEmail}" style="color:#174ea6">${adminEmail}</a></p>`,
    "</div>",
    "</div>",
    "</div>"
  ].join("");

  return { subject, text, html };
}

async function sendResendEmail({
  to,
  subject,
  text,
  html,
  licenseCode,
  licenseId,
  requestId,
  replyToEmail,
  type,
  requestedByUid
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  licenseCode?: string;
  licenseId?: string | null;
  requestId?: string | null;
  replyToEmail?: string | null;
  type: ResendMailType;
  requestedByUid?: string | null;
}): Promise<{ emailId: string | null; mailLogId: string }> {
  const mailLogRef = db.collection("mailLogs").doc();
  const from = resendFromEmail();
  const replyTo = replyToEmail || resendReplyToEmail();

  await mailLogRef.set(compactMap({
    mailLogId: mailLogRef.id,
    type,
    status: "sending",
    provider: "resend",
    to,
    toLower: emailLower(to),
    from,
    replyTo,
    subject,
    licenseCode: licenseCode || undefined,
    licenseId: licenseId || undefined,
    requestId: requestId || undefined,
    requestedByUid: requestedByUid || undefined,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }));

  const apiKey = secretOrEnv(resendApiKey, "RESEND_API_KEY");
  if (!apiKey) {
    await mailLogRef.set(
      {
        status: "failed",
        errorMessage: "RESEND_API_KEY is not configured.",
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    throw new HttpsError(
      "failed-precondition",
      "RESEND_API_KEY is not configured. Set it with Firebase Secret Manager or a local environment variable."
    );
  }

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
    await mailLogRef.set(
      {
        status: "failed",
        errorMessage: result.error.message || "Resend could not send the email.",
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    throw new HttpsError(
      "internal",
      result.error.message || "Resend could not send the license email."
    );
  }

  const emailId = result.data?.id || null;
  await mailLogRef.set(
    compactMap({
      status: "sent",
      providerMessageId: emailId || undefined,
      sentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }),
    { merge: true }
  );

  return { emailId, mailLogId: mailLogRef.id };
}

async function sendResendTestLicenseEmail(requestedByUid?: string | null): Promise<{ emailId: string | null; mailLogId: string; licenseCode: string }> {
  const licenseCode = testLicenseCode();
  const content = licenseEmailContent({
    licenseCode,
    plan: "personal",
    maxDevices: 3
  });
  const result = await sendResendEmail({
    to: adminEmail,
    ...content,
    subject: "Brainok Store test license email",
    licenseCode,
    licenseId: null,
    type: "license_test",
    requestedByUid
  });

  return {
    ...result,
    licenseCode
  };
}

async function notifyAdminOfAppQuestion({
  questionId,
  appId,
  appName,
  userEmail,
  question
}: {
  questionId: string;
  appId: string;
  appName: string;
  userEmail: string | null;
  question: string;
}): Promise<void> {
  const smtpPassword = qnaSmtpPassword.value();
  if (!smtpPassword) {
    throw new Error("QNA_SMTP_PASSWORD is not configured.");
  }

  const smtpUser = process.env.QNA_SMTP_USER || adminEmail;
  const smtpHost = process.env.QNA_SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.QNA_SMTP_PORT || 465);
  const fromLabel = process.env.QNA_SMTP_FROM_NAME || "Brainok Store";
  const safeAppName = htmlEscape(appName);
  const safeQuestion = htmlEscape(question).replace(/\n/g, "<br>");
  const safeUserEmail = htmlEscape(userEmail || "Unknown user");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  });

  await transporter.sendMail({
    from: `"${fromLabel}" <${smtpUser}>`,
    to: adminEmail,
    replyTo: userEmail || undefined,
    subject: `[Brainok Store QnA] ${appName}`,
    text: [
      "A new app question was submitted.",
      "",
      `App: ${appName}`,
      `App ID: ${appId}`,
      `Question ID: ${questionId}`,
      `User: ${userEmail || "Unknown user"}`,
      "",
      question
    ].join("\n"),
    html: [
      "<p>A new app question was submitted.</p>",
      "<ul>",
      `<li><strong>App:</strong> ${safeAppName}</li>`,
      `<li><strong>App ID:</strong> ${htmlEscape(appId)}</li>`,
      `<li><strong>Question ID:</strong> ${htmlEscape(questionId)}</li>`,
      `<li><strong>User:</strong> ${safeUserEmail}</li>`,
      "</ul>",
      `<p><strong>Question</strong></p><p>${safeQuestion}</p>`
    ].join("")
  });
}

function boundedSupportResources(value: unknown) {
  if (!Array.isArray(value)) {
    return defaultSiteSettings.supportResources;
  }

  return value.slice(0, 12).map((item, index) => {
    const resource = (item || {}) as Record<string, unknown>;
    const fallback = defaultSiteSettings.supportResources[index] || defaultSiteSettings.supportResources[0];
    return {
      id: boundedString(resource.id, fallback.id || `support-${index + 1}`, 60),
      title: boundedString(resource.title, fallback.title, 80),
      description: boundedString(resource.description, fallback.description, 160),
      url: boundedString(resource.url, "", 500)
    };
  }).filter((item) => item.title.length > 0);
}

function inferredAccountRole(profile: Record<string, unknown>): AccountRole {
  return profileEmailLower(profile) === adminEmail ? "admin" : "user";
}

function isSiteAdmin(profile: Record<string, unknown>): boolean {
  return inferredAccountRole(profile) === "admin";
}

async function requireSiteAdmin(uid: string): Promise<void> {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists || !isSiteAdmin(userSnap.data() || {})) {
    throw new HttpsError("permission-denied", "Only the site admin can manage licenses.");
  }
}

function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function paymentProvider(value: unknown): PaymentProvider {
  const id = oneOf<PaymentProviderId>(
    value,
    ["manual", "toss", "legacy_external"],
    "manual"
  );
  return paymentProviders[id];
}

function paymentStatus(value: unknown): PaymentStatus {
  return oneOf<PaymentStatus>(
    value,
    ["created", "pending", "paid", "paid_needs_license", "refunded", "partially_refunded", "failed", "cancelled"],
    "pending"
  );
}

async function writePaymentRecord({
  provider,
  status,
  email,
  amountCents,
  currency,
  orderId,
  providerPaymentId,
  rawPayload,
  licenseId,
  licenseCode
}: {
  provider: PaymentProviderId;
  status: PaymentStatus;
  email?: string | null;
  amountCents?: number;
  currency?: string;
  orderId?: string;
  providerPaymentId?: string;
  rawPayload?: unknown;
  licenseId?: string;
  licenseCode?: string;
}) {
  const paymentId = providerPaymentId || orderId || crypto.randomUUID();
  const paymentRef = db.collection("payments").doc(`${provider}_${paymentId}`);
  await paymentRef.set(
    compactMap({
      paymentId: paymentRef.id,
      provider,
      providerPaymentId,
      orderId,
      status,
      email: email || null,
      emailLower: emailLower(email),
      amountCents,
      currency,
      licenseId,
      licenseCode,
      rawPayload,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }),
    { merge: true }
  );

  return paymentRef.id;
}

export const tossPaymentsWebhook = onRequest(
  { region, cors: false },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method not allowed");
      return;
    }

    const payload = (request.body || {}) as Record<string, unknown>;
    const eventName =
      asString(request.get("toss-webhook-event-type")) ||
      asString(payload.eventType) ||
      asString(payload.status) ||
      "unknown";
    const eventId = sha256(request.rawBody || JSON.stringify(payload));

    try {
      await db.collection("webhookEvents").doc(eventId).set(
        {
          provider: "toss",
          eventName,
          payload,
          handledAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      await writePaymentRecord({
        provider: "toss",
        status: paymentStatus(payload.status),
        email: asString(payload.email) || asString(payload.customerEmail),
        amountCents: asNumber(payload.amount),
        currency: asString(payload.currency) || "KRW",
        orderId: asString(payload.orderId),
        providerPaymentId: asString(payload.paymentKey) || asString(payload.paymentId),
        rawPayload: payload
      });

      response.status(200).json({ ok: true, provider: "toss" });
    } catch (error) {
      console.error("Toss payment webhook failed", error);
      response.status(500).json({ ok: false });
    }
  }
);

export const ensureUserProfile = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const user = await auth.getUser(uid);
  const userRef = db.collection("users").doc(uid);
  const snapshot = await userRef.get();

  if (snapshot.exists) {
    const existing = snapshot.data() || {};
    const currentProfile = {
      ...existing,
      email: user.email || null,
      emailLower: emailLower(user.email)
    };
    await userRef.set(
      {
        email: user.email || null,
        emailLower: emailLower(user.email),
        accountRole: inferredAccountRole(currentProfile),
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        accessStatus: existing.accessStatus || "pending",
        deviceLimit: Math.max(Number(existing.deviceLimit || 0), 5),
        lastLoginAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  } else {
    await userRef.set({
      uid,
      email: user.email || null,
      emailLower: emailLower(user.email),
      accountRole: inferredAccountRole({
        email: user.email || null,
        emailLower: emailLower(user.email)
      }),
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      planType: "free",
      licenseStatus: "free",
      accessStatus: "pending",
      inviteQuota: 0,
      deviceLimit: 5,
      paymentProvider: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp()
    });
  }

  return { ok: true };
});

export const createCheckout = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const user = await auth.getUser(uid);
  const data = (request.data || {}) as Record<string, unknown>;
  const provider = paymentProvider(data.provider);

  if (provider.id === "manual") {
    const subject = encodeURIComponent("Brainok License request");
    const body = encodeURIComponent([
      "Brainok License Request",
      "",
      `User ID: ${uid}`,
      `Email: ${user.email || ""}`,
      `Source: ${asString(data.source) || "web"}`,
      "",
      "Requested plan:",
      "Message:"
    ].join("\n"));

    return {
      provider: provider.id,
      url: `mailto:${adminEmail}?subject=${subject}&body=${body}`
    };
  }

  if (provider.id === "toss") {
    throw new HttpsError(
      "failed-precondition",
      "Toss Payments checkout is not configured yet. Manual license issuance is available."
    );
  }

  throw new HttpsError("failed-precondition", "This payment provider is retained for historical records only.");
});

export const updateSiteSettings = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const userSnap = await db.collection("users").doc(uid).get();

  if (!userSnap.exists) {
    throw new HttpsError("failed-precondition", "Create a user profile first.");
  }

  const profile = userSnap.data() || {};
  if (!isSiteAdmin(profile)) {
    throw new HttpsError("permission-denied", "Only app admins can update site settings.");
  }

  const data = (request.data || {}) as Record<string, unknown>;
  const settings = {
    brandName: boundedString(data.brandName, defaultSiteSettings.brandName, 60),
    brandInitial: boundedString(data.brandInitial, defaultSiteSettings.brandInitial, 3),
    heroEyebrow: boundedString(data.heroEyebrow, defaultSiteSettings.heroEyebrow, 120),
    heroTitle: boundedString(data.heroTitle, defaultSiteSettings.heroTitle, 140),
    heroDescription: boundedString(data.heroDescription, defaultSiteSettings.heroDescription, 500),
    primaryCtaLabel: boundedString(data.primaryCtaLabel, defaultSiteSettings.primaryCtaLabel, 40),
    secondaryCtaLabel: boundedString(data.secondaryCtaLabel, defaultSiteSettings.secondaryCtaLabel, 40),
    downloadTitle: boundedString(data.downloadTitle, defaultSiteSettings.downloadTitle, 80),
    downloadSubtitle: boundedString(data.downloadSubtitle, defaultSiteSettings.downloadSubtitle, 80),
    downloadBody: boundedString(data.downloadBody, defaultSiteSettings.downloadBody, 400),
    supportResources: boundedSupportResources(data.supportResources),
    updatedBy: uid,
    updatedAt: FieldValue.serverTimestamp()
  };

  await db.collection("site").doc("public").set(settings, { merge: true });
  return { ok: true };
});

export const registerDevice = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const machineHash = asString(data.machineHash);
  const os = asString(data.os) || "unknown";
  const appVersion = asString(data.appVersion);

  if (!machineHash || machineHash.length < 32) {
    throw new HttpsError("invalid-argument", "machineHash is required.");
  }

  const deviceId = sha256(`${uid}:${machineHash}`);
  const deviceRef = db.collection("devices").doc(deviceId);
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const deviceSnap = await transaction.get(deviceRef);

    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    const profile = userSnap.data() || {};
    const deviceLimit = Math.max(1, Number(profile.deviceLimit || 1));
    const activeDevicesQuery = db
      .collection("devices")
      .where("uid", "==", uid)
      .where("status", "==", "active");
    const activeDevices = await transaction.get(activeDevicesQuery);

    const existingActive = deviceSnap.exists && deviceSnap.data()?.status === "active";
    if (!existingActive && activeDevices.size >= deviceLimit) {
      throw new HttpsError(
        "failed-precondition",
        `Device limit reached (${deviceLimit}).`
      );
    }

    const now = FieldValue.serverTimestamp();
    transaction.set(
      deviceRef,
      compactMap({
        uid,
        os,
        machineHash,
        appVersion,
        status: "active",
        createdAt: deviceSnap.exists ? deviceSnap.data()?.createdAt : now,
        lastSeenAt: now
      }),
      { merge: true }
    );

    return {
      allowed: true,
      deviceId,
      deviceLimit,
      activeDeviceCount: existingActive ? activeDevices.size : activeDevices.size + 1
    };
  });

  return result;
});

function generateInviteCode(): string {
  const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

function normalizeInviteCode(value: unknown): string | undefined {
  const code = asString(value)?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code || code.length < 8) {
    return undefined;
  }

  return `${code.slice(0, 5)}-${code.slice(5, 10)}`;
}

function normalizeSharedAccessCode(value: unknown): string | undefined {
  const code = asString(value)
    ?.toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!code || code.length < 4 || code.length > 64) {
    return undefined;
  }

  return code;
}

function benefitFromRequest(_value: unknown): InviteBenefit {
  return "beta_access";
}

function generateActivationCode(): string {
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `BRN-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function normalizeLicenseCode(value: unknown): string | undefined {
  const code = asString(value)
    ?.toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!code || code.length < 8 || code.length > 80) {
    return undefined;
  }

  return code;
}

function generateLicenseCode(plan: BrainokLicensePlan): string {
  const prefix = plan === "pro"
    ? "PRO"
    : plan === "lab"
      ? "LAB"
      : plan === "friend"
        ? "FRIEND"
        : "SUPPORTER";
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `BRAINOK-${prefix}-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function licenseIdForCode(code: string): string {
  return `lic_${sha256(code).slice(0, 20)}`;
}

function normalizePlan(value: unknown): BrainokLicensePlan {
  const raw = asString(value);
  if (raw === "supporter") {
    return "personal";
  }

  if (raw === "pro_supporter") {
    return "pro";
  }

  return oneOf<BrainokLicensePlan>(
    raw,
    ["personal", "pro", "lab", "friend"],
    "personal"
  );
}

function defaultDeviceLimit(plan: BrainokLicensePlan): number {
  if (plan === "pro") {
    return 5;
  }

  if (plan === "lab") {
    return 20;
  }

  if (plan === "friend") {
    return 50;
  }

  return 3;
}

function licenseDeviceLimit(plan: BrainokLicensePlan, value: unknown): number {
  const fallback = defaultDeviceLimit(plan);
  const limit = Math.round(asNumber(value) ?? fallback);
  const maximum = plan === "lab" || plan === "friend" ? 100 : 20;
  return Math.min(maximum, Math.max(1, limit));
}

async function issueBrainokLicense({
  email,
  buyerName,
  plan,
  licenseCode: requestedLicenseCode,
  maxDevices: requestedMaxDevices,
  source,
  createdByUid,
  paymentId
}: {
  email?: string | null;
  buyerName?: string | null;
  plan: BrainokLicensePlan;
  licenseCode?: string;
  maxDevices?: number;
  source: PaymentProviderId;
  createdByUid?: string | null;
  paymentId?: string | null;
}) {
  const licenseCode = normalizeLicenseCode(requestedLicenseCode) || generateLicenseCode(plan);
  const licenseId = licenseIdForCode(licenseCode);
  const normalizedEmail = asString(email) || null;
  const normalizedBuyerName = asString(buyerName) || null;
  const maxDevices = licenseDeviceLimit(plan, requestedMaxDevices);
  const licenseRef = db.collection("licenses").doc(licenseCode);
  const existing = await licenseRef.get();

  if (existing.exists) {
    throw new HttpsError("already-exists", "This license code already exists.");
  }

  await licenseRef.create(compactMap({
    licenseId,
    licenseCode,
    email: normalizedEmail,
    emailLower: emailLower(normalizedEmail),
    buyerName: normalizedBuyerName,
    plan,
    status: "active" satisfies BrainokLicenseStatus,
    maxDevices,
    activationCount: 0,
    allowedApps: ["*"],
    source,
    paymentId: paymentId || undefined,
    emailDeliveryStatus: normalizedEmail ? "pending" : "skipped",
    createdByUid: createdByUid || undefined,
    issuedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }));

  return {
    licenseId,
    licenseCode,
    email: normalizedEmail,
    buyerName: normalizedBuyerName,
    plan,
    status: "active" as const,
    maxDevices
  };
}

function normalizeActivationCode(value: unknown): string | undefined {
  const raw = asString(value)?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) {
    return undefined;
  }

  const body = raw.startsWith("BRN") ? raw.slice(3) : raw;
  if (body.length < 12) {
    return undefined;
  }

  const code = body.slice(0, 12);
  return `BRN-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

function activationRequest(data: Record<string, unknown>) {
  const appId = asString(data.appId);
  const machineHash = asString(data.machineHash);

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  if (!machineHash || machineHash.length < 8 || machineHash.length > 256) {
    throw new HttpsError("invalid-argument", "A valid machine hash is required.");
  }

  const machineHashHash = sha256(machineHash);
  return {
    appId,
    machineHashHash,
    activationId: `${slugify(appId)}-${machineHashHash}`
  };
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function activationStatus(record: Record<string, unknown>): ActivationStatus {
  const status = oneOf<Exclude<ActivationStatus, "not_found">>(
    record.status,
    ["trial", "active", "expired", "revoked"],
    "trial"
  );

  if (status === "trial") {
    const trialEndsAt = timestampMillis(record.trialEndsAt);
    if (trialEndsAt && trialEndsAt <= Date.now()) {
      return "expired";
    }
  }

  return status;
}

function activationResponse(
  appId: string,
  appName: string,
  record: Record<string, unknown>
) {
  const status = activationStatus(record);
  const trialEndsAtMs = timestampMillis(record.trialEndsAt);
  const trialEndsAt = trialEndsAtMs ? new Date(trialEndsAtMs).toISOString() : null;
  const daysRemaining = status === "trial" && trialEndsAtMs
    ? Math.max(0, Math.ceil((trialEndsAtMs - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    ok: true,
    appId,
    appName,
    status,
    trialEndsAt,
    daysRemaining
  };
}

function appAccessPatch(
  appId: string,
  name: string,
  role: AppRole,
  extra: Record<string, unknown> = {}
) {
  return {
    [`apps.${appId}`]: compactMap({
      appId,
      name,
      role,
      accessStatus: "active",
      activatedAt: FieldValue.serverTimestamp(),
      ...extra
    })
  };
}

function appSettingsFromRequest(
  data: Record<string, unknown>,
  defaults: {
    pricingMode?: AppPricingMode;
    priceCents?: number;
    currency?: string;
    billingInterval?: AppBillingInterval;
    checkoutUrl?: string | null;
    releaseUrl?: string | null;
    macDownloadUrl?: string | null;
    windowsDownloadUrl?: string | null;
    docsUrl?: string | null;
    iconUrl?: string | null;
    thumbnailUrl?: string | null;
    videoUrl?: string | null;
    latestVersion?: string | null;
    visibility?: AppVisibility;
    appType?: AppType;
    sortOrder?: number;
    shortDescription?: string;
    shortDescriptionKo?: string;
    description?: string;
    descriptionKo?: string;
    supportContent?: string;
    supportContentKo?: string;
    category?: string;
  } = {}
) {
  const pricingMode = oneOf<AppPricingMode>(
    data.pricingMode,
    ["invite_only", "free", "paid"],
    defaults.pricingMode || "invite_only"
  );
  const billingInterval = oneOf<AppBillingInterval>(
    data.billingInterval,
    ["one_time", "monthly", "yearly", "pay_what_you_want"],
    defaults.billingInterval || "one_time"
  );

  return {
    shortDescription: textField(data.shortDescription, defaults.shortDescription ?? "", 260),
    shortDescriptionKo: textField(data.shortDescriptionKo, defaults.shortDescriptionKo ?? "", 260),
    description: textField(data.description, defaults.description ?? "", 20000),
    descriptionKo: textField(data.descriptionKo, defaults.descriptionKo ?? "", 20000),
    supportContent: textField(data.supportContent, defaults.supportContent ?? "", 20000),
    supportContentKo: textField(data.supportContentKo, defaults.supportContentKo ?? "", 20000),
    category: asString(data.category) ?? defaults.category ?? "",
    visibility: oneOf<AppVisibility>(
      data.visibility,
      ["public", "private"],
      defaults.visibility || "public"
    ),
    appType: oneOf<AppType>(
      data.appType,
      ["application", "web_app"],
      defaults.appType || "application"
    ),
    sortOrder: Math.max(0, Math.round(asNumber(data.sortOrder) ?? defaults.sortOrder ?? 0)),
    pricing: {
      mode: pricingMode,
      priceCents: pricingMode === "free" || pricingMode === "invite_only"
        ? 0
        : normalizePriceCents(data.priceCents ?? defaults.priceCents),
      currency: normalizeCurrency(data.currency, defaults.currency || "USD"),
      interval: billingInterval,
      checkoutUrl: data.checkoutUrl === undefined
        ? defaults.checkoutUrl ?? null
        : optionalUrl(data.checkoutUrl)
    },
    downloads: {
      releaseUrl: data.releaseUrl === undefined
        ? defaults.releaseUrl ?? null
        : optionalUrl(data.releaseUrl),
      macUrl: data.macDownloadUrl === undefined
        ? defaults.macDownloadUrl ?? null
        : optionalUrl(data.macDownloadUrl),
      windowsUrl: data.windowsDownloadUrl === undefined
        ? defaults.windowsDownloadUrl ?? null
        : optionalUrl(data.windowsDownloadUrl),
      docsUrl: data.docsUrl === undefined
        ? defaults.docsUrl ?? null
        : optionalUrl(data.docsUrl),
      latestVersion: asString(data.latestVersion) ?? defaults.latestVersion ?? null
    },
    media: {
      iconUrl: data.iconUrl === undefined
        ? defaults.iconUrl ?? null
        : optionalUrl(data.iconUrl),
      thumbnailUrl: data.thumbnailUrl === undefined
        ? defaults.thumbnailUrl ?? null
        : optionalUrl(data.thumbnailUrl),
      videoUrl: data.videoUrl === undefined
        ? defaults.videoUrl ?? null
        : optionalUrl(data.videoUrl)
    }
  };
}

export const createApp = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const name = asString(data.name);

  if (!name || name.length < 2 || name.length > 80) {
    throw new HttpsError("invalid-argument", "App name must be 2-80 characters.");
  }

  const slug = slugify(name);
  const appId = `${slug}-${crypto.randomBytes(3).toString("hex")}`;
  const appRef = db.collection("apps").doc(appId);
  const userRef = db.collection("users").doc(uid);
  const settings = appSettingsFromRequest(data);

  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    const profile = userSnap.data() || {};
    if (!isSiteAdmin(profile)) {
      throw new HttpsError("permission-denied", "Only app admins can create apps.");
    }

    transaction.create(appRef, {
      appId,
      name,
      slug,
      ownerUid: uid,
      status: "active",
      ...settings,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    transaction.update(
      userRef,
      {
        ...appAccessPatch(appId, name, "owner"),
        updatedAt: FieldValue.serverTimestamp()
      }
    );
  });

  return { appId, name, slug };
});

export const updateApp = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const appId = asString(data.appId);

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  const appRef = db.collection("apps").doc(appId);
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (transaction) => {
    const [userSnap, appSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(appRef)
    ]);

    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const profile = userSnap.data() || {};
    const app = appSnap.data() || {};

    if (!isSiteAdmin(profile)) {
      throw new HttpsError("permission-denied", "Only the site admin can edit apps.");
    }

    const nextName = asString(data.name) || asString(app.name) || appId;
    if (nextName.length < 2 || nextName.length > 80) {
      throw new HttpsError("invalid-argument", "App name must be 2-80 characters.");
    }

    const existingPricing = (app.pricing || {}) as Record<string, unknown>;
    const existingDownloads = (app.downloads || {}) as Record<string, unknown>;
    const existingMedia = (app.media || {}) as Record<string, unknown>;
    const settings = appSettingsFromRequest(data, {
      pricingMode: oneOf<AppPricingMode>(
        existingPricing.mode,
        ["invite_only", "free", "paid"],
        "invite_only"
      ),
      priceCents: normalizePriceCents(existingPricing.priceCents),
      currency: normalizeCurrency(existingPricing.currency),
      billingInterval: oneOf<AppBillingInterval>(
        existingPricing.interval,
        ["one_time", "monthly", "yearly", "pay_what_you_want"],
        "one_time"
      ),
      checkoutUrl: asString(existingPricing.checkoutUrl) || null,
      releaseUrl: asString(existingDownloads.releaseUrl) || null,
      macDownloadUrl: asString(existingDownloads.macUrl) || null,
      windowsDownloadUrl: asString(existingDownloads.windowsUrl) || null,
      docsUrl: asString(existingDownloads.docsUrl) || null,
      iconUrl: asString(existingMedia.iconUrl) || null,
      thumbnailUrl: asString(existingMedia.thumbnailUrl) || null,
      videoUrl: asString(existingMedia.videoUrl) || null,
      latestVersion: asString(existingDownloads.latestVersion) || null,
      visibility: oneOf<AppVisibility>(
        app.visibility,
        ["public", "private"],
        "public"
      ),
      appType: oneOf<AppType>(
        app.appType,
        ["application", "web_app"],
        "application"
      ),
      sortOrder: asNumber(app.sortOrder) ?? 0,
      description: asString(app.description) || "",
      descriptionKo: asString(app.descriptionKo) || "",
      shortDescription: asString(app.shortDescription) || "",
      shortDescriptionKo: asString(app.shortDescriptionKo) || "",
      supportContent: asString(app.supportContent) || "",
      supportContentKo: asString(app.supportContentKo) || "",
      category: asString(app.category) || ""
    });

    transaction.update(appRef, {
      name: nextName,
      slug: slugify(nextName),
      ...settings,
      updatedAt: FieldValue.serverTimestamp()
    });

    transaction.update(userRef, {
      [`apps.${appId}.name`]: nextName,
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, appId };
});

async function activeLicenseRecipientEmails(maxRecipients: number): Promise<string[]> {
  const snapshot = await db.collection("licenses")
    .where("status", "==", "active")
    .limit(Math.max(1, Math.min(maxRecipients * 3, 500)))
    .get();
  const recipients = new Map<string, string>();

  for (const licenseDoc of snapshot.docs) {
    const license = licenseDoc.data() || {};
    const email = asString(license.email) || asString(license.lastEmailTo);
    const normalized = emailLower(email);
    if (!email || !normalized || !email.includes("@") || recipients.has(normalized)) {
      continue;
    }

    recipients.set(normalized, email);
    if (recipients.size >= maxRecipients) {
      break;
    }
  }

  return Array.from(recipients.values());
}

export const sendAppAnnouncement = onCall(
  { region, secrets: [resendApiKey] },
  async (request) => {
    const uid = requireUid(request);
    await requireSiteAdmin(uid);

    const data = (request.data || {}) as Record<string, unknown>;
    const appId = asString(data.appId);
    const maxRecipients = Math.max(1, Math.min(asNumber(data.maxRecipients) ?? 100, 200));

    if (!appId) {
      throw new HttpsError("invalid-argument", "appId is required.");
    }

    const appSnap = await db.collection("apps").doc(appId).get();
    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const app = appSnap.data() || {};
    const appName = asString(app.name) || appId;
    const downloads = (app.downloads || {}) as Record<string, unknown>;
    const appType = oneOf<AppType>(app.appType, ["application", "web_app"], "application");
    const recipients = await activeLicenseRecipientEmails(maxRecipients);
    const announcementRef = db.collection("appAnnouncements").doc();
    const storeUrl = process.env.BRAINOK_STORE_URL || "https://store.brainok.net";
    const content = appAnnouncementEmailContent({
      appName,
      appType,
      category: asString(app.category) || null,
      latestVersion: asString(downloads.latestVersion) || null,
      shortDescriptionKo: emailPreviewText(app.shortDescriptionKo, 1200),
      shortDescriptionEn: emailPreviewText(app.shortDescription, 1200),
      readmeKo: emailPreviewText(app.descriptionKo),
      readmeEn: emailPreviewText(app.description),
      appUrl: storeUrl
    });

    await announcementRef.set({
      announcementId: announcementRef.id,
      appId,
      appName,
      status: recipients.length > 0 ? "sending" : "no_recipients",
      recipientCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      createdByUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const sent: Array<{ to: string; mailLogId: string; emailId: string | null }> = [];
    const failed: Array<{ to: string; errorMessage: string }> = [];

    for (const to of recipients) {
      try {
        const result = await sendResendEmail({
          to,
          ...content,
          requestId: announcementRef.id,
          type: "app_announcement",
          requestedByUid: uid
        });
        sent.push({ to, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not send app announcement.";
        failed.push({ to, errorMessage: message.slice(0, 500) });
      }
    }

    await announcementRef.set(
      compactMap({
        status: failed.length > 0 ? "partial" : "sent",
        sentCount: sent.length,
        failedCount: failed.length,
        sentTo: sent.map((item) => item.to),
        failedTo: failed,
        lastMailLogIds: sent.map((item) => item.mailLogId).slice(-20),
        sentAt: sent.length > 0 ? FieldValue.serverTimestamp() : undefined,
        updatedAt: FieldValue.serverTimestamp()
      }),
      { merge: true }
    );

    return {
      ok: true,
      announcementId: announcementRef.id,
      recipientCount: recipients.length,
      sentCount: sent.length,
      failedCount: failed.length,
      failed
    };
  }
);

export const askAppQuestion = onCall({ region, secrets: [qnaSmtpPassword] }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const appId = asString(data.appId);
  const question = textField(data.question, "", 2000).trim();

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  if (question.length < 3) {
    throw new HttpsError("invalid-argument", "Question must be at least 3 characters.");
  }

  const appSnap = await db.collection("apps").doc(appId).get();
  if (!appSnap.exists) {
    throw new HttpsError("not-found", "App does not exist.");
  }

  const app = appSnap.data() || {};
  const appName = asString(app.name) || appId;
  const user = await auth.getUser(uid);
  const questionRef = db.collection("appQuestions").doc();

  await questionRef.set({
    questionId: questionRef.id,
    appId,
    appName,
    userUid: uid,
    userEmail: user.email || null,
    question,
    answer: null,
    status: "open",
    emailNotificationStatus: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await notifyAdminOfAppQuestion({
    questionId: questionRef.id,
    appId,
    appName,
    userEmail: user.email || null,
    question
  }).then(() => questionRef.update({
    emailNotificationStatus: "sent",
    emailNotificationError: FieldValue.delete(),
    emailNotificationUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  })).catch((error) => {
    console.error("Could not send QnA email notification.", error);
    return questionRef.update({
      emailNotificationStatus: "failed",
      emailNotificationError: error instanceof Error ? error.message.slice(0, 500) : "Unknown email notification error.",
      emailNotificationUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { questionId: questionRef.id, appId };
});

export const answerAppQuestion = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const questionId = asString(data.questionId);
  const answer = textField(data.answer, "", 4000).trim();

  if (!questionId) {
    throw new HttpsError("invalid-argument", "questionId is required.");
  }

  if (answer.length < 2) {
    throw new HttpsError("invalid-argument", "Answer must be at least 2 characters.");
  }

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists || !isSiteAdmin(userSnap.data() || {})) {
    throw new HttpsError("permission-denied", "Only the site admin can answer support questions.");
  }

  const questionRef = db.collection("appQuestions").doc(questionId);
  const questionSnap = await questionRef.get();
  if (!questionSnap.exists) {
    throw new HttpsError("not-found", "Question does not exist.");
  }

  await questionRef.update({
    answer,
    status: "answered",
    answeredBy: uid,
    answeredAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true, questionId };
});

export const createActivationCode = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const appId = asString(data.appId);
  const assignedEmailLower = emailLower(asString(data.assignedEmail));

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  const maxActivations = Math.min(
    50,
    Math.max(1, Math.round(asNumber(data.maxActivations) ?? 1))
  );
  const code = generateActivationCode();
  const userRef = db.collection("users").doc(uid);
  const appRef = db.collection("apps").doc(appId);
  const codeRef = db.collection("activationCodes").doc(code);

  const result = await db.runTransaction(async (transaction) => {
    const [userSnap, appSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(appRef)
    ]);

    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    if (!isSiteAdmin(userSnap.data() || {})) {
      throw new HttpsError("permission-denied", "Only the site admin can create activation codes.");
    }

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const app = appSnap.data() || {};
    const appName = asString(app.name) || appId;

    transaction.create(codeRef, compactMap({
      code,
      appId,
      appName,
      assignedEmailLower: assignedEmailLower || undefined,
      createdByUid: uid,
      status: "unused",
      maxActivations,
      activationCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }));

    return { code, appId, appName, assignedEmailLower, maxActivations };
  });

  return result;
});

export const listMyActivationCodes = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const user = await auth.getUser(uid);
  const userEmailLower = emailLower(user.email);

  if (!userEmailLower) {
    return { activationCodes: [] };
  }

  const snapshot = await db.collection("activationCodes")
    .where("assignedEmailLower", "==", userEmailLower)
    .limit(50)
    .get();

  const activationCodes = snapshot.docs
    .map((activationDoc) => {
      const data = activationDoc.data() || {};
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : null;
      const createdAtMillis = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0;

      return {
        code: activationDoc.id,
        appId: asString(data.appId) || "",
        appName: asString(data.appName) || asString(data.appId) || "Brainok App",
        status: asString(data.status) || "unused",
        maxActivations: Math.max(1, Number(data.maxActivations || 1)),
        activationCount: Math.max(0, Number(data.activationCount || 0)),
        createdAt,
        createdAtMillis
      };
    })
    .sort((left, right) => right.createdAtMillis - left.createdAtMillis)
    .map(({ createdAtMillis: _createdAtMillis, ...activationCode }) => activationCode);

  return { activationCodes };
});

export const requestBrainokLicense = onCall(
  { region, secrets: [resendApiKey] },
  async (request) => {
    const data = (request.data || {}) as Record<string, unknown>;
    const email = asString(data.email);
    const emailLowerValue = emailLower(email);

    if (!email || !emailLowerValue || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "A valid email address is required.");
    }

    const plan = normalizePublicLicensePlan(data.plan);
    const requestedPlanLabel = boundedString(data.plan, plan, 80);
    const devices = licenseDeviceLimit(plan, asNumber(data.devices));
    const name = textField(data.name, "", 120).trim() || null;
    const message = textField(data.message, "", 1200).trim() || null;
    const language = oneOf<"ko" | "en">(data.language, ["ko", "en"], "en");
    const requestRef = db.collection("licenseRequests").doc();

    await requestRef.set(compactMap({
      requestId: requestRef.id,
      name,
      email,
      emailLower: emailLowerValue,
      plan,
      requestedPlanLabel,
      devices,
      message,
      language,
      status: "pending",
      source: "web",
      emailNotificationStatus: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }));

    try {
      const content = licenseRequestEmailContent({
        requestId: requestRef.id,
        name,
        email,
        plan,
        requestedPlanLabel,
        devices,
        message
      });
      const emailResult = await sendResendEmail({
        to: adminEmail,
        ...content,
        requestId: requestRef.id,
        replyToEmail: email,
        type: "license_request"
      });

      await requestRef.set(
        {
          emailNotificationStatus: "sent",
          mailLogId: emailResult.mailLogId,
          providerMessageId: emailResult.emailId || null,
          emailedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        ok: true,
        requestId: requestRef.id,
        emailNotificationStatus: "sent" as const,
        mailLogId: emailResult.mailLogId
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Could not send license request email.";
      console.error("Could not send Brainok license request email.", error);
      await requestRef.set(
        {
          emailNotificationStatus: "failed",
          emailNotificationError: messageText.slice(0, 500),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        ok: true,
        requestId: requestRef.id,
        emailNotificationStatus: "failed" as const,
        errorMessage: messageText
      };
    }
  }
);

export const createLicense = onCall(
  { region, secrets: [resendApiKey] },
  async (request) => {
    const uid = requireUid(request);
    await requireSiteAdmin(uid);

    const data = (request.data || {}) as Record<string, unknown>;
    const plan = normalizePlan(data.plan);
    const email = asString(data.email) || null;
    const buyerName = asString(data.buyerName) || null;
    const result = await issueBrainokLicense({
      email,
      buyerName,
      plan,
      licenseCode: asString(data.licenseCode),
      maxDevices: asNumber(data.maxDevices),
      source: "manual",
      createdByUid: uid
    });

    if (!email) {
      return {
        ...result,
        emailDelivery: {
          status: "skipped" as const,
          to: null
        }
      };
    }

    const licenseRef = db.collection("licenses").doc(result.licenseCode);
    try {
      const content = licenseEmailContent({
        licenseCode: result.licenseCode,
        plan: result.plan,
        maxDevices: result.maxDevices,
        recipientName: buyerName
      });
      const emailResult = await sendResendEmail({
        to: email,
        ...content,
        licenseCode: result.licenseCode,
        licenseId: result.licenseId,
        type: "license_delivery",
        requestedByUid: uid
      });

      await licenseRef.set(
        {
          emailDeliveryStatus: "sent",
          lastEmailedAt: FieldValue.serverTimestamp(),
          lastEmailTo: email,
          lastMailLogId: emailResult.mailLogId,
          lastEmailError: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        ...result,
        emailDelivery: {
          status: "sent" as const,
          to: email,
          ...emailResult
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send license email.";
      await licenseRef.set(
        {
          emailDeliveryStatus: "failed",
          lastEmailTo: email,
          lastEmailError: message.slice(0, 500),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        ...result,
        emailDelivery: {
          status: "failed" as const,
          to: email,
          errorMessage: message
        }
      };
    }
  }
);

async function licenseSnapFromRequest(data: Record<string, unknown>): Promise<DocumentSnapshot> {
  const code = normalizeLicenseCode(data.licenseCode || data.code);
  const licenseId = asString(data.licenseId);

  if (code) {
    return db.collection("licenses").doc(code).get();
  }

  if (licenseId) {
    const snapshot = await db.collection("licenses")
      .where("licenseId", "==", licenseId)
      .limit(1)
      .get();
    const licenseDoc = snapshot.docs[0];
    if (!licenseDoc) {
      throw new HttpsError("not-found", "License does not exist.");
    }

    return licenseDoc;
  }

  throw new HttpsError("invalid-argument", "licenseCode or licenseId is required.");
}

function licenseEmailAddress(data: Record<string, unknown>, license: Record<string, unknown>): string {
  const to = asString(data.to) || asString(data.email) || asString(license.email) || adminEmail;
  const normalized = emailLower(to);
  if (!to || !normalized || !to.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email address is required.");
  }

  return to;
}

async function sendStoredLicenseEmail({
  requestData,
  requestedByUid,
  type
}: {
  requestData: Record<string, unknown>;
  requestedByUid: string;
  type: "license_delivery" | "license_resend";
}) {
  const licenseSnap = await licenseSnapFromRequest(requestData);
  if (!licenseSnap?.exists) {
    throw new HttpsError("not-found", "License does not exist.");
  }

  const license = licenseSnap.data() || {};
  const licenseCode = normalizeLicenseCode(license.licenseCode || licenseSnap.id);
  if (!licenseCode) {
    throw new HttpsError("failed-precondition", "License code is invalid.");
  }

  const status = oneOf<BrainokLicenseStatus>(
    license.status,
    ["active", "disabled", "expired"],
    "active"
  );
  if (status !== "active") {
    throw new HttpsError("failed-precondition", "Only active licenses can be emailed.");
  }

  const plan = normalizePlan(license.plan);
  const maxDevices = Math.max(1, Number(license.maxDevices || defaultDeviceLimit(plan)));
  const to = licenseEmailAddress(requestData, license);
  const licenseId = asString(license.licenseId) || licenseIdForCode(licenseCode);
  const content = licenseEmailContent({
    licenseCode,
    plan,
    maxDevices,
    recipientName: asString(license.buyerName) || null
  });
  const result = await sendResendEmail({
    to,
    ...content,
    licenseCode,
    licenseId,
    type,
    requestedByUid
  });

  await licenseSnap.ref.set(
    {
      lastEmailedAt: FieldValue.serverTimestamp(),
      lastEmailTo: to,
      lastMailLogId: result.mailLogId,
      emailDeliveryStatus: "sent",
      lastEmailError: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return {
    ok: true,
    to,
    licenseId,
    licenseCode,
    ...result
  };
}

export const verifyLicense = onCall({ region }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const licenseCode = normalizeLicenseCode(data.licenseCode || data.code);
  const deviceId = asString(data.deviceId);
  const appId = asString(data.appId);

  if (!licenseCode) {
    throw new HttpsError("invalid-argument", "A valid Brainok license code is required.");
  }

  const licenseSnap = await db.collection("licenses").doc(licenseCode).get();
  if (!licenseSnap.exists) {
    return {
      ok: true,
      valid: false,
      status: "not_found",
      activated: false
    };
  }

  const license = licenseSnap.data() || {};
  const licenseId = asString(license.licenseId) || licenseIdForCode(licenseCode);
  const plan = normalizePlan(license.plan);
  const maxDevices = Math.max(1, Number(license.maxDevices || defaultDeviceLimit(plan)));
  const allowedApps = Array.isArray(license.allowedApps)
    ? license.allowedApps.filter((value): value is string => typeof value === "string")
    : ["*"];
  const appAllowed = !appId || allowedApps.includes("*") || allowedApps.includes(appId);
  let status = oneOf<BrainokLicenseStatus>(
    license.status,
    ["active", "disabled", "expired"],
    "active"
  );

  const expiresAtMs = timestampMillis(license.expiresAt);
  if (status === "active" && expiresAtMs && expiresAtMs <= Date.now()) {
    status = "expired";
    await licenseSnap.ref.set(
      {
        status: "expired",
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  const activeActivationsSnap = await db.collection("activations")
    .where("licenseId", "==", licenseId)
    .where("status", "==", "active")
    .get();
  let activated = false;
  const activeDeviceCount = activeActivationsSnap.size;
  if (deviceId) {
    const activationSnap = await db
      .collection("activations")
      .doc(`${licenseId}-${sha256(deviceId)}`)
      .get();
    activated = activationSnap.exists && activationSnap.data()?.status === "active";
  }

  const valid = status === "active" && appAllowed;
  return {
    ok: true,
    valid,
    activated,
    status,
    reason: appAllowed ? null : "app_not_allowed",
    licenseId,
    plan,
    maxDevices,
    activeDeviceCount,
    canActivateNewDevice: valid && (activated || activeDeviceCount < maxDevices)
  };
});

export const sendLicenseEmail = onCall(
  { region, secrets: [resendApiKey] },
  async (request) => {
    const uid = requireUid(request);
    await requireSiteAdmin(uid);

    return sendStoredLicenseEmail({
      requestData: (request.data || {}) as Record<string, unknown>,
      requestedByUid: uid,
      type: "license_delivery"
    });
  }
);

export const resendLicenseEmail = onCall(
  { region, secrets: [resendApiKey] },
  async (request) => {
    const uid = requireUid(request);
    await requireSiteAdmin(uid);

    return sendStoredLicenseEmail({
      requestData: (request.data || {}) as Record<string, unknown>,
      requestedByUid: uid,
      type: "license_resend"
    });
  }
);

export const listLicenses = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  await requireSiteAdmin(uid);

  const data = (request.data || {}) as Record<string, unknown>;
  const search = asString(data.search);
  const normalizedSearch = normalizeLicenseCode(search);
  const searchEmail = emailLower(search);
  let licenseDocs: DocumentSnapshot[] = [];

  if (normalizedSearch) {
    const exactSnap = await db.collection("licenses").doc(normalizedSearch).get();
    if (exactSnap.exists) {
      licenseDocs = [exactSnap];
    }
  }

  if (licenseDocs.length === 0 && searchEmail) {
    const emailSnap = await db.collection("licenses")
      .where("emailLower", "==", searchEmail)
      .limit(50)
      .get();
    licenseDocs = emailSnap.docs;
  }

  if (licenseDocs.length === 0 && !search) {
    const latestSnap = await db.collection("licenses")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    licenseDocs = latestSnap.docs;
  }

  const licenses = await Promise.all(licenseDocs.map(async (licenseDoc) => {
    const license = licenseDoc.data() || {};
    const licenseId = asString(license.licenseId) || licenseIdForCode(licenseDoc.id);
    const activationsSnap = await db.collection("activations")
      .where("licenseId", "==", licenseId)
      .limit(100)
      .get();
    const activations = activationsSnap.docs
      .map((activationDoc) => {
        const activation = activationDoc.data() || {};
        const activatedAt = activation.activatedAt instanceof Timestamp
          ? activation.activatedAt.toDate().toISOString()
          : null;
        const activatedAtMillis = activation.activatedAt instanceof Timestamp
          ? activation.activatedAt.toMillis()
          : 0;

        return {
          activationId: activationDoc.id,
          deviceId: asString(activation.deviceId) || "",
          deviceName: asString(activation.deviceName) || "Unknown device",
          appId: asString(activation.appId) || null,
          appName: asString(activation.appName) || null,
          status: asString(activation.status) || "active",
          activatedAt,
          activatedAtMillis
        };
      })
      .sort((left, right) => right.activatedAtMillis - left.activatedAtMillis)
      .map(({ activatedAtMillis: _activatedAtMillis, ...activation }) => activation);

    const createdAt = license.createdAt instanceof Timestamp
      ? license.createdAt.toDate().toISOString()
      : null;
    const issuedAt = license.issuedAt instanceof Timestamp
      ? license.issuedAt.toDate().toISOString()
      : createdAt;

    return {
      licenseId,
      licenseCode: asString(license.licenseCode) || licenseDoc.id,
      email: asString(license.email) || null,
      buyerName: asString(license.buyerName) || null,
      plan: normalizePlan(license.plan),
      status: asString(license.status) || "active",
      maxDevices: Math.max(1, Number(license.maxDevices || 1)),
      activationCount: activations.filter((activation) => activation.status === "active").length,
      emailDeliveryStatus: asString(license.emailDeliveryStatus) || null,
      lastEmailTo: asString(license.lastEmailTo) || null,
      lastMailLogId: asString(license.lastMailLogId) || null,
      lastEmailError: asString(license.lastEmailError) || null,
      issuedAt,
      createdAt,
      activations
    };
  }));

  return { licenses };
});

export const disableLicense = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  await requireSiteAdmin(uid);

  const data = (request.data || {}) as Record<string, unknown>;
  const code = normalizeLicenseCode(data.licenseCode);
  const licenseId = asString(data.licenseId);
  let licenseRef: FirebaseFirestore.DocumentReference | null = code
    ? db.collection("licenses").doc(code)
    : null;

  if (!licenseRef && licenseId) {
    const snapshot = await db.collection("licenses")
      .where("licenseId", "==", licenseId)
      .limit(1)
      .get();
    licenseRef = snapshot.docs[0]?.ref || null;
  }

  if (!licenseRef) {
    throw new HttpsError("invalid-argument", "licenseCode or licenseId is required.");
  }

  await licenseRef.update({
    status: "disabled",
    disabledAt: FieldValue.serverTimestamp(),
    disabledByUid: uid,
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true };
});

export const resetLicenseDevice = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  await requireSiteAdmin(uid);

  const data = (request.data || {}) as Record<string, unknown>;
  const activationId = asString(data.activationId);
  if (!activationId) {
    throw new HttpsError("invalid-argument", "activationId is required.");
  }

  const activationRef = db.collection("activations").doc(activationId);

  await db.runTransaction(async (transaction) => {
    const activationSnap = await transaction.get(activationRef);
    if (!activationSnap.exists) {
      throw new HttpsError("not-found", "Activation does not exist.");
    }

    const activation = activationSnap.data() || {};
    const licenseCode = normalizeLicenseCode(activation.licenseCode);
    const active = activation.status === "active";

    transaction.update(activationRef, {
      status: "reset",
      resetAt: FieldValue.serverTimestamp(),
      resetByUid: uid,
      updatedAt: FieldValue.serverTimestamp()
    });

    if (licenseCode && active) {
      transaction.update(db.collection("licenses").doc(licenseCode), {
        activationCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });

  return { ok: true, activationId };
});

export const sendTestLicenseEmail = onCall(
  { region, secrets: [resendApiKey] },
  async (request) => {
    const uid = requireUid(request);
    await requireSiteAdmin(uid);

    const result = await sendResendTestLicenseEmail(uid);
    return {
      ok: true,
      to: adminEmail,
      ...result
    };
  }
);

export const createSharedAccessCode = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const appId = asString(data.appId);
  const code = normalizeSharedAccessCode(data.code);

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  if (!code) {
    throw new HttpsError("invalid-argument", "Use a valid shared access code.");
  }

  const maxRedemptions = Math.min(
    10000,
    Math.max(0, Math.round(asNumber(data.maxRedemptions) ?? 0))
  );
  const userRef = db.collection("users").doc(uid);
  const appRef = db.collection("apps").doc(appId);
  const sharedRef = db.collection("sharedAccessCodes").doc(code);

  const result = await db.runTransaction(async (transaction) => {
    const [userSnap, appSnap, sharedSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(appRef),
      transaction.get(sharedRef)
    ]);

    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    if (!isSiteAdmin(userSnap.data() || {})) {
      throw new HttpsError("permission-denied", "Only the site admin can create shared access codes.");
    }

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const app = appSnap.data() || {};
    const appName = asString(app.name) || appId;

    transaction.set(sharedRef, compactMap({
      code,
      appId,
      appName,
      status: "active",
      maxRedemptions,
      redemptionCount: sharedSnap.exists ? undefined : 0,
      createdByUid: uid,
      updatedByUid: uid,
      createdAt: sharedSnap.exists ? undefined : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }), { merge: true });

    return { code, appId, appName, maxRedemptions };
  });

  return result;
});

export const redeemSharedAccessCode = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const code = normalizeSharedAccessCode(data.code);

  if (!code) {
    throw new HttpsError("invalid-argument", "Use a valid shared access code.");
  }

  const user = await auth.getUser(uid);
  const userEmailLower = emailLower(user.email);

  if (!userEmailLower) {
    throw new HttpsError("failed-precondition", "Your account needs an email address.");
  }

  const sharedRef = db.collection("sharedAccessCodes").doc(code);
  const userRef = db.collection("users").doc(uid);
  const activationCode = generateActivationCode();
  const activationCodeRef = db.collection("activationCodes").doc(activationCode);

  const result = await db.runTransaction(async (transaction) => {
    const [sharedSnap, userSnap] = await Promise.all([
      transaction.get(sharedRef),
      transaction.get(userRef)
    ]);

    if (!sharedSnap.exists) {
      throw new HttpsError("not-found", "Access code does not exist.");
    }

    const shared = sharedSnap.data() || {};
    if (shared.status !== "active") {
      throw new HttpsError("failed-precondition", "Access code is not active.");
    }

    const appId = asString(shared.appId);
    if (!appId) {
      throw new HttpsError("failed-precondition", "Access code is missing an app.");
    }

    const appRef = db.collection("apps").doc(appId);
    const redemptionRef = sharedRef.collection("redemptions").doc(uid);
    const [appSnap, redemptionSnap] = await Promise.all([
      transaction.get(appRef),
      transaction.get(redemptionRef)
    ]);

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const app = appSnap.data() || {};
    const appName = asString(app.name) || asString(shared.appName) || appId;

    if (redemptionSnap.exists) {
      const redemption = redemptionSnap.data() || {};
      const existingActivationCode = asString(redemption.activationCode);
      if (existingActivationCode) {
        return {
          ok: true,
          code,
          appId,
          appName,
          activationCode: existingActivationCode,
          alreadyRedeemed: true
        };
      }
    }

    const maxRedemptions = Math.max(0, Number(shared.maxRedemptions || 0));
    const redemptionCount = Math.max(0, Number(shared.redemptionCount || 0));
    if (maxRedemptions > 0 && redemptionCount >= maxRedemptions) {
      throw new HttpsError("failed-precondition", "Access code has reached its limit.");
    }

    transaction.create(activationCodeRef, {
      code: activationCode,
      appId,
      appName,
      assignedEmailLower: userEmailLower,
      createdByUid: uid,
      source: "shared_access_code",
      sharedAccessCode: code,
      status: "unused",
      maxActivations: 1,
      activationCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    transaction.set(redemptionRef, {
      uid,
      emailLower: userEmailLower,
      appId,
      appName,
      activationCode,
      redeemedAt: FieldValue.serverTimestamp()
    });

    transaction.update(sharedRef, {
      redemptionCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });

    const currentDeviceLimit = Number((userSnap.data() || {}).deviceLimit || 5);
    transaction.set(userRef, {
      uid,
      email: user.email || null,
      emailLower: userEmailLower,
      accessStatus: "active",
      planType: "free",
      licenseStatus: "free",
      deviceLimit: Math.max(currentDeviceLimit, 5),
      ...appAccessPatch(appId, appName, "user", {
        inviteCode: code
      }),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return {
      ok: true,
      code,
      appId,
      appName,
      activationCode,
      alreadyRedeemed: false
    };
  });

  return result;
});

export const checkAppActivation = onCall({ region }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const { appId, activationId } = activationRequest(data);
  const [appSnap, activationSnap] = await Promise.all([
    db.collection("apps").doc(appId).get(),
    db.collection("activations").doc(activationId).get()
  ]);

  if (!appSnap.exists) {
    throw new HttpsError("not-found", "App does not exist.");
  }

  const app = appSnap.data() || {};
  const appName = asString(app.name) || appId;

  if (!activationSnap.exists) {
    return {
      ok: true,
      appId,
      appName,
      status: "not_found" as ActivationStatus,
      trialEndsAt: null,
      daysRemaining: 0
    };
  }

  const record = activationSnap.data() || {};
  const response = activationResponse(appId, appName, record);
  if (response.status === "expired" && record.status === "trial") {
    await activationSnap.ref.update({
      status: "expired",
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  return response;
});

export const startAppTrial = onCall({ region }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const { appId, machineHashHash, activationId } = activationRequest(data);
  const appRef = db.collection("apps").doc(appId);
  const activationRef = db.collection("activations").doc(activationId);
  const now = Date.now();
  const trialEndsAt = Timestamp.fromMillis(now + trialLengthMs);

  const result = await db.runTransaction(async (transaction) => {
    const [appSnap, activationSnap] = await Promise.all([
      transaction.get(appRef),
      transaction.get(activationRef)
    ]);

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const app = appSnap.data() || {};
    if (app.status !== "active") {
      throw new HttpsError("failed-precondition", "This app is not available.");
    }

    const appName = asString(app.name) || appId;

    if (activationSnap.exists) {
      const record = activationSnap.data() || {};
      const response = activationResponse(appId, appName, record);
      if (response.status === "expired" && record.status === "trial") {
        transaction.update(activationRef, {
          status: "expired",
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      return response;
    }

    const record = compactMap({
      activationId,
      appId,
      appName,
      machineHashHash,
      status: "trial",
      source: "trial",
      os: asString(data.os) || "unknown",
      appVersion: asString(data.appVersion) || null,
      trialStartedAt: Timestamp.fromMillis(now),
      trialEndsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    transaction.create(activationRef, record);
    return activationResponse(appId, appName, record);
  });

  return result;
});

export const activateAppCode = onCall({ region }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const { appId, machineHashHash, activationId } = activationRequest(data);
  const code = normalizeActivationCode(data.code);

  if (!code) {
    throw new HttpsError("invalid-argument", "A valid activation code is required.");
  }

  const appRef = db.collection("apps").doc(appId);
  const codeRef = db.collection("activationCodes").doc(code);
  const activationRef = db.collection("activations").doc(activationId);
  const activatedAt = Timestamp.fromMillis(Date.now());

  const result = await db.runTransaction(async (transaction) => {
    const [appSnap, codeSnap, activationSnap] = await Promise.all([
      transaction.get(appRef),
      transaction.get(codeRef),
      transaction.get(activationRef)
    ]);

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    if (!codeSnap.exists) {
      throw new HttpsError("not-found", "Activation code does not exist.");
    }

    const app = appSnap.data() || {};
    const appName = asString(app.name) || appId;
    const codeData = codeSnap.data() || {};
    const codeAppId = asString(codeData.appId);

    if (codeAppId !== appId) {
      throw new HttpsError("permission-denied", "This activation code is for a different app.");
    }

    if (codeData.status === "revoked") {
      throw new HttpsError("failed-precondition", "This activation code has been revoked.");
    }

    const maxActivations = Math.max(1, Number(codeData.maxActivations || 1));
    const activationCount = Math.max(0, Number(codeData.activationCount || 0));
    const existingActivation = activationSnap.exists ? activationSnap.data() || {} : {};
    const alreadyActivatedHere = asString(existingActivation.activationCode) === code
      && existingActivation.status === "active";

    if (!alreadyActivatedHere && activationCount >= maxActivations) {
      throw new HttpsError("failed-precondition", "This activation code has already been used.");
    }

    const activationRecord = compactMap({
      activationId,
      appId,
      appName,
      machineHashHash,
      status: "active",
      source: "activation_code",
      activationCode: code,
      os: asString(data.os) || asString(existingActivation.os) || "unknown",
      appVersion: asString(data.appVersion) || asString(existingActivation.appVersion) || null,
      activatedAt,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: activationSnap.exists ? undefined : FieldValue.serverTimestamp()
    });

    transaction.set(activationRef, activationRecord, { merge: true });

    const nextActivationCount = alreadyActivatedHere ? activationCount : activationCount + 1;
    const codePatch: Record<string, unknown> = {
      status: nextActivationCount >= maxActivations ? "used" : "active",
      [`activations.${activationId}`]: true,
      lastActivatedAt: activatedAt,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (!alreadyActivatedHere) {
      codePatch.activationCount = FieldValue.increment(1);
    }

    transaction.update(codeRef, codePatch);
    return activationResponse(appId, appName, activationRecord);
  });

  return result;
});

export const activateBrainokLicense = onCall({ region }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const licenseCode = normalizeLicenseCode(data.code || data.licenseCode);
  const deviceId = asString(data.deviceId);

  if (!licenseCode) {
    throw new HttpsError("invalid-argument", "A valid Brainok license code is required.");
  }

  if (!deviceId || deviceId.length < 4 || deviceId.length > 256) {
    throw new HttpsError("invalid-argument", "deviceId is required.");
  }

  const deviceIdHash = sha256(deviceId);
  const licenseRef = db.collection("licenses").doc(licenseCode);
  const activatedAt = Timestamp.fromMillis(Date.now());

  const result = await db.runTransaction(async (transaction) => {
    const licenseSnap = await transaction.get(licenseRef);
    if (!licenseSnap.exists) {
      throw new HttpsError("not-found", "License code does not exist.");
    }

    const license = licenseSnap.data() || {};
    const licenseId = asString(license.licenseId) || licenseIdForCode(licenseCode);
    const activationId = `${licenseId}-${deviceIdHash}`;
    const activationRef = db.collection("activations").doc(activationId);
    const [activationSnap, activeActivationsSnap] = await Promise.all([
      transaction.get(activationRef),
      transaction.get(
        db.collection("activations")
          .where("licenseId", "==", licenseId)
          .where("status", "==", "active")
      )
    ]);

    const status = oneOf<BrainokLicenseStatus>(
      license.status,
      ["active", "disabled", "expired"],
      "active"
    );
    if (status !== "active") {
      throw new HttpsError("failed-precondition", "This license is not active.");
    }

    const expiresAtMs = timestampMillis(license.expiresAt);
    if (expiresAtMs && expiresAtMs <= Date.now()) {
      transaction.update(licenseRef, {
        status: "expired",
        updatedAt: FieldValue.serverTimestamp()
      });
      throw new HttpsError("failed-precondition", "This license has expired.");
    }

    const maxDevices = Math.max(1, Number(license.maxDevices || 1));
    const existingActivation = activationSnap.exists ? activationSnap.data() || {} : {};
    const alreadyActivatedHere = existingActivation.status === "active";

    if (!alreadyActivatedHere && activeActivationsSnap.size >= maxDevices) {
      throw new HttpsError("failed-precondition", `Device limit reached (${maxDevices}).`);
    }

    const activationRecord = compactMap({
      activationId,
      licenseId,
      licenseCode,
      deviceId,
      deviceIdHash,
      deviceName: boundedString(data.deviceName, "Unknown device", 120),
      appId: asString(data.appId) || null,
      appName: asString(data.appName) || null,
      os: asString(data.os) || asString(existingActivation.os) || "unknown",
      appVersion: asString(data.appVersion) || asString(existingActivation.appVersion) || null,
      status: "active",
      source: "brainok_license",
      activatedAt: alreadyActivatedHere ? existingActivation.activatedAt || activatedAt : activatedAt,
      lastCheckedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: activationSnap.exists ? undefined : FieldValue.serverTimestamp()
    });

    transaction.set(activationRef, activationRecord, { merge: true });

    const licensePatch: Record<string, unknown> = {
      lastActivatedAt: activatedAt,
      updatedAt: FieldValue.serverTimestamp()
    };
    if (!alreadyActivatedHere) {
      licensePatch.activationCount = FieldValue.increment(1);
    }
    transaction.update(licenseRef, licensePatch);

    return {
      ok: true,
      activated: true,
      activatedDate: activatedAt.toDate().toISOString(),
      licenseId,
      licenseCode,
      plan: normalizePlan(license.plan),
      status: "active",
      maxDevices,
      deviceId
    };
  });

  return result;
});

export const checkBrainokLicense = onCall({ region }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const licenseCode = normalizeLicenseCode(data.code || data.licenseCode);
  const deviceId = asString(data.deviceId);

  if (!licenseCode || !deviceId) {
    throw new HttpsError("invalid-argument", "licenseCode and deviceId are required.");
  }

  const licenseSnap = await db.collection("licenses").doc(licenseCode).get();
  if (!licenseSnap.exists) {
    return { ok: true, status: "not_found", activated: false };
  }

  const license = licenseSnap.data() || {};
  const licenseId = asString(license.licenseId) || licenseIdForCode(licenseCode);
  const activationId = `${licenseId}-${sha256(deviceId)}`;
  const activationSnap = await db.collection("activations").doc(activationId).get();
  const status = asString(license.status) || "active";
  const activated = status === "active" && activationSnap.exists && activationSnap.data()?.status === "active";

  return {
    ok: true,
    status,
    activated,
    licenseId,
    licenseCode,
    plan: normalizePlan(license.plan),
    maxDevices: Math.max(1, Number(license.maxDevices || 1))
  };
});

export const createAppCheckout = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const user = await auth.getUser(uid);
  const data = (request.data || {}) as Record<string, unknown>;
  const appId = asString(data.appId);

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  const appSnap = await db.collection("apps").doc(appId).get();
  if (!appSnap.exists) {
    throw new HttpsError("not-found", "App does not exist.");
  }

  const app = appSnap.data() || {};
  if (app.status !== "active") {
    throw new HttpsError("failed-precondition", "This app is not available.");
  }

  const pricing = (app.pricing || {}) as Record<string, unknown>;
  const mode = oneOf<AppPricingMode>(
    pricing.mode,
    ["invite_only", "free", "paid"],
    "invite_only"
  );

  if (mode !== "paid") {
    throw new HttpsError("failed-precondition", "This app does not use checkout.");
  }

  const checkoutBase = asString(pricing.checkoutUrl);
  if (!checkoutBase) {
    throw new HttpsError("failed-precondition", "Checkout URL is not configured for this app.");
  }

  const checkoutUrl = new URL(checkoutBase);
  if (user.email) {
    checkoutUrl.searchParams.set("email", user.email);
  }

  checkoutUrl.searchParams.set("uid", uid);
  checkoutUrl.searchParams.set("appId", appId);
  checkoutUrl.searchParams.set("appName", asString(app.name) || appId);
  checkoutUrl.searchParams.set("source", "web");

  return { url: checkoutUrl.toString() };
});

export const grantFreeAppAccess = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const appId = asString(data.appId);

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  const userRef = db.collection("users").doc(uid);
  const appRef = db.collection("apps").doc(appId);

  await db.runTransaction(async (transaction) => {
    const [userSnap, appSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(appRef)
    ]);

    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const app = appSnap.data() || {};
    const pricing = (app.pricing || {}) as Record<string, unknown>;
    const mode = oneOf<AppPricingMode>(
      pricing.mode,
      ["invite_only", "free", "paid"],
      "invite_only"
    );

    if (app.status !== "active" || app.visibility !== "public" || mode !== "free") {
      throw new HttpsError("failed-precondition", "This app is not available as a free app.");
    }

    const profile = userSnap.data() || {};
    const currentDeviceLimit = Number(profile.deviceLimit || 5);

    transaction.update(userRef, {
      accessStatus: "active",
      planType: "free",
      licenseStatus: "free",
      deviceLimit: Math.max(currentDeviceLimit, 5),
      ...appAccessPatch(appId, asString(app.name) || appId, "user", {
        source: "free"
      }),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, appId };
});

export const createInvite = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const appId = asString(data.appId);
  const benefit = benefitFromRequest(data.benefit);

  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required.");
  }

  const userRef = db.collection("users").doc(uid);
  const appRef = db.collection("apps").doc(appId);
  const code = generateInviteCode();
  const inviteRef = db.collection("invites").doc(code);
  const expiresAt = Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const result = await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const appSnap = await transaction.get(appRef);
    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    if (!appSnap.exists) {
      throw new HttpsError("not-found", "App does not exist.");
    }

    const profile = userSnap.data() || {};
    if (!isSiteAdmin(profile)) {
      throw new HttpsError("permission-denied", "Only the site admin can create invites.");
    }

    const app = appSnap.data() || {};

    const inviteQuota = Number(profile.inviteQuota || 0);
    if (inviteQuota < 1) {
      throw new HttpsError("failed-precondition", "No invite quota remaining.");
    }

    transaction.create(inviteRef, {
      code,
      appId,
      appName: app.name || appId,
      inviterUid: uid,
      usedBy: null,
      benefit,
      status: "unused",
      expiresAt,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.update(userRef, {
      inviteQuota: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp()
    });

    return {
      code,
      appId,
      appName: app.name || appId,
      remainingInviteQuota: inviteQuota - 1
    };
  });

  return result;
});

export const redeemInvite = onCall({ region }, async (request) => {
  const uid = requireUid(request);
  const code = normalizeInviteCode((request.data as Record<string, unknown> | undefined)?.code);

  if (!code) {
    throw new HttpsError("invalid-argument", "A valid invite code is required.");
  }

  const inviteRef = db.collection("invites").doc(code);
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);
    const userSnap = await transaction.get(userRef);

    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "Invite code does not exist.");
    }

    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "Create a user profile first.");
    }

    const invite = inviteSnap.data() || {};
    if (invite.inviterUid === uid) {
      throw new HttpsError("failed-precondition", "You cannot redeem your own invite.");
    }

    if (invite.status !== "unused") {
      throw new HttpsError("failed-precondition", "Invite code has already been used.");
    }

    const expiresAt = invite.expiresAt as Timestamp | undefined;
    if (expiresAt && expiresAt.toMillis() < Date.now()) {
      transaction.update(inviteRef, {
        status: "expired",
        updatedAt: FieldValue.serverTimestamp()
      });
      throw new HttpsError("failed-precondition", "Invite code has expired.");
    }

    const benefit = benefitFromRequest(invite.benefit);
    const appId = asString(invite.appId);
    const appName = asString(invite.appName) || appId || "Brainok App";
    const profile = userSnap.data() || {};
    const currentDeviceLimit = Number(profile.deviceLimit || 5);

    transaction.update(inviteRef, {
      status: "used",
      usedBy: uid,
      usedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const userPatch: Record<string, unknown> = {
      accessStatus: "active",
      planType: "free",
      licenseStatus: "free",
      deviceLimit: Math.max(currentDeviceLimit, 5),
      inviteGrant: compactMap({
        code,
        appId,
        benefit
      }),
      updatedAt: FieldValue.serverTimestamp()
    };

    if (appId) {
      Object.assign(
        userPatch,
        appAccessPatch(appId, appName, "user", {
          inviteCode: code
        })
      );
    }

    transaction.update(userRef, userPatch);

    return { ok: true, benefit, appId: appId || null };
  });

  return result;
});
