import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Maximize2,
  Package,
  PlayCircle,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  ShoppingCart,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";
import { auth } from "./firebase";
import {
  BrainokApp,
  ADMIN_EMAIL,
  AppType,
  AppQuestion,
  DEFAULT_SITE_SETTINGS,
  SiteSettings,
  SupportResource,
  UserProfile,
  ActivationCodeSummary,
  answerAppQuestion,
  askAppQuestion,
  createActivationCode,
  createApp,
  createSharedAccessCode,
  ensureUserProfile,
  grantFreeAppAccess,
  listMyActivationCodes,
  redeemSharedAccessCode,
  updateSiteSettings,
  updateApp,
  uploadAppReleaseFile,
  ReleaseUploadTarget,
  watchApps,
  watchAppQuestions,
  watchPublicApps,
  watchProfile,
  watchSiteSettings
} from "./account";

type Tab = "apps" | "webApps" | "support" | "download" | "account";
type AppOpenRequest = { appId: string; key: number } | null;

const BRAND_NAME = "Brainok Store";
const BRAND_LOGO_SRC = "/brainok-store-logo.png";
const KOFI_ACCOUNT_SLUG = "brainok777";
const KOFI_PAGE_URL = `https://ko-fi.com/${KOFI_ACCOUNT_SLUG}`;
const KOFI_CHECKOUT_URL = `${KOFI_PAGE_URL}#checkoutModal`;
const KOFI_TIP_PANEL_URL = `${KOFI_PAGE_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;
const KOFI_BUTTON_IMAGE_URL = "https://storage.ko-fi.com/cdn/kofi6.png?v=6";
const KOFI_OVERLAY_SCRIPT_URL = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
const LOCAL_APP_MEDIA: Record<string, string> = {
  "brainok-pagewheel": "/app-media/brainok-pagewheel.jpg",
  "brainok-pagewheel-afcc05": "/app-media/brainok-pagewheel.jpg",
  "hotkey-launcher": "/app-media/hotkey-launcher.jpg",
  "hotkey-launcher-c16cbb": "/app-media/hotkey-launcher.jpg",
  "recent-file-launcher": "/app-media/recent-file-launcher.jpg",
  "recent-file-launcher-2c4ea8": "/app-media/recent-file-launcher.jpg"
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [ready, setReady] = useState(false);
  const [navApps, setNavApps] = useState<BrainokApp[]>([]);
  const [tab, setTab] = useState<Tab>("apps");
  const [error, setError] = useState<string | null>(null);
  const [homeResetKey, setHomeResetKey] = useState(0);
  const [appOpenRequest, setAppOpenRequest] = useState<AppOpenRequest>(null);

  function goHome() {
    setTab("apps");
    setAppOpenRequest(null);
    setHomeResetKey((currentKey) => currentKey + 1);
  }

  function openApp(appId: string) {
    const targetApp = navApps.find((app) => app.appId === appId);
    setTab(appKind(targetApp) === "web_app" ? "webApps" : "apps");
    setAppOpenRequest({ appId, key: Date.now() });
  }

  function openDonationPanel() {
    setTab("support");
    window.setTimeout(() => {
      document.getElementById("kofi-tip-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  useEffect(() => {
    const widgetWindow = window as typeof window & {
      kofiWidgetOverlay?: {
        draw: (accountSlug: string, options: Record<string, string>) => void;
      };
    };

    function drawOverlay() {
      if (document.body.dataset.kofiOverlayReady === "true" || !widgetWindow.kofiWidgetOverlay) {
        return;
      }

      widgetWindow.kofiWidgetOverlay.draw(KOFI_ACCOUNT_SLUG, {
        type: "floating-chat",
        "floating-chat.donateButton.text": "Support me",
        "floating-chat.donateButton.background-color": "#00bfa5",
        "floating-chat.donateButton.text-color": "#fff"
      });
      document.body.dataset.kofiOverlayReady = "true";
    }

    const existingScript = document.getElementById("kofi-overlay-widget-script") as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        drawOverlay();
        return undefined;
      }

      existingScript.addEventListener("load", drawOverlay);
      return () => existingScript.removeEventListener("load", drawOverlay);
    }

    const script = document.createElement("script");
    script.id = "kofi-overlay-widget-script";
    script.src = KOFI_OVERLAY_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      drawOverlay();
    });
    document.body.appendChild(script);
    return undefined;
  }, []);

  useEffect(() => {
    let authStateResolved = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!authStateResolved) {
        setReady(true);
      }
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      authStateResolved = true;
      window.clearTimeout(fallbackTimer);
      setUser(nextUser);
      setReady(true);
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return undefined;
    }

    void ensureUserProfile().catch((profileError) => {
      setError(profileError instanceof Error ? profileError.message : "Profile setup failed.");
    });

    return watchProfile(user.uid, setProfile);
  }, [user]);

  useEffect(() => {
    return watchSiteSettings(setSiteSettings, (settingsError) => {
      setError(settingsError instanceof Error ? settingsError.message : "Site settings could not load.");
    });
  }, []);

  useEffect(() => {
    const handleError = () => setNavApps([]);
    return user && isAdminProfile(profile) ? watchApps(setNavApps, handleError) : watchPublicApps(setNavApps, handleError);
  }, [profile, user]);

  const sortedNavApps = useMemo(
    () => sortAppsForDisplay(navApps.filter((app) => app.status !== "archived" && appKind(app) === "application")),
    [navApps]
  );
  const sortedWebApps = useMemo(
    () => sortAppsForDisplay(navApps.filter((app) => app.status !== "archived" && appKind(app) === "web_app")),
    [navApps]
  );

  const activeView = useMemo(() => {
    if (tab === "apps") {
      return (
        <AppsView
          user={user}
          profile={profile}
          homeResetKey={homeResetKey}
          openAppRequest={appOpenRequest}
          onError={setError}
          onOpenAccount={() => setTab("account")}
          appType="application"
          emptyTitle="Applications"
          emptyAdminCopy="No applications yet. Use the publisher above to create the first application."
          emptyPublicCopy="No public applications yet. Sign in with your admin account to publish one."
          eyebrow="Applications"
          title="Choose an application"
          intro="Applications are listed sideways. Each app can have separate Windows and Mac installers, a 30-day trial, and activation/redeem codes."
        />
      );
    }

    if (tab === "webApps") {
      return (
        <AppsView
          user={user}
          profile={profile}
          homeResetKey={homeResetKey}
          openAppRequest={appOpenRequest}
          onError={setError}
          onOpenAccount={() => setTab("account")}
          appType="web_app"
          emptyTitle="Web App"
          emptyAdminCopy="No web apps yet. Create one and set its type to Web App."
          emptyPublicCopy="No public web apps yet."
          eyebrow="Web App"
          title="Choose a web app"
          intro="Web apps are listed separately from downloadable applications, so visitors can find browser-based tools quickly."
        />
      );
    }

    if (tab === "download") {
      return <DownloadView apps={sortedNavApps} siteSettings={siteSettings} />;
    }

    if (tab === "account") {
      return <AccountView user={user} profile={profile} siteSettings={siteSettings} onError={setError} />;
    }

    return <PricingView apps={[...sortedNavApps, ...sortedWebApps]} user={user} profile={profile} siteSettings={siteSettings} onError={setError} />;
  }, [appOpenRequest, homeResetKey, profile, siteSettings, sortedNavApps, sortedWebApps, tab, user]);

  if (!ready) {
    return <main className="page-shell">Loading...</main>;
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={goHome}>
          <BrandLogo className="brand-mark" />
          <strong>{BRAND_NAME}</strong>
        </button>

        <nav className="tabs" aria-label="Main navigation">
          <div className="nav-menu-item">
            <button className={tab === "apps" ? "tab active" : "tab"} onClick={goHome}>
              <Package size={17} />
              Applications
              <ChevronDown size={15} />
            </button>
            <div className="mega-menu product-mega" role="menu">
              <div>
                <span className="mega-heading">Applications</span>
                {sortedNavApps.length > 0 ? (
                  sortedNavApps.slice(0, 10).map((app) => (
                    <button className="product-menu-app" key={app.appId} onClick={() => openApp(app.appId)}>
                      <MenuAppIcon app={app} />
                      <span>
                        <strong>{app.name}</strong>
                        <small>{app.category || app.downloads?.latestVersion || "Application"}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <button onClick={goHome}>
                    <Package size={22} />
                    <span>
                      <strong>No public applications yet</strong>
                      <small>Published apps will appear here</small>
                    </span>
                  </button>
                )}
                <button className="menu-footer-action" onClick={goHome}>
                  <Package size={22} />
                  <span>
                    <strong>All applications</strong>
                    <small>Open the applications board</small>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <TabButton active={tab === "webApps"} onClick={() => setTab("webApps")} icon={<Globe2 size={17} />}>
            Web App
          </TabButton>
          <TabButton active={tab === "support"} onClick={() => setTab("support")} icon={<ReceiptText size={17} />}>
            Support
          </TabButton>
        </nav>

        <div className="header-actions">
          <button className="button primary pill" onClick={() => setTab("download")}>
            {siteSettings.primaryCtaLabel}
          </button>
          <a
            className="kofi-donate-link"
            href={KOFI_CHECKOUT_URL}
            target="_blank"
            rel="noreferrer"
            onClick={openDonationPanel}
            title="Open the Ko-fi tip form. Brainok Store sign-in is not required."
          >
            <img
              height={36}
              style={{ border: 0, height: 36 }}
              src={KOFI_BUTTON_IMAGE_URL}
              alt="Donate on Ko-fi"
            />
          </a>
          <button className="icon-button" aria-label="Account" title="Account" onClick={() => setTab("account")}>
            <UserRound size={19} />
          </button>
          {user ? (
            <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => void signOut(auth)}>
              <LogOut size={19} />
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {activeView}
    </main>
  );
}

function BrandLogo({ className }: { className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <img src={BRAND_LOGO_SRC} alt="" />
    </span>
  );
}

function MenuAppIcon({ app }: { app: BrainokApp }) {
  const iconUrl = appIconUrl(app);

  if (iconUrl) {
    return <img className="menu-app-thumb" src={iconUrl} alt="" />;
  }

  return <Package size={22} />;
}

function SupportResourceMenuItem({
  resource,
  onFallback
}: {
  resource: SupportResource;
  onFallback: () => void;
}) {
  const content = (
    <>
      <ReceiptText size={22} />
      <span>
        <strong>{resource.title}</strong>
        <small>{resource.description}</small>
      </span>
    </>
  );

  if (resource.url) {
    return (
      <a className="resource-menu-item" href={resource.url}>
        {content}
      </a>
    );
  }

  return (
    <button className="resource-menu-item" onClick={onFallback}>
      {content}
    </button>
  );
}

function normalizeKofiTipPanelUrl(donationUrl: string | undefined) {
  const rawUrl = donationUrl?.trim() || KOFI_PAGE_URL;

  try {
    const url = new URL(rawUrl);
    if (!url.hostname.endsWith("ko-fi.com")) {
      return KOFI_TIP_PANEL_URL;
    }

    const accountSlug = url.pathname.split("/").filter(Boolean)[0];
    if (accountSlug && accountSlug !== KOFI_ACCOUNT_SLUG) {
      return KOFI_TIP_PANEL_URL;
    }

    url.hash = "";
    url.pathname = `/${KOFI_ACCOUNT_SLUG}/`;
    url.searchParams.set("hidefeed", "true");
    url.searchParams.set("widget", "true");
    url.searchParams.set("embed", "true");
    url.searchParams.set("preview", "true");
    return url.toString();
  } catch {
    return KOFI_TIP_PANEL_URL;
  }
}

function PricingView({
  apps,
  user,
  profile,
  siteSettings,
  onError
}: {
  apps: BrainokApp[];
  user: User | null;
  profile: UserProfile | null;
  siteSettings: SiteSettings;
  onError: (message: string | null) => void;
}) {
  const [selectedSupportAppId, setSelectedSupportAppId] = useState<string | null>(null);
  const supportApps = useMemo(
    () => sortAppsForDisplay(apps.filter((app) => app.status === "active")),
    [apps]
  );
  const selectedSupportApp = selectedSupportAppId
    ? supportApps.find((app) => app.appId === selectedSupportAppId) || null
    : null;
  const tipPanelUrl = useMemo(
    () => normalizeKofiTipPanelUrl(siteSettings.donationCheckoutUrl),
    [siteSettings.donationCheckoutUrl]
  );

  useEffect(() => {
    if (selectedSupportAppId && !selectedSupportApp) {
      setSelectedSupportAppId(null);
    }
  }, [selectedSupportApp, selectedSupportAppId]);

  if (selectedSupportApp) {
    return (
      <SupportAppDetail
        app={selectedSupportApp}
        user={user}
        profile={profile}
        onBack={() => setSelectedSupportAppId(null)}
        onError={onError}
      />
    );
  }

  return (
    <section className="support-resource-page">
      <div className="section-heading">
        <span className="mini-label">Support</span>
        <h2>Support</h2>
        <p>Choose an app below to open support.</p>
      </div>

      <KofiTipPanel iframeUrl={tipPanelUrl} />

      {supportApps.length === 0 ? (
        <article className="support-resource-card">
          <Package size={24} />
          <span>
            <strong>No apps yet</strong>
            <small>Published apps will appear here.</small>
          </span>
        </article>
      ) : (
        <div className="support-app-board">
          {supportApps.map((app) => {
            const primaryMedia = appPrimaryMedia(app);
            return (
              <article className="support-app-card" key={app.appId}>
                <button
                  className={`support-app-thumb support-app-thumb-button${primaryMedia.isIcon ? " icon-media" : ""}`}
                  type="button"
                  onClick={() => setSelectedSupportAppId(app.appId)}
                >
                  {primaryMedia.url ? <img src={primaryMedia.url} alt="" /> : <Package size={28} />}
                </button>
                <div className="support-app-body">
                  <span className="mini-label">{app.category || "Desktop app"}</span>
                  <h3>{app.name}</h3>
                  <p>{supportTeaser(app)}</p>
                  <div className="button-row">
                    <button className="button primary" type="button" onClick={() => setSelectedSupportAppId(app.appId)}>
                      <ReceiptText size={18} />
                      Open support
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function KofiTipPanel({ iframeUrl }: { iframeUrl: string }) {
  return (
    <section className="kofi-tip-panel" id="kofi-tip-panel" aria-labelledby="kofi-tip-panel-title">
      <div className="kofi-tip-panel-copy">
        <span className="mini-label">Tip Panel</span>
        <h3 id="kofi-tip-panel-title">Support Brainok Store</h3>
        <p>Leave a display name and message with your donation. Brainok Store sign-in is not required.</p>
      </div>
      <a className="button primary kofi-tip-action" href={KOFI_CHECKOUT_URL} target="_blank" rel="noreferrer">
        <ExternalLink size={18} />
        Open Ko-fi tip form
      </a>
      <iframe
        id="kofiframe"
        className="kofi-tip-iframe"
        src={iframeUrl}
        title={KOFI_ACCOUNT_SLUG}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="payment"
        height={712}
      />
    </section>
  );
}

function SupportAppDetail({
  app,
  user,
  profile,
  onBack,
  onError
}: {
  app: BrainokApp;
  user: User | null;
  profile: UserProfile | null;
  onBack: () => void;
  onError: (message: string | null) => void;
}) {
  const primaryMedia = appPrimaryMedia(app);
  const supportContent = app.supportContent || app.description;

  return (
    <section className="support-detail-page">
      <button className="button secondary compact detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        All support
      </button>

      <div className="support-detail-layout">
        <article className="support-detail-main">
          <div className={`support-detail-media${primaryMedia.isIcon ? " icon-media" : ""}`}>
            {primaryMedia.url ? <img src={primaryMedia.url} alt="" /> : <Package size={34} />}
          </div>
          <span className="mini-label">{app.category || "Desktop app"}</span>
          <h2>{app.name} support</h2>
          <p className="support-short-copy">{app.shortDescription || compactAppDescription(app)}</p>
          <div className="support-content-box">
            <span className="mini-label">Support guide</span>
            <MarkdownView
              className="markdown-view support-markdown"
              content={supportContent}
              fallback="Add install notes, troubleshooting steps, known issues, and contact guidance for this app."
            />
          </div>
        </article>

        <AppQnaPanel app={app} user={user} profile={profile} onError={onError} />
      </div>
    </section>
  );
}

function AppQnaPanel({
  app,
  user,
  profile,
  onError
}: {
  app: BrainokApp;
  user: User | null;
  profile: UserProfile | null;
  onError: (message: string | null) => void;
}) {
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const canAnswer = isAdminProfile(profile);

  useEffect(() => {
    if (!user) {
      setQuestions([]);
      return undefined;
    }

    return watchAppQuestions(app.appId, setQuestions, (error) => {
      onError(error instanceof Error ? error.message : "Could not load QnA.");
    });
  }, [app.appId, onError, user]);

  const sortedQuestions = useMemo(
    () => [...questions].sort((left, right) => timestampMillis(right.createdAt) - timestampMillis(left.createdAt)),
    [questions]
  );

  async function submitQuestion() {
    try {
      if (!user) {
        onError("Sign in before asking a support question.");
        return;
      }

      if (questionDraft.trim().length < 3) {
        onError("Write a little more before submitting.");
        return;
      }

      setBusyQuestionId("new");
      onError(null);
      await askAppQuestion(app.appId, questionDraft);
      setQuestionDraft("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not submit question.");
    } finally {
      setBusyQuestionId(null);
    }
  }

  async function submitAnswer(question: AppQuestion) {
    try {
      const answer = answerDrafts[question.questionId] || "";
      if (answer.trim().length < 2) {
        onError("Write an answer first.");
        return;
      }

      setBusyQuestionId(question.questionId);
      onError(null);
      await answerAppQuestion(question.questionId, answer);
      setAnswerDrafts((currentDrafts) => ({ ...currentDrafts, [question.questionId]: "" }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save answer.");
    } finally {
      setBusyQuestionId(null);
    }
  }

  return (
    <aside className="qna-panel">
      <div>
        <span className="mini-label">App QnA</span>
        <h2>Questions</h2>
        <p className="panel-copy">Users can ask app-specific questions here. Admin answers appear under each question.</p>
      </div>

      {user ? (
        <div className="qna-compose">
          <label>
            Ask a question
            <textarea
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              rows={4}
              placeholder="Example: How do I activate this app after the 30-day trial?"
            />
          </label>
          <button className="button primary full" disabled={busyQuestionId === "new"} onClick={() => void submitQuestion()}>
            <ReceiptText size={18} />
            Submit question
          </button>
        </div>
      ) : (
        <p className="activation-note">Sign in to ask a support question.</p>
      )}

      <div className="qna-list">
        {sortedQuestions.length === 0 ? (
          <p className="panel-copy">No questions yet.</p>
        ) : (
          sortedQuestions.map((question) => (
            <article className="qna-item" key={question.questionId}>
              <div className="qna-meta">
                <strong>{canAnswer ? question.userEmail || "User" : "User"}</strong>
                <span>{formatTimestamp(question.createdAt)}</span>
              </div>
              <p>{question.question}</p>
              {question.answer ? (
                <div className="qna-answer">
                  <strong>Admin answer</strong>
                  <p>{question.answer}</p>
                </div>
              ) : canAnswer ? (
                <div className="qna-answer-form">
                  <textarea
                    value={answerDrafts[question.questionId] || ""}
                    onChange={(event) => setAnswerDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [question.questionId]: event.target.value
                    }))}
                    rows={3}
                    placeholder="Write an admin answer..."
                  />
                  <button className="button secondary full" disabled={busyQuestionId === question.questionId} onClick={() => void submitAnswer(question)}>
                    <Save size={18} />
                    Save answer
                  </button>
                </div>
              ) : (
                <span className="qna-status">Waiting for admin answer</span>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function AppsView({
  user,
  profile,
  homeResetKey,
  openAppRequest,
  onError,
  onOpenAccount,
  appType,
  emptyTitle,
  emptyAdminCopy,
  emptyPublicCopy,
  eyebrow,
  title,
  intro
}: {
  user: User | null;
  profile: UserProfile | null;
  homeResetKey: number;
  openAppRequest: AppOpenRequest;
  onError: (message: string | null) => void;
  onOpenAccount: () => void;
  appType: AppType;
  emptyTitle: string;
  emptyAdminCopy: string;
  emptyPublicCopy: string;
  eyebrow: string;
  title: string;
  intro: string;
}) {
  const [apps, setApps] = useState<BrainokApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [appsLoadError, setAppsLoadError] = useState<string | null>(null);
  const [floatingDemoApp, setFloatingDemoApp] = useState<BrainokApp | null>(null);

  useEffect(() => {
    const handleError = (error: Error) => {
      setAppsLoadError(error.message);
    };

    setAppsLoadError(null);
    onError(null);
    return user ? watchApps(setApps, handleError) : watchPublicApps(setApps, handleError);
  }, [onError, user]);

  const canManageApps = Boolean(user && isAdminProfile(profile));
  const visibleApps = apps.filter((app) => {
    if (appKind(app) !== appType) {
      return false;
    }

    if (canManageApps) {
      return true;
    }

    if (app.visibility === "public") {
      return true;
    }

    if (app.ownerUid === user?.uid) {
      return true;
    }

    return profile?.apps?.[app.appId]?.accessStatus === "active";
  });
  const sortedApps = useMemo(() => sortAppsForDisplay(visibleApps), [visibleApps]);
  const selectedApp = selectedAppId ? sortedApps.find((app) => app.appId === selectedAppId) || null : null;
  const floatingDemoVideoUrl = floatingDemoApp?.media?.videoUrl || null;
  const floatingDemoEmbedUrl = youtubeEmbedUrlFrom(floatingDemoVideoUrl, "player");
  const floatingDemoExternalUrl = externalVideoUrlFrom(floatingDemoVideoUrl);

  useEffect(() => {
    setSelectedAppId(null);
  }, [homeResetKey]);

  useEffect(() => {
    if (openAppRequest?.appId) {
      setSelectedAppId(openAppRequest.appId);
    }
  }, [openAppRequest?.key]);

  useEffect(() => {
    if (selectedAppId && !selectedApp) {
      setSelectedAppId(null);
    }
  }, [selectedApp, selectedAppId]);

  useEffect(() => {
    if (!floatingDemoApp) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFloatingDemoApp(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [floatingDemoApp]);

  async function claimFree(app: BrainokApp) {
    try {
      if (!user) {
        onError("Sign in before adding an app to your account.");
        onOpenAccount();
        return;
      }

      setBusyAppId(app.appId);
      onError(null);
      await grantFreeAppAccess(app.appId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add app access.");
    } finally {
      setBusyAppId(null);
    }
  }

  return (
    <>
      {appsLoadError ? (
        <section className="notice-panel">
          <h2>App board is waiting for access</h2>
          <p>
            Firestore blocked the app list for this session. Sign in with your admin account,
            then refresh this page after rules finish deploying.
          </p>
        </section>
      ) : null}

      {selectedApp ? (
        <AppDetailView
          app={selectedApp}
          access={profile?.apps?.[selectedApp.appId]?.accessStatus === "active"}
          busy={busyAppId === selectedApp.appId}
          onBack={() => setSelectedAppId(null)}
          onClaimFree={() => void claimFree(selectedApp)}
        />
      ) : sortedApps.length === 0 ? (
        <section className="account-panel">
          <h2>{emptyTitle}</h2>
          <p className="panel-copy">
            {canManageApps ? emptyAdminCopy : emptyPublicCopy}
          </p>
        </section>
      ) : (
        <section className="app-rail-section" aria-labelledby="app-rail-title">
          <div className="section-heading">
            <span className="mini-label">{eyebrow}</span>
            <h2 id="app-rail-title">{title}</h2>
            <p>{intro}</p>
          </div>

          <div className="app-board" role="list">
            {sortedApps.map((app) => {
              const access = profile?.apps?.[app.appId]?.accessStatus === "active";
              const pricingMode = app.pricing?.mode || "invite_only";
              const downloadLinks = appDownloadLinks(app);
              const releaseUrl = app.downloads?.releaseUrl || null;
              const docsUrl = app.downloads?.docsUrl || null;
              const primaryMedia = appPrimaryMedia(app);
              const videoUrl = app.media?.videoUrl || null;
              const externalVideoUrl = externalVideoUrlFrom(videoUrl);
              const floatingVideoUrl = youtubeEmbedUrlFrom(videoUrl, "player");
              const busy = busyAppId === app.appId;
              const checkoutUrl = app.pricing?.checkoutUrl || null;

              return (
                <article className="app-card" key={app.appId} role="listitem">
                <button
                  className={`app-media app-media-button${primaryMedia.isIcon ? " icon-media" : ""}`}
                  type="button"
                  onClick={() => setSelectedAppId(app.appId)}
                  aria-label={`Open ${app.name}`}
                >
                  {primaryMedia.url ? (
                    <img src={primaryMedia.url} alt="" />
                  ) : videoUrl && isDirectVideoUrl(videoUrl) ? (
                    <video src={videoUrl} muted playsInline preload="metadata" />
                  ) : (
                    <div className="app-media-placeholder">
                      {videoUrl ? <PlayCircle size={30} /> : <ImageIcon size={28} />}
                    </div>
                  )}
                </button>
                <div className="app-card-main">
                  <span className="mini-label">{app.category || app.visibility || "public"}</span>
                  <button className="app-title-button" type="button" onClick={() => setSelectedAppId(app.appId)}>
                    {app.name}
                  </button>
                  <MarkdownView
                    className="markdown-view app-description"
                    content={app.shortDescription || compactAppDescription(app)}
                    fallback="Desktop app access, releases, and activation numbers are managed here."
                  />
                </div>

                <dl className="app-meta">
                  <div>
                    <dt>Access</dt>
                    <dd>{access ? "Active" : "30-day trial"}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{app.downloads?.latestVersion || "TBD"}</dd>
                  </div>
                </dl>

                <div className="download-actions">
                  {downloadLinks.length > 0 ? (
                    downloadLinks.map((downloadLink, index) => (
                      <a className={index === 0 ? "button primary" : "button secondary"} href={downloadLink.href} key={downloadLink.label}>
                        <Download size={18} />
                        {downloadLink.label}
                      </a>
                    ))
                  ) : (
                    <button className="button secondary" disabled>
                      <Download size={18} />
                      No build yet
                    </button>
                  )}
                </div>

                <div className="button-row">
                  {access ? (
                    <button className="button secondary" disabled>
                      <ShieldCheck size={18} />
                      Activated
                    </button>
                  ) : pricingMode === "free" ? (
                    <button className="button primary" disabled={busy} onClick={() => void claimFree(app)}>
                      <Plus size={18} />
                      Add to account
                    </button>
                  ) : pricingMode === "paid" ? (
                    checkoutUrl ? (
                      <a className="button primary" href={checkoutUrl} target="_blank" rel="noreferrer">
                        <ShoppingCart size={18} />
                        Buy access
                      </a>
                    ) : (
                      <button className="button secondary" disabled>
                        <ShoppingCart size={18} />
                        Checkout link not set
                      </button>
                    )
                  ) : (
                    <button className="button secondary" disabled>
                      <KeyRound size={18} />
                      Activate in app
                    </button>
                  )}

                  {releaseUrl ? (
                    <a className="button secondary" href={releaseUrl}>
                      <ExternalLink size={18} />
                      Release
                    </a>
                  ) : null}
                  {docsUrl ? (
                    <a className="button secondary" href={docsUrl}>
                      <BookOpen size={18} />
                      Docs
                    </a>
                  ) : null}
                  {floatingVideoUrl ? (
                    <button className="button secondary" type="button" onClick={() => setFloatingDemoApp(app)}>
                      <PlayCircle size={18} />
                      Demo
                    </button>
                  ) : externalVideoUrl ? (
                    <a className="button secondary" href={externalVideoUrl} target="_blank" rel="noreferrer">
                      <PlayCircle size={18} />
                      Demo
                    </a>
                  ) : null}
                </div>
                <div className="activation-note app-card-note">
                  <KeyRound size={18} />
                  <span>Download first. A 30-day trial starts in the app. If you received a redeem/activation code, enter it in the app to keep using it free.</span>
                </div>
              </article>
              );
            })}
          </div>
        </section>
      )}

      {floatingDemoApp && floatingDemoEmbedUrl ? (
        <div
          className="floating-video-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${floatingDemoApp.name} floating demo video`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFloatingDemoApp(null);
            }
          }}
        >
          <div className="floating-video-window">
            <div className="floating-video-toolbar">
              <strong>{floatingDemoApp.name} demo</strong>
              <div className="floating-video-actions">
                {floatingDemoExternalUrl ? (
                  <a className="button secondary compact" href={floatingDemoExternalUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    YouTube
                  </a>
                ) : null}
                <button className="icon-button" type="button" aria-label="Close floating player" onClick={() => setFloatingDemoApp(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={floatingDemoEmbedUrl}
              title={`${floatingDemoApp.name} floating demo video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function AppDetailView({
  app,
  access,
  busy,
  onBack,
  onClaimFree
}: {
  app: BrainokApp;
  access: boolean;
  busy: boolean;
  onBack: () => void;
  onClaimFree: () => void;
}) {
  const pricingMode = app.pricing?.mode || "invite_only";
  const downloadLinks = appDownloadLinks(app);
  const releaseUrl = app.downloads?.releaseUrl || null;
  const docsUrl = app.downloads?.docsUrl || null;
  const primaryMedia = appPrimaryMedia(app);
  const videoUrl = app.media?.videoUrl || null;
  const youtubeEmbedUrl = youtubeEmbedUrlFrom(videoUrl, "quiet");
  const youtubeFloatingUrl = youtubeEmbedUrlFrom(videoUrl, "player");
  const externalVideoUrl = externalVideoUrlFrom(videoUrl);
  const checkoutUrl = app.pricing?.checkoutUrl || null;
  const [floatingVideoOpen, setFloatingVideoOpen] = useState(false);

  useEffect(() => {
    if (!floatingVideoOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFloatingVideoOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [floatingVideoOpen]);

  return (
    <section className="app-detail-page">
      <button className="button secondary compact detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        All apps
      </button>

      <div className="app-detail-hero">
        <div className="app-detail-media-stack">
          <div className={`app-detail-media${primaryMedia.isIcon ? " icon-media" : ""}`}>
            {primaryMedia.url ? (
              <img src={primaryMedia.url} alt="" />
            ) : videoUrl && isDirectVideoUrl(videoUrl) ? (
              <video src={videoUrl} controls preload="metadata" />
            ) : (
              <div className="app-media-placeholder">
                {videoUrl ? <PlayCircle size={38} /> : <ImageIcon size={34} />}
              </div>
            )}
          </div>

          {youtubeEmbedUrl ? (
            <div className="app-detail-video app-detail-video-embed">
              <iframe
                src={youtubeEmbedUrl}
                title={`${app.name} demo video`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <button
                className="video-float-hit-target"
                type="button"
                aria-label={`Open ${app.name} demo in a floating player`}
                title="Double-click to open a floating player"
                onDoubleClick={() => setFloatingVideoOpen(true)}
              />
              <button
                className="video-float-button"
                type="button"
                onClick={() => setFloatingVideoOpen(true)}
              >
                <Maximize2 size={15} />
                Floating
              </button>
            </div>
          ) : videoUrl && isDirectVideoUrl(videoUrl) && primaryMedia.url ? (
            <div className="app-detail-video">
              <video src={videoUrl} controls preload="metadata" />
            </div>
          ) : videoUrl ? (
            <div className="app-detail-video app-detail-video-link">
              <PlayCircle size={34} />
              <strong>Demo video</strong>
              <span>Open the saved video link in a new tab.</span>
              <a className="button secondary compact" href={externalVideoUrl || videoUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Open demo
              </a>
            </div>
          ) : null}
        </div>

        <div className="app-detail-summary">
          <span className="mini-label">{app.category || app.visibility || "public"}</span>
          <h1>{app.name}</h1>
          <p>{compactAppDescription(app)}</p>

          <dl className="app-meta detail-meta">
            <div>
              <dt>Access</dt>
              <dd>{access ? "Active" : "30-day trial"}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{app.downloads?.latestVersion || "TBD"}</dd>
            </div>
          </dl>

          <div className="activation-note">
            <KeyRound size={18} />
            <span>
              Install first. The app starts a 30-day trial. If you received a redeem/activation
              code, enter it inside the app to keep using it free.
            </span>
          </div>

          <div className="download-actions detail-downloads">
            {downloadLinks.length > 0 ? (
              downloadLinks.map((downloadLink, index) => (
                <a className={index === 0 ? "button primary" : "button secondary"} href={downloadLink.href} key={downloadLink.label}>
                  <Download size={18} />
                  {downloadLink.label}
                </a>
              ))
            ) : (
              <button className="button secondary" disabled>
                <Download size={18} />
                No build yet
              </button>
            )}
          </div>

          <div className="button-row">
            {access ? (
              <button className="button secondary" disabled>
                <ShieldCheck size={18} />
                Activated
              </button>
            ) : pricingMode === "free" ? (
              <button className="button primary" disabled={busy} onClick={onClaimFree}>
                <Plus size={18} />
                Add to account
              </button>
            ) : pricingMode === "paid" ? (
              checkoutUrl ? (
                <a className="button primary" href={checkoutUrl} target="_blank" rel="noreferrer">
                  <ShoppingCart size={18} />
                  Buy access
                </a>
              ) : (
                <button className="button secondary" disabled>
                  <ShoppingCart size={18} />
                  Checkout link not set
                </button>
              )
            ) : (
              <button className="button secondary" disabled>
                <KeyRound size={18} />
                Activate in app
              </button>
            )}

            {releaseUrl ? (
              <a className="button secondary" href={releaseUrl}>
                <ExternalLink size={18} />
                Release
              </a>
            ) : null}
            {docsUrl ? (
              <a className="button secondary" href={docsUrl}>
                <BookOpen size={18} />
                Docs
              </a>
            ) : null}
            {externalVideoUrl ? (
              <a className="button secondary" href={externalVideoUrl} target="_blank" rel="noreferrer">
                <PlayCircle size={18} />
                Demo
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <article className="app-detail-body">
        <span className="mini-label">Application overview</span>
        <MarkdownView
          className="markdown-view app-detail-description"
          content={app.shortDescription || compactAppDescription(app)}
          fallback="Open the Support page for install notes, troubleshooting, and QnA."
        />
      </article>

      {floatingVideoOpen && youtubeFloatingUrl ? (
        <div
          className="floating-video-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${app.name} floating demo video`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFloatingVideoOpen(false);
            }
          }}
        >
          <div className="floating-video-window">
            <div className="floating-video-toolbar">
              <strong>{app.name} demo</strong>
              <div className="floating-video-actions">
                {externalVideoUrl ? (
                  <a className="button secondary compact" href={externalVideoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    YouTube
                  </a>
                ) : null}
                <button className="icon-button" type="button" aria-label="Close floating player" onClick={() => setFloatingVideoOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={youtubeFloatingUrl}
              title={`${app.name} floating demo video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SiteSettingsEditor({
  settings,
  onError
}: {
  settings: SiteSettings;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState<SiteSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function updateDraft(key: keyof SiteSettings, value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setSaved(false);
  }

  async function saveSettings() {
    try {
      setBusy(true);
      setSaved(false);
      onError(null);
      await updateSiteSettings(draft);
      setSaved(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save site settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="site-settings-panel">
      <details>
        <summary>
          <span>
            <span className="mini-label">Admin editor</span>
            <strong>Site settings</strong>
          </span>
          <span className="summary-hint">Change the homepage without code</span>
        </summary>

        <div className="settings-editor">
          <div className="editor-grid">
            <label>
              Brand name
              <input value={draft.brandName} onChange={(event) => updateDraft("brandName", event.target.value)} />
            </label>
            <label>
              Brand mark
              <input value={draft.brandInitial} onChange={(event) => updateDraft("brandInitial", event.target.value.slice(0, 3))} />
            </label>
            <label>
              Hero eyebrow
              <input value={draft.heroEyebrow} onChange={(event) => updateDraft("heroEyebrow", event.target.value)} />
            </label>
            <label>
              Main button
              <input value={draft.primaryCtaLabel} onChange={(event) => updateDraft("primaryCtaLabel", event.target.value)} />
            </label>
            <label className="wide-field">
              Hero title
              <textarea value={draft.heroTitle} rows={2} onChange={(event) => updateDraft("heroTitle", event.target.value)} />
            </label>
            <label className="wide-field">
              Hero description
              <textarea value={draft.heroDescription} rows={3} onChange={(event) => updateDraft("heroDescription", event.target.value)} />
            </label>
            <label>
              Secondary button
              <input value={draft.secondaryCtaLabel} onChange={(event) => updateDraft("secondaryCtaLabel", event.target.value)} />
            </label>
            <label>
              Download title
              <input value={draft.downloadTitle} onChange={(event) => updateDraft("downloadTitle", event.target.value)} />
            </label>
            <label>
              Download subtitle
              <input value={draft.downloadSubtitle} onChange={(event) => updateDraft("downloadSubtitle", event.target.value)} />
            </label>
            <label className="wide-field">
              Download body
              <textarea value={draft.downloadBody} rows={2} onChange={(event) => updateDraft("downloadBody", event.target.value)} />
            </label>
            <label>
              Donation title
              <input value={draft.donationTitle} onChange={(event) => updateDraft("donationTitle", event.target.value)} />
            </label>
            <label>
              Donation note
              <input value={draft.donationSuggested} onChange={(event) => updateDraft("donationSuggested", event.target.value)} />
            </label>
            <label className="wide-field">
              Donation description
              <textarea value={draft.donationDescription} rows={2} onChange={(event) => updateDraft("donationDescription", event.target.value)} />
            </label>
          </div>

          <div className="publisher-actions">
            <button className="button primary" disabled={busy} onClick={() => void saveSettings()}>
              <Save size={18} />
              Save site settings
            </button>
            {saved ? <span className="quota-note">Saved</span> : null}
          </div>
        </div>
      </details>
    </section>
  );
}

function AppPublisher({
  user,
  profile,
  manageableApps,
  onError
}: {
  user: User;
  profile: UserProfile | null;
  manageableApps: BrainokApp[];
  onError: (message: string | null) => void;
}) {
  const [mode, setMode] = useState<"new" | "edit">(manageableApps.length > 0 ? "edit" : "new");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [draft, setDraft] = useState<AppDraft>(emptyAppDraft);
  const [createdInvite, setCreatedInvite] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy code");
  const [uploadTarget, setUploadTarget] = useState<ReleaseUploadTarget>("windows");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedApp = manageableApps.find((app) => app.appId === selectedAppId) || manageableApps[0] || null;
  useEffect(() => {
    if (manageableApps.length === 0) {
      setMode("new");
      setSelectedAppId("");
      return;
    }

    setMode((currentMode) => currentMode === "new" ? currentMode : "edit");
    setSelectedAppId((currentAppId) => currentAppId || manageableApps[0].appId);
  }, [manageableApps]);

  useEffect(() => {
    if (mode === "new") {
      setDraft(emptyAppDraft);
      return;
    }

    if (selectedApp) {
      setDraft(appToDraft(selectedApp));
    }
  }, [mode, selectedApp?.appId]);

  async function saveApp() {
    try {
      setBusy(true);
      onError(null);

      if (!draft.name.trim()) {
        onError("App title is required.");
        return;
      }

      if (mode === "new") {
        const app = await createApp(draft.name, draftToUpdate(draft));
        setSelectedAppId(app.appId);
        setMode("edit");
        return;
      }

      if (!selectedApp) {
        onError("Select an app first.");
        return;
      }

      await updateApp(selectedApp.appId, draftToUpdate(draft));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save app.");
    } finally {
      setBusy(false);
    }
  }

  async function createNewActivationCode() {
    try {
      if (!selectedApp) {
        onError("Create or select an app first.");
        return;
      }

      setBusy(true);
      onError(null);
      const activation = await createActivationCode(selectedApp.appId);
      setCreatedInvite(activation.code);
      setCopyLabel("Copy code");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create activation number.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!createdInvite) {
      return;
    }

    await navigator.clipboard.writeText(createdInvite);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy code"), 1400);
  }

  async function uploadFile(file: File | undefined) {
    try {
      if (!file) {
        return;
      }

      if (!selectedApp) {
        onError("Save the app first, then upload release files.");
        return;
      }

      setBusy(true);
      setUploadProgress(0);
      onError(null);
      const result = await uploadAppReleaseFile({
        appId: selectedApp.appId,
        ownerUid: user.uid,
        file,
        target: uploadTarget,
        onProgress: setUploadProgress
      });

      setDraft((currentDraft) => attachUploadUrl(currentDraft, uploadTarget, result.url));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not upload file.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setUploadProgress(null), 1200);
    }
  }

  return (
    <section className="publisher-panel">
      <div className="publisher-header">
        <div>
          <span className="mini-label">Admin publisher</span>
          <h2>Publish or update an app</h2>
          <p>Fill the title and description, choose access, then attach release links or upload files.</p>
        </div>
        <div className="mode-switch" aria-label="Publisher mode">
          <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>
            New app
          </button>
          <button className={mode === "edit" ? "active" : ""} disabled={manageableApps.length === 0} onClick={() => setMode("edit")}>
            Edit app
          </button>
        </div>
      </div>

      {mode === "edit" && manageableApps.length > 0 ? (
        <label>
          App
          <select value={selectedApp?.appId || ""} onChange={(event) => setSelectedAppId(event.target.value)}>
            {manageableApps.map((app) => (
              <option key={app.appId} value={app.appId}>
                {app.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="publisher-steps">
        <section>
          <span className="step-badge">1</span>
          <h3>Title and description</h3>
          <div className="editor-grid">
            <label>
              App title
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Brainok Neuro" />
            </label>
            <label>
              Category
              <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Research, clinic, writing..." />
            </label>
            <label>
              App type
              <select value={draft.appType} onChange={(event) => setDraft({ ...draft, appType: event.target.value as AppType })}>
                <option value="application">Application</option>
                <option value="web_app">Web App</option>
              </select>
            </label>
            <label>
              Display order
              <input type="number" min="0" step="1" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} />
            </label>
            <label className="wide-field">
              Listing short description
              <textarea
                value={draft.shortDescription}
                onChange={(event) => setDraft({ ...draft, shortDescription: event.target.value })}
                rows={3}
                placeholder="One or two short sentences for the listing page."
              />
            </label>
            <label className="wide-field">
              Listing detail Markdown
              <textarea
                className="large-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                rows={12}
                placeholder={"Paste Markdown here.\n\n# What it does\n- Main feature\n- Who it is for\n\n## Notes\nYou can use headings, lists, links, and code."}
              />
            </label>
            <div className="wide-field markdown-preview">
              <span className="mini-label">Markdown preview</span>
              <MarkdownView content={draft.description} fallback="Your formatted app description will appear here." />
            </div>
            <label className="wide-field">
              Support content
              <textarea
                className="large-description"
                value={draft.supportContent}
                onChange={(event) => setDraft({ ...draft, supportContent: event.target.value })}
                rows={12}
                placeholder={"Paste Support Markdown here.\n\n# Install\n# Activation\n# Common problems"}
              />
            </label>
            <div className="wide-field markdown-preview">
              <span className="mini-label">Support preview</span>
              <MarkdownView content={draft.supportContent} fallback="Support guide will appear here." />
            </div>
          </div>
        </section>

        <section>
          <span className="step-badge">2</span>
          <h3>Access and price</h3>
          <div className="editor-grid">
            <label>
              Visibility
              <select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as AppDraft["visibility"] })}>
                <option value="public">Public board</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label>
              Access model
              <select value={draft.pricingMode} onChange={(event) => setDraft({ ...draft, pricingMode: event.target.value as AppDraft["pricingMode"] })}>
                <option value="invite_only">Invite only</option>
                <option value="free">Free</option>
                <option value="paid">Paid access</option>
                <option value="donation">Donation only</option>
              </select>
            </label>
            <label>
              Price
              <input type="number" min="0" step="0.01" value={draft.priceMajor} onChange={(event) => setDraft({ ...draft, priceMajor: event.target.value })} />
            </label>
            <label>
              Currency
              <input value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} />
            </label>
            <label>
              Billing
              <select value={draft.billingInterval} onChange={(event) => setDraft({ ...draft, billingInterval: event.target.value as AppDraft["billingInterval"] })}>
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="pay_what_you_want">Pay what you want</option>
              </select>
            </label>
            <label>
              Latest version
              <input value={draft.latestVersion} onChange={(event) => setDraft({ ...draft, latestVersion: event.target.value })} placeholder="0.1.0" />
            </label>
          </div>
        </section>

        <section>
          <span className="step-badge">3</span>
          <h3>Thumbnail and demo</h3>
          <div className="media-editor">
            <div className="media-preview">
              {draft.thumbnailUrl ? (
                <img src={toDisplayImageUrl(draft.thumbnailUrl) || ""} alt="" />
              ) : draft.videoUrl && isDirectVideoUrl(draft.videoUrl) ? (
                <video src={draft.videoUrl} muted playsInline controls />
              ) : draft.videoUrl && youtubeEmbedUrlFrom(draft.videoUrl) ? (
                <iframe
                  src={youtubeEmbedUrlFrom(draft.videoUrl) || ""}
                  title="Demo video preview"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div>
                  {draft.videoUrl ? <PlayCircle size={30} /> : <ImageIcon size={30} />}
                  <span>{draft.videoUrl ? "External video link is saved." : "Upload a thumbnail or demo video."}</span>
                </div>
              )}
            </div>
            <div className="editor-grid">
              <label>
                App icon URL
                <input value={draft.iconUrl} onChange={(event) => setDraft({ ...draft, iconUrl: event.target.value })} placeholder="Square PNG/WebP URL" />
              </label>
              <label>
                Thumbnail image URL
                <input value={draft.thumbnailUrl} onChange={(event) => setDraft({ ...draft, thumbnailUrl: event.target.value })} placeholder="https://..." />
              </label>
              <label>
                Demo video URL
                <input value={draft.videoUrl} onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="https://..." />
              </label>
            </div>
          </div>
        </section>

        <section>
          <span className="step-badge">4</span>
          <h3>Files and links</h3>
          <div className="upload-strip">
            <label>
              Attach file as
              <select value={uploadTarget} onChange={(event) => setUploadTarget(event.target.value as ReleaseUploadTarget)}>
                <option value="icon">App icon</option>
                <option value="thumbnail">Thumbnail image</option>
                <option value="video">Demo video</option>
                <option value="windows">Windows installer</option>
                <option value="mac">Mac installer</option>
                <option value="release">Release page</option>
                <option value="docs">Manual or docs</option>
              </select>
            </label>
            <label className={selectedApp ? "file-picker" : "file-picker disabled"}>
              <UploadCloud size={20} />
              {uploadProgress === null ? "Choose file" : `Uploading ${uploadProgress}%`}
              <input disabled={!selectedApp || busy} type="file" accept={uploadAccept(uploadTarget)} onChange={(event) => void uploadFile(event.target.files?.[0])} />
            </label>
          </div>
          <div className="editor-grid">
            <label className="wide-field">
              Lemon checkout URL
              <input value={draft.checkoutUrl} onChange={(event) => setDraft({ ...draft, checkoutUrl: event.target.value })} placeholder="https://brainokstore.lemonsqueezy.com/checkout/..." />
            </label>
            <label>
              Release page URL
              <input value={draft.releaseUrl} onChange={(event) => setDraft({ ...draft, releaseUrl: event.target.value })} placeholder="GitHub Release or Firebase URL" />
            </label>
            <label>
              Documentation URL
              <input value={draft.docsUrl} onChange={(event) => setDraft({ ...draft, docsUrl: event.target.value })} />
            </label>
            <label>
              Windows download URL
              <input value={draft.windowsDownloadUrl} onChange={(event) => setDraft({ ...draft, windowsDownloadUrl: event.target.value })} />
            </label>
            <label>
              Mac download URL
              <input value={draft.macDownloadUrl} onChange={(event) => setDraft({ ...draft, macDownloadUrl: event.target.value })} />
            </label>
          </div>
        </section>
      </div>

      <div className="publisher-actions">
        <button className="button primary" disabled={busy || !draft.name.trim()} onClick={() => void saveApp()}>
          <Save size={18} />
          {mode === "new" ? "Create app" : "Save app"}
        </button>
        <button className="button secondary" disabled={busy || !selectedApp} onClick={() => void createNewActivationCode()}>
          <KeyRound size={18} />
          Create activation number
        </button>
        <span className="quota-note">One code activates one device. Trial is 30 days.</span>
      </div>

      {createdInvite ? (
        <div className="invite-result compact">
          <code className="invite-code">{createdInvite}</code>
          <button className="button secondary" onClick={() => void copyInvite()}>
            <Copy size={18} />
            {copyLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function DownloadView({
  apps,
  siteSettings
}: {
  apps: BrainokApp[];
  siteSettings: SiteSettings;
}) {
  const downloadableApps = apps
    .filter((app) => app.status === "active")
    .sort((left, right) => left.name.localeCompare(right.name));

  if (downloadableApps.length === 0) {
    return (
      <section className="download-stage">
        <div className="download-hero-card">
          <BrandLogo className="download-logo" />
          <h2>{siteSettings.downloadTitle}</h2>
          <strong>{siteSettings.downloadSubtitle}</strong>
          <p>No public apps are ready for download yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="download-catalog">
      <div className="download-catalog-header">
        <BrandLogo className="download-logo" />
        <div>
          <span className="mini-label">Free downloads</span>
          <h2>{siteSettings.downloadTitle}</h2>
          <strong>{siteSettings.downloadSubtitle}</strong>
          <p>{siteSettings.downloadBody}</p>
        </div>
      </div>

      <div className="download-app-list">
        {downloadableApps.map((app) => {
          const downloadLinks = appDownloadLinks(app);
          const primaryMedia = appPrimaryMedia(app);

          return (
            <article className="download-app-card" key={app.appId}>
              <div className={`download-app-thumb${primaryMedia.isIcon ? " icon-media" : ""}`}>
                {primaryMedia.url ? <img src={primaryMedia.url} alt="" /> : <Package size={34} />}
              </div>
              <div className="download-app-body">
                <span className="mini-label">{app.downloads?.latestVersion ? `Version ${app.downloads.latestVersion}` : app.category || "Desktop app"}</span>
                <h3>{app.name}</h3>
                <p>{compactAppDescription(app)}</p>
                <div className="download-actions">
                  {downloadLinks.length > 0 ? (
                    downloadLinks.map((downloadLink, index) => (
                      <a className={index === 0 ? "button primary" : "button secondary"} href={downloadLink.href} key={downloadLink.label}>
                        <Download size={18} />
                        {downloadLink.label}
                      </a>
                    ))
                  ) : (
                    <button className="button secondary" disabled>
                      <Download size={18} />
                      Build soon
                    </button>
                  )}
                </div>
                <p className="download-note">No credit card needed. The app starts a 30-day trial and accepts an activation number inside the app.</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AccountView({
  user,
  profile,
  siteSettings,
  onError
}: {
  user: User | null;
  profile: UserProfile | null;
  siteSettings: SiteSettings;
  onError: (message: string | null) => void;
}) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [createdInvite, setCreatedInvite] = useState<string | null>(null);
  const [createdInviteAppName, setCreatedInviteAppName] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy code");
  const [activationCustomerEmail, setActivationCustomerEmail] = useState("");
  const [myActivationCodes, setMyActivationCodes] = useState<ActivationCodeSummary[]>([]);
  const [myActivationCodesLoading, setMyActivationCodesLoading] = useState(false);
  const [copiedActivationCode, setCopiedActivationCode] = useState<string | null>(null);
  const [sharedAccessCodeDraft, setSharedAccessCodeDraft] = useState("BRAINOK-FRIENDS-2026");
  const [sharedAccessMaxUsers, setSharedAccessMaxUsers] = useState("0");
  const [sharedAccessSaved, setSharedAccessSaved] = useState<string | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessCodeResult, setAccessCodeResult] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<"user" | "admin">("admin");
  const [apps, setApps] = useState<BrainokApp[]>([]);
  const [newAppName, setNewAppName] = useState("");
  const [newAppType, setNewAppType] = useState<AppType>("application");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [appDraft, setAppDraft] = useState<AppDraft>(emptyAppDraft);
  const [appUploadTarget, setAppUploadTarget] = useState<ReleaseUploadTarget>("icon");
  const [appUploadProgress, setAppUploadProgress] = useState<number | null>(null);
  const [appSaveStatus, setAppSaveStatus] = useState<string | null>(null);
  const [donationUrlDraft, setDonationUrlDraft] = useState(siteSettings.donationCheckoutUrl || DEFAULT_SITE_SETTINGS.donationCheckoutUrl);
  const [donationUrlSaved, setDonationUrlSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const canManageApps = isAdminProfile(profile);
  const manageableApps = sortAppsForDisplay(canManageApps ? apps : apps.filter((app) => app.ownerUid === user?.uid));
  const selectedManagedApp = manageableApps.find((app) => app.appId === selectedAppId) || manageableApps[0] || null;
  const accessibleApps = Object.values(profile?.apps || {}).filter((app) => app.accessStatus === "active");

  useEffect(() => {
    if (!user) {
      setApps([]);
      return undefined;
    }

    return watchApps(setApps);
  }, [user]);

  useEffect(() => {
    if (!selectedManagedApp) {
      setAppDraft(emptyAppDraft);
      setAppSaveStatus(null);
      return;
    }

    setAppDraft(appToDraft(selectedManagedApp));
    setAppSaveStatus(null);
  }, [selectedManagedApp?.appId]);

  useEffect(() => {
    if (!user || canManageApps) {
      setMyActivationCodes([]);
      return undefined;
    }

    let mounted = true;
    setMyActivationCodesLoading(true);
    loadMyActivationCodes()
      .then((activationCodes) => {
        if (mounted) {
          setMyActivationCodes(activationCodes);
        }
      })
      .catch((error) => {
        if (mounted) {
          onError(error instanceof Error ? error.message : "Could not load activation numbers.");
        }
      })
      .finally(() => {
        if (mounted) {
          setMyActivationCodesLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [canManageApps, onError, user]);

  useEffect(() => {
    setDonationUrlDraft(siteSettings.donationCheckoutUrl || DEFAULT_SITE_SETTINGS.donationCheckoutUrl);
    setDonationUrlSaved(false);
  }, [siteSettings.donationCheckoutUrl]);

  function selectLoginMode(mode: "user" | "admin") {
    setLoginMode(mode);
    if (mode === "admin") {
      setEmail(ADMIN_EMAIL);
    }
  }

  async function signIn() {
    try {
      setBusy(true);
      onError(null);
      const signInEmail = loginMode === "admin" && !email.trim() ? ADMIN_EMAIL : email.trim();
      setEmail(signInEmail);
      await signInWithEmailAndPassword(auth, signInEmail, password);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    try {
      setBusy(true);
      onError(null);
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      onError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createNewApp() {
    try {
      setBusy(true);
      onError(null);
      const app = await createApp(newAppName, {
        appType: newAppType,
        sortOrder: nextSortOrder(manageableApps.filter((item) => appKind(item) === newAppType))
      });
      setNewAppName("");
      setSelectedAppId(app.appId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create app.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDonationUrl() {
    try {
      setBusy(true);
      setDonationUrlSaved(false);
      onError(null);
      await updateSiteSettings({
        ...siteSettings,
        donationCheckoutUrl: donationUrlDraft.trim()
      });
      setDonationUrlSaved(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save donation URL.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMyActivationCodes() {
    return listMyActivationCodes();
  }

  async function refreshMyActivationCodes() {
    setMyActivationCodesLoading(true);
    try {
      setMyActivationCodes(await loadMyActivationCodes());
    } finally {
      setMyActivationCodesLoading(false);
    }
  }

  async function saveSelectedApp() {
    try {
      if (!selectedManagedApp) {
        return;
      }

      setBusy(true);
      onError(null);
      setAppSaveStatus(null);
      await updateApp(selectedManagedApp.appId, draftToUpdate(appDraft));
      setAppSaveStatus(`Saved ${appDraft.name || selectedManagedApp.name}`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save app settings.");
    } finally {
      setBusy(false);
    }
  }

  async function moveSelectedApp(direction: "up" | "down") {
    try {
      if (!selectedManagedApp) {
        return;
      }

      const orderedTypeApps = sortAppsForDisplay(manageableApps.filter((app) => appKind(app) === appKind(selectedManagedApp)));
      const currentIndex = orderedTypeApps.findIndex((app) => app.appId === selectedManagedApp.appId);
      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const swapApp = orderedTypeApps[swapIndex];

      if (currentIndex < 0 || !swapApp) {
        return;
      }

      setBusy(true);
      onError(null);
      setAppSaveStatus(null);
      await Promise.all([
        updateApp(selectedManagedApp.appId, {
          sortOrder: displaySortOrder(swapApp, swapIndex),
          appType: appKind(selectedManagedApp)
        }),
        updateApp(swapApp.appId, {
          sortOrder: displaySortOrder(selectedManagedApp, currentIndex),
          appType: appKind(swapApp)
        })
      ]);
      setAppSaveStatus(`Moved ${selectedManagedApp.name} ${direction}`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not reorder apps.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSelectedAppFile(file: File | undefined) {
    try {
      if (!file) {
        return;
      }

      if (!user || !selectedManagedApp) {
        onError("Create an app first.");
        return;
      }

      setBusy(true);
      setAppUploadProgress(0);
      onError(null);
      const result = await uploadAppReleaseFile({
        appId: selectedManagedApp.appId,
        ownerUid: user.uid,
        file,
        target: appUploadTarget,
        onProgress: setAppUploadProgress
      });

      setAppDraft((currentDraft) => attachUploadUrl(currentDraft, appUploadTarget, result.url));
      setAppSaveStatus("Upload complete. Click Save app settings to publish it.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not upload file.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setAppUploadProgress(null), 1200);
    }
  }

  async function createNewActivationCode() {
    try {
      setBusy(true);
      onError(null);
      const appId = selectedManagedApp?.appId;
      if (!appId) {
        onError("Create an app first.");
        return;
      }

      const activation = await createActivationCode(appId, 1, activationCustomerEmail);
      setCreatedInvite(activation.code);
      setCreatedInviteAppName(activation.appName);
      setCopyLabel("Copy code");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create activation number.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSharedAccessCode() {
    try {
      setBusy(true);
      setSharedAccessSaved(null);
      onError(null);
      const appId = selectedManagedApp?.appId;
      if (!appId) {
        onError("Create an app first.");
        return;
      }

      const result = await createSharedAccessCode(
        appId,
        sharedAccessCodeDraft,
        Number(sharedAccessMaxUsers) || 0
      );
      setSharedAccessSaved(`${result.code} for ${result.appName}`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save shared access code.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!createdInvite) {
      return;
    }

    await navigator.clipboard.writeText(createdInvite);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy code"), 1400);
  }

  async function copyMyActivationCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedActivationCode(code);
    window.setTimeout(() => setCopiedActivationCode(null), 1400);
  }

  async function redeemAccessCode() {
    try {
      setBusy(true);
      setAccessCodeResult(null);
      onError(null);
      const result = await redeemSharedAccessCode(accessCodeInput);
      setAccessCodeInput("");
      setAccessCodeResult(
        `${result.appName}: ${result.activationCode}${result.alreadyRedeemed ? " (already assigned)" : ""}`
      );
      await refreshMyActivationCodes();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not redeem access code.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <section className="account-panel sign-in-panel">
        <span className="mini-label">Choose account type</span>
        <h2>{loginMode === "admin" ? "Admin sign in" : "User sign in"}</h2>
        <p className="panel-copy">
          {loginMode === "admin"
            ? `Use this only for ${ADMIN_EMAIL}. This account publishes apps, edits the site, and creates invite codes.`
            : "Use this for downloading apps and redeeming invite codes."}
        </p>

        <div className="login-mode-switch" aria-label="Login type">
          <button className={loginMode === "user" ? "active" : ""} onClick={() => selectLoginMode("user")}>
            <UserRound size={18} />
            <span>
              <strong>User login</strong>
              <small>Invite and download</small>
            </span>
          </button>
          <button className={loginMode === "admin" ? "active" : ""} onClick={() => selectLoginMode("admin")}>
            <KeyRound size={18} />
            <span>
              <strong>Admin login</strong>
              <small>{ADMIN_EMAIL}</small>
            </span>
          </button>
        </div>

        <div className="form-grid">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <button className="button primary" disabled={busy} onClick={() => void signIn()}>
            <KeyRound size={18} />
            {loginMode === "admin" ? "Sign in as admin" : "Sign in as user"}
          </button>
          <button className="button secondary" disabled={busy} onClick={() => void googleSignIn()}>
            <UserRound size={18} />
            {loginMode === "admin" ? "Google admin" : "Google user"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={canManageApps ? "content-grid admin-workspace" : "content-grid two"}>
      {!canManageApps ? (
        <div className="account-panel">
        <div className="account-heading">
          <h2>Account</h2>
          <span className={canManageApps ? "role-badge admin" : "role-badge user"}>
            {canManageApps ? "Admin" : "User"}
          </span>
        </div>
        {loginMode === "admin" && profile && !canManageApps ? (
          <p className="warning-text">
            This account is signed in as a normal user. Admin tools are hidden because only {ADMIN_EMAIL} can be admin.
          </p>
        ) : null}
        <dl>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>{accessibleApps.length > 0 ? `${accessibleApps.length} app(s)` : profile?.accessStatus || "Loading"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{isAdminProfile(profile) ? "admin" : "user"}</dd>
          </div>
          <div>
            <dt>Device limit</dt>
            <dd>{profile?.deviceLimit ?? "-"}</dd>
          </div>
          <div>
            <dt>Supporter</dt>
            <dd>{profile?.supporterStatus || "none"}</dd>
          </div>
          <div>
            <dt>Total donated</dt>
            <dd>{formatDonation(profile)}</dd>
          </div>
          <div>
            <dt>Invite quota</dt>
            <dd>{profile?.inviteQuota ?? "-"}</dd>
          </div>
          <div>
            <dt>Managed apps</dt>
            <dd>{manageableApps.length}</dd>
          </div>
        </dl>
      </div>
      ) : null}

      {canManageApps ? (
        <div className="account-panel">
          <h2>Donation</h2>
          <p className="panel-copy">
            This Ko-fi Tip Panel lets supporters leave a message and donate without signing in to
            Brainok Store.
          </p>
          <div className="editor-grid">
            <label className="wide-field">
              Global donation URL
              <input
                value={donationUrlDraft}
                onChange={(event) => {
                  setDonationUrlDraft(event.target.value);
                  setDonationUrlSaved(false);
                }}
                placeholder="https://ko-fi.com/brainok777/?hidefeed=true&widget=true&embed=true&preview=true"
              />
            </label>
          </div>
          <div className="button-row">
            <button className="button primary" disabled={busy} onClick={() => void saveDonationUrl()}>
              <Save size={18} />
              Save donation URL
            </button>
            {donationUrlSaved ? <span className="quota-note">Saved</span> : null}
          </div>
        </div>
      ) : null}

      <div className="account-panel">
        {canManageApps ? (
          <>
            <h2>Apps</h2>
            <p className="panel-copy">
              Add apps whenever you need them, then create app-specific activation numbers.
            </p>

            <div className="inline-form">
              <input value={newAppName} onChange={(event) => setNewAppName(event.target.value)} placeholder="New app name" />
              <select value={newAppType} onChange={(event) => setNewAppType(event.target.value as AppType)} aria-label="New app type">
                <option value="application">Application</option>
                <option value="web_app">Web App</option>
              </select>
              <button className="button secondary" disabled={busy || !newAppName.trim()} onClick={() => void createNewApp()}>
                <Plus size={18} />
                Add app
              </button>
            </div>

            {manageableApps.length > 0 ? (
              <>
                <div className="app-selector-panel">
                  <div className="app-selector-header">
                    <span className="mini-label">Select app to edit</span>
                    {selectedManagedApp ? <strong>Editing: {selectedManagedApp.name}</strong> : null}
                  </div>
                  <div className="app-order-actions">
                    <button className="icon-button" type="button" aria-label="Move selected app up" title="Move up" disabled={busy || !selectedManagedApp} onClick={() => void moveSelectedApp("up")}>
                      <ArrowUp size={18} />
                    </button>
                    <button className="icon-button" type="button" aria-label="Move selected app down" title="Move down" disabled={busy || !selectedManagedApp} onClick={() => void moveSelectedApp("down")}>
                      <ArrowDown size={18} />
                    </button>
                  </div>
                  <div className="app-selector-rail" role="list">
                    {manageableApps.map((app) => {
                      const selected = selectedManagedApp?.appId === app.appId;
                      const iconUrl = appIconUrl(app);

                      return (
                        <button
                          className={selected ? "app-selector-tile active" : "app-selector-tile"}
                          key={app.appId}
                          type="button"
                          role="listitem"
                          aria-pressed={selected}
                          onClick={() => setSelectedAppId(app.appId)}
                        >
                          <span className="app-selector-icon">
                            {iconUrl ? <img src={iconUrl} alt="" /> : <Package size={23} />}
                          </span>
                          <span className="app-selector-copy">
                            <strong>{app.name}</strong>
                            <small>{appTypeLabel(app)} · order {displaySortOrder(app, manageableApps.indexOf(app))}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="editor-grid">
                  <label>
                    Name
                    <input value={appDraft.name} onChange={(event) => setAppDraft({ ...appDraft, name: event.target.value })} />
                  </label>
                  <label>
                    Category
                    <input value={appDraft.category} onChange={(event) => setAppDraft({ ...appDraft, category: event.target.value })} placeholder="Research, writing, clinic..." />
                  </label>
                  <label>
                    App type
                    <select value={appDraft.appType} onChange={(event) => setAppDraft({ ...appDraft, appType: event.target.value as AppType })}>
                      <option value="application">Application</option>
                      <option value="web_app">Web App</option>
                    </select>
                  </label>
                  <label>
                    Display order
                    <input type="number" min="0" step="1" value={appDraft.sortOrder} onChange={(event) => setAppDraft({ ...appDraft, sortOrder: event.target.value })} />
                  </label>
                  <label className="wide-field">
                    Listing short description
                    <textarea
                      value={appDraft.shortDescription}
                      onChange={(event) => setAppDraft({ ...appDraft, shortDescription: event.target.value })}
                      rows={3}
                      placeholder="One or two short sentences for the listing page."
                    />
                  </label>
                  <label className="wide-field">
                    Listing detail Markdown
                    <textarea
                      className="large-description"
                      value={appDraft.description}
                      onChange={(event) => setAppDraft({ ...appDraft, description: event.target.value })}
                      rows={10}
                      placeholder="Optional longer product notes. Support page uses the Support content below first."
                    />
                  </label>
                  <div className="wide-field markdown-preview">
                    <span className="mini-label">Listing Markdown preview</span>
                    <MarkdownView content={appDraft.description} fallback="Your formatted app description will appear here." />
                  </div>
                  <label className="wide-field">
                    Support content
                    <textarea
                      className="large-description"
                      value={appDraft.supportContent}
                      onChange={(event) => setAppDraft({ ...appDraft, supportContent: event.target.value })}
                      rows={12}
                      placeholder={"Paste Support Markdown here.\n\nSuggested sections:\n# Install\n# Activation\n# Common problems\n# Contact"}
                    />
                  </label>
                  <div className="wide-field markdown-preview">
                    <span className="mini-label">Support preview</span>
                    <MarkdownView content={appDraft.supportContent} fallback="Support guide will appear here." />
                  </div>
                  <div className="wide-field app-media-settings">
                    <div className="app-icon-editor">
                      <div className="app-icon-preview">
                        {toDisplayImageUrl(appDraft.iconUrl) ? (
                          <img src={toDisplayImageUrl(appDraft.iconUrl) || ""} alt="" />
                        ) : (
                          <Package size={26} />
                        )}
                      </div>
                      <label>
                        App icon URL
                        <input
                          value={appDraft.iconUrl}
                          onChange={(event) => setAppDraft({ ...appDraft, iconUrl: event.target.value })}
                          placeholder="Square PNG/WebP URL"
                        />
                      </label>
                    </div>
                    <div className="nested-editor-grid">
                      <label>
                        Thumbnail image URL
                        <input
                          value={appDraft.thumbnailUrl}
                          onChange={(event) => setAppDraft({ ...appDraft, thumbnailUrl: event.target.value })}
                          placeholder="Large product image URL"
                        />
                      </label>
                      <label>
                        Demo video URL
                        <input
                          value={appDraft.videoUrl}
                          onChange={(event) => setAppDraft({ ...appDraft, videoUrl: event.target.value })}
                          placeholder="Demo video URL"
                        />
                      </label>
                    </div>
                    <div className="upload-strip compact-upload">
                      <label>
                        Upload file as
                        <select value={appUploadTarget} onChange={(event) => setAppUploadTarget(event.target.value as ReleaseUploadTarget)}>
                          <option value="icon">App icon</option>
                          <option value="thumbnail">Thumbnail image</option>
                          <option value="video">Demo video</option>
                          <option value="windows">Windows installer</option>
                          <option value="mac">Mac installer</option>
                          <option value="release">Release page file</option>
                          <option value="docs">Manual or docs</option>
                        </select>
                      </label>
                      <label className={selectedManagedApp ? "file-picker" : "file-picker disabled"}>
                        <UploadCloud size={20} />
                        {appUploadProgress === null ? "Choose file" : `Uploading ${appUploadProgress}%`}
                        <input
                          disabled={!selectedManagedApp || busy}
                          type="file"
                          accept={uploadAccept(appUploadTarget)}
                          onChange={(event) => void uploadSelectedAppFile(event.target.files?.[0])}
                        />
                      </label>
                    </div>
                    <p className="quota-note">Use a square icon for menus, and a wider thumbnail for the app detail page.</p>
                  </div>
                  <label>
                    Visibility
                    <select value={appDraft.visibility} onChange={(event) => setAppDraft({ ...appDraft, visibility: event.target.value as AppDraft["visibility"] })}>
                      <option value="public">Public board</option>
                      <option value="private">Private</option>
                    </select>
                  </label>
                  <label>
                    Access model
                    <select value={appDraft.pricingMode} onChange={(event) => setAppDraft({ ...appDraft, pricingMode: event.target.value as AppDraft["pricingMode"] })}>
                      <option value="invite_only">Invite only</option>
                      <option value="free">Free</option>
                      <option value="paid">Paid access</option>
                      <option value="donation">Donation only</option>
                    </select>
                  </label>
                  <label>
                    Price
                    <input type="number" min="0" step="0.01" value={appDraft.priceMajor} onChange={(event) => setAppDraft({ ...appDraft, priceMajor: event.target.value })} />
                  </label>
                  <label>
                    Currency
                    <input value={appDraft.currency} onChange={(event) => setAppDraft({ ...appDraft, currency: event.target.value.toUpperCase() })} />
                  </label>
                  <label>
                    Billing
                    <select value={appDraft.billingInterval} onChange={(event) => setAppDraft({ ...appDraft, billingInterval: event.target.value as AppDraft["billingInterval"] })}>
                      <option value="one_time">One-time</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="pay_what_you_want">Pay what you want</option>
                    </select>
                  </label>
                  <label className="wide-field">
                    Lemon checkout URL
                    <input value={appDraft.checkoutUrl} onChange={(event) => setAppDraft({ ...appDraft, checkoutUrl: event.target.value })} placeholder="https://brainokstore.lemonsqueezy.com/checkout/..." />
                  </label>
                  <label>
                    Version
                    <input value={appDraft.latestVersion} onChange={(event) => setAppDraft({ ...appDraft, latestVersion: event.target.value })} placeholder="0.1.0" />
                  </label>
                  <label>
                    Release URL
                    <input value={appDraft.releaseUrl} onChange={(event) => setAppDraft({ ...appDraft, releaseUrl: event.target.value })} />
                  </label>
                  <label>
                    Mac download URL
                    <input value={appDraft.macDownloadUrl} onChange={(event) => setAppDraft({ ...appDraft, macDownloadUrl: event.target.value })} />
                  </label>
                  <label>
                    Windows download URL
                    <input value={appDraft.windowsDownloadUrl} onChange={(event) => setAppDraft({ ...appDraft, windowsDownloadUrl: event.target.value })} />
                  </label>
                </div>

                <button className="button primary full" disabled={busy || !selectedManagedApp} onClick={() => void saveSelectedApp()}>
                  <Save size={18} />
                  Save app settings
                </button>
                {appSaveStatus ? <p className="status-note">{appSaveStatus}</p> : null}
              </>
            ) : null}

            <div className="panel-separator" />

            <h2>Shared access code</h2>
            <p className="panel-copy">
              Give this one code to friends or early testers. When they sign in and enter it,
              the site creates their own personal activation number automatically.
            </p>
            <div className="editor-grid">
              <label>
                Shared code
                <input
                  value={sharedAccessCodeDraft}
                  onChange={(event) => {
                    setSharedAccessCodeDraft(event.target.value);
                    setSharedAccessSaved(null);
                  }}
                  placeholder="BRAINOK-FRIENDS-2026"
                />
              </label>
              <label>
                Max users
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={sharedAccessMaxUsers}
                  onChange={(event) => {
                    setSharedAccessMaxUsers(event.target.value);
                    setSharedAccessSaved(null);
                  }}
                  placeholder="0"
                />
              </label>
            </div>
            <p className="quota-note">Use 0 for unlimited early testers. Each user gets one personal activation number.</p>
            <button className="button primary full" disabled={busy || !selectedManagedApp || !sharedAccessCodeDraft.trim()} onClick={() => void saveSharedAccessCode()}>
              <KeyRound size={18} />
              Save shared access code
            </button>
            {sharedAccessSaved ? <p className="success-text">Shared access code saved: {sharedAccessSaved}</p> : null}

            <div className="panel-separator" />

            <h2>One-off activation number</h2>
            <p className="panel-copy">
              Use this only when you want to assign a code to one specific customer email yourself.
            </p>
            <label>
              Customer email
              <input
                value={activationCustomerEmail}
                onChange={(event) => setActivationCustomerEmail(event.target.value)}
                placeholder="customer@example.com"
              />
            </label>
            <p className="quota-note">
              If you enter an email, that user can sign in later and see this activation number in Account.
            </p>

            <button className="button secondary full" disabled={busy || !selectedManagedApp} onClick={() => void createNewActivationCode()}>
              <KeyRound size={18} />
              Create activation number
            </button>
            {createdInvite ? (
              <div className="invite-result">
                {createdInviteAppName ? <span className="mini-label">{createdInviteAppName}</span> : null}
                <code className="invite-code">{createdInvite}</code>
                <button className="button secondary full" onClick={() => void copyInvite()}>
                  <Copy size={18} />
                  {copyLabel}
                </button>
              </div>
            ) : null}

          </>
        ) : (
          <>
            <h2>Desktop activation</h2>
            <p className="panel-copy">
              Download the app, launch it, and enter your activation number inside the desktop app. A 30-day trial starts automatically on first launch.
            </p>
            <div className="access-code-box">
              <h3>Have an access code?</h3>
              <p className="panel-copy">
                Enter the shared code you received. The site will create your personal activation number for this account.
              </p>
              <div className="inline-form">
                <input
                  value={accessCodeInput}
                  onChange={(event) => {
                    setAccessCodeInput(event.target.value);
                    setAccessCodeResult(null);
                  }}
                  placeholder="BRAINOK-FRIENDS-2026"
                />
                <button className="button primary" disabled={busy || !accessCodeInput.trim()} onClick={() => void redeemAccessCode()}>
                  <KeyRound size={18} />
                  Get number
                </button>
              </div>
              {accessCodeResult ? <p className="success-text">Activation number ready: {accessCodeResult}</p> : null}
            </div>

            <div className="panel-separator" />

            <div className="activation-code-list">
              {myActivationCodesLoading ? (
                <p className="panel-copy">Loading your activation numbers...</p>
              ) : myActivationCodes.length > 0 ? (
                myActivationCodes.map((activationCode) => (
                  <article className="activation-code-card" key={activationCode.code}>
                    <div>
                      <span className="mini-label">{activationCode.appName}</span>
                      <code>{activationCode.code}</code>
                      <small>
                        {activationCode.status} · {activationCode.activationCount}/{activationCode.maxActivations} used
                      </small>
                    </div>
                    <button className="button secondary compact" onClick={() => void copyMyActivationCode(activationCode.code)}>
                      <Copy size={16} />
                      {copiedActivationCode === activationCode.code ? "Copied" : "Copy"}
                    </button>
                  </article>
                ))
              ) : (
                <p className="warning-text">
                  No activation number is assigned to {user.email || "this account"} yet. You can still download and use the 30-day trial. If you received a shared access code, enter it above to create your number.
                </p>
              )}
            </div>
          </>
        )}

      </div>
    </section>
  );
}

function SupportResourcesEditor({
  settings,
  onError
}: {
  settings: SiteSettings;
  onError: (message: string | null) => void;
}) {
  const safeResources = Array.isArray(settings.supportResources) && settings.supportResources.length > 0
    ? settings.supportResources
    : DEFAULT_SITE_SETTINGS.supportResources;
  const [resources, setResources] = useState<SupportResource[]>(safeResources);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setResources(safeResources);
    setSaved(false);
  }, [safeResources]);

  function updateResource(index: number, key: keyof SupportResource, value: string) {
    setResources((currentResources) => currentResources.map((resource, resourceIndex) => (
      resourceIndex === index ? { ...resource, [key]: value } : resource
    )));
    setSaved(false);
  }

  function addResource() {
    setResources((currentResources) => [
      ...currentResources,
      {
        id: `support-${Date.now()}`,
        title: "New resource",
        description: "Short support description",
        url: ""
      }
    ]);
    setSaved(false);
  }

  function removeResource(index: number) {
    setResources((currentResources) => currentResources.filter((_, resourceIndex) => resourceIndex !== index));
    setSaved(false);
  }

  async function saveResources() {
    try {
      setBusy(true);
      onError(null);
      await updateSiteSettings({
        ...settings,
        supportResources: resources.map((resource, index) => ({
          id: resource.id || `support-${index + 1}`,
          title: resource.title,
          description: resource.description,
          url: resource.url || ""
        }))
      });
      setSaved(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save support resources.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="support-resources-editor">
      <h2>Support resources</h2>
      <p className="panel-copy">These red resource cards appear under the Support menu.</p>
      <div className="support-editor-list">
        {resources.map((resource, index) => (
          <div className="support-editor-item" key={resource.id || index}>
            <label>
              Title
              <input value={resource.title} onChange={(event) => updateResource(index, "title", event.target.value)} />
            </label>
            <label>
              Description
              <input value={resource.description} onChange={(event) => updateResource(index, "description", event.target.value)} />
            </label>
            <label>
              URL
              <input value={resource.url || ""} onChange={(event) => updateResource(index, "url", event.target.value)} placeholder="https://..." />
            </label>
            <button className="button secondary" type="button" onClick={() => removeResource(index)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="publisher-actions">
        <button className="button secondary" type="button" onClick={addResource}>
          <Plus size={18} />
          Add resource
        </button>
        <button className="button primary" disabled={busy} type="button" onClick={() => void saveResources()}>
          <Save size={18} />
          Save resources
        </button>
        {saved ? <span className="quota-note">Saved</span> : null}
      </div>
    </div>
  );
}

function DocsView() {
  return (
    <section className="docs-panel">
      <h2>Brainok Store</h2>
      <p>
        Brainok Store offers software tools and digital projects designed to improve productivity,
        support research, and inspire innovation. Our goal is to build practical applications that
        make everyday work easier and more efficient.
      </p>
      <p>
        Many Brainok tools are freely available. Your support helps us continue developing and
        maintaining these projects.
      </p>
    </section>
  );
}

interface AppDraft {
  name: string;
  shortDescription: string;
  description: string;
  supportContent: string;
  category: string;
  appType: AppType;
  sortOrder: string;
  visibility: "public" | "private";
  pricingMode: "invite_only" | "free" | "paid" | "donation";
  priceMajor: string;
  currency: string;
  billingInterval: "one_time" | "monthly" | "yearly" | "pay_what_you_want";
  checkoutUrl: string;
  releaseUrl: string;
  macDownloadUrl: string;
  windowsDownloadUrl: string;
  docsUrl: string;
  iconUrl: string;
  thumbnailUrl: string;
  videoUrl: string;
  latestVersion: string;
}

const emptyAppDraft: AppDraft = {
  name: "",
  shortDescription: "",
  description: "",
  supportContent: "",
  category: "",
  appType: "application",
  sortOrder: "0",
  visibility: "public",
  pricingMode: "invite_only",
  priceMajor: "0",
  currency: "USD",
  billingInterval: "one_time",
  checkoutUrl: "",
  releaseUrl: "",
  macDownloadUrl: "",
  windowsDownloadUrl: "",
  docsUrl: "",
  iconUrl: "",
  thumbnailUrl: "",
  videoUrl: "",
  latestVersion: ""
};

function appToDraft(app: BrainokApp): AppDraft {
  return {
    name: app.name,
    shortDescription: app.shortDescription || "",
    description: app.description || "",
    supportContent: app.supportContent || "",
    category: app.category || "",
    appType: appKind(app),
    sortOrder: String(displaySortOrder(app, 0)),
    visibility: app.visibility || "public",
    pricingMode: app.pricing?.mode || "invite_only",
    priceMajor: centsToMajor(app.pricing?.priceCents || 0),
    currency: app.pricing?.currency || "USD",
    billingInterval: app.pricing?.interval || "one_time",
    checkoutUrl: app.pricing?.checkoutUrl || "",
    releaseUrl: app.downloads?.releaseUrl || "",
    macDownloadUrl: app.downloads?.macUrl || "",
    windowsDownloadUrl: app.downloads?.windowsUrl || "",
    docsUrl: app.downloads?.docsUrl || "",
    iconUrl: app.media?.iconUrl || "",
    thumbnailUrl: app.media?.thumbnailUrl || "",
    videoUrl: app.media?.videoUrl || "",
    latestVersion: app.downloads?.latestVersion || ""
  };
}

function draftToUpdate(draft: AppDraft) {
  return {
    name: draft.name,
    shortDescription: draft.shortDescription,
    description: draft.description,
    supportContent: draft.supportContent,
    category: draft.category,
    appType: draft.appType,
    sortOrder: Math.max(0, Math.round(Number(draft.sortOrder || 0))),
    visibility: draft.visibility,
    pricingMode: draft.pricingMode,
    priceCents: Math.max(0, Math.round(Number(draft.priceMajor || 0) * 100)),
    currency: draft.currency || "USD",
    billingInterval: draft.billingInterval,
    checkoutUrl: draft.checkoutUrl,
    releaseUrl: draft.releaseUrl,
    macDownloadUrl: draft.macDownloadUrl,
    windowsDownloadUrl: draft.windowsDownloadUrl,
    docsUrl: draft.docsUrl,
    iconUrl: toStorableImageUrl(draft.iconUrl),
    thumbnailUrl: toStorableImageUrl(draft.thumbnailUrl),
    videoUrl: draft.videoUrl,
    latestVersion: draft.latestVersion
  };
}

function attachUploadUrl(draft: AppDraft, target: ReleaseUploadTarget, url: string): AppDraft {
  if (target === "windows") {
    return { ...draft, windowsDownloadUrl: url };
  }

  if (target === "mac") {
    return { ...draft, macDownloadUrl: url };
  }

  if (target === "docs") {
    return { ...draft, docsUrl: url };
  }

  if (target === "thumbnail") {
    return { ...draft, thumbnailUrl: url };
  }

  if (target === "icon") {
    return { ...draft, iconUrl: url };
  }

  if (target === "video") {
    return { ...draft, videoUrl: url };
  }

  return { ...draft, releaseUrl: url };
}

function uploadAccept(target: ReleaseUploadTarget) {
  if (target === "icon" || target === "thumbnail") {
    return "image/png,image/jpeg,image/webp,image/gif";
  }

  if (target === "video") {
    return "video/mp4,video/webm,video/quicktime";
  }

  return undefined;
}

function toStorableImageUrl(value: string) {
  return toDisplayImageUrl(value) || "";
}

function localAppMediaUrl(app: BrainokApp) {
  return LOCAL_APP_MEDIA[app.appId] || LOCAL_APP_MEDIA[app.slug] || null;
}

function appIconUrl(app: BrainokApp) {
  return localAppMediaUrl(app) || toDisplayImageUrl(app.media?.iconUrl) || toDisplayImageUrl(app.media?.thumbnailUrl);
}

function appKind(app: BrainokApp | null | undefined): AppType {
  return app?.appType === "web_app" ? "web_app" : "application";
}

function appTypeLabel(app: BrainokApp) {
  return appKind(app) === "web_app" ? "Web App" : "Application";
}

function displaySortOrder(app: BrainokApp, fallbackIndex: number) {
  return typeof app.sortOrder === "number" && Number.isFinite(app.sortOrder)
    ? app.sortOrder
    : (fallbackIndex + 1) * 10;
}

function sortAppsForDisplay(apps: BrainokApp[]) {
  return apps
    .map((app, index) => ({ app, index }))
    .sort((left, right) => {
    const orderDelta = displaySortOrder(left.app, left.index) - displaySortOrder(right.app, right.index);
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return left.app.name.localeCompare(right.app.name);
  })
    .map(({ app }) => app);
}

function nextSortOrder(apps: BrainokApp[]) {
  if (apps.length === 0) {
    return 10;
  }

  return Math.max(...apps.map((app, index) => displaySortOrder(app, index))) + 10;
}

function appPrimaryMedia(app: BrainokApp) {
  const localUrl = localAppMediaUrl(app);
  if (localUrl) {
    return { url: localUrl, isIcon: false };
  }

  const thumbnailUrl = toDisplayImageUrl(app.media?.thumbnailUrl);
  if (thumbnailUrl) {
    return { url: thumbnailUrl, isIcon: false };
  }

  const iconUrl = toDisplayImageUrl(app.media?.iconUrl);
  return { url: iconUrl, isIcon: Boolean(iconUrl) };
}

function toDisplayImageUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  const driveId = googleDriveFileId(raw);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`;
  }

  return raw;
}

function googleDriveFileId(value: string) {
  try {
    const url = new URL(value);
    if (!url.hostname.includes("drive.google.com")) {
      return null;
    }

    const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    if (filePathMatch?.[1]) {
      return filePathMatch[1];
    }

    return url.searchParams.get("id");
  } catch {
    const looseMatch = value.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    return looseMatch?.[1] || null;
  }
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url) || url.includes("firebasestorage.googleapis.com");
}

const YOUTUBE_PLAYBACK_QUALITY = "hd720";

function youtubeEmbedUrlFrom(value: string | null | undefined, mode: "quiet" | "player" = "quiet") {
  const raw = externalVideoUrlFrom(value);
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^(www|m)\./, "");
    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || null;
    } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live", "v", "e"].includes(parts[0])) {
          videoId = parts[1] || null;
        }
      }
    }

    if (!videoId) {
      videoId = raw.match(/(?:[?&]v=|\/(?:embed|shorts|live|v|e)\/|youtu\.be\/)([\w-]{11})/)?.[1] || null;
    }

    if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
      return null;
    }

    const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    const start = youtubeStartSeconds(url.searchParams.get("t") || url.searchParams.get("start"));
    if (start > 0) {
      embedUrl.searchParams.set("start", String(start));
    }
    embedUrl.searchParams.set("playsinline", "1");
    embedUrl.searchParams.set("modestbranding", "1");
    embedUrl.searchParams.set("iv_load_policy", "3");
    embedUrl.searchParams.set("rel", "0");
    embedUrl.searchParams.set("autoplay", "1");
    embedUrl.searchParams.set("vq", YOUTUBE_PLAYBACK_QUALITY);
    if (mode === "quiet") {
      embedUrl.searchParams.set("mute", "1");
      embedUrl.searchParams.set("controls", "0");
    } else {
      embedUrl.searchParams.set("controls", "1");
    }
    return embedUrl.toString();
  } catch {
    return null;
  }
}

function externalVideoUrlFrom(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  const embeddedUrl = raw.match(/(?:src|href)=["']([^"']+)["']/i)?.[1];
  const looseUrl = raw.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  return embeddedUrl || looseUrl || raw;
}

function youtubeStartSeconds(value: string | null) {
  if (!value) {
    return 0;
  }

  const numeric = Number(value.replace(/s$/i, ""));
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.floor(numeric));
  }

  const match = value.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!match) {
    return 0;
  }

  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

function MarkdownView({
  content,
  fallback,
  className = "markdown-view"
}: {
  content?: string | null;
  fallback: string;
  className?: string;
}) {
  const raw = (content?.trim() || fallback).trim();
  const lines = raw.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(<pre key={`code-${index}`}><code>{codeLines.join("\n")}</code></pre>);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${index}`} />);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && /^(=+|-+)$/.test(lines[index + 1].trim())) {
      const Tag = lines[index + 1].trim().startsWith("=") ? "h1" : "h2";
      const headingContent = renderInlineMarkdown(trimmed, `setext-${index}`);
      blocks.push(
        Tag === "h1"
          ? <h1 key={`setext-${index}`}>{headingContent}</h1>
          : <h2 key={`setext-${index}`}>{headingContent}</h2>
      );
      index += 2;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 6);
      const headingContent = renderInlineMarkdown(heading[2], `heading-${index}`);
      if (level === 1) {
        blocks.push(<h1 key={`heading-${index}`}>{headingContent}</h1>);
      } else if (level === 2) {
        blocks.push(<h2 key={`heading-${index}`}>{headingContent}</h2>);
      } else if (level === 3) {
        blocks.push(<h3 key={`heading-${index}`}>{headingContent}</h3>);
      } else if (level === 4) {
        blocks.push(<h4 key={`heading-${index}`}>{headingContent}</h4>);
      } else if (level === 5) {
        blocks.push(<h5 key={`heading-${index}`}>{headingContent}</h5>);
      } else {
        blocks.push(<h6 key={`heading-${index}`}>{headingContent}</h6>);
      }
      index += 1;
      continue;
    }

    if (looksLikePlainHeading(lines, index)) {
      const headingContent = renderInlineMarkdown(trimmed, `plain-heading-${index}`);
      const firstBlock = blocks.length === 0;
      blocks.push(
        firstBlock
          ? <h1 key={`plain-heading-${index}`}>{headingContent}</h1>
          : <h2 key={`plain-heading-${index}`}>{headingContent}</h2>
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ul-${index}-${itemIndex}`}>{renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ol-${index}-${itemIndex}`}>{renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {renderInlineMarkdown(quoteLines.join("\n"), `quote-${index}`)}
        </blockquote>
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isMarkdownBlockStart(lines[index].trim())
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`}>
        {renderInlineMarkdown(paragraphLines.join("\n"), `p-${index}`)}
      </p>
    );
  }

  return <div className={className}>{blocks}</div>;
}

function isMarkdownBlockStart(line: string) {
  return /^(```|#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s*|-{3,}$|\*{3,}$|_{3,}$)/.test(line);
}

function looksLikePlainHeading(lines: string[], index: number) {
  const trimmed = lines[index].trim();
  if (!trimmed || trimmed.length > 72) {
    return false;
  }

  if (isMarkdownBlockStart(trimmed) || /[.!?。！？,，:：;；]$/.test(trimmed)) {
    return false;
  }

  if (/^(https?:\/\/|이\s|이것|저는|그리고|하지만|또한)\b/i.test(trimmed)) {
    return false;
  }

  const previousBlank = index === 0 || !lines[index - 1].trim();
  const nextBlank = index + 1 < lines.length && !lines[index + 1].trim();
  const nextExists = lines.slice(index + 1).some((line) => line.trim());

  return previousBlank && nextBlank && nextExists;
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  function pushPlain(segment: string) {
    segment.split("\n").forEach((part, index) => {
      if (index > 0) {
        nodes.push(<br key={`${keyPrefix}-br-${nodes.length}`} />);
      }
      if (part) {
        nodes.push(part);
      }
    });
  }

  while ((match = pattern.exec(text)) !== null) {
    pushPlain(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith("`")) {
      nodes.push(<code key={`${keyPrefix}-code-${nodes.length}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-strong-${nodes.length}`}>{token.slice(2, -2)}</strong>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link?.[2] || "";
      const safeHref = /^https?:\/\//i.test(href) ? href : "#";
      nodes.push(
        <a key={`${keyPrefix}-link-${nodes.length}`} href={safeHref} target="_blank" rel="noreferrer">
          {link?.[1] || href}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  pushPlain(text.slice(lastIndex));
  return nodes;
}

function centsToMajor(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2).replace(/\.00$/, "");
}

function compactAppDescription(app: BrainokApp) {
  const fallback = "Install the app, use the trial, then enter a redeem code if you received one.";
  const text = (app.shortDescription || app.description || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return fallback;
  }

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function supportTeaser(app: BrainokApp) {
  const text = (app.supportContent || app.description || app.shortDescription || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return "Open support for install notes, troubleshooting, and app-specific QnA.";
  }

  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function timestampMillis(value: unknown) {
  if (!value) {
    return 0;
  }

  if (typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatTimestamp(value: unknown) {
  const millis = timestampMillis(value);
  if (!millis) {
    return "just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(millis));
}

function appDownloadLinks(app: BrainokApp) {
  const links: Array<{ label: string; href: string }> = [];

  if (app.downloads?.windowsUrl) {
    links.push({ label: "Download Win", href: app.downloads.windowsUrl });
  }

  if (app.downloads?.macUrl) {
    links.push({ label: "Download Mac", href: app.downloads.macUrl });
  }

  if (links.length === 0 && app.downloads?.releaseUrl) {
    links.push({ label: "Release page", href: app.downloads.releaseUrl });
  }

  return links;
}

function accessLabel(mode: string) {
  if (mode === "free") {
    return "Free";
  }

  if (mode === "paid") {
    return "Paid";
  }

  if (mode === "donation") {
    return "Donation";
  }

  return "Invite only";
}

function isAdminProfile(profile: UserProfile | null) {
  if (!profile) {
    return false;
  }

  return profile.email?.toLowerCase() === ADMIN_EMAIL;
}

function formatAppPrice(app: BrainokApp) {
  const pricing = app.pricing;
  const mode = pricing?.mode || "invite_only";

  if (mode === "free") {
    return "$0";
  }

  if (mode === "invite_only") {
    return "Invite only";
  }

  if (mode === "donation") {
    return "Pay what you want";
  }

  const currency = pricing?.currency || "USD";
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency
  }).format((pricing?.priceCents || 0) / 100);

  if (pricing?.interval === "monthly") {
    return `${amount}/mo`;
  }

  if (pricing?.interval === "yearly") {
    return `${amount}/yr`;
  }

  if (pricing?.interval === "pay_what_you_want") {
    return `From ${amount}`;
  }

  return amount;
}

function formatDonation(profile: UserProfile | null) {
  if (!profile?.donationTotalCents) {
    return "-";
  }

  const currency = profile.donationCurrency || "USD";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency
  }).format(profile.donationTotalCents / 100);
}

function PlanCard({
  title,
  price,
  features,
  action
}: {
  title: string;
  price: string;
  features: string[];
  action?: ReactNode;
}) {
  return (
    <article className="plan-card">
      <h2>{title}</h2>
      <strong>{price}</strong>
      <ul>
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      {action}
    </article>
  );
}

function DownloadCard({
  title,
  subtitle,
  href
}: {
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <article className="download-card">
      <Download size={28} />
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <a className="button primary" href={href}>
        <Download size={18} />
        Download
      </a>
    </article>
  );
}

function TabButton({
  active,
  icon,
  children,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "tab active" : "tab"} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
