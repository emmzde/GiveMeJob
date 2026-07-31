import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { defaultLocale, t } from "@/lib/i18n";

describe("App", () => {
  it("shows the offline catalog shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Поиск по локальному каталогу",
    );
    expect(screen.getByRole("navigation", { name: "Основная навигация" })).toBeInTheDocument();
  });

  it("renders through the configured Russian i18n layer", () => {
    expect(defaultLocale).toBe("ru");
    expect(t("offlineReady")).toBe("Работает без сети");
  });
});
