import type { ZodIssue } from "zod";

import type { ProfileInput } from "@/lib/profile";
import { t } from "@/lib/i18n";

export type ProfileField = keyof ProfileInput;
export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

export const profileFieldOrder: readonly ProfileField[] = [
  "preferredRoles",
  "skills",
  "seniority",
  "country",
  "city",
  "remoteModes",
  "salaryMinUsdYear",
];

const fieldMessages: Readonly<Record<ProfileField, string>> = {
  preferredRoles: t("profileRolesError"),
  skills: t("profileSkillsError"),
  seniority: t("profileSeniorityError"),
  country: t("profileCountryError"),
  city: t("profileCityError"),
  remoteModes: t("profileWorkModesError"),
  salaryMinUsdYear: t("profileSalaryError"),
};

export function profileFieldErrors(issues: readonly ZodIssue[]): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && profileFieldOrder.includes(field as ProfileField)) {
      const profileField = field as ProfileField;
      errors[profileField] ??= fieldMessages[profileField];
    }
  }
  return errors;
}
