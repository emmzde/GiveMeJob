import { ArrowRight, Bookmark, Minus, Search, Square, UserRound, X } from "lucide-react";
import type { ReactNode } from "react";

import { useAppUiStore, type AppScreen } from "@/app/store/appUiStore";
import { BrandMark, BrandWordmark } from "@/components/brand/BrandMark";
import { CornerArrow } from "@/components/ui/corner-arrow";
import { t, type AppLocale } from "@/lib/i18n";
import { openSupportLink } from "@/lib/support";
import { desktopWindow } from "@/lib/tauri/window";
import { IconTile } from "@/components/ui/icon-tile";
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
      className={cn("window-button", danger && "window-button-danger")}
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
  const setScreen = useAppUiStore((state) => state.setScreen);
  const setLanguage = useAppUiStore((state) => state.setLanguage);

  function enterWorkspace(screen: AppScreen = "search") {
    setScreen(screen);
    completeWelcome();
  }

  const features = [
    { screen: "search", icon: Search, tone: "blue", title: t("jobs"), description: t("welcomeSearchCopy") },
    { screen: "shortlist", icon: Bookmark, tone: "gold", title: t("shortlist"), description: t("careerShortlistCopy") },
    { screen: "profile", icon: UserRound, tone: "violet", title: t("profile"), description: t("careerProfileCopy") },
  ] as const;

  return (
    <main aria-labelledby="welcome-title" className="welcome-screen">
      <header className="welcome-topbar" data-tauri-drag-region>
        <div className="welcome-brand" data-tauri-drag-region>
          <BrandMark size={28} />
          <BrandWordmark />
        </div>

        <div className="welcome-topbar-actions">
          <button
            aria-label={t("welcomeGithub")}
            className="welcome-github-button"
            onClick={() => void openSupportLink("github")}
            type="button"
          >
            <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.61-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 7c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
            </svg>
            <span>{t("welcomeGithub")}</span>
          </button>
          <div aria-label={t("welcomeLanguageLabel")} className="welcome-language" role="group">
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
          <div className="window-controls">
            <WelcomeWindowButton action={desktopWindow.minimize} label={t("windowMinimize")}>
              <Minus aria-hidden="true" className="size-4" />
            </WelcomeWindowButton>
            <WelcomeWindowButton action={desktopWindow.toggleMaximize} label={t("windowMaximize")}>
              <Square aria-hidden="true" className="size-3" />
            </WelcomeWindowButton>
            <WelcomeWindowButton action={desktopWindow.close} danger label={t("windowClose")}>
              <X aria-hidden="true" className="size-4" />
            </WelcomeWindowButton>
          </div>
        </div>
      </header>

      <div className="welcome-content">
        <section className="welcome-hero">
          <BrandMark className="welcome-hero-mark" size={72} />
          <h1 id="welcome-title">{t("welcomeTitle")}</h1>
          <p>{t("welcomeDescription")}</p>
          <button className="pill-button-solid welcome-start-button" onClick={() => enterWorkspace()} type="button">
            {t("welcomeStart")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </section>

        <div className="welcome-features">
          {features.map(({ screen, icon: Icon, tone, title, description }) => (
            <button
              className="notch-card welcome-feature"
              key={screen}
              onClick={() => enterWorkspace(screen)}
              type="button"
            >
              <IconTile icon={Icon} size="lg" tone={tone} />
              <span className="showcase-copy">
                <span className="showcase-kicker">{title}</span>
                <span className="showcase-title">{description}</span>
              </span>
              <CornerArrow />
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
