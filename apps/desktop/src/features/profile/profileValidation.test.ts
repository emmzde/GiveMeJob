import { describe, expect, it } from "vitest";

import { profileFieldErrors } from "@/features/profile/profileValidation";
import { t } from "@/lib/i18n";
import { profileInputSchema } from "@/lib/profile";

describe("profile field validation", () => {
  it("maps schema issues to the affected field without exposing parser text", () => {
    const result = profileInputSchema.safeParse({
      preferredRoles: [],
      seniority: null,
      skills: [],
      country: null,
      city: null,
      remoteModes: [],
      salaryMinUsdYear: 10_000_001,
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(profileFieldErrors(result.error.issues)).toEqual({
      salaryMinUsdYear: t("profileSalaryError"),
    });
  });
});
