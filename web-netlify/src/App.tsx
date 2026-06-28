import { useEffect, useMemo, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
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
  answerAppQuestion,
  askAppQuestion,
  createApp,
  ensureUserProfile,
  grantFreeAppAccess,
  getAppFromServer,
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
type Language = "ko" | "en";
type ReadmeLanguage = "en" | "ko";
type MarkdownDraftField = "description" | "descriptionKo";

const BRAND_NAME = "Brainok Store";
const BRAND_LOGO_SRC = "/brainok-store-logo.png";
const KOFI_ACCOUNT_SLUG = "brainok777";
const KOFI_PAGE_URL = `https://ko-fi.com/${KOFI_ACCOUNT_SLUG}`;
const KOFI_CHECKOUT_URL = `${KOFI_PAGE_URL}#checkoutModal`;
const KOFI_TIP_PANEL_URL = `${KOFI_PAGE_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;
const LOCAL_APP_MEDIA: Record<string, string> = {
  "brainok-pagewheel": "/app-media/brainok-pagewheel.jpg",
  "brainok-pagewheel-afcc05": "/app-media/brainok-pagewheel.jpg",
  "hotkey-launcher": "/app-media/hotkey-launcher.jpg",
  "hotkey-launcher-c16cbb": "/app-media/hotkey-launcher.jpg",
  "recent-file-launcher": "/app-media/recent-file-launcher.jpg",
  "recent-file-launcher-2c4ea8": "/app-media/recent-file-launcher.jpg"
};
const LANGUAGE_STORAGE_KEY = "brainok-store-language";

const UI_TEXT = {
  ko: {
    loading: "불러오는 중...",
    navLabel: "주요 메뉴",
    applications: "응용 프로그램",
    application: "응용 프로그램",
    webApp: "웹 앱",
    support: "지원",
    account: "계정",
    signOut: "로그아웃",
    languageToggle: "English",
    languageFlag: "🇺🇸",
    kofiTitle: "Ko-fi 후원 폼 열기. Brainok Store 로그인은 필요하지 않습니다.",
    donateAlt: "Ko-fi에서 후원",
    noPublicApplications: "공개된 응용 프로그램이 아직 없습니다",
    publishedAppsAppear: "게시된 앱이 여기에 표시됩니다",
    allApplications: "전체 응용 프로그램",
    openApplicationsBoard: "응용 프로그램 목록 열기",
    apps: {
      applicationsEmptyTitle: "응용 프로그램",
      applicationsEmptyAdminCopy: "응용 프로그램이 아직 없습니다. 게시 도구에서 첫 앱을 만들어 주세요.",
      applicationsEmptyPublicCopy: "공개된 응용 프로그램이 아직 없습니다. 관리자 계정으로 로그인해 게시할 수 있습니다.",
      applicationsEyebrow: "응용 프로그램",
      applicationsTitle: "응용 프로그램 선택",
      applicationsIntro: "앱은 가로 목록으로 정리됩니다. Windows/Mac 설치 파일, 30일 체험판, 활성화 번호를 앱별로 관리할 수 있습니다.",
      webEmptyTitle: "웹 앱",
      webEmptyAdminCopy: "웹 앱이 아직 없습니다. 앱을 만들고 종류를 Web App으로 설정하세요.",
      webEmptyPublicCopy: "공개된 웹 앱이 아직 없습니다.",
      webEyebrow: "웹 앱",
      webTitle: "웹 앱 선택",
      webIntro: "브라우저에서 사용하는 도구를 다운로드 앱과 분리해 빠르게 찾을 수 있습니다.",
      boardWaitingTitle: "앱 목록 접근을 기다리는 중",
      boardWaitingCopy: "Firestore가 이 세션의 앱 목록을 막았습니다. 관리자 계정으로 로그인한 뒤 규칙 배포가 끝나면 새로고침하세요.",
      signInBeforeAdding: "앱을 계정에 추가하려면 먼저 로그인하세요.",
      addAccessFailed: "앱 접근 권한을 추가하지 못했습니다.",
      openApp: (name: string) => `${name} 열기`,
      fallbackDescription: "앱을 설치하고 체험판을 사용한 뒤, 받은 코드가 있으면 입력하세요.",
      fallbackMarkdown: "데스크톱 앱 접근 권한, 릴리스, 활성화 번호를 여기에서 관리합니다.",
      access: "접근",
      active: "활성",
      trial: "30일 체험판",
      version: "버전",
      noBuildYet: "빌드 없음",
      activated: "활성화됨",
      addToAccount: "계정에 추가",
      buyAccess: "구매",
      checkoutMissing: "결제 링크 없음",
      activateInApp: "앱에서 활성화",
      release: "릴리스",
      docs: "문서",
      demo: "데모",
      note: "먼저 다운로드하세요. 앱을 실행하면 30일 체험판이 시작됩니다. 교환/활성화 코드를 받았다면 앱 안에서 입력해 계속 무료로 사용할 수 있습니다.",
      allApps: "전체 앱",
      floating: "크게 보기",
      openFloating: (name: string) => `${name} 데모를 떠 있는 플레이어로 열기`,
      floatingTitle: "더블클릭하면 떠 있는 플레이어로 열립니다",
      demoVideo: "데모 영상",
      openSavedVideo: "저장된 영상 링크를 새 탭에서 엽니다.",
      openDemo: "데모 열기",
      overview: "앱 개요",
      overviewFallback: "설치 안내, 문제 해결, QnA는 지원 페이지에서 확인하세요.",
      closeFloating: "떠 있는 플레이어 닫기",
      floatingDemoLabel: (name: string) => `${name} 데모 영상`,
      desktopApp: "데스크톱 앱",
      publicLabel: "공개"
    },
    supportPage: {
      chooseApp: "아래 앱을 선택해 지원 페이지를 여세요.",
      noApps: "앱이 아직 없습니다",
      openSupport: "지원 열기",
      tipPanel: "후원 패널",
      supportStore: "Brainok Store 후원",
      donationCopy: "후원할 때 표시 이름과 메시지를 남길 수 있습니다. Brainok Store 로그인은 필요하지 않습니다.",
      openKofi: "Ko-fi 후원 폼 열기",
      allSupport: "전체 지원",
      supportGuide: "지원 안내",
      supportFallback: "이 앱의 설치 방법, 문제 해결, 알려진 문제, 연락 방법을 추가하세요.",
      teaserFallback: "설치 안내, 문제 해결, 앱별 QnA를 보려면 지원을 여세요."
    },
    qna: {
      loadFailed: "QnA를 불러오지 못했습니다.",
      signInBeforeAsk: "지원 질문을 하려면 먼저 로그인하세요.",
      writeMore: "제출하기 전에 조금 더 자세히 적어 주세요.",
      submitFailed: "질문을 제출하지 못했습니다.",
      writeAnswer: "답변을 먼저 작성하세요.",
      saveFailed: "답변을 저장하지 못했습니다.",
      label: "앱 QnA",
      title: "질문",
      intro: "사용자는 앱별 질문을 남길 수 있고, 관리자 답변은 각 질문 아래에 표시됩니다.",
      ask: "질문하기",
      placeholder: "예: 30일 체험판 이후 이 앱을 어떻게 활성화하나요?",
      submit: "질문 제출",
      signInPrompt: "지원 질문을 하려면 로그인하세요.",
      noQuestions: "아직 질문이 없습니다.",
      user: "사용자",
      adminAnswer: "관리자 답변",
      answerPlaceholder: "관리자 답변을 작성하세요...",
      saveAnswer: "답변 저장",
      waiting: "관리자 답변 대기 중",
      justNow: "방금 전"
    },
    download: {
      noApps: "다운로드 가능한 공개 앱이 아직 없습니다.",
      freeDownloads: "무료 다운로드",
      buildSoon: "준비 중",
      note: "신용카드는 필요 없습니다. 앱을 실행하면 30일 체험판이 시작되고, 앱 안에서 활성화 번호를 입력할 수 있습니다.",
      downloadWin: "Windows 다운로드",
      downloadMac: "Mac 다운로드",
      releasePage: "릴리스 페이지"
    },
    accountView: {
      chooseType: "계정 유형 선택",
      adminSignIn: "관리자 로그인",
      userSignIn: "사용자 로그인",
      adminIntro: (email: string) => `${email} 전용입니다. 이 계정은 앱 게시, 사이트 편집, 초대 코드 생성을 담당합니다.`,
      userIntro: "앱 다운로드와 초대 코드 등록에 사용합니다.",
      loginType: "로그인 유형",
      userLogin: "사용자 로그인",
      userLoginSub: "초대 및 다운로드",
      adminLogin: "관리자 로그인",
      email: "이메일",
      password: "비밀번호",
      signInAdmin: "관리자로 로그인",
      signInUser: "사용자로 로그인",
      googleAdmin: "Google 관리자",
      googleUser: "Google 사용자",
      enterEmail: "이메일 주소를 입력하거나 Google 로그인을 사용하세요.",
      enterAdminPassword: "관리자 비밀번호를 입력하거나 Google 관리자를 사용하세요.",
      enterUserPassword: "비밀번호를 입력하거나 Google 사용자를 사용하세요.",
      signInFailed: "로그인하지 못했습니다.",
      chooseAdmin: (email: string) => `Google 관리자 로그인에는 ${email} 계정을 선택하세요.`,
      googleFailed: "Google 로그인에 실패했습니다.",
      normalWarning: (email: string) => `이 계정은 일반 사용자로 로그인되어 있습니다. 관리자 도구는 ${email} 계정에서만 표시됩니다.`,
      access: "접근",
      role: "역할",
      deviceLimit: "기기 제한",
      supporter: "후원 상태",
      totalDonated: "총 후원",
      inviteQuota: "초대 한도",
      managedApps: "관리 앱",
      loading: "불러오는 중",
      appsCount: (count: number) => `${count}개 앱`
    }
  },
  en: {
    loading: "Loading...",
    navLabel: "Main navigation",
    applications: "Applications",
    application: "Application",
    webApp: "Web App",
    support: "Support",
    account: "Account",
    signOut: "Sign out",
    languageToggle: "한국어",
    languageFlag: "🇰🇷",
    kofiTitle: "Open the Ko-fi tip form. Brainok Store sign-in is not required.",
    donateAlt: "Donate on Ko-fi",
    noPublicApplications: "No public applications yet",
    publishedAppsAppear: "Published apps will appear here",
    allApplications: "All applications",
    openApplicationsBoard: "Open the applications board",
    apps: {
      applicationsEmptyTitle: "Applications",
      applicationsEmptyAdminCopy: "No applications yet. Use the publisher above to create the first application.",
      applicationsEmptyPublicCopy: "No public applications yet. Sign in with your admin account to publish one.",
      applicationsEyebrow: "Applications",
      applicationsTitle: "Choose an application",
      applicationsIntro: "Applications are listed sideways. Each app can have separate Windows and Mac installers, a 30-day trial, and activation/redeem codes.",
      webEmptyTitle: "Web App",
      webEmptyAdminCopy: "No web apps yet. Create one and set its type to Web App.",
      webEmptyPublicCopy: "No public web apps yet.",
      webEyebrow: "Web App",
      webTitle: "Choose a web app",
      webIntro: "Web apps are listed separately from downloadable applications, so visitors can find browser-based tools quickly.",
      boardWaitingTitle: "App board is waiting for access",
      boardWaitingCopy: "Firestore blocked the app list for this session. Sign in with your admin account, then refresh this page after rules finish deploying.",
      signInBeforeAdding: "Sign in before adding an app to your account.",
      addAccessFailed: "Could not add app access.",
      openApp: (name: string) => `Open ${name}`,
      fallbackDescription: "Install the app, use the trial, then enter a redeem code if you received one.",
      fallbackMarkdown: "Desktop app access, releases, and activation numbers are managed here.",
      access: "Access",
      active: "Active",
      trial: "30-day trial",
      version: "Version",
      noBuildYet: "No build yet",
      activated: "Activated",
      addToAccount: "Add to account",
      buyAccess: "Buy access",
      checkoutMissing: "Checkout link not set",
      activateInApp: "Activate in app",
      release: "Release",
      docs: "Docs",
      demo: "Demo",
      note: "Download first. A 30-day trial starts in the app. If you received a redeem/activation code, enter it in the app to keep using it free.",
      allApps: "All apps",
      floating: "Floating",
      openFloating: (name: string) => `Open ${name} demo in a floating player`,
      floatingTitle: "Double-click to open a floating player",
      demoVideo: "Demo video",
      openSavedVideo: "Open the saved video link in a new tab.",
      openDemo: "Open demo",
      overview: "Application overview",
      overviewFallback: "Open the Support page for install notes, troubleshooting, and QnA.",
      closeFloating: "Close floating player",
      floatingDemoLabel: (name: string) => `${name} floating demo video`,
      desktopApp: "Desktop app",
      publicLabel: "public"
    },
    supportPage: {
      chooseApp: "Choose an app below to open support.",
      noApps: "No apps yet",
      openSupport: "Open support",
      tipPanel: "Tip Panel",
      supportStore: "Support Brainok Store",
      donationCopy: "Leave a display name and message with your donation. Brainok Store sign-in is not required.",
      openKofi: "Open Ko-fi tip form",
      allSupport: "All support",
      supportGuide: "Support guide",
      supportFallback: "Add install notes, troubleshooting steps, known issues, and contact guidance for this app.",
      teaserFallback: "Open support for install notes, troubleshooting, and app-specific QnA."
    },
    qna: {
      loadFailed: "Could not load QnA.",
      signInBeforeAsk: "Sign in before asking a support question.",
      writeMore: "Write a little more before submitting.",
      submitFailed: "Could not submit question.",
      writeAnswer: "Write an answer first.",
      saveFailed: "Could not save answer.",
      label: "App QnA",
      title: "Questions",
      intro: "Users can ask app-specific questions here. Admin answers appear under each question.",
      ask: "Ask a question",
      placeholder: "Example: How do I activate this app after the 30-day trial?",
      submit: "Submit question",
      signInPrompt: "Sign in to ask a support question.",
      noQuestions: "No questions yet.",
      user: "User",
      adminAnswer: "Admin answer",
      answerPlaceholder: "Write an admin answer...",
      saveAnswer: "Save answer",
      waiting: "Waiting for admin answer",
      justNow: "just now"
    },
    download: {
      noApps: "No public apps are ready for download yet.",
      freeDownloads: "Free downloads",
      buildSoon: "Build soon",
      note: "No credit card needed. The app starts a 30-day trial and accepts an activation number inside the app.",
      downloadWin: "Download Win",
      downloadMac: "Download Mac",
      releasePage: "Release page"
    },
    accountView: {
      chooseType: "Choose account type",
      adminSignIn: "Admin sign in",
      userSignIn: "User sign in",
      adminIntro: (email: string) => `Use this only for ${email}. This account publishes apps, edits the site, and creates invite codes.`,
      userIntro: "Use this for downloading apps and redeeming invite codes.",
      loginType: "Login type",
      userLogin: "User login",
      userLoginSub: "Invite and download",
      adminLogin: "Admin login",
      email: "Email",
      password: "Password",
      signInAdmin: "Sign in as admin",
      signInUser: "Sign in as user",
      googleAdmin: "Google admin",
      googleUser: "Google user",
      enterEmail: "Enter your email address, or use Google sign-in.",
      enterAdminPassword: "Enter the admin password, or use Google admin.",
      enterUserPassword: "Enter your password, or use Google user.",
      signInFailed: "Sign-in failed.",
      chooseAdmin: (email: string) => `Choose ${email} for Google admin login.`,
      googleFailed: "Google sign-in failed.",
      normalWarning: (email: string) => `This account is signed in as a normal user. Admin tools are hidden because only ${email} can be admin.`,
      access: "Access",
      role: "Role",
      deviceLimit: "Device limit",
      supporter: "Supporter",
      totalDonated: "Total donated",
      inviteQuota: "Invite quota",
      managedApps: "Managed apps",
      loading: "Loading",
      appsCount: (count: number) => `${count} app(s)`
    }
  }
} as const;

type UiText = (typeof UI_TEXT)[Language];

function readPreferredLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

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
  const [language, setLanguage] = useState<Language>(readPreferredLanguage);
  const text = UI_TEXT[language];
  const localizedSiteSettings = useMemo(() => language === "ko" ? {
    ...siteSettings,
    primaryCtaLabel: "무료 다운로드",
    downloadTitle: "Brainok Store 다운로드",
    downloadSubtitle: "신용카드 없이 시작",
    downloadBody: "운영체제에 맞는 설치 파일을 선택하세요. 데스크톱 앱은 30일 체험판으로 시작하고 앱 안에서 활성화 번호를 입력할 수 있습니다."
  } : siteSettings, [language, siteSettings]);

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

  function toggleLanguage() {
    setLanguage((currentLanguage) => currentLanguage === "ko" ? "en" : "ko");
  }

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language persistence is optional; the UI still works without storage.
    }
  }, [language]);

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
          emptyTitle={text.apps.applicationsEmptyTitle}
          emptyAdminCopy={text.apps.applicationsEmptyAdminCopy}
          emptyPublicCopy={text.apps.applicationsEmptyPublicCopy}
          title={text.apps.applicationsTitle}
          language={language}
          text={text}
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
          emptyTitle={text.apps.webEmptyTitle}
          emptyAdminCopy={text.apps.webEmptyAdminCopy}
          emptyPublicCopy={text.apps.webEmptyPublicCopy}
          title={text.apps.webTitle}
          language={language}
          text={text}
        />
      );
    }

    if (tab === "download") {
      return <DownloadView apps={sortedNavApps} siteSettings={localizedSiteSettings} language={language} text={text} />;
    }

    if (tab === "account") {
      return <AccountView user={user} profile={profile} siteSettings={localizedSiteSettings} onError={setError} language={language} text={text} />;
    }

    return <PricingView apps={[...sortedNavApps, ...sortedWebApps]} user={user} profile={profile} siteSettings={localizedSiteSettings} onError={setError} language={language} text={text} />;
  }, [appOpenRequest, homeResetKey, language, localizedSiteSettings, profile, sortedNavApps, sortedWebApps, tab, text, user]);

  if (!ready) {
    return <main className="page-shell">{text.loading}</main>;
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={goHome}>
          <BrandLogo className="brand-mark" />
          <strong>{BRAND_NAME}</strong>
        </button>

        <nav className="tabs" aria-label={text.navLabel}>
          <div className="nav-menu-item">
            <button className={tab === "apps" ? "tab active" : "tab"} onClick={goHome}>
              <Package size={17} />
              {text.applications}
              <ChevronDown size={15} />
            </button>
            <div className="mega-menu product-mega" role="menu">
              <div>
                <span className="mega-heading">{text.applications}</span>
                {sortedNavApps.length > 0 ? (
                  sortedNavApps.slice(0, 10).map((app) => (
                    <button className="product-menu-app" key={app.appId} onClick={() => openApp(app.appId)}>
                      <MenuAppIcon app={app} />
                      <span>
                        <strong>{app.name}</strong>
                        <small>{app.category || app.downloads?.latestVersion || text.application}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <button onClick={goHome}>
                    <Package size={22} />
                    <span>
                      <strong>{text.noPublicApplications}</strong>
                      <small>{text.publishedAppsAppear}</small>
                    </span>
                  </button>
                )}
                <button className="menu-footer-action" onClick={goHome}>
                  <Package size={22} />
                  <span>
                    <strong>{text.allApplications}</strong>
                    <small>{text.openApplicationsBoard}</small>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <TabButton active={tab === "webApps"} onClick={() => setTab("webApps")} icon={<Globe2 size={17} />}>
            {text.webApp}
          </TabButton>
          <TabButton active={tab === "support"} onClick={() => setTab("support")} icon={<ReceiptText size={17} />}>
            {text.support}
          </TabButton>
        </nav>

        <div className="header-actions">
          <button className="language-button" aria-label={text.languageToggle} title={text.languageToggle} onClick={toggleLanguage}>
            <span aria-hidden="true">{text.languageFlag}</span>
          </button>
          <button className="icon-button" aria-label={text.account} title={text.account} onClick={() => setTab("account")}>
            <UserRound size={19} />
          </button>
          {user ? (
            <button className="icon-button" aria-label={text.signOut} title={text.signOut} onClick={() => void signOut(auth)}>
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
  onError,
  language,
  text
}: {
  apps: BrainokApp[];
  user: User | null;
  profile: UserProfile | null;
  siteSettings: SiteSettings;
  onError: (message: string | null) => void;
  language: Language;
  text: UiText;
}) {
  const [selectedSupportAppId, setSelectedSupportAppId] = useState<string | null>(null);
  const supportApps = useMemo(
    () => sortAppsForDisplay(apps.filter((app) => app.status === "active")),
    [apps]
  );
  const selectedSupportApp = selectedSupportAppId
    ? supportApps.find((app) => app.appId === selectedSupportAppId) || null
    : null;
  const tipPanelUrl = KOFI_TIP_PANEL_URL;

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
        language={language}
        text={text}
      />
    );
  }

  return (
    <section className="support-resource-page">
      <div className="section-heading">
        <span className="mini-label">{text.support}</span>
        <h2>{text.support}</h2>
        <p>{text.supportPage.chooseApp}</p>
      </div>

      <KofiTipPanel iframeUrl={tipPanelUrl} text={text} />

      {supportApps.length === 0 ? (
        <article className="support-resource-card">
          <Package size={24} />
          <span>
            <strong>{text.supportPage.noApps}</strong>
            <small>{text.publishedAppsAppear}</small>
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
                  <span className="mini-label">{app.category || text.apps.desktopApp}</span>
                  <h3>{app.name}</h3>
                  <p>{supportTeaser(app, text.supportPage.teaserFallback, language)}</p>
                  <div className="button-row">
                    <button className="button primary" type="button" onClick={() => setSelectedSupportAppId(app.appId)}>
                      <ReceiptText size={18} />
                      {text.supportPage.openSupport}
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

function KofiTipPanel({ iframeUrl, text }: { iframeUrl: string; text: UiText }) {
  return (
    <section className="kofi-tip-panel" id="kofi-tip-panel" aria-labelledby="kofi-tip-panel-title">
      <div className="kofi-tip-panel-copy">
        <span className="mini-label">{text.supportPage.tipPanel}</span>
        <h3 id="kofi-tip-panel-title">{text.supportPage.supportStore}</h3>
        <p>{text.supportPage.donationCopy}</p>
      </div>
      <a className="button primary kofi-tip-action" href={KOFI_CHECKOUT_URL} target="_blank" rel="noreferrer">
        <ExternalLink size={18} />
        {text.supportPage.openKofi}
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
  onError,
  language,
  text
}: {
  app: BrainokApp;
  user: User | null;
  profile: UserProfile | null;
  onBack: () => void;
  onError: (message: string | null) => void;
  language: Language;
  text: UiText;
}) {
  const primaryMedia = appPrimaryMedia(app);
  const supportContent = localizedSupportContent(app, language);

  return (
    <section className="support-detail-page">
      <button className="button secondary compact detail-back" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        {text.supportPage.allSupport}
      </button>

      <div className="support-detail-layout">
        <article className="support-detail-main">
          <div className={`support-detail-media${primaryMedia.isIcon ? " icon-media" : ""}`}>
            {primaryMedia.url ? <img src={primaryMedia.url} alt="" /> : <Package size={34} />}
          </div>
          <span className="mini-label">{app.category || text.apps.desktopApp}</span>
          <h2>{app.name} {text.support}</h2>
          <p className="support-short-copy">{localizedShortDescription(app, language) || compactAppDescription(app, text.apps.fallbackDescription, language)}</p>
          <div className="support-content-box">
            <span className="mini-label">{text.supportPage.supportGuide}</span>
            <MarkdownView
              className="markdown-view support-markdown"
              content={supportContent}
              fallback={text.supportPage.supportFallback}
            />
          </div>
        </article>

        <AppQnaPanel app={app} user={user} profile={profile} onError={onError} language={language} text={text} />
      </div>
    </section>
  );
}

function AppQnaPanel({
  app,
  user,
  profile,
  onError,
  language,
  text
}: {
  app: BrainokApp;
  user: User | null;
  profile: UserProfile | null;
  onError: (message: string | null) => void;
  language: Language;
  text: UiText;
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
      onError(error instanceof Error ? error.message : text.qna.loadFailed);
    });
  }, [app.appId, onError, text, user]);

  const sortedQuestions = useMemo(
    () => [...questions].sort((left, right) => timestampMillis(right.createdAt) - timestampMillis(left.createdAt)),
    [questions]
  );

  async function submitQuestion() {
    try {
      if (!user) {
        onError(text.qna.signInBeforeAsk);
        return;
      }

      if (questionDraft.trim().length < 3) {
        onError(text.qna.writeMore);
        return;
      }

      setBusyQuestionId("new");
      onError(null);
      await askAppQuestion(app.appId, questionDraft);
      setQuestionDraft("");
    } catch (error) {
      onError(error instanceof Error ? error.message : text.qna.submitFailed);
    } finally {
      setBusyQuestionId(null);
    }
  }

  async function submitAnswer(question: AppQuestion) {
    try {
      const answer = answerDrafts[question.questionId] || "";
      if (answer.trim().length < 2) {
        onError(text.qna.writeAnswer);
        return;
      }

      setBusyQuestionId(question.questionId);
      onError(null);
      await answerAppQuestion(question.questionId, answer);
      setAnswerDrafts((currentDrafts) => ({ ...currentDrafts, [question.questionId]: "" }));
    } catch (error) {
      onError(error instanceof Error ? error.message : text.qna.saveFailed);
    } finally {
      setBusyQuestionId(null);
    }
  }

  return (
    <aside className="qna-panel">
      <div>
        <span className="mini-label">{text.qna.label}</span>
        <h2>{text.qna.title}</h2>
        <p className="panel-copy">{text.qna.intro}</p>
      </div>

      {user ? (
        <div className="qna-compose">
          <label>
            {text.qna.ask}
            <textarea
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              rows={4}
              placeholder={text.qna.placeholder}
            />
          </label>
          <button className="button primary full" disabled={busyQuestionId === "new"} onClick={() => void submitQuestion()}>
            <ReceiptText size={18} />
            {text.qna.submit}
          </button>
        </div>
      ) : (
        <p className="activation-note">{text.qna.signInPrompt}</p>
      )}

      <div className="qna-list">
        {sortedQuestions.length === 0 ? (
          <p className="panel-copy">{text.qna.noQuestions}</p>
        ) : (
          sortedQuestions.map((question) => (
            <article className="qna-item" key={question.questionId}>
              <div className="qna-meta">
                <strong>{canAnswer ? question.userEmail || text.qna.user : text.qna.user}</strong>
                <span>{formatTimestamp(question.createdAt, language, text.qna.justNow)}</span>
              </div>
              <p>{question.question}</p>
              {question.answer ? (
                <div className="qna-answer">
                  <strong>{text.qna.adminAnswer}</strong>
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
                    placeholder={text.qna.answerPlaceholder}
                  />
                  <button className="button secondary full" disabled={busyQuestionId === question.questionId} onClick={() => void submitAnswer(question)}>
                    <Save size={18} />
                    {text.qna.saveAnswer}
                  </button>
                </div>
              ) : (
                <span className="qna-status">{text.qna.waiting}</span>
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
  title,
  language,
  text
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
  title: string;
  language: Language;
  text: UiText;
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
        onError(text.apps.signInBeforeAdding);
        onOpenAccount();
        return;
      }

      setBusyAppId(app.appId);
      onError(null);
      await grantFreeAppAccess(app.appId);
    } catch (error) {
      onError(error instanceof Error ? error.message : text.apps.addAccessFailed);
    } finally {
      setBusyAppId(null);
    }
  }

  return (
    <>
      {appsLoadError ? (
        <section className="notice-panel">
          <h2>{text.apps.boardWaitingTitle}</h2>
          <p>{text.apps.boardWaitingCopy}</p>
        </section>
      ) : null}

      {selectedApp ? (
        <AppDetailView
          app={selectedApp}
          access={profile?.apps?.[selectedApp.appId]?.accessStatus === "active"}
          busy={busyAppId === selectedApp.appId}
          onBack={() => setSelectedAppId(null)}
          onClaimFree={() => void claimFree(selectedApp)}
          language={language}
          text={text}
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
            <h2 id="app-rail-title">{title}</h2>
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
                  aria-label={text.apps.openApp(app.name)}
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
                  <span className="mini-label">{app.category || app.visibility || text.apps.publicLabel}</span>
                  <button className="app-title-button" type="button" onClick={() => setSelectedAppId(app.appId)}>
                    {app.name}
                  </button>
                  <MarkdownView
                    className="markdown-view app-description"
                    content={localizedShortDescription(app, language) || compactAppDescription(app, text.apps.fallbackDescription, language)}
                    fallback={text.apps.fallbackMarkdown}
                  />
                </div>

                <dl className="app-meta">
                  <div>
                    <dt>{text.apps.access}</dt>
                    <dd>{access ? text.apps.active : text.apps.trial}</dd>
                  </div>
                  <div>
                    <dt>{text.apps.version}</dt>
                    <dd>{app.downloads?.latestVersion || "TBD"}</dd>
                  </div>
                </dl>

                <div className="download-actions">
                  {downloadLinks.length > 0 ? (
                    downloadLinks.map((downloadLink, index) => (
                      <a className={index === 0 ? "button primary" : "button secondary"} href={downloadLink.href} key={downloadLink.label}>
                        <Download size={18} />
                        {localizedDownloadLabel(downloadLink.kind, text)}
                      </a>
                    ))
                  ) : (
                    <button className="button secondary" disabled>
                      <Download size={18} />
                      {text.apps.noBuildYet}
                    </button>
                  )}
                </div>

                <div className="button-row">
                  {access ? (
                    <button className="button secondary" disabled>
                      <ShieldCheck size={18} />
                      {text.apps.activated}
                    </button>
                  ) : pricingMode === "free" ? (
                    <button className="button primary" disabled={busy} onClick={() => void claimFree(app)}>
                      <Plus size={18} />
                      {text.apps.addToAccount}
                    </button>
                  ) : pricingMode === "paid" ? (
                    checkoutUrl ? (
                      <a className="button primary" href={checkoutUrl} target="_blank" rel="noreferrer">
                        <ShoppingCart size={18} />
                        {text.apps.buyAccess}
                      </a>
                    ) : (
                      <button className="button secondary" disabled>
                        <ShoppingCart size={18} />
                        {text.apps.checkoutMissing}
                      </button>
                    )
                  ) : (
                    <button className="button secondary" disabled>
                      <KeyRound size={18} />
                      {text.apps.activateInApp}
                    </button>
                  )}

                  {releaseUrl ? (
                    <a className="button secondary" href={releaseUrl}>
                      <ExternalLink size={18} />
                      {text.apps.release}
                    </a>
                  ) : null}
                  {docsUrl ? (
                    <a className="button secondary" href={docsUrl}>
                      <BookOpen size={18} />
                      {text.apps.docs}
                    </a>
                  ) : null}
                  {floatingVideoUrl ? (
                    <button className="button secondary" type="button" onClick={() => setFloatingDemoApp(app)}>
                      <PlayCircle size={18} />
                      {text.apps.demo}
                    </button>
                  ) : externalVideoUrl ? (
                    <a className="button secondary" href={externalVideoUrl} target="_blank" rel="noreferrer">
                      <PlayCircle size={18} />
                      {text.apps.demo}
                    </a>
                  ) : null}
                </div>
                <div className="activation-note app-card-note">
                  <KeyRound size={18} />
                  <span>{text.apps.note}</span>
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
          aria-label={text.apps.floatingDemoLabel(floatingDemoApp.name)}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFloatingDemoApp(null);
            }
          }}
        >
          <div className="floating-video-window">
            <div className="floating-video-toolbar">
              <strong>{floatingDemoApp.name} {text.apps.demo}</strong>
              <div className="floating-video-actions">
                {floatingDemoExternalUrl ? (
                  <a className="button secondary compact" href={floatingDemoExternalUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    YouTube
                  </a>
                ) : null}
                <button className="icon-button" type="button" aria-label={text.apps.closeFloating} onClick={() => setFloatingDemoApp(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={floatingDemoEmbedUrl}
              title={text.apps.floatingDemoLabel(floatingDemoApp.name)}
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
  onClaimFree,
  language,
  text
}: {
  app: BrainokApp;
  access: boolean;
  busy: boolean;
  onBack: () => void;
  onClaimFree: () => void;
  language: Language;
  text: UiText;
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
        {text.apps.allApps}
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
                aria-label={text.apps.openFloating(app.name)}
                title={text.apps.floatingTitle}
                onDoubleClick={() => setFloatingVideoOpen(true)}
              />
              <button
                className="video-float-button"
                type="button"
                onClick={() => setFloatingVideoOpen(true)}
              >
                <Maximize2 size={15} />
                {text.apps.floating}
              </button>
            </div>
          ) : videoUrl && isDirectVideoUrl(videoUrl) && primaryMedia.url ? (
            <div className="app-detail-video">
              <video src={videoUrl} controls preload="metadata" />
            </div>
          ) : videoUrl ? (
            <div className="app-detail-video app-detail-video-link">
              <PlayCircle size={34} />
              <strong>{text.apps.demoVideo}</strong>
              <span>{text.apps.openSavedVideo}</span>
              <a className="button secondary compact" href={externalVideoUrl || videoUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                {text.apps.openDemo}
              </a>
            </div>
          ) : null}
        </div>

        <div className="app-detail-summary">
          <span className="mini-label">{app.category || app.visibility || text.apps.publicLabel}</span>
          <h1>{app.name}</h1>
          <p>{localizedShortDescription(app, language) || compactAppDescription(app, text.apps.fallbackDescription, language)}</p>

          <dl className="app-meta detail-meta">
            <div>
              <dt>{text.apps.access}</dt>
              <dd>{access ? text.apps.active : text.apps.trial}</dd>
            </div>
            <div>
              <dt>{text.apps.version}</dt>
              <dd>{app.downloads?.latestVersion || "TBD"}</dd>
            </div>
          </dl>

          <div className="activation-note">
            <KeyRound size={18} />
            <span>{text.apps.note}</span>
          </div>

          <div className="download-actions detail-downloads">
            {downloadLinks.length > 0 ? (
              downloadLinks.map((downloadLink, index) => (
                <a className={index === 0 ? "button primary" : "button secondary"} href={downloadLink.href} key={downloadLink.label}>
                  <Download size={18} />
                  {localizedDownloadLabel(downloadLink.kind, text)}
                </a>
              ))
            ) : (
              <button className="button secondary" disabled>
                <Download size={18} />
                {text.apps.noBuildYet}
              </button>
            )}
          </div>

          <div className="button-row">
            {access ? (
              <button className="button secondary" disabled>
                <ShieldCheck size={18} />
                {text.apps.activated}
              </button>
            ) : pricingMode === "free" ? (
              <button className="button primary" disabled={busy} onClick={onClaimFree}>
                <Plus size={18} />
                {text.apps.addToAccount}
              </button>
            ) : pricingMode === "paid" ? (
              checkoutUrl ? (
                <a className="button primary" href={checkoutUrl} target="_blank" rel="noreferrer">
                  <ShoppingCart size={18} />
                  {text.apps.buyAccess}
                </a>
              ) : (
                <button className="button secondary" disabled>
                  <ShoppingCart size={18} />
                  {text.apps.checkoutMissing}
                </button>
              )
            ) : (
              <button className="button secondary" disabled>
                <KeyRound size={18} />
                {text.apps.activateInApp}
              </button>
            )}

            {releaseUrl ? (
              <a className="button secondary" href={releaseUrl}>
                <ExternalLink size={18} />
                {text.apps.release}
              </a>
            ) : null}
            {docsUrl ? (
              <a className="button secondary" href={docsUrl}>
                <BookOpen size={18} />
                {text.apps.docs}
              </a>
            ) : null}
            {externalVideoUrl ? (
              <a className="button secondary" href={externalVideoUrl} target="_blank" rel="noreferrer">
                <PlayCircle size={18} />
                {text.apps.demo}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <article className="app-detail-body">
        <MarkdownView
          className="markdown-view app-detail-description"
          content={localizedDescription(app, language) || localizedShortDescription(app, language) || compactAppDescription(app, text.apps.fallbackDescription, language)}
          fallback={text.apps.overviewFallback}
        />
      </article>

      {floatingVideoOpen && youtubeFloatingUrl ? (
        <div
          className="floating-video-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={text.apps.floatingDemoLabel(app.name)}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFloatingVideoOpen(false);
            }
          }}
        >
          <div className="floating-video-window">
            <div className="floating-video-toolbar">
              <strong>{app.name} {text.apps.demo}</strong>
              <div className="floating-video-actions">
                {externalVideoUrl ? (
                  <a className="button secondary compact" href={externalVideoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    YouTube
                  </a>
                ) : null}
                <button className="icon-button" type="button" aria-label={text.apps.closeFloating} onClick={() => setFloatingVideoOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={youtubeFloatingUrl}
              title={text.apps.floatingDemoLabel(app.name)}
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

function DownloadView({
  apps,
  siteSettings,
  language,
  text
}: {
  apps: BrainokApp[];
  siteSettings: SiteSettings;
  language: Language;
  text: UiText;
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
          <p>{text.download.noApps}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="download-catalog">
      <div className="download-catalog-header">
        <BrandLogo className="download-logo" />
        <div>
          <span className="mini-label">{text.download.freeDownloads}</span>
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
                <span className="mini-label">{app.downloads?.latestVersion ? `${text.apps.version} ${app.downloads.latestVersion}` : app.category || text.apps.desktopApp}</span>
                <h3>{app.name}</h3>
                <p>{localizedShortDescription(app, language) || compactAppDescription(app, text.apps.fallbackDescription, language)}</p>
                <div className="download-actions">
                  {downloadLinks.length > 0 ? (
                    downloadLinks.map((downloadLink, index) => (
                      <a className={index === 0 ? "button primary" : "button secondary"} href={downloadLink.href} key={downloadLink.label}>
                        <Download size={18} />
                        {localizedDownloadLabel(downloadLink.kind, text)}
                      </a>
                    ))
                  ) : (
                    <button className="button secondary" disabled>
                      <Download size={18} />
                      {text.download.buildSoon}
                    </button>
                  )}
                </div>
                <p className="download-note">{text.download.note}</p>
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
  onError,
  language,
  text
}: {
  user: User | null;
  profile: UserProfile | null;
  siteSettings: SiteSettings;
  onError: (message: string | null) => void;
  language: Language;
  text: UiText;
}) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"user" | "admin">("admin");
  const [apps, setApps] = useState<BrainokApp[]>([]);
  const [newAppName, setNewAppName] = useState("");
  const [newAppType, setNewAppType] = useState<AppType>("application");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [appDraft, setAppDraft] = useState<AppDraft>(emptyAppDraft);
  const [appUploadTarget, setAppUploadTarget] = useState<ReleaseUploadTarget>("icon");
  const [appUploadProgress, setAppUploadProgress] = useState<number | null>(null);
  const [appSaveStatus, setAppSaveStatus] = useState<string | null>(null);
  const [readmeLanguage, setReadmeLanguage] = useState<ReadmeLanguage>(language);
  const [markdownImageStatus, setMarkdownImageStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canManageApps = isAdminProfile(profile);
  const manageableApps = sortAppsForDisplay(canManageApps ? apps : apps.filter((app) => app.ownerUid === user?.uid));
  const selectedManagedApp = manageableApps.find((app) => app.appId === selectedAppId) || manageableApps[0] || null;
  const accessibleApps = Object.values(profile?.apps || {}).filter((app) => app.accessStatus === "active");

  useEffect(() => {
    setReadmeLanguage(language);
  }, [language]);

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

  function selectLoginMode(mode: "user" | "admin") {
    setLoginMode(mode);
    if (mode === "admin") {
      setEmail(ADMIN_EMAIL);
    }
  }

  async function signIn() {
    const signInEmail = loginMode === "admin" && !email.trim() ? ADMIN_EMAIL : email.trim();
    setEmail(signInEmail);
    if (!signInEmail) {
      onError(text.accountView.enterEmail);
      return;
    }
    if (!password) {
      onError(loginMode === "admin" ? text.accountView.enterAdminPassword : text.accountView.enterUserPassword);
      return;
    }

    try {
      setBusy(true);
      onError(null);
      await signInWithEmailAndPassword(auth, signInEmail, password);
    } catch (error) {
      onError(error instanceof Error ? error.message : text.accountView.signInFailed);
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    try {
      setBusy(true);
      onError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
        ...(loginMode === "admin" ? { login_hint: ADMIN_EMAIL } : {})
      });
      const credential = await signInWithPopup(auth, provider);
      if (loginMode === "admin" && credential.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        throw new Error(text.accountView.chooseAdmin(ADMIN_EMAIL));
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : text.accountView.googleFailed);
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

  async function saveSelectedApp() {
    try {
      if (!selectedManagedApp) {
        return;
      }

      setBusy(true);
      onError(null);
      setAppSaveStatus(null);
      await updateApp(selectedManagedApp.appId, draftToUpdate(appDraft));
      const savedApp = await getAppFromServer(selectedManagedApp.appId);
      if (!savedApp || !readmeFieldsPersisted(appDraft, savedApp)) {
        const message = "Save finished, but README fields did not persist. Deploy Firebase Functions, then save again.";
        setAppSaveStatus(null);
        onError(message);
        return;
      }
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

  async function pasteMarkdownImage(field: MarkdownDraftField, event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFile = clipboardImageFile(event);
    if (!imageFile) {
      return;
    }

    event.preventDefault();
    if (!user || !selectedManagedApp) {
      onError("Save or select an app before pasting images into README.");
      return;
    }

    const selectionStart = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    const file = imageFile.name ? imageFile : new File([imageFile], `readme-image-${Date.now()}.png`, {
      type: imageFile.type || "image/png"
    });

    try {
      setMarkdownImageStatus("Uploading pasted image...");
      onError(null);
      const result = await uploadAppReleaseFile({
        appId: selectedManagedApp.appId,
        ownerUid: user.uid,
        file,
        target: "docs"
      });
      const imageMarkdown = `\n\n![${markdownImageAlt(file.name)}](${result.url})\n\n`;
      setAppDraft((currentDraft) => ({
        ...currentDraft,
        [field]: insertTextAtRange(currentDraft[field], imageMarkdown, selectionStart, selectionEnd)
      }));
      setMarkdownImageStatus("Image inserted into README.");
      window.setTimeout(() => setMarkdownImageStatus(null), 1600);
    } catch (error) {
      setMarkdownImageStatus(null);
      onError(error instanceof Error ? error.message : "Could not upload pasted image.");
    }
  }

  const readmeShortField: "shortDescription" | "shortDescriptionKo" = readmeLanguage === "ko" ? "shortDescriptionKo" : "shortDescription";
  const readmeDescriptionField: MarkdownDraftField = readmeLanguage === "ko" ? "descriptionKo" : "description";
  const readmeLabel = readmeLanguage === "ko" ? "Korean README" : "English README";

  if (!user) {
    return (
      <section className="account-panel sign-in-panel">
        <span className="mini-label">{text.accountView.chooseType}</span>
        <h2>{loginMode === "admin" ? text.accountView.adminSignIn : text.accountView.userSignIn}</h2>
        <p className="panel-copy">
          {loginMode === "admin"
            ? text.accountView.adminIntro(ADMIN_EMAIL)
            : text.accountView.userIntro}
        </p>

        <div className="login-mode-switch" aria-label={text.accountView.loginType}>
          <button className={loginMode === "user" ? "active" : ""} onClick={() => selectLoginMode("user")}>
            <UserRound size={18} />
            <span>
              <strong>{text.accountView.userLogin}</strong>
              <small>{text.accountView.userLoginSub}</small>
            </span>
          </button>
          <button className={loginMode === "admin" ? "active" : ""} onClick={() => selectLoginMode("admin")}>
            <KeyRound size={18} />
            <span>
              <strong>{text.accountView.adminLogin}</strong>
              <small>{ADMIN_EMAIL}</small>
            </span>
          </button>
        </div>

        <div className="form-grid">
          <label>
            {text.accountView.email}
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            {text.accountView.password}
            <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <button className="button primary" disabled={busy} onClick={() => void signIn()}>
            <KeyRound size={18} />
            {loginMode === "admin" ? text.accountView.signInAdmin : text.accountView.signInUser}
          </button>
          <button className="button secondary" disabled={busy} onClick={() => void googleSignIn()}>
            <UserRound size={18} />
            {loginMode === "admin" ? text.accountView.googleAdmin : text.accountView.googleUser}
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
          <h2>{text.account}</h2>
          <span className={canManageApps ? "role-badge admin" : "role-badge user"}>
            {canManageApps ? "Admin" : "User"}
          </span>
        </div>
        {loginMode === "admin" && profile && !canManageApps ? (
          <p className="warning-text">
            {text.accountView.normalWarning(ADMIN_EMAIL)}
          </p>
        ) : null}
        <dl>
          <div>
            <dt>{text.accountView.email}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{text.accountView.access}</dt>
            <dd>{accessibleApps.length > 0 ? text.accountView.appsCount(accessibleApps.length) : profile?.accessStatus || text.accountView.loading}</dd>
          </div>
          <div>
            <dt>{text.accountView.role}</dt>
            <dd>{isAdminProfile(profile) ? "admin" : "user"}</dd>
          </div>
          <div>
            <dt>{text.accountView.deviceLimit}</dt>
            <dd>{profile?.deviceLimit ?? "-"}</dd>
          </div>
          <div>
            <dt>{text.accountView.supporter}</dt>
            <dd>{profile?.supporterStatus || "none"}</dd>
          </div>
          <div>
            <dt>{text.accountView.totalDonated}</dt>
            <dd>{formatDonation(profile)}</dd>
          </div>
          <div>
            <dt>{text.accountView.inviteQuota}</dt>
            <dd>{profile?.inviteQuota ?? "-"}</dd>
          </div>
          <div>
            <dt>{text.accountView.managedApps}</dt>
            <dd>{manageableApps.length}</dd>
          </div>
        </dl>
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
                  <div className="wide-field readme-editor-panel">
                    <div className="readme-editor-header">
                      <div>
                        <span className="mini-label">README language</span>
                        <h3>{readmeLabel}</h3>
                      </div>
                      <div className="mode-switch compact-switch" aria-label="README language">
                        <button className={readmeLanguage === "ko" ? "active" : ""} type="button" onClick={() => setReadmeLanguage("ko")}>
                          🇰🇷 Korean
                        </button>
                        <button className={readmeLanguage === "en" ? "active" : ""} type="button" onClick={() => setReadmeLanguage("en")}>
                          🇺🇸 English
                        </button>
                      </div>
                    </div>

                    <label>
                      Listing short description
                      <textarea
                        value={appDraft[readmeShortField]}
                        onChange={(event) => setAppDraft({ ...appDraft, [readmeShortField]: event.target.value })}
                        rows={3}
                        placeholder={readmeLanguage === "ko" ? "목록에 표시할 짧은 한국어 설명입니다." : "One or two short English sentences for the listing page."}
                      />
                    </label>

                    <label>
                      README Markdown
                      <textarea
                        className="large-description readme-textarea"
                        value={appDraft[readmeDescriptionField]}
                        onChange={(event) => setAppDraft({ ...appDraft, [readmeDescriptionField]: event.target.value })}
                        onPaste={(event) => void pasteMarkdownImage(readmeDescriptionField, event)}
                        rows={12}
                        wrap="soft"
                        placeholder={readmeLanguage === "ko"
                          ? "한국어 README를 붙여넣으세요.\n\n# 설치\n# 사용 방법\n# 자주 묻는 질문\n\n이미지를 복사해 이 칸에 붙여넣으면 자동으로 업로드됩니다."
                          : "Paste English README Markdown here.\n\n# Install\n# Usage\n# FAQ\n\nCopy an image and paste it here to upload it automatically."}
                      />
                    </label>

                    {markdownImageStatus ? <p className="quota-note">{markdownImageStatus}</p> : null}

                    <div className="markdown-preview">
                      <span className="mini-label">{readmeLabel} preview</span>
                      <MarkdownView content={appDraft[readmeDescriptionField]} fallback="Your formatted README will appear here." />
                    </div>
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
                    <select
                      value={appDraft.pricingMode === "donation" ? "free" : appDraft.pricingMode}
                      onChange={(event) => {
                        const pricingMode = event.target.value as AppDraft["pricingMode"];
                        setAppDraft({
                          ...appDraft,
                          pricingMode,
                          ...(pricingMode === "paid" ? {} : { priceMajor: "0", checkoutUrl: "" })
                        });
                      }}
                    >
                      <option value="invite_only">Invite only</option>
                      <option value="free">Free</option>
                      <option value="paid">Paid access</option>
                    </select>
                  </label>
                  {appDraft.pricingMode === "paid" ? (
                    <>
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
                    </>
                  ) : null}
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

          </>
        ) : (
          <>
            <h2>Desktop activation</h2>
            <p className="panel-copy">
              Download the DMG, launch the app, and complete activation inside the desktop app. A 30-day trial starts automatically on first launch.
            </p>
            <p className="activation-note">
              Activation numbers are handled by the app itself, so this website no longer creates shared or one-off activation codes.
            </p>
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
  shortDescriptionKo: string;
  description: string;
  descriptionKo: string;
  supportContent: string;
  supportContentKo: string;
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
  shortDescriptionKo: "",
  description: "",
  descriptionKo: "",
  supportContent: "",
  supportContentKo: "",
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
    shortDescriptionKo: app.shortDescriptionKo || "",
    description: app.description || "",
    descriptionKo: app.descriptionKo || "",
    supportContent: app.supportContent || "",
    supportContentKo: app.supportContentKo || "",
    category: app.category || "",
    appType: appKind(app),
    sortOrder: String(displaySortOrder(app, 0)),
    visibility: app.visibility || "public",
    pricingMode: app.pricing?.mode === "donation" ? "free" : app.pricing?.mode || "invite_only",
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
    shortDescriptionKo: draft.shortDescriptionKo,
    description: draft.description,
    descriptionKo: draft.descriptionKo,
    supportContent: "",
    supportContentKo: "",
    category: draft.category,
    appType: draft.appType,
    sortOrder: Math.max(0, Math.round(Number(draft.sortOrder || 0))),
    visibility: draft.visibility,
    pricingMode: draft.pricingMode === "donation" ? "free" : draft.pricingMode,
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

function readmeFieldsPersisted(draft: AppDraft, app: BrainokApp) {
  return (
    (app.shortDescription || "") === persistedText(draft.shortDescription, 260) &&
    (app.shortDescriptionKo || "") === persistedText(draft.shortDescriptionKo, 260) &&
    (app.description || "") === persistedText(draft.description, 20000) &&
    (app.descriptionKo || "") === persistedText(draft.descriptionKo, 20000)
  );
}

function persistedText(value: string, maxLength: number) {
  return value.slice(0, maxLength);
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

function clipboardImageFile(event: ClipboardEvent<HTMLTextAreaElement>) {
  const files = Array.from(event.clipboardData.files);
  const directImage = files.find((file) => file.type.startsWith("image/"));
  if (directImage) {
    return directImage;
  }

  return Array.from(event.clipboardData.items)
    .find((item) => item.kind === "file" && item.type.startsWith("image/"))
    ?.getAsFile() || null;
}

function insertTextAtRange(value: string, insert: string, start: number, end: number) {
  return `${value.slice(0, start)}${insert}${value.slice(end)}`;
}

function markdownImageAlt(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "README image";
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

function localizedShortDescription(app: BrainokApp, language: Language) {
  return language === "ko" ? app.shortDescriptionKo || app.shortDescription || "" : app.shortDescription || "";
}

function localizedDescription(app: BrainokApp, language: Language) {
  return language === "ko" ? app.descriptionKo || app.description || "" : app.description || "";
}

function localizedSupportContent(app: BrainokApp, language: Language) {
  return localizedDescription(app, language);
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

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const src = safeMarkdownUrl(image[2]);
      if (src) {
        blocks.push(
          <figure className="markdown-image" key={`image-${index}`}>
            <img src={src} alt={image[1] || ""} loading="lazy" />
          </figure>
        );
      }
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
  return /^(```|!\[[^\]]*\]\([^)]+\)|#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s*|-{3,}$|\*{3,}$|_{3,}$)/.test(line);
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
      const safeHref = safeMarkdownUrl(href) || "#";
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

function safeMarkdownUrl(value: string) {
  const raw = value.trim();
  return /^(https?:\/\/|data:image\/(?:png|jpeg|jpg|gif|webp);base64,)/i.test(raw) ? raw : "";
}

function centsToMajor(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2).replace(/\.00$/, "");
}

function compactAppDescription(
  app: BrainokApp,
  fallback = "Install the app, use the trial, then enter a redeem code if you received one.",
  language: Language = "en"
) {
  const text = (localizedShortDescription(app, language) || localizedDescription(app, language))
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return fallback;
  }

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function supportTeaser(
  app: BrainokApp,
  fallback = "Open support for install notes, troubleshooting, and app-specific QnA.",
  language: Language = "en"
) {
  const text = (localizedSupportContent(app, language) || localizedShortDescription(app, language))
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return fallback;
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

function formatTimestamp(value: unknown, language: Language = "en", emptyLabel = "just now") {
  const millis = timestampMillis(value);
  if (!millis) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(millis));
}

type DownloadLinkKind = "windows" | "mac" | "release";

function appDownloadLinks(app: BrainokApp) {
  const links: Array<{ kind: DownloadLinkKind; label: string; href: string }> = [];

  if (app.downloads?.windowsUrl) {
    links.push({ kind: "windows", label: "Download Win", href: app.downloads.windowsUrl });
  }

  if (app.downloads?.macUrl) {
    links.push({ kind: "mac", label: "Download Mac", href: app.downloads.macUrl });
  }

  if (links.length === 0 && app.downloads?.releaseUrl) {
    links.push({ kind: "release", label: "Release page", href: app.downloads.releaseUrl });
  }

  return links;
}

function localizedDownloadLabel(kind: DownloadLinkKind, text: UiText) {
  if (kind === "windows") {
    return text.download.downloadWin;
  }

  if (kind === "mac") {
    return text.download.downloadMac;
  }

  return text.download.releasePage;
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
