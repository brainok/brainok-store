import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
initializeApp();
const db = getFirestore();
const auth = getAuth();
const region = process.env.FUNCTION_REGION || "asia-northeast3";
const lemonSqueezyWebhookSecret = defineSecret("LEMONSQUEEZY_WEBHOOK_SECRET");
const qnaSmtpPassword = defineSecret("QNA_SMTP_PASSWORD");
const adminEmail = "brainok777@gmail.com";
const trialLengthMs = 30 * 24 * 60 * 60 * 1000;
const defaultSiteSettings = {
    brandName: "Brainok App",
    brandInitial: "B",
    heroEyebrow: "Trial-first desktop software",
    heroTitle: "Useful desktop tools, released like real products.",
    heroDescription: "Publish apps with thumbnails, demos, installers, activation numbers, and optional donations in one place. Every app can start with a 30-day trial.",
    primaryCtaLabel: "Free Download",
    secondaryCtaLabel: "View Apps",
    downloadTitle: "Download Brainok App",
    downloadSubtitle: "No credit card needed",
    downloadBody: "Choose the installer for your operating system. The desktop app starts a 30-day trial and accepts an activation number inside the app.",
    donationTitle: "Donation",
    donationDescription: "Donations are optional. They support development, but they do not replace invite access or paid app access.",
    donationSuggested: "Suggested donation: $9.99",
    donationCheckoutUrl: "",
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
function requireUid(request) {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError("unauthenticated", "Sign in first.");
    }
    return uid;
}
function asString(value) {
    if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    return undefined;
}
function asNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
function oneOf(value, allowed, fallback) {
    const raw = asString(value);
    return raw && allowed.includes(raw) ? raw : fallback;
}
function optionalUrl(value) {
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
    }
    catch {
        throw new HttpsError("invalid-argument", "Use a valid http or https URL.");
    }
}
function normalizeCurrency(value, fallback = "USD") {
    const raw = asString(value) || fallback;
    return raw.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || fallback;
}
function normalizePriceCents(value) {
    const price = asNumber(value) ?? 0;
    return Math.max(0, Math.round(price));
}
function emailLower(email) {
    return email ? email.trim().toLowerCase() : null;
}
function profileEmailLower(profile) {
    return emailLower(asString(profile.emailLower) || asString(profile.email));
}
function slugify(value) {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "app";
}
function compactMap(input) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
function boundedString(value, fallback, maxLength = 500) {
    const raw = asString(value) ?? fallback;
    return raw.slice(0, maxLength);
}
function textField(value, fallback, maxLength = 500) {
    if (value === undefined) {
        return fallback.slice(0, maxLength);
    }
    if (typeof value === "string") {
        return value.slice(0, maxLength);
    }
    return (asString(value) ?? fallback).slice(0, maxLength);
}
function htmlEscape(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
async function notifyAdminOfAppQuestion({ questionId, appId, appName, userEmail, question }) {
    const smtpPassword = qnaSmtpPassword.value();
    if (!smtpPassword) {
        console.warn("QNA_SMTP_PASSWORD is not configured; skipping QnA email notification.");
        return;
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
function boundedSupportResources(value) {
    if (!Array.isArray(value)) {
        return defaultSiteSettings.supportResources;
    }
    return value.slice(0, 12).map((item, index) => {
        const resource = (item || {});
        const fallback = defaultSiteSettings.supportResources[index] || defaultSiteSettings.supportResources[0];
        return {
            id: boundedString(resource.id, fallback.id || `support-${index + 1}`, 60),
            title: boundedString(resource.title, fallback.title, 80),
            description: boundedString(resource.description, fallback.description, 160),
            url: boundedString(resource.url, "", 500)
        };
    }).filter((item) => item.title.length > 0);
}
function inferredAccountRole(profile) {
    return profileEmailLower(profile) === adminEmail ? "admin" : "user";
}
function isSiteAdmin(profile) {
    return inferredAccountRole(profile) === "admin";
}
function sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
}
function verifyLemonSignature(rawBody, signatureHeader, secret) {
    if (!rawBody || !signatureHeader || !secret) {
        return false;
    }
    const expected = Buffer.from(crypto.createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
    const actual = Buffer.from(signatureHeader, "utf8");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
function payloadAttributes(payload) {
    return payload.data?.attributes || {};
}
function payloadUid(payload) {
    const custom = payload.meta?.custom_data || {};
    return asString(custom.uid) || asString(custom.user_id);
}
function payloadEmail(payload) {
    return asString(payloadAttributes(payload).user_email);
}
function payloadCustomData(payload) {
    return payload.meta?.custom_data || {};
}
async function resolveUserRef(payload) {
    const uid = payloadUid(payload);
    if (uid) {
        return db.collection("users").doc(uid);
    }
    const email = emailLower(payloadEmail(payload));
    if (!email) {
        return null;
    }
    const existing = await db
        .collection("users")
        .where("emailLower", "==", email)
        .limit(1)
        .get();
    if (!existing.empty) {
        return existing.docs[0].ref;
    }
    try {
        const user = await auth.getUserByEmail(email);
        return db.collection("users").doc(user.uid);
    }
    catch {
        return null;
    }
}
function mapSubscriptionStatus(eventName, rawStatus) {
    if (eventName === "order_refunded" || eventName === "subscription_payment_refunded") {
        return "refunded";
    }
    if (eventName === "subscription_expired") {
        return "expired";
    }
    if (eventName === "subscription_cancelled") {
        return "cancelled";
    }
    if (eventName === "subscription_paused") {
        return "paused";
    }
    if (rawStatus === "active") {
        return "active";
    }
    if (rawStatus === "on_trial") {
        return "on_trial";
    }
    if (rawStatus === "past_due") {
        return "past_due";
    }
    if (rawStatus === "paused") {
        return "paused";
    }
    if (rawStatus === "cancelled") {
        return "cancelled";
    }
    if (rawStatus === "expired") {
        return "expired";
    }
    return "inactive";
}
function hasProAccess(status) {
    return status === "active" || status === "on_trial";
}
function lemonState(payload, eventName) {
    const data = payload.data || {};
    const attrs = payloadAttributes(payload);
    const dataType = asString(data.type);
    return compactMap({
        customerId: asString(attrs.customer_id),
        orderId: asString(attrs.order_id),
        orderItemId: asString(attrs.order_item_id),
        productId: asString(attrs.product_id),
        variantId: asString(attrs.variant_id),
        subscriptionId: asString(attrs.subscription_id) ||
            (dataType === "subscriptions" ? asString(data.id) : undefined),
        invoiceId: dataType === "subscription-invoices" ? asString(data.id) : undefined,
        status: asString(attrs.status),
        renewsAt: asString(attrs.renews_at) || null,
        endsAt: asString(attrs.ends_at) || null,
        trialEndsAt: asString(attrs.trial_ends_at) || null,
        lastEventName: eventName,
        lastWebhookAt: new Date().toISOString()
    });
}
async function writePendingPayment(payload, eventName) {
    const email = emailLower(payloadEmail(payload));
    const id = sha256(`${eventName}:${email || "unknown"}:${payload.data?.id || crypto.randomUUID()}`);
    await db.collection("pendingPayments").doc(id).set({
        email,
        eventName,
        payload,
        createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
}
async function applyLemonEvent(payload, eventName) {
    const customData = payloadCustomData(payload);
    const purpose = asString(customData.purpose);
    const appId = asString(customData.appId);
    if (appId && purpose === "app_purchase") {
        await applyAppPurchaseEvent(payload, eventName);
        return;
    }
    if (eventName === "order_created" || eventName === "order_refunded") {
        await applyDonationEvent(payload, eventName);
        return;
    }
    const userRef = await resolveUserRef(payload);
    if (!userRef) {
        await writePendingPayment(payload, eventName);
        return;
    }
    const attrs = payloadAttributes(payload);
    const status = mapSubscriptionStatus(eventName, asString(attrs.status));
    const proAccess = hasProAccess(status);
    const email = payloadEmail(payload) || null;
    const userUpdate = compactMap({
        email,
        emailLower: email ? emailLower(email) : undefined,
        planType: proAccess ? "pro" : "free",
        licenseStatus: status,
        inviteQuota: proAccess ? 3 : 0,
        deviceLimit: proAccess ? 2 : 1,
        subscriptionProvider: "lemonsqueezy",
        lemonSqueezy: lemonState(payload, eventName),
        updatedAt: FieldValue.serverTimestamp()
    });
    await userRef.set(userUpdate, { merge: true });
    const subscriptionId = asString(userUpdate.lemonSqueezy && userUpdate.lemonSqueezy.subscriptionId);
    if (subscriptionId) {
        await db.collection("subscriptions").doc(subscriptionId).set(compactMap({
            uid: userRef.id,
            provider: "lemonsqueezy",
            licenseStatus: status,
            planType: proAccess ? "pro" : "free",
            lemonSqueezy: lemonState(payload, eventName),
            updatedAt: FieldValue.serverTimestamp()
        }), { merge: true });
    }
}
async function applyDonationEvent(payload, eventName) {
    const userRef = await resolveUserRef(payload);
    if (!userRef) {
        await writePendingPayment(payload, eventName);
        return;
    }
    const attrs = payloadAttributes(payload);
    const isRefund = eventName === "order_refunded";
    const orderId = asString(payload.data?.id) ||
        asString(attrs.order_id) ||
        sha256(JSON.stringify(payload));
    const amountCents = asNumber(attrs.total) ?? asNumber(attrs.subtotal);
    const currency = asString(attrs.currency);
    const email = payloadEmail(payload);
    const customData = payloadCustomData(payload);
    const appId = asString(customData.appId);
    const purpose = asString(customData.purpose);
    const userUpdate = compactMap({
        email,
        emailLower: emailLower(email),
        supporterStatus: isRefund ? "refunded" : "supporter",
        donationCurrency: currency,
        lastPaymentProvider: "lemonsqueezy",
        lemonSqueezy: lemonState(payload, eventName),
        lastDonationAt: isRefund ? undefined : FieldValue.serverTimestamp(),
        lastRefundAt: isRefund ? FieldValue.serverTimestamp() : undefined,
        updatedAt: FieldValue.serverTimestamp()
    });
    if (!isRefund) {
        userUpdate.donationCount = FieldValue.increment(1);
        if (amountCents !== undefined) {
            userUpdate.donationTotalCents = FieldValue.increment(amountCents);
        }
    }
    await userRef.set(userUpdate, { merge: true });
    await db.collection("donations").doc(orderId).set(compactMap({
        uid: userRef.id,
        provider: "lemonsqueezy",
        eventName,
        orderId,
        appId,
        purpose,
        amountCents,
        currency,
        email,
        lemonSqueezy: lemonState(payload, eventName),
        rawAttributes: attrs,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
    }), { merge: true });
}
async function applyAppPurchaseEvent(payload, eventName) {
    const userRef = await resolveUserRef(payload);
    if (!userRef) {
        await writePendingPayment(payload, eventName);
        return;
    }
    const customData = payloadCustomData(payload);
    const appId = asString(customData.appId);
    if (!appId) {
        await writePendingPayment(payload, eventName);
        return;
    }
    const appRef = db.collection("apps").doc(appId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
        await writePendingPayment(payload, eventName);
        return;
    }
    const app = appSnap.data() || {};
    const attrs = payloadAttributes(payload);
    const rawStatus = asString(attrs.status);
    const revoked = eventName === "order_refunded" ||
        eventName === "subscription_cancelled" ||
        eventName === "subscription_expired" ||
        eventName === "subscription_payment_refunded" ||
        rawStatus === "cancelled" ||
        rawStatus === "expired" ||
        rawStatus === "refunded";
    const orderId = asString(payload.data?.id) ||
        asString(attrs.order_id) ||
        sha256(JSON.stringify(payload));
    const email = payloadEmail(payload);
    const amountCents = asNumber(attrs.total) ?? asNumber(attrs.subtotal);
    const currency = asString(attrs.currency);
    const role = "user";
    const accessStatus = revoked ? "revoked" : "active";
    await userRef.set(compactMap({
        email: email || undefined,
        emailLower: email ? emailLower(email) : undefined,
        accessStatus: revoked ? undefined : "active",
        planType: "free",
        licenseStatus: "free",
        deviceLimit: revoked ? undefined : 5,
        [`apps.${appId}`]: compactMap({
            appId,
            name: asString(app.name) || appId,
            role,
            accessStatus,
            source: "paid",
            orderId,
            activatedAt: revoked ? undefined : FieldValue.serverTimestamp(),
            revokedAt: revoked ? FieldValue.serverTimestamp() : undefined,
            lemonSqueezy: lemonState(payload, eventName)
        }),
        updatedAt: FieldValue.serverTimestamp()
    }), { merge: true });
    await db.collection("purchases").doc(orderId).set(compactMap({
        uid: userRef.id,
        appId,
        appName: asString(app.name) || appId,
        provider: "lemonsqueezy",
        eventName,
        status: accessStatus,
        amountCents,
        currency,
        email,
        lemonSqueezy: lemonState(payload, eventName),
        rawAttributes: attrs,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
    }), { merge: true });
}
export const lemonsqueezyWebhook = onRequest({
    region,
    cors: false,
    secrets: [lemonSqueezyWebhookSecret]
}, async (request, response) => {
    if (request.method !== "POST") {
        response.status(405).send("Method not allowed");
        return;
    }
    const signature = request.get("x-signature") || undefined;
    const valid = verifyLemonSignature(request.rawBody, signature, lemonSqueezyWebhookSecret.value());
    if (!valid) {
        response.status(401).send("Invalid signature");
        return;
    }
    const payload = request.body;
    const eventName = request.get("x-event-name") || payload.meta?.event_name || "unknown";
    const eventId = sha256(request.rawBody || JSON.stringify(payload));
    try {
        await applyLemonEvent(payload, eventName);
        await db.collection("webhookEvents").doc(eventId).set({
            eventName,
            dataType: payload.data?.type || null,
            dataId: payload.data?.id || null,
            handledAt: FieldValue.serverTimestamp()
        }, { merge: true });
        response.status(200).json({ ok: true });
    }
    catch (error) {
        console.error("Lemon Squeezy webhook failed", error);
        response.status(500).json({ ok: false });
    }
});
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
        await userRef.set({
            email: user.email || null,
            emailLower: emailLower(user.email),
            accountRole: inferredAccountRole(currentProfile),
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            accessStatus: existing.accessStatus || "pending",
            deviceLimit: Math.max(Number(existing.deviceLimit || 0), 5),
            supporterStatus: existing.supporterStatus || "none",
            donationCount: existing.donationCount ?? 0,
            donationTotalCents: existing.donationTotalCents ?? 0,
            lastLoginAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
    }
    else {
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
            subscriptionProvider: null,
            supporterStatus: "none",
            donationCount: 0,
            donationTotalCents: 0,
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
    const checkoutBase = process.env.LEMONSQUEEZY_CHECKOUT_URL;
    if (!checkoutBase) {
        throw new HttpsError("failed-precondition", "LEMONSQUEEZY_CHECKOUT_URL is not configured.");
    }
    const source = asString(request.data?.source) || "app";
    const checkoutUrl = new URL(checkoutBase);
    if (user.email) {
        checkoutUrl.searchParams.set("checkout[email]", user.email);
    }
    checkoutUrl.searchParams.set("checkout[custom][uid]", uid);
    checkoutUrl.searchParams.set("checkout[custom][source]", source);
    return { url: checkoutUrl.toString() };
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
    const data = (request.data || {});
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
        donationTitle: boundedString(data.donationTitle, defaultSiteSettings.donationTitle, 80),
        donationDescription: boundedString(data.donationDescription, defaultSiteSettings.donationDescription, 400),
        donationSuggested: boundedString(data.donationSuggested, defaultSiteSettings.donationSuggested, 80),
        donationCheckoutUrl: boundedString(data.donationCheckoutUrl, defaultSiteSettings.donationCheckoutUrl, 500),
        supportResources: boundedSupportResources(data.supportResources),
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp()
    };
    await db.collection("site").doc("public").set(settings, { merge: true });
    return { ok: true };
});
export const registerDevice = onCall({ region }, async (request) => {
    const uid = requireUid(request);
    const data = (request.data || {});
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
            throw new HttpsError("failed-precondition", `Device limit reached (${deviceLimit}).`);
        }
        const now = FieldValue.serverTimestamp();
        transaction.set(deviceRef, compactMap({
            uid,
            os,
            machineHash,
            appVersion,
            status: "active",
            createdAt: deviceSnap.exists ? deviceSnap.data()?.createdAt : now,
            lastSeenAt: now
        }), { merge: true });
        return {
            allowed: true,
            deviceId,
            deviceLimit,
            activeDeviceCount: existingActive ? activeDevices.size : activeDevices.size + 1
        };
    });
    return result;
});
function generateInviteCode() {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}
function normalizeInviteCode(value) {
    const code = asString(value)?.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code || code.length < 8) {
        return undefined;
    }
    return `${code.slice(0, 5)}-${code.slice(5, 10)}`;
}
function normalizeSharedAccessCode(value) {
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
function benefitFromRequest(_value) {
    return "beta_access";
}
function generateActivationCode() {
    const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
    return `BRN-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
function normalizeActivationCode(value) {
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
function activationRequest(data) {
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
function timestampMillis(value) {
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
function activationStatus(record) {
    const status = oneOf(record.status, ["trial", "active", "expired", "revoked"], "trial");
    if (status === "trial") {
        const trialEndsAt = timestampMillis(record.trialEndsAt);
        if (trialEndsAt && trialEndsAt <= Date.now()) {
            return "expired";
        }
    }
    return status;
}
function activationResponse(appId, appName, record) {
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
function appAccessPatch(appId, name, role, extra = {}) {
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
function appSettingsFromRequest(data, defaults = {}) {
    const pricingMode = oneOf(data.pricingMode, ["invite_only", "free", "paid", "donation"], defaults.pricingMode || "invite_only");
    const billingInterval = oneOf(data.billingInterval, ["one_time", "monthly", "yearly", "pay_what_you_want"], defaults.billingInterval || "one_time");
    return {
        shortDescription: textField(data.shortDescription, defaults.shortDescription ?? "", 260),
        shortDescriptionKo: textField(data.shortDescriptionKo, defaults.shortDescriptionKo ?? "", 260),
        description: textField(data.description, defaults.description ?? "", 20000),
        descriptionKo: textField(data.descriptionKo, defaults.descriptionKo ?? "", 20000),
        supportContent: textField(data.supportContent, defaults.supportContent ?? "", 20000),
        supportContentKo: textField(data.supportContentKo, defaults.supportContentKo ?? "", 20000),
        category: asString(data.category) ?? defaults.category ?? "",
        visibility: oneOf(data.visibility, ["public", "private"], defaults.visibility || "public"),
        appType: oneOf(data.appType, ["application", "web_app"], defaults.appType || "application"),
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
    const data = (request.data || {});
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
        transaction.update(userRef, {
            ...appAccessPatch(appId, name, "owner"),
            updatedAt: FieldValue.serverTimestamp()
        });
    });
    return { appId, name, slug };
});
export const updateApp = onCall({ region }, async (request) => {
    const uid = requireUid(request);
    const data = (request.data || {});
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
        const existingPricing = (app.pricing || {});
        const existingDownloads = (app.downloads || {});
        const existingMedia = (app.media || {});
        const settings = appSettingsFromRequest(data, {
            pricingMode: oneOf(existingPricing.mode, ["invite_only", "free", "paid", "donation"], "invite_only"),
            priceCents: normalizePriceCents(existingPricing.priceCents),
            currency: normalizeCurrency(existingPricing.currency),
            billingInterval: oneOf(existingPricing.interval, ["one_time", "monthly", "yearly", "pay_what_you_want"], "one_time"),
            checkoutUrl: asString(existingPricing.checkoutUrl) || null,
            releaseUrl: asString(existingDownloads.releaseUrl) || null,
            macDownloadUrl: asString(existingDownloads.macUrl) || null,
            windowsDownloadUrl: asString(existingDownloads.windowsUrl) || null,
            docsUrl: asString(existingDownloads.docsUrl) || null,
            iconUrl: asString(existingMedia.iconUrl) || null,
            thumbnailUrl: asString(existingMedia.thumbnailUrl) || null,
            videoUrl: asString(existingMedia.videoUrl) || null,
            latestVersion: asString(existingDownloads.latestVersion) || null,
            visibility: oneOf(app.visibility, ["public", "private"], "public"),
            appType: oneOf(app.appType, ["application", "web_app"], "application"),
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
export const askAppQuestion = onCall({ region, secrets: [qnaSmtpPassword] }, async (request) => {
    const uid = requireUid(request);
    const data = (request.data || {});
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });
    await notifyAdminOfAppQuestion({
        questionId: questionRef.id,
        appId,
        appName,
        userEmail: user.email || null,
        question
    }).catch((error) => {
        console.error("Could not send QnA email notification.", error);
    });
    return { questionId: questionRef.id, appId };
});
export const answerAppQuestion = onCall({ region }, async (request) => {
    const uid = requireUid(request);
    const data = (request.data || {});
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
    const data = (request.data || {});
    const appId = asString(data.appId);
    const assignedEmailLower = emailLower(asString(data.assignedEmail));
    if (!appId) {
        throw new HttpsError("invalid-argument", "appId is required.");
    }
    const maxActivations = Math.min(50, Math.max(1, Math.round(asNumber(data.maxActivations) ?? 1)));
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
export const createSharedAccessCode = onCall({ region }, async (request) => {
    const uid = requireUid(request);
    const data = (request.data || {});
    const appId = asString(data.appId);
    const code = normalizeSharedAccessCode(data.code);
    if (!appId) {
        throw new HttpsError("invalid-argument", "appId is required.");
    }
    if (!code) {
        throw new HttpsError("invalid-argument", "Use a valid shared access code.");
    }
    const maxRedemptions = Math.min(10000, Math.max(0, Math.round(asNumber(data.maxRedemptions) ?? 0)));
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
    const data = (request.data || {});
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
    const data = (request.data || {});
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
            status: "not_found",
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
    const data = (request.data || {});
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
    const data = (request.data || {});
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
        const codePatch = {
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
export const createAppCheckout = onCall({ region }, async (request) => {
    const uid = requireUid(request);
    const user = await auth.getUser(uid);
    const data = (request.data || {});
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
    const pricing = (app.pricing || {});
    const mode = oneOf(pricing.mode, ["invite_only", "free", "paid", "donation"], "invite_only");
    if (mode !== "paid" && mode !== "donation") {
        throw new HttpsError("failed-precondition", "This app does not use checkout.");
    }
    const checkoutBase = asString(pricing.checkoutUrl);
    if (!checkoutBase) {
        throw new HttpsError("failed-precondition", "Checkout URL is not configured for this app.");
    }
    const checkoutUrl = new URL(checkoutBase);
    if (user.email) {
        checkoutUrl.searchParams.set("checkout[email]", user.email);
    }
    checkoutUrl.searchParams.set("checkout[custom][uid]", uid);
    checkoutUrl.searchParams.set("checkout[custom][appId]", appId);
    checkoutUrl.searchParams.set("checkout[custom][appName]", asString(app.name) || appId);
    checkoutUrl.searchParams.set("checkout[custom][purpose]", mode === "donation" ? "app_donation" : "app_purchase");
    checkoutUrl.searchParams.set("checkout[custom][source]", "web");
    return { url: checkoutUrl.toString() };
});
export const grantFreeAppAccess = onCall({ region }, async (request) => {
    const uid = requireUid(request);
    const data = (request.data || {});
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
        const pricing = (app.pricing || {});
        const mode = oneOf(pricing.mode, ["invite_only", "free", "paid", "donation"], "invite_only");
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
    const data = (request.data || {});
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
    const code = normalizeInviteCode(request.data?.code);
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
        const expiresAt = invite.expiresAt;
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
        const userPatch = {
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
            Object.assign(userPatch, appAccessPatch(appId, appName, "user", {
                inviteCode: code
            }));
        }
        transaction.update(userRef, userPatch);
        return { ok: true, benefit, appId: appId || null };
    });
    return result;
});
//# sourceMappingURL=index.js.map