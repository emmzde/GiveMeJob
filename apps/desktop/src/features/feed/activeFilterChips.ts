import type { SearchDraft } from "@/features/feed/searchDraft";
import { formatCount } from "@/features/feed/jobPresentation";
import {
  employmentTypeLabels,
  formatSourceLabel,
  remoteModeLabels,
  seniorityLabels,
} from "@/features/feed/searchLabels";
import { t } from "@/lib/i18n";

export interface ActiveFilterChip {
  id: string;
  label: string;
  remove(draft: SearchDraft): SearchDraft;
}

export function getActiveFilterChips(draft: SearchDraft): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  for (const skill of draft.skills) {
    chips.push({
      id: `skill:${skill}`,
      label: skill,
      remove: (current) => ({
        ...current,
        skills: current.skills.filter((value) => value !== skill),
      }),
    });
  }
  for (const location of draft.locations) {
    chips.push({
      id: `location:${location}`,
      label: location,
      remove: (current) => ({
        ...current,
        locations: current.locations.filter((value) => value !== location),
      }),
    });
  }
  for (const remoteMode of draft.remoteModes) {
    chips.push({
      id: `remote:${remoteMode}`,
      label: remoteModeLabels[remoteMode],
      remove: (current) => ({
        ...current,
        remoteModes: current.remoteModes.filter((value) => value !== remoteMode),
      }),
    });
  }
  for (const seniority of draft.seniorities) {
    chips.push({
      id: `seniority:${seniority}`,
      label: seniorityLabels[seniority],
      remove: (current) => ({
        ...current,
        seniorities: current.seniorities.filter((value) => value !== seniority),
      }),
    });
  }
  for (const employmentType of draft.employmentTypes) {
    chips.push({
      id: `employment:${employmentType}`,
      label: employmentTypeLabels[employmentType],
      remove: (current) => ({
        ...current,
        employmentTypes: current.employmentTypes.filter(
          (value) => value !== employmentType,
        ),
      }),
    });
  }
  if (draft.salaryMinUsdYear !== undefined) {
    const salary = draft.salaryMinUsdYear;
    chips.push({
      id: "salary:min",
      label: `${t("salaryFrom")} ${formatCount(salary)} USD${t("salaryPerYear")}`,
      remove: (current) => ({ ...current, salaryMinUsdYear: undefined }),
    });
  }
  if (draft.salaryKnownOnly) {
    chips.push({
      id: "salary:known",
      label: t("salaryKnownOnly"),
      remove: (current) => ({ ...current, salaryKnownOnly: false }),
    });
  }
  for (const source of draft.sources) {
    chips.push({
      id: `source:${source}`,
      label: formatSourceLabel(source),
      remove: (current) => ({
        ...current,
        sources: current.sources.filter((value) => value !== source),
      }),
    });
  }
  return chips;
}
