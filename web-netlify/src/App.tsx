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
  RotateCcw,
  Save,
  Search,
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
  BrainokLicensePlan,
  AppQuestion,
  DEFAULT_SITE_SETTINGS,
  LicenseSummary,
  SiteSettings,
  SupportResource,
  UserProfile,
  answerAppQuestion,
  askAppQuestion,
  createApp,
  createLicense,
  disableLicense,
  ensureUserProfile,
  getAppFromServer,
  listLicenses,
  resetLicenseDevice,
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

type Tab = "apps" | "webApps" | "subscription" | "download" | "account";
type AppOpenRequest = { appId: string; key: number } | null;
type SupportOpenRequest = { appId: string; key: number } | null;
type Language = "ko" | "en";
type ReadmeLanguage = "en" | "ko";
type MarkdownDraftField = "description" | "descriptionKo";

const BRAND_LOGO_SRC = "/brainok-store-front-icon.png?v=1";
const SUBSCRIPTION_REQUEST_EMAIL = "brainok777@gmail.com";
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
    subscription: "라이선스",
    support: "지원",
    account: "계정",
    signOut: "로그아웃",
    languageToggle: "English",
    languageFlag: "🇺🇸",
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
      applicationsIntro: "앱은 아래로 이어지는 카드 목록으로 정리됩니다. Windows/Mac 설치 파일, 30일 체험판, 범용 Brainok 라이선스를 함께 운영할 수 있습니다.",
      webEmptyTitle: "웹 앱",
      webEmptyAdminCopy: "웹 앱이 아직 없습니다. 앱을 만들고 종류를 Web App으로 설정하세요.",
      webEmptyPublicCopy: "공개된 웹 앱이 아직 없습니다.",
      webEyebrow: "웹 앱",
      webTitle: "웹 앱 선택",
      webIntro: "브라우저에서 사용하는 도구를 다운로드 앱과 분리해 빠르게 찾을 수 있습니다.",
      boardWaitingTitle: "앱 목록 접근을 기다리는 중",
      boardWaitingCopy: "Firestore가 이 세션의 앱 목록을 막았습니다. 관리자 계정으로 로그인한 뒤 규칙 배포가 끝나면 새로고침하세요.",
      openApp: (name: string) => `${name} 열기`,
      fallbackDescription: "앱을 설치하고 체험판을 사용한 뒤, 받은 코드가 있으면 입력하세요.",
      fallbackMarkdown: "데스크톱 앱 접근 권한, 릴리스, Brainok 라이선스 안내를 여기에서 관리합니다.",
      access: "접근",
      active: "활성",
      trial: "30일 체험판",
      version: "버전",
      noBuildYet: "빌드 없음",
      activated: "활성화됨",
      supportRequest: "지원 요청",
      buyAccess: "구매",
      checkoutMissing: "결제 링크 없음",
      activateInApp: "앱에서 활성화",
      release: "릴리스",
      docs: "문서",
      demo: "데모",
      note: "무료 다운로드. 계정은 필요 없습니다. 앱을 실행하면 30일 체험판이 시작되고, 이후 하나의 Brainok 라이선스로 계속 사용할 수 있습니다.",
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
      chooseApp: "앱 카드에서 지원 요청을 선택하면 앱별 지원 페이지가 열립니다.",
      noApps: "앱이 아직 없습니다",
      openSupport: "지원 열기",
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
      signInCta: "로그인 / 회원가입",
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
      note: "무료 다운로드. 계정은 필요 없습니다. 앱을 실행하면 30일 체험판이 시작되고, 이후 앱 안에서 Brainok 라이선스를 입력할 수 있습니다.",
      downloadWin: "Windows 다운로드",
      downloadMac: "Mac 다운로드",
      releasePage: "릴리스 페이지"
    },
    subscriptionPage: {
      eyebrow: "Brainok 라이선스",
      title: "하나의 라이선스. 모든 Brainok 앱.",
      intro: "Brainok 앱은 누구나 무료로 다운로드하고 30일 동안 모든 기능을 체험할 수 있습니다. 체험 기간이 끝나면 하나의 Brainok 라이선스로 현재 앱과 앞으로 출시될 Brainok 앱을 계속 사용할 수 있습니다.",
      primaryCta: "Brainok 라이선스 받기",
      freeTitle: "무료 다운로드",
      freeBullets: ["계정 필요 없음", "30일 전체 기능 체험", "원하는 앱을 바로 다운로드"],
      oneTitle: "하나의 라이선스",
      oneBullets: ["모든 Brainok 앱을 하나로 잠금 해제", "한 번 활성화", "계속 사용"],
      anywhereTitle: "어디서나 사용",
      anywhereBullets: ["최대 3대 Mac에서 사용", "활성화 후 오프라인 사용 가능"],
      plansTitle: "라이선스 선택",
      personalTitle: "Personal License",
      personalPrice: "Mac 3대",
      personalCopy: "개인 사용자를 위한 기본 라이선스입니다.",
      personalCta: "라이선스 요청",
      proTitle: "Pro License",
      proPrice: "Mac 5대",
      proCopy: "여러 Mac을 오가며 쓰는 사용자에게 적합합니다.",
      proCta: "라이선스 요청",
      labTitle: "Lab License",
      labPrice: "Mac 20대 이상",
      labCopy: "연구실, 진료실, 기관처럼 여러 컴퓨터에서 함께 사용할 때 적합합니다.",
      labCta: "문의하기",
      formTitle: "Brainok 라이선스 받기",
      formIntro: "필요한 라이선스를 알려 주세요. 확인 후 다음 절차를 안내해 드립니다.",
      formName: "이름",
      formEmail: "이메일",
      formPlan: "라이선스",
      formDevices: "Mac 대수",
      formMessage: "메시지",
      formCancel: "취소",
      formSubmit: "요청 보내기"
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
    subscription: "License",
    support: "Support",
    account: "Account",
    signOut: "Sign out",
    languageToggle: "한국어",
    languageFlag: "🇰🇷",
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
      applicationsIntro: "Applications are listed as a vertical card grid. Each app can have separate Windows and Mac installers, a 30-day trial, and one universal Brainok license.",
      webEmptyTitle: "Web App",
      webEmptyAdminCopy: "No web apps yet. Create one and set its type to Web App.",
      webEmptyPublicCopy: "No public web apps yet.",
      webEyebrow: "Web App",
      webTitle: "Choose a web app",
      webIntro: "Web apps are listed separately from downloadable applications, so visitors can find browser-based tools quickly.",
      boardWaitingTitle: "App board is waiting for access",
      boardWaitingCopy: "Firestore blocked the app list for this session. Sign in with your admin account, then refresh this page after rules finish deploying.",
      openApp: (name: string) => `Open ${name}`,
      fallbackDescription: "Install the app, use the trial, then enter a redeem code if you received one.",
      fallbackMarkdown: "Desktop app access, releases, and Brainok license guidance are managed here.",
      access: "Access",
      active: "Active",
      trial: "30-day trial",
      version: "Version",
      noBuildYet: "No build yet",
      activated: "Activated",
      supportRequest: "Support request",
      buyAccess: "Buy access",
      checkoutMissing: "Checkout link not set",
      activateInApp: "Activate in app",
      release: "Release",
      docs: "Docs",
      demo: "Demo",
      note: "Download free. No account required. A 30-day trial starts in the app, then one Brainok license unlocks continued use.",
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
      chooseApp: "Use Support request on an app card to open app-specific support.",
      noApps: "No apps yet",
      openSupport: "Open support",
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
      signInCta: "Sign in / Log in",
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
      note: "Download free. No account required. The app starts a 30-day trial and accepts a Brainok license inside the app.",
      downloadWin: "Download Win",
      downloadMac: "Download Mac",
      releasePage: "Release page"
    },
    subscriptionPage: {
      eyebrow: "Brainok License",
      title: "One License. Every Brainok App.",
      intro: "Download any Brainok app for free and enjoy a full 30-day trial. When you're ready, activate a single Brainok License to unlock all current and future Brainok applications.",
      primaryCta: "Get Brainok License",
      freeTitle: "Free Download",
      freeBullets: ["No account required", "30-day trial", "Download any app instantly"],
      oneTitle: "One License",
      oneBullets: ["One license unlocks every Brainok app", "Activate once", "Use forever"],
      anywhereTitle: "Use Anywhere",
      anywhereBullets: ["Available on up to 3 devices", "Works offline after activation"],
      plansTitle: "Choose Your Plan",
      personalTitle: "Personal License",
      personalPrice: "3 Macs",
      personalCopy: "Ideal for personal use.",
      personalCta: "Request License",
      proTitle: "Pro License",
      proPrice: "5 Macs",
      proCopy: "For power users.",
      proCta: "Request License",
      labTitle: "Lab License",
      labPrice: "20+ Macs",
      labCopy: "For research labs and organizations.",
      labCta: "Contact Us",
      formTitle: "Get Brainok License",
      formIntro: "Tell us which license you need. We will reply with the next steps.",
      formName: "Name",
      formEmail: "Email",
      formPlan: "Plan",
      formDevices: "Macs",
      formMessage: "Message",
      formCancel: "Cancel",
      formSubmit: "Send Request"
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
      inviteQuota: "Invite quota",
      managedApps: "Managed apps",
      loading: "Loading",
      appsCount: (count: number) => `${count} app(s)`
    }
  }
} as const;

type UiText = (typeof UI_TEXT)[Language];

function readPreferredLanguage(): Language {
  return "ko";
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
  const [supportOpenRequest, setSupportOpenRequest] = useState<SupportOpenRequest>(null);
  const [preferredLoginMode, setPreferredLoginMode] = useState<"user" | "admin">("admin");
  const [language, setLanguage] = useState<Language>(readPreferredLanguage);
  const text = UI_TEXT[language];
  const localizedSiteSettings = useMemo(() => language === "ko" ? {
    ...siteSettings,
    primaryCtaLabel: "무료 다운로드",
    downloadTitle: "Brainok Store 다운로드",
    downloadSubtitle: "무료 다운로드. 계정 필요 없음.",
    downloadBody: "운영체제에 맞는 설치 파일을 선택하세요. 데스크톱 앱은 30일 체험판으로 시작하고 앱 안에서 Brainok 라이선스를 입력할 수 있습니다."
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

  function openUserSignIn() {
    setPreferredLoginMode("user");
    setTab("account");
  }

  function openSupportRequest(appId: string) {
    setTab("subscription");
    setSupportOpenRequest({ appId, key: Date.now() });
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
          onOpenSupportRequest={openSupportRequest}
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
          onOpenSupportRequest={openSupportRequest}
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
      return <AccountView user={user} profile={profile} siteSettings={localizedSiteSettings} onError={setError} preferredLoginMode={preferredLoginMode} language={language} text={text} />;
    }

    return <SubscriptionView apps={[...sortedNavApps, ...sortedWebApps]} user={user} profile={profile} onError={setError} onOpenAccount={openUserSignIn} openSupportRequest={supportOpenRequest} language={language} text={text} />;
  }, [appOpenRequest, homeResetKey, language, localizedSiteSettings, preferredLoginMode, profile, sortedNavApps, sortedWebApps, supportOpenRequest, tab, text, user]);

  if (!ready) {
    return <main className="page-shell">{text.loading}</main>;
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={goHome}>
          <BrandLogo className="brand-mark" />
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
          <TabButton active={tab === "subscription"} onClick={() => setTab("subscription")} icon={<ReceiptText size={17} />}>
            {text.subscription}
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

function SubscriptionView({
  apps,
  user,
  profile,
  onError,
  onOpenAccount,
  openSupportRequest,
  language,
  text
}: {
  apps: BrainokApp[];
  user: User | null;
  profile: UserProfile | null;
  onError: (message: string | null) => void;
  onOpenAccount: () => void;
  openSupportRequest: SupportOpenRequest;
  language: Language;
  text: UiText;
}) {
  const [selectedSupportAppId, setSelectedSupportAppId] = useState<string | null>(null);
  const [requestPlan, setRequestPlan] = useState<string | null>(null);
  const supportApps = useMemo(
    () => sortAppsForDisplay(apps.filter((app) => app.status === "active")),
    [apps]
  );
  const selectedSupportApp = selectedSupportAppId
    ? supportApps.find((app) => app.appId === selectedSupportAppId) || null
    : null;

  useEffect(() => {
    if (selectedSupportAppId && !selectedSupportApp) {
      setSelectedSupportAppId(null);
    }
  }, [selectedSupportApp, selectedSupportAppId]);

  useEffect(() => {
    if (openSupportRequest?.appId) {
      setSelectedSupportAppId(openSupportRequest.appId);
    }
  }, [openSupportRequest?.key]);

  if (selectedSupportApp) {
    return (
      <SupportAppDetail
        app={selectedSupportApp}
        user={user}
        profile={profile}
        onBack={() => setSelectedSupportAppId(null)}
        onError={onError}
        onOpenAccount={onOpenAccount}
        language={language}
        text={text}
      />
    );
  }

  return (
    <section className="subscription-page">
      <div className="section-heading">
        <span className="mini-label">{text.subscriptionPage.eyebrow}</span>
        <h2>{text.subscriptionPage.title}</h2>
        <p>{text.subscriptionPage.intro}</p>
        <button className="button primary large" type="button" onClick={() => setRequestPlan(text.subscriptionPage.personalTitle)}>
          <KeyRound size={18} />
          {text.subscriptionPage.primaryCta}
        </button>
      </div>

      <div className="subscription-flow">
        <LicenseFeatureCard icon={<Download size={22} />} title={text.subscriptionPage.freeTitle} bullets={text.subscriptionPage.freeBullets} />
        <LicenseFeatureCard icon={<KeyRound size={22} />} title={text.subscriptionPage.oneTitle} bullets={text.subscriptionPage.oneBullets} />
        <LicenseFeatureCard icon={<ShieldCheck size={22} />} title={text.subscriptionPage.anywhereTitle} bullets={text.subscriptionPage.anywhereBullets} />
      </div>

      <section className="subscription-plans" aria-labelledby="subscription-plans-title">
        <h3 id="subscription-plans-title">{text.subscriptionPage.plansTitle}</h3>
        <div className="subscription-plan-grid">
          <PlanCard
            title={text.subscriptionPage.personalTitle}
            price={text.subscriptionPage.personalPrice}
            features={[text.subscriptionPage.personalCopy]}
            action={(
              <button className="button primary full" type="button" onClick={() => setRequestPlan(text.subscriptionPage.personalTitle)}>
                {text.subscriptionPage.personalCta}
              </button>
            )}
          />
          <PlanCard
            title={text.subscriptionPage.proTitle}
            price={text.subscriptionPage.proPrice}
            features={[text.subscriptionPage.proCopy]}
            action={(
              <button className="button primary full" type="button" onClick={() => setRequestPlan(text.subscriptionPage.proTitle)}>
                {text.subscriptionPage.proCta}
              </button>
            )}
          />
          <PlanCard
            title={text.subscriptionPage.labTitle}
            price={text.subscriptionPage.labPrice}
            features={[text.subscriptionPage.labCopy]}
            action={(
              <button className="button secondary full" type="button" onClick={() => setRequestPlan(text.subscriptionPage.labTitle)}>
                {text.subscriptionPage.labCta}
              </button>
            )}
          />
        </div>
      </section>

      {requestPlan ? (
        <LicenseRequestDialog
          defaultPlan={requestPlan}
          language={language}
          text={text}
          onClose={() => setRequestPlan(null)}
        />
      ) : null}
    </section>
  );
}

function LicenseFeatureCard({
  icon,
  title,
  bullets
}: {
  icon: ReactNode;
  title: string;
  bullets: readonly string[];
}) {
  return (
    <article>
      {icon}
      <strong>{title}</strong>
      <ul>
        {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
      </ul>
    </article>
  );
}

function LicenseRequestDialog({
  defaultPlan,
  language,
  text,
  onClose
}: {
  defaultPlan: string;
  language: Language;
  text: UiText;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState(defaultPlan);
  const [devices, setDevices] = useState(defaultPlan.includes("Lab") ? "20" : defaultPlan.includes("Pro") ? "5" : "3");
  const [message, setMessage] = useState("");

  const requestHref = licenseRequestMailto({
    language,
    name,
    email,
    plan,
    devices,
    message
  });

  function updatePlan(nextPlan: string) {
    setPlan(nextPlan);
    setDevices(nextPlan.includes("Lab") ? "20" : nextPlan.includes("Pro") ? "5" : "3");
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="license-request-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <section className="license-request-modal">
        <div className="account-heading">
          <div>
            <span className="mini-label">Brainok License</span>
            <h2 id="license-request-title">{text.subscriptionPage.formTitle}</h2>
          </div>
          <button className="icon-button" type="button" aria-label={text.subscriptionPage.formCancel} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="panel-copy">{text.subscriptionPage.formIntro}</p>
        <div className="form-grid">
          <label>
            {text.subscriptionPage.formName}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            {text.subscriptionPage.formEmail}
            <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            {text.subscriptionPage.formPlan}
            <select value={plan} onChange={(event) => updatePlan(event.target.value)}>
              <option>{text.subscriptionPage.personalTitle}</option>
              <option>{text.subscriptionPage.proTitle}</option>
              <option>{text.subscriptionPage.labTitle}</option>
            </select>
          </label>
          <label>
            {text.subscriptionPage.formDevices}
            <input value={devices} inputMode="numeric" onChange={(event) => setDevices(event.target.value)} />
          </label>
          <label className="wide-field">
            {text.subscriptionPage.formMessage}
            <textarea value={message} rows={4} onChange={(event) => setMessage(event.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <button className="button secondary" type="button" onClick={onClose}>
            {text.subscriptionPage.formCancel}
          </button>
          <a className="button primary" href={requestHref}>
            <KeyRound size={22} />
            {text.subscriptionPage.formSubmit}
          </a>
        </div>
      </section>
    </div>
  );
}

function SupportAppDetail({
  app,
  user,
  profile,
  onBack,
  onError,
  onOpenAccount,
  language,
  text
}: {
  app: BrainokApp;
  user: User | null;
  profile: UserProfile | null;
  onBack: () => void;
  onError: (message: string | null) => void;
  onOpenAccount: () => void;
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

        <AppQnaPanel app={app} user={user} profile={profile} onError={onError} onOpenAccount={onOpenAccount} language={language} text={text} />
      </div>
    </section>
  );
}

function AppQnaPanel({
  app,
  user,
  profile,
  onError,
  onOpenAccount,
  language,
  text
}: {
  app: BrainokApp;
  user: User | null;
  profile: UserProfile | null;
  onError: (message: string | null) => void;
  onOpenAccount: () => void;
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
        onOpenAccount();
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
        <div className="activation-note qna-sign-in-note">
          <span>{text.qna.signInPrompt}</span>
          <button className="button secondary compact" type="button" onClick={onOpenAccount}>
            <UserRound size={17} />
            {text.qna.signInCta}
          </button>
        </div>
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
  onOpenSupportRequest,
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
  onOpenSupportRequest: (appId: string) => void;
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
          onBack={() => setSelectedAppId(null)}
          onOpenSupportRequest={() => onOpenSupportRequest(selectedApp.appId)}
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
              const isWebApp = appKind(app) === "web_app";
              const access = profile?.apps?.[app.appId]?.accessStatus === "active";
              const pricingMode = app.pricing?.mode || "invite_only";
              const downloadLinks = appDownloadLinks(app);
              const releaseUrl = app.downloads?.releaseUrl || null;
              const docsUrl = app.downloads?.docsUrl || null;
              const primaryMedia = appPrimaryMedia(app);
              const videoUrl = app.media?.videoUrl || null;
              const externalVideoUrl = externalVideoUrlFrom(videoUrl);
              const floatingVideoUrl = youtubeEmbedUrlFrom(videoUrl, "player");
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
                    <dd>{access || isWebApp ? text.apps.active : text.apps.trial}</dd>
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
                  <button className="button primary" type="button" onClick={() => onOpenSupportRequest(app.appId)}>
                    <ReceiptText size={18} />
                    {text.apps.supportRequest}
                  </button>

                  {access ? (
                    <button className="button secondary" disabled>
                      <ShieldCheck size={18} />
                      {text.apps.activated}
                    </button>
                  ) : pricingMode === "free" ? (
                    null
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
                {!isWebApp ? (
                  <div className="activation-note app-card-note">
                    <KeyRound size={18} />
                    <span>{text.apps.note}</span>
                  </div>
                ) : null}
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
  onBack,
  onOpenSupportRequest,
  language,
  text
}: {
  app: BrainokApp;
  access: boolean;
  onBack: () => void;
  onOpenSupportRequest: () => void;
  language: Language;
  text: UiText;
}) {
  const isWebApp = appKind(app) === "web_app";
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
              <dd>{access || isWebApp ? text.apps.active : text.apps.trial}</dd>
            </div>
            <div>
              <dt>{text.apps.version}</dt>
              <dd>{app.downloads?.latestVersion || "TBD"}</dd>
            </div>
          </dl>

          {!isWebApp ? (
            <div className="activation-note">
              <KeyRound size={18} />
              <span>{text.apps.note}</span>
            </div>
          ) : null}

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
            <button className="button primary" type="button" onClick={onOpenSupportRequest}>
              <ReceiptText size={18} />
              {text.apps.supportRequest}
            </button>

            {access ? (
              <button className="button secondary" disabled>
                <ShieldCheck size={18} />
                {text.apps.activated}
              </button>
            ) : pricingMode === "free" ? (
              null
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
  preferredLoginMode,
  language,
  text
}: {
  user: User | null;
  profile: UserProfile | null;
  siteSettings: SiteSettings;
  onError: (message: string | null) => void;
  preferredLoginMode: "user" | "admin";
  language: Language;
  text: UiText;
}) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"user" | "admin">(preferredLoginMode);
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
      selectLoginMode(preferredLoginMode);
    }
  }, [preferredLoginMode, user]);

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
              Add apps whenever you need them. Desktop apps use the universal Brainok license after their 30-day trial.
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
                      value={appDraft.pricingMode}
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
              Download is always free. After the trial, enter one Brainok license inside the app to keep using every Brainok desktop app offline.
            </p>
          </>
        )}

      </div>

      {canManageApps ? (
        <LicenseAdminPanel onError={onError} />
      ) : null}
    </section>
  );
}

const FRIEND_SEVERANCE_CODE = "BRAINOK-SEVERANCE-2026";

function LicenseAdminPanel({ onError }: { onError: (message: string | null) => void }) {
  const [licenses, setLicenses] = useState<LicenseSummary[]>([]);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<BrainokLicensePlan>("personal");
  const [licenseCode, setLicenseCode] = useState("");
  const [maxDevices, setMaxDevices] = useState("3");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    void refreshLicenses("");
  }, []);

  function updatePlan(nextPlan: BrainokLicensePlan) {
    setPlan(nextPlan);
    setMaxDevices(String(defaultLicenseDeviceLimit(nextPlan)));
    if (nextPlan === "friend") {
      setLicenseCode(FRIEND_SEVERANCE_CODE);
    } else if (licenseCode === FRIEND_SEVERANCE_CODE) {
      setLicenseCode("");
    }
  }

  async function refreshLicenses(nextSearch = search) {
    try {
      setBusy(true);
      onError(null);
      setPanelError(null);
      const nextLicenses = await listLicenses(nextSearch.trim());
      setLicenses(nextLicenses);
    } catch (error) {
      const message = licenseAdminErrorMessage(error, "Could not load licenses.");
      setPanelError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function createNewLicense() {
    try {
      setBusy(true);
      setStatus("Creating license...");
      onError(null);
      setPanelError(null);
      const created = await createLicense({
        email: email.trim(),
        plan,
        licenseCode: licenseCode.trim(),
        maxDevices: Number(maxDevices)
      });
      setStatus(`Created ${created.licenseCode}`);
      setSearch(created.licenseCode);
      await refreshLicenses(created.licenseCode);
    } catch (error) {
      const message = licenseAdminErrorMessage(error, "Could not create license.");
      setStatus(null);
      setPanelError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function disableSelectedLicense(code: string) {
    try {
      setBusy(true);
      setStatus(null);
      onError(null);
      setPanelError(null);
      await disableLicense(code);
      setStatus(`Disabled ${code}`);
      await refreshLicenses();
    } catch (error) {
      const message = licenseAdminErrorMessage(error, "Could not disable license.");
      setPanelError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function resetDevice(activationId: string) {
    try {
      setBusy(true);
      setStatus(null);
      onError(null);
      setPanelError(null);
      await resetLicenseDevice(activationId);
      setStatus("Device reset.");
      await refreshLicenses();
    } catch (error) {
      const message = licenseAdminErrorMessage(error, "Could not reset this device.");
      setPanelError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-panel license-admin-panel">
      <div className="account-heading">
        <h2>Brainok Licenses</h2>
        <span className="role-badge admin">Universal</span>
      </div>
      <p className="panel-copy">
        One Brainok license unlocks PageWheel, Clipboard, Hotkey Launcher, and future Brainok apps after the 30-day trial.
      </p>
      <p className="activation-note">
        Current process: after a buyer pays, generate a license here, copy the code, and send it to the buyer by email. Automatic purchase-to-license email delivery is not connected yet.
      </p>

      <div className="license-admin-grid">
        <div className="license-toolbox">
          <h3>Generate license</h3>
          <div className="editor-grid compact-editor-grid">
            <label>
              Buyer email
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="optional@example.com" />
            </label>
            <label>
              Plan
              <select value={plan} onChange={(event) => updatePlan(event.target.value as BrainokLicensePlan)}>
                <option value="personal">Personal / 3 devices</option>
                <option value="pro">Pro / 5 devices</option>
                <option value="lab">Lab / 20-100 devices</option>
                <option value="friend">Friend / shared code</option>
              </select>
            </label>
            <label>
              Activation code
              <input value={licenseCode} onChange={(event) => setLicenseCode(event.target.value)} placeholder="Leave blank to generate" />
              <small>Leave blank for Personal, Pro, or Lab. Use Friend only for one shared code.</small>
            </label>
            <label>
              Max devices
              <input type="number" min="1" max="100" value={maxDevices} onChange={(event) => setMaxDevices(event.target.value)} />
            </label>
          </div>
          <button className="button primary full" disabled={busy} onClick={() => void createNewLicense()}>
            <KeyRound size={18} />
            {busy ? "Working..." : "Generate license"}
          </button>
          {status ? <p className="success-text">{status}</p> : null}
          {panelError ? <p className="error-text inline-error">{panelError}</p> : null}
        </div>

        <div className="license-toolbox">
          <h3>Search license</h3>
          <div className="inline-form">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email or license code" />
            <button className="button secondary" disabled={busy} onClick={() => void refreshLicenses()}>
              <Search size={18} />
              Search
            </button>
          </div>
          <p className="quota-note">Empty search shows the latest licenses.</p>
        </div>
      </div>

      <div className="license-list">
        {licenses.length > 0 ? licenses.map((license) => (
          <article className="license-card" key={license.licenseId}>
            <div className="license-card-main">
              <div>
                <span className="mini-label">{license.plan.replace("_", " ")}</span>
                <code>{license.licenseCode}</code>
                <small>{license.email || "No email"} · {license.activationCount}/{license.maxDevices} devices · {license.status}</small>
              </div>
              <button className="button secondary" disabled={busy || license.status === "disabled"} onClick={() => void disableSelectedLicense(license.licenseCode)}>
                <X size={18} />
                Disable
              </button>
            </div>
            <div className="license-activation-list">
              {license.activations.length > 0 ? license.activations.map((activation) => (
                <div className="license-activation-row" key={activation.activationId}>
                  <span>
                    <strong>{activation.deviceName}</strong>
                    <small>{activation.status} · {activation.appName || activation.appId || "Brainok app"} · {activation.activatedAt ? formatTimestamp(activation.activatedAt) : "No date"}</small>
                  </span>
                  <button className="icon-button" type="button" aria-label="Reset device" title="Reset device" disabled={busy || activation.status !== "active"} onClick={() => void resetDevice(activation.activationId)}>
                    <RotateCcw size={18} />
                  </button>
                </div>
              )) : (
                <p className="quota-note">No devices activated yet.</p>
              )}
            </div>
          </article>
        )) : (
          <p className="quota-note">No licenses found.</p>
        )}
      </div>
    </div>
  );
}

function licenseAdminErrorMessage(error: unknown, fallback: string) {
  const rawCode = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  const rawMessage = error instanceof Error ? error.message : "";
  const message = rawMessage.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/i, "").trim();

  if (rawCode.includes("functions/not-found") || message === "not-found") {
    return "License server functions are not deployed yet. Deploy Firebase Functions, then try again.";
  }

  if (rawCode.includes("functions/internal") || message === "internal") {
    return "License server returned an internal error. Check Firebase Functions logs and try again.";
  }

  return message || fallback;
}

function defaultLicenseDeviceLimit(plan: BrainokLicensePlan) {
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
  pricingMode: "invite_only" | "free" | "paid";
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
    shortDescriptionKo: draft.shortDescriptionKo,
    description: draft.description,
    descriptionKo: draft.descriptionKo,
    supportContent: "",
    supportContentKo: "",
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

function licenseRequestMailto({
  language,
  name,
  email,
  plan,
  devices,
  message
}: {
  language: Language;
  name: string;
  email: string;
  plan: string;
  devices: string;
  message: string;
}) {
  const subject = language === "ko" ? "Brainok License 요청" : "Brainok License request";
  const body = [
    "Brainok License Request",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Plan: ${plan}`,
    `Macs: ${devices}`,
    "",
    "Message:",
    message
  ].join("\n");

  return `mailto:${SUBSCRIPTION_REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function accessLabel(mode: string) {
  if (mode === "free") {
    return "Free";
  }

  if (mode === "paid") {
    return "Paid";
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
