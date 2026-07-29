import { ArrowRight, Check, Database, MonitorCog, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const foundations = [
  {
    icon: Database,
    title: t("postgresTitle"),
    description: t("postgresDescription"),
  },
  {
    icon: Server,
    title: t("apiTitle"),
    description: t("apiDescription"),
  },
  {
    icon: MonitorCog,
    title: t("desktopTitle"),
    description: t("desktopDescription"),
  },
] as const;

export function App() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-8 text-[var(--text)] sm:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--text)] text-xs text-[var(--bg)]">
              G
            </span>
            GiveMeJob!
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Check aria-hidden="true" className="size-4" />
            {t("phase")}
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16">
          <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            {t("foundationEyebrow")}
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {t("foundationTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-[var(--text-secondary)]">
            {t("foundationDescription")}
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
            {foundations.map(({ icon: Icon, title, description }) => (
              <article key={title} className="bg-[var(--bg)] p-5">
                <Icon aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
                <h2 className="mt-8 text-sm font-semibold">{title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8">
            <Button>
              {t("continueToData")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
