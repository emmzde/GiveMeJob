import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import { AppErrorBoundary } from "@/app/AppErrorBoundary";
import { appQueryClient } from "@/app/queryClient";
import { useAppUiStore } from "@/app/store/appUiStore";
import { applyDocumentTheme, resolveTheme } from "@/app/theme";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/manrope";
import "@fontsource-variable/plus-jakarta-sans";
import "@/styles/index.css";

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
