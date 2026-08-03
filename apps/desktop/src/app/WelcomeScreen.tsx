import {
  Bookmark,
  Briefcase,
  Languages,
  Minus,
  Search,
  Square,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { t, type AppLocale } from "@/lib/i18n";
import { openSupportLink } from "@/lib/support";
import { desktopWindow } from "@/lib/tauri/window";
import { cn } from "@/lib/utils";

const languages: ReadonlyArray<{ label: string; locale: AppLocale }> = [
  { label: "RU", locale: "ru" },
  { label: "EN", locale: "en" },
];

function WelcomeWindowButton({
  action,
  children,
  danger = false,
  label,
}: {
  action(): Promise<void>;
  children: ReactNode;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn("welcome-window-button", danger && "welcome-window-button-danger")}
      onClick={() => void action()}
      type="button"
    >
      {children}
    </button>
  );
}

export function WelcomeScreen() {
  const language = useAppUiStore((state) => state.language);
  const completeWelcome = useAppUiStore((state) => state.completeWelcome);
  const setLanguage = useAppUiStore((state) => state.setLanguage);

  return (
    <main aria-labelledby="welcome-title" className="welcome-screen">
      <header className="welcome-topbar" data-tauri-drag-region>
        <div className="welcome-brand" data-tauri-drag-region>
          <span aria-hidden="true" className="welcome-brand-mark"><span className="brand-mark" /></span>
        </div>

        <div className="welcome-topbar-actions">
          <div className="welcome-header-ctas">
            <button
              className="welcome-github-button"
              onClick={() => void openSupportLink("github")}
              type="button"
            >
              {t("welcomeGithub")}
            </button>
            <button className="welcome-start-button" onClick={completeWelcome} type="button">
              {t("welcomeStart")}
            </button>
          </div>
          <div aria-label={t("welcomeLanguageLabel")} className="welcome-language" role="group">
            <Languages aria-hidden="true" className="size-3.5" />
            {languages.map((option) => (
              <button
                aria-pressed={language === option.locale}
                className="welcome-language-option"
                data-active={language === option.locale}
                key={option.locale}
                onClick={() => setLanguage(option.locale)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="welcome-window-controls">
            <WelcomeWindowButton action={desktopWindow.minimize} label={t("windowMinimize")}>
              <Minus aria-hidden="true" className="size-3.5" />
            </WelcomeWindowButton>
            <WelcomeWindowButton action={desktopWindow.toggleMaximize} label={t("windowMaximize")}>
              <Square aria-hidden="true" className="size-3" />
            </WelcomeWindowButton>
            <WelcomeWindowButton action={desktopWindow.close} danger label={t("windowClose")}>
              <X aria-hidden="true" className="size-3.5" />
            </WelcomeWindowButton>
          </div>
        </div>
      </header>

      <div aria-hidden="true" className="welcome-atmosphere">
        <span className="welcome-orbit welcome-orbit-one" />
        <span className="welcome-orbit welcome-orbit-two" />
        <span className="welcome-orbit welcome-orbit-three" />
      </div>

      <section className="welcome-hero">
        <h1 id="welcome-title">
          {t("welcomeTitle")}
          <span>by Emil</span>
        </h1>
        <p>{t("welcomeDescription")}</p>
      </section>

      <div aria-hidden="true" className="welcome-product-preview">
        <div className="welcome-preview-toolbar">
          <div className="welcome-preview-search">
            <Search className="size-3.5" />
            <span>{t("searchPlaceholder")}</span>
          </div>
          <div className="welcome-preview-toolbar-lines"><i /><i /><i /></div>
        </div>
        <div className="welcome-preview-layout">
          <aside className="welcome-preview-sidebar">
            <div className="welcome-preview-nav-item" data-active="true">
              <Briefcase className="size-3.5" />
              <span>{t("jobs")}</span>
            </div>
            <div className="welcome-preview-nav-item">
              <Bookmark className="size-3.5" />
              <span>{t("shortlist")}</span>
            </div>
            <div className="welcome-preview-nav-item">
              <UserRound className="size-3.5" />
              <span>{t("profile")}</span>
            </div>
          </aside>
          <div className="welcome-preview-workspace">
            <div className="welcome-preview-metrics">
              <div className="welcome-preview-metric" data-accent="true"><i /><strong>12 480</strong><span /></div>
              <div className="welcome-preview-metric"><i /><strong>846</strong><span /></div>
              <div className="welcome-preview-metric"><i /><strong>92%</strong><span /></div>
            </div>
            <div className="welcome-preview-table">
              <div className="welcome-preview-table-head"><i /><i /><i /><i /></div>
              <div className="welcome-preview-table-row"><b /><i /><i /><span /></div>
              <div className="welcome-preview-table-row"><b /><i /><i /><span /></div>
              <div className="welcome-preview-table-row"><b /><i /><i /><span /></div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="welcome-cosmos">
        <svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 1200 420">
          <defs>
            <radialGradient id="welcome-aura" cx="50%" cy="54%" r="52%">
              <stop offset="0%" stopColor="#d8c7ff" stopOpacity="0.95" />
              <stop offset="18%" stopColor="#9865ff" stopOpacity="0.76" />
              <stop offset="52%" stopColor="#5723ce" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#21094f" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="welcome-disk" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#6d35e8" stopOpacity="0" />
              <stop offset="24%" stopColor="#7f4cff" stopOpacity="0.48" />
              <stop offset="48%" stopColor="#f3eaff" stopOpacity="1" />
              <stop offset="52%" stopColor="#f3eaff" stopOpacity="1" />
              <stop offset="76%" stopColor="#7f4cff" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#6d35e8" stopOpacity="0" />
            </linearGradient>
            <filter id="welcome-blur-wide" x="-30%" y="-80%" width="160%" height="260%">
              <feGaussianBlur stdDeviation="28" />
            </filter>
            <filter id="welcome-blur-soft" x="-30%" y="-50%" width="160%" height="200%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id="welcome-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur result="blur" stdDeviation="5" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="welcome-upper-half">
              <rect height="276" width="1200" x="0" y="0" />
            </clipPath>
          </defs>

          <ellipse className="welcome-cosmos-aura" cx="600" cy="235" fill="url(#welcome-aura)" filter="url(#welcome-blur-wide)" rx="300" ry="190" />
          <ellipse cx="600" cy="256" fill="none" filter="url(#welcome-blur-soft)" rx="470" ry="55" stroke="#7440f0" strokeOpacity="0.7" strokeWidth="20" />
          <circle className="welcome-cosmos-ring-blur" clipPath="url(#welcome-upper-half)" cx="600" cy="265" fill="none" filter="url(#welcome-blur-soft)" r="145" stroke="#9e6dff" strokeWidth="27" />
          <circle className="welcome-cosmos-ring" clipPath="url(#welcome-upper-half)" cx="600" cy="265" fill="#04010d" filter="url(#welcome-glow)" r="137" stroke="url(#welcome-disk)" strokeWidth="9" />
          <path d="M58 278 C 310 235, 890 235, 1142 278" fill="none" filter="url(#welcome-blur-wide)" stroke="#7541ff" strokeOpacity="0.72" strokeWidth="35" />
          <path d="M42 276 C 314 249, 886 249, 1158 276" fill="none" filter="url(#welcome-blur-soft)" stroke="url(#welcome-disk)" strokeWidth="13" />
          <path className="welcome-cosmos-line" d="M28 276 C 310 268, 890 268, 1172 276" fill="none" stroke="url(#welcome-disk)" strokeWidth="3" />
          <circle cx="855" cy="164" fill="#f5efff" r="2.2" />
          <circle cx="892" cy="205" fill="#aa82ff" r="1.4" />
          <circle cx="330" cy="202" fill="#a67cff" r="1.8" />
          <circle cx="956" cy="244" fill="#ffffff" r="1.2" />
        </svg>
      </div>
    </main>
  );
}
