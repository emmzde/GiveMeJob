import type { MatchReason, MatchReasonCode } from "@/lib/match";
import { t } from "@/lib/i18n";

const reasonLabels: Readonly<Record<MatchReasonCode, string>> = {
  skills_overlap: t("matchReasonSkillsOverlap"),
  skills_missing: t("matchReasonSkillsMissing"),
  role_aligned: t("matchReasonRoleAligned"),
  role_mismatch: t("matchReasonRoleMismatch"),
  seniority_aligned: t("matchReasonSeniorityAligned"),
  seniority_mismatch: t("matchReasonSeniorityMismatch"),
  location_aligned: t("matchReasonLocationAligned"),
  location_mismatch: t("matchReasonLocationMismatch"),
  salary_meets: t("matchReasonSalaryMeets"),
  salary_below: t("matchReasonSalaryBelow"),
};

export function matchReasonLabel(reason: MatchReason): string {
  return reasonLabels[reason.code];
}
