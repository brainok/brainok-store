import { collection, doc, getDocFromServer, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, functions, storage } from "./firebase";

export const ADMIN_EMAIL = "brainok777@gmail.com";

export interface SiteSettings {
  brandName: string;
  brandInitial: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  downloadTitle: string;
  downloadSubtitle: string;
  downloadBody: string;
  supportResources: SupportResource[];
}

export interface SupportResource {
  id: string;
  title: string;
  description: string;
  url?: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brandName: "Brainok Store",
  brandInitial: "B",
  heroEyebrow: "Trial-first desktop software",
  heroTitle: "Useful desktop tools, released like real products.",
  heroDescription:
    "Download free, use a full 30-day trial, then unlock every Brainok app with one Brainok license.",
  primaryCtaLabel: "Free Download",
  secondaryCtaLabel: "View Apps",
  downloadTitle: "Download Brainok Store",
  downloadSubtitle: "Free download. No account required.",
  downloadBody: "Choose the installer for your operating system. Each desktop app starts a 30-day trial and accepts one universal Brainok license inside the app.",
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
      title: "Brainok License",
      description: "Use one license across Brainok apps",
      url: ""
    }
  ]
};

export interface UserProfile {
  uid: string;
  email: string | null;
  accountRole?: "admin" | "user";
  planType: "free" | "pro" | "team";
  licenseStatus: string;
  accessStatus?: "pending" | "active" | "revoked";
  inviteQuota: number;
  deviceLimit: number;
  apps?: Record<string, AppAccess>;
}

export interface AppAccess {
  appId: string;
  name: string;
  role: "owner" | "admin" | "user";
  accessStatus: "pending" | "active" | "revoked";
  source?: "invite" | "free" | "paid";
}

export type AppVisibility = "public" | "private";
export type AppType = "application" | "web_app";
export type AppPricingMode = "invite_only" | "free" | "paid";
export type AppBillingInterval = "one_time" | "monthly" | "yearly" | "pay_what_you_want";

export interface AppPricing {
  mode: AppPricingMode;
  priceCents: number;
  currency: string;
  interval: AppBillingInterval;
  checkoutUrl?: string | null;
}

export interface AppDownloads {
  releaseUrl?: string | null;
  macUrl?: string | null;
  windowsUrl?: string | null;
  docsUrl?: string | null;
  latestVersion?: string | null;
}

export interface AppMedia {
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
}

export interface ActivationCodeSummary {
  code: string;
  appId: string;
  appName: string;
  status: string;
  maxActivations: number;
  activationCount: number;
  createdAt: string | null;
}

export type BrainokLicensePlan = "personal" | "pro" | "lab" | "friend";

export interface LicenseActivationSummary {
  activationId: string;
  deviceId: string;
  deviceName: string;
  appId?: string | null;
  appName?: string | null;
  status: string;
  activatedAt: string | null;
}

export interface LicenseSummary {
  licenseId: string;
  licenseCode: string;
  email: string | null;
  buyerName?: string | null;
  plan: BrainokLicensePlan;
  status: string;
  maxDevices: number;
  activationCount: number;
  emailDeliveryStatus?: "sent" | "failed" | "skipped" | string;
  lastEmailTo?: string | null;
  lastMailLogId?: string | null;
  lastEmailError?: string | null;
  issuedAt: string | null;
  createdAt: string | null;
  activations: LicenseActivationSummary[];
}

export type BrainokOrderStatus = "awaiting_payment" | "paid" | "completed" | "cancelled" | "failed";
export type BrainokPaymentMethod = "bank_transfer" | "paypal";

export interface BrainokStoreConfig {
  plans: Array<{
    id: "lifetime_2" | "lifetime_5";
    name: string;
    maxDevices: number;
    amount: number;
    currency: string;
    label: string;
    paypalAmount?: number;
    paypalCurrency?: string;
    paypalLabel?: string;
  }>;
  bank: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  paypal: {
    clientId: string | null;
    currency: string;
    environment: "sandbox" | "live";
  };
  supportEmail: string;
}

export interface BrainokOrderSummary {
  orderId: string;
  email: string;
  depositorName?: string | null;
  amount: number;
  currency: string;
  status: BrainokOrderStatus;
  paymentMethod: BrainokPaymentMethod;
  paypalOrderId?: string | null;
  licenseId?: string | null;
  licenseCode?: string | null;
  createdAt: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
}

export interface BrainokApp {
  appId: string;
  name: string;
  slug: string;
  ownerUid: string;
  status: "active" | "archived";
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
  pricing?: AppPricing;
  downloads?: AppDownloads;
  media?: AppMedia;
}

export interface UpdateAppInput {
  name?: string;
  shortDescription?: string;
  shortDescriptionKo?: string;
  description?: string;
  descriptionKo?: string;
  supportContent?: string;
  supportContentKo?: string;
  category?: string;
  visibility?: AppVisibility;
  appType?: AppType;
  sortOrder?: number;
  pricingMode?: AppPricingMode;
  priceCents?: number;
  currency?: string;
  billingInterval?: AppBillingInterval;
  checkoutUrl?: string;
  releaseUrl?: string;
  macDownloadUrl?: string;
  windowsDownloadUrl?: string;
  docsUrl?: string;
  iconUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  latestVersion?: string;
}

export interface AppQuestion {
  questionId: string;
  appId: string;
  appName: string;
  userUid: string;
  userEmail?: string | null;
  question: string;
  answer?: string | null;
  status: "open" | "answered";
  createdAt?: unknown;
  answeredAt?: unknown;
}

export function watchProfile(uid: string, onNext: (profile: UserProfile | null) => void) {
  return onSnapshot(doc(db, "users", uid), (snapshot) => {
    onNext(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
  });
}

export function watchSiteSettings(onNext: (settings: SiteSettings) => void, onError?: (error: Error) => void) {
  return onSnapshot(doc(db, "site", "public"), (snapshot) => {
    const savedSettings = snapshot.exists() ? snapshot.data() as Partial<SiteSettings> : {};
    onNext({ ...DEFAULT_SITE_SETTINGS, ...savedSettings });
  }, onError);
}

export function watchApps(onNext: (apps: BrainokApp[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(collection(db, "apps"), (snapshot) => {
    onNext(snapshot.docs.map((appDoc) => appDoc.data() as BrainokApp));
  }, onError);
}

export function watchPublicApps(onNext: (apps: BrainokApp[]) => void, onError?: (error: Error) => void) {
  const publicAppsQuery = query(collection(db, "apps"), where("visibility", "==", "public"));
  return onSnapshot(publicAppsQuery, (snapshot) => {
    onNext(snapshot.docs.map((appDoc) => appDoc.data() as BrainokApp));
  }, onError);
}

export function watchAppQuestions(appId: string, onNext: (questions: AppQuestion[]) => void, onError?: (error: Error) => void) {
  const appQuestionsQuery = query(collection(db, "appQuestions"), where("appId", "==", appId));
  return onSnapshot(appQuestionsQuery, (snapshot) => {
    onNext(snapshot.docs.map((questionDoc) => questionDoc.data() as AppQuestion));
  }, onError);
}

export async function ensureUserProfile() {
  await httpsCallable(functions, "ensureUserProfile")({});
}

export async function createCheckoutUrl() {
  const result = await httpsCallable(functions, "createCheckout")({ source: "web" });
  return (result.data as { url: string }).url;
}

export async function updateSiteSettings(input: SiteSettings) {
  const result = await httpsCallable(functions, "updateSiteSettings")(input);
  return result.data as { ok: true };
}

export async function createApp(name: string, input: UpdateAppInput = {}) {
  const result = await httpsCallable(functions, "createApp")({ name, ...input });
  return result.data as { appId: string; name: string; slug: string };
}

export async function updateApp(appId: string, input: UpdateAppInput) {
  const result = await httpsCallable(functions, "updateApp")({ appId, ...input });
  return result.data as { ok: true; appId: string };
}

export async function sendAppAnnouncement(appId: string, maxRecipients = 100) {
  const result = await httpsCallable(functions, "sendAppAnnouncement")({ appId, maxRecipients });
  return result.data as {
    ok: true;
    announcementId: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    failed?: Array<{ to: string; errorMessage: string }>;
  };
}

export async function getAppFromServer(appId: string) {
  const snapshot = await getDocFromServer(doc(db, "apps", appId));
  return snapshot.exists() ? (snapshot.data() as BrainokApp) : null;
}

export async function askAppQuestion(appId: string, question: string) {
  const result = await httpsCallable(functions, "askAppQuestion")({ appId, question });
  return result.data as { questionId: string; appId: string };
}

export async function answerAppQuestion(questionId: string, answer: string) {
  const result = await httpsCallable(functions, "answerAppQuestion")({ questionId, answer });
  return result.data as { ok: true; questionId: string };
}

export async function createAppCheckoutUrl(appId: string) {
  const result = await httpsCallable(functions, "createAppCheckout")({ appId });
  return (result.data as { url: string }).url;
}

export async function createActivationCode(appId: string, maxActivations = 1, assignedEmail = "") {
  const result = await httpsCallable(functions, "createActivationCode")({
    appId,
    maxActivations,
    assignedEmail
  });

  return result.data as {
    code: string;
    appId: string;
    appName: string;
    assignedEmailLower: string | null;
    maxActivations: number;
  };
}

export async function listMyActivationCodes() {
  const result = await httpsCallable(functions, "listMyActivationCodes")({});
  return (result.data as { activationCodes: ActivationCodeSummary[] }).activationCodes;
}

export async function createLicense(input: {
  buyerName?: string;
  email?: string;
  plan: BrainokLicensePlan;
  licenseCode?: string;
  maxDevices?: number;
}) {
  const result = await httpsCallable(functions, "createLicense")(input);
  return result.data as LicenseSummary & {
    emailDelivery?: {
      status: "sent" | "failed" | "skipped";
      to: string | null;
      emailId?: string | null;
      mailLogId?: string;
      errorMessage?: string;
    };
  };
}

export async function requestBrainokLicense(input: {
  name?: string;
  email: string;
  plan: string;
  devices: number;
  message?: string;
  language: "ko" | "en";
}) {
  const result = await httpsCallable(functions, "requestBrainokLicense")(input);
  return result.data as {
    ok: true;
    requestId: string;
    emailNotificationStatus: "sent" | "failed";
    mailLogId?: string;
    errorMessage?: string;
  };
}

export async function getBrainokStoreConfig() {
  const result = await httpsCallable(functions, "getBrainokStoreConfig")({});
  return result.data as BrainokStoreConfig;
}

export async function createBankTransferOrder(input: {
  email: string;
  depositorName: string;
  planId: "lifetime_2" | "lifetime_5";
  agreementAccepted: boolean;
}) {
  const result = await httpsCallable(functions, "createBankTransferOrder")(input);
  return result.data as {
    ok: true;
    order: BrainokOrderSummary;
    orderEmailDelivery?: {
      status: "sent" | "failed" | "skipped";
      to?: string | null;
      errorMessage?: string;
    };
    adminOrderEmailDelivery?: {
      status: "sent" | "failed" | "skipped";
      to?: string | null;
      errorMessage?: string;
    };
    bank: BrainokStoreConfig["bank"];
    instructions: string;
  };
}

export async function createPayPalOrder(input: {
  email: string;
  planId: "lifetime_2" | "lifetime_5";
  agreementAccepted: boolean;
}) {
  const result = await httpsCallable(functions, "createPayPalOrder")(input);
  return result.data as {
    ok: true;
    orderId: string;
    paypalOrderId: string;
  };
}

export async function capturePayPalOrder(input: {
  orderId: string;
  paypalOrderId: string;
}) {
  const result = await httpsCallable(functions, "capturePayPalOrder")(input);
  return result.data as {
    ok: true;
    order: BrainokOrderSummary;
    license: {
      licenseId: string;
      licenseCode: string;
      email: string | null;
    };
    emailDelivery?: {
      status: "sent" | "failed" | "skipped";
      to: string | null;
      errorMessage?: string;
    };
  };
}

export async function listOrders(status = "all") {
  const result = await httpsCallable(functions, "listOrders")({ status });
  return (result.data as { orders: BrainokOrderSummary[] }).orders;
}

export async function approveBankTransferOrder(orderId: string) {
  const result = await httpsCallable(functions, "approveBankTransferOrder")({ orderId });
  return result.data as {
    ok: true;
    order: BrainokOrderSummary;
    license: {
      licenseId: string;
      licenseCode: string;
      email: string | null;
    };
    emailDelivery?: {
      status: "sent" | "failed" | "skipped";
      to: string | null;
      errorMessage?: string;
    };
  };
}

export async function cancelOrder(orderId: string) {
  const result = await httpsCallable(functions, "cancelOrder")({ orderId });
  return result.data as { ok: true; orderId: string; status: "cancelled" };
}

export async function listLicenses(search = "") {
  const result = await httpsCallable(functions, "listLicenses")({ search });
  return (result.data as { licenses: LicenseSummary[] }).licenses;
}

export async function disableLicense(licenseCode: string) {
  const result = await httpsCallable(functions, "disableLicense")({ licenseCode });
  return result.data as { ok: true };
}

export async function resetLicenseDevice(activationId: string) {
  const result = await httpsCallable(functions, "resetLicenseDevice")({ activationId });
  return result.data as { ok: true; activationId: string };
}

export async function sendTestLicenseEmail() {
  const result = await httpsCallable(functions, "sendTestLicenseEmail")({});
  return result.data as {
    ok: true;
    to: string;
    emailId: string | null;
    mailLogId: string;
    licenseCode: string;
  };
}

export async function sendLicenseEmail(licenseCode: string, to?: string) {
  const result = await httpsCallable(functions, "sendLicenseEmail")({ licenseCode, to });
  return result.data as {
    ok: true;
    to: string;
    emailId: string | null;
    mailLogId: string;
    licenseId: string;
    licenseCode: string;
  };
}

export async function resendLicenseEmail(licenseCode: string, to?: string) {
  const result = await httpsCallable(functions, "resendLicenseEmail")({ licenseCode, to });
  return result.data as {
    ok: true;
    to: string;
    emailId: string | null;
    mailLogId: string;
    licenseId: string;
    licenseCode: string;
  };
}

export async function createSharedAccessCode(appId: string, code: string, maxRedemptions = 0) {
  const result = await httpsCallable(functions, "createSharedAccessCode")({
    appId,
    code,
    maxRedemptions
  });

  return result.data as {
    code: string;
    appId: string;
    appName: string;
    maxRedemptions: number;
  };
}

export async function redeemSharedAccessCode(code: string) {
  const result = await httpsCallable(functions, "redeemSharedAccessCode")({ code });

  return result.data as {
    ok: true;
    code: string;
    appId: string;
    appName: string;
    activationCode: string;
    alreadyRedeemed: boolean;
  };
}

export async function grantFreeAppAccess(appId: string) {
  const result = await httpsCallable(functions, "grantFreeAppAccess")({ appId });
  return result.data as { ok: true; appId: string };
}

export async function createInvite(appId: string) {
  const result = await httpsCallable(functions, "createInvite")({ appId });
  return result.data as {
    code: string;
    appId: string;
    appName: string;
    remainingInviteQuota: number;
  };
}

export async function redeemInvite(code: string) {
  const result = await httpsCallable(functions, "redeemInvite")({ code });
  return result.data as { ok: true; benefit: "beta_access"; appId?: string | null };
}

export type ReleaseUploadTarget = "release" | "windows" | "mac" | "docs" | "icon" | "thumbnail" | "video";

export async function uploadAppReleaseFile({
  appId,
  ownerUid,
  file,
  target,
  onProgress
}: {
  appId: string;
  ownerUid: string;
  file: File;
  target: ReleaseUploadTarget;
  onProgress?: (progress: number) => void;
}) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `app-releases/${ownerUid}/${appId}/${target}/${Date.now()}-${safeName}`;
  const uploadTask = uploadBytesResumable(ref(storage, path), file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: {
      appId,
      target,
      originalName: file.name
    }
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      resolve
    );
  });

  const url = await getDownloadURL(uploadTask.snapshot.ref);
  return { url, path, fileName: file.name };
}
