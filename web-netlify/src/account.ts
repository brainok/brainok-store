import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
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
  donationTitle: string;
  donationDescription: string;
  donationSuggested: string;
  donationCheckoutUrl: string;
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
    "Publish apps with thumbnails, demos, installers, and activation numbers in one place. Every app can start with a 30-day trial.",
  primaryCtaLabel: "Free Download",
  secondaryCtaLabel: "View Apps",
  downloadTitle: "Download Brainok Store",
  downloadSubtitle: "No credit card needed",
  downloadBody: "Choose the installer for your operating system. The desktop app starts a 30-day trial and accepts an activation number inside the app.",
  donationTitle: "Donation",
  donationDescription:
    "Donations are optional. They support development, but they do not replace invite access or paid app access.",
  donationSuggested: "Suggested donation: $9.99",
  donationCheckoutUrl: "https://ko-fi.com/brainok777/?hidefeed=true&widget=true&embed=true&preview=true",
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

export interface UserProfile {
  uid: string;
  email: string | null;
  accountRole?: "admin" | "user";
  planType: "free" | "pro" | "team";
  licenseStatus: string;
  accessStatus?: "pending" | "active" | "revoked";
  inviteQuota: number;
  deviceLimit: number;
  supporterStatus?: "none" | "supporter" | "refunded";
  donationCount?: number;
  donationTotalCents?: number;
  donationCurrency?: string;
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
export type AppPricingMode = "invite_only" | "free" | "paid" | "donation";
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

export interface BrainokApp {
  appId: string;
  name: string;
  slug: string;
  ownerUid: string;
  status: "active" | "archived";
  visibility?: AppVisibility;
  shortDescription?: string;
  description?: string;
  supportContent?: string;
  category?: string;
  pricing?: AppPricing;
  downloads?: AppDownloads;
  media?: AppMedia;
}

export interface UpdateAppInput {
  name?: string;
  shortDescription?: string;
  description?: string;
  supportContent?: string;
  category?: string;
  visibility?: AppVisibility;
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
