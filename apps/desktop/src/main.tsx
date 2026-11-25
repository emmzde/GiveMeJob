import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import { AppErrorBoundary } from "@/app/AppErrorBoundary";
import { appQueryClient } from "@/app/queryClient";
import { useAppUiStore } from "@/app/store/appUiStore";
import { applyDocumentTheme, resolveTheme } from "@/app/theme";
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/index.css";
import "@/styles/oled.css";
import "@/styles/emmy-mascot.css";
import "@/styles/motion.css";
import "@/styles/settings.css";
import "@/styles/crisp.css";

applyDocumentTheme(
  document.documentElement,
  resolveTheme(
    useAppUiStore.getState().theme,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  ),
);

const appRoot = document.getElementById("root");

if (!appRoot) {
  throw new Error("Root element was not found");
}

createRoot(appRoot).render(
  <StrictMode>
    <QueryClientProvider client={appQueryClient}>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
