export type PlanType = "free" | "pro" | "team";

export type LicenseStatus =
  | "free"
  | "inactive"
  | "active"
  | "on_trial"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired"
  | "refunded";

export type SubscriptionProvider = "lemonsqueezy";

export type DeviceStatus = "active" | "revoked";

export type DesktopOS = "mac" | "windows" | "linux" | "unknown";

export interface LemonSqueezySubscriptionState {
  customerId?: string;
  orderId?: string;
  orderItemId?: string;
  productId?: string;
  variantId?: string;
  subscriptionId?: string;
  status?: string;
  renewsAt?: string | null;
  endsAt?: string | null;
  trialEndsAt?: string | null;
  lastEventName?: string;
  lastWebhookAt?: string;
}

export type AccountRole = "admin" | "user";
export type AccessStatus = "pending" | "active" | "revoked";
export type AppRole = "owner" | "admin" | "user";
export type AppVisibility = "public" | "private";
export type AppType = "application" | "web_app";
export type AppPricingMode = "invite_only" | "free" | "paid";
export type AppBillingInterval = "one_time" | "monthly" | "yearly" | "pay_what_you_want";
export type BrainokLicensePlan = "personal" | "pro" | "lab" | "friend";
export type BrainokLicenseStatus = "active" | "disabled" | "expired";

export interface AppAccess {
  appId: string;
  name: string;
  role: AppRole;
  accessStatus: AccessStatus;
  source?: "invite" | "free" | "paid";
  activatedAt?: unknown;
  inviteCode?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  emailLower: string | null;
  accountRole: AccountRole;
  displayName?: string | null;
  photoURL?: string | null;
  planType: PlanType;
  licenseStatus: LicenseStatus;
  accessStatus: AccessStatus;
  inviteQuota: number;
  deviceLimit: number;
  subscriptionProvider: SubscriptionProvider | null;
  lastPaymentProvider?: SubscriptionProvider;
  apps?: Record<string, AppAccess>;
  lemonSqueezy?: LemonSqueezySubscriptionState;
  createdAt: unknown;
  updatedAt: unknown;
  lastLoginAt?: unknown;
}

export interface RegisteredDevice {
  uid: string;
  os: DesktopOS;
  machineHash: string;
  appVersion?: string;
  status: DeviceStatus;
  createdAt: unknown;
  lastSeenAt: unknown;
}

export interface BrainokLicense {
  licenseId: string;
  licenseCode: string;
  email?: string | null;
  plan: BrainokLicensePlan;
  status: BrainokLicenseStatus;
  maxDevices: number;
  activationCount: number;
  allowedApps: string[];
  issuedAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BrainokLicenseActivation {
  activationId: string;
  licenseId: string;
  licenseCode: string;
  deviceId: string;
  deviceIdHash: string;
  deviceName?: string;
  appId?: string | null;
  appName?: string | null;
  status: "active" | "reset" | "revoked";
  source: "brainok_license";
  os?: DesktopOS;
  appVersion?: string | null;
  activatedAt: unknown;
  lastCheckedAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ActivateBrainokLicenseResult {
  ok: true;
  activated: true;
  activatedDate: string;
  licenseId: string;
  licenseCode: string;
  plan: BrainokLicensePlan;
  status: "active";
  maxDevices: number;
  deviceId: string;
}

export type InviteBenefit = "beta_access";

export type InviteStatus = "unused" | "used" | "expired" | "revoked";

export interface InviteCode {
  code: string;
  appId?: string;
  appName?: string;
  inviterUid: string;
  usedBy: string | null;
  benefit: InviteBenefit;
  status: InviteStatus;
  expiresAt: unknown;
  createdAt: unknown;
  usedAt?: unknown;
}

export interface CreateCheckoutResult {
  url: string;
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
  description?: string;
  category?: string;
  pricing?: {
    mode: AppPricingMode;
    priceCents: number;
    currency: string;
    interval: AppBillingInterval;
    checkoutUrl?: string | null;
  };
  downloads?: {
    releaseUrl?: string | null;
    macUrl?: string | null;
    windowsUrl?: string | null;
    docsUrl?: string | null;
    latestVersion?: string | null;
  };
  media?: {
    thumbnailUrl?: string | null;
    videoUrl?: string | null;
  };
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CreateAppResult {
  appId: string;
  name: string;
  slug: string;
}

export interface RegisterDeviceResult {
  allowed: true;
  deviceId: string;
  deviceLimit: number;
  activeDeviceCount: number;
}

export interface CreateInviteResult {
  code: string;
  appId: string;
  appName: string;
  remainingInviteQuota: number;
}

export interface RedeemInviteResult {
  ok: true;
  benefit: InviteBenefit;
  appId?: string | null;
}

export interface LemonSqueezyWebhookPayload {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
  };
}
