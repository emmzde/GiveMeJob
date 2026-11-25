import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { BrandMark, BrandWordmark } from "@/components/brand/BrandMark";
import { t } from "@/lib/i18n";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // React reports the exception in development. Avoid logging job or profile data here.
    void _error;
    void _info;
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main
          className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-[var(--text)]"
        >
          <section
            aria-live="assertive"
            className="w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--panel-card)]"
            role="alert"
          >
            <header className="flex h-12 items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-frame)] px-4">
              <BrandMark size={28} />
              <BrandWordmark />
            </header>
            <div className="p-5">
              <p className="ui-mono text-[10px] uppercase tracking-[0.08em] text-[var(--danger)]">Error</p>
              <h1 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{t("unexpectedErrorTitle")}</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {t("unexpectedErrorDescription")}
              </p>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
