import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import { WelcomeScreen } from "@/app/WelcomeScreen";

describe("WelcomeScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetAppUiStore({ welcomeCompleted: false });
  });

  it("switches language before entering the workspace", () => {
    render(<WelcomeScreen />);

    expect(screen.getByRole("heading", { level: 1, name: /Добро пожаловать/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(screen.getByRole("heading", { level: 1, name: /Welcome/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get started" })).toBeInTheDocument();
    expect(useAppUiStore.getState().language).toBe("en");
  });

  it("persists completion when work starts", () => {
    render(<WelcomeScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Начать работу" }));

    expect(useAppUiStore.getState().welcomeCompleted).toBe(true);
    expect(window.localStorage.getItem("givemejob.welcome-completed")).toBe("1");
  });
});
