import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

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
            className="max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-raised)] p-6"
            role="alert"
          >
            <h1 className="text-lg font-semibold">{t("unexpectedErrorTitle")}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {t("unexpectedErrorDescription")}
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
