import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { defaultLocale, t } from "@/lib/i18n";

describe("App", () => {
  it("shows the Phase 0 foundation status", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Всё готово, чтобы начать собирать живые вакансии.",
    );
    expect(screen.getByText("Фаза 0")).toBeInTheDocument();
  });

  it("renders through the configured Russian i18n layer", () => {
    expect(defaultLocale).toBe("ru");
    expect(t("continueToData")).toBe("Перейти к данным");
  });
});
