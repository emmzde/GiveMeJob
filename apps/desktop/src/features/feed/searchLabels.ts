import type {
  EmploymentType,
  LocationKind,
  RemoteMode,
  SearchSort,
  Seniority,
} from "@/lib/catalog";
import { t } from "@/lib/i18n";

export const searchSortLabels: Readonly<Record<SearchSort, string>> = {
  relevance: t("sortRelevance"),
  newest: t("sortNewest"),
  salary: t("sortSalary"),
};

export const remoteModeLabels: Readonly<Record<RemoteMode, string>> = {
  remote: t("remoteModeRemote"),
  hybrid: t("remoteModeHybrid"),
  onsite: t("remoteModeOnsite"),
};

export const seniorityLabels: Readonly<Record<Seniority, string>> = {
  intern: t("seniorityIntern"),
  junior: t("seniorityJunior"),
  middle: t("seniorityMiddle"),
  senior: t("senioritySenior"),
  lead: t("seniorityLead"),
  staff: t("seniorityStaff"),
  principal: t("seniorityPrincipal"),
  manager: t("seniorityManager"),
  director: t("seniorityDirector"),
  executive: t("seniorityExecutive"),
};

export const employmentTypeLabels: Readonly<Record<EmploymentType, string>> = {
  full_time: t("employmentFullTime"),
  contract: t("employmentContract"),
  part_time: t("employmentPartTime"),
  internship: t("employmentInternship"),
  temporary: t("employmentTemporary"),
  volunteer: t("employmentVolunteer"),
  other: t("employmentOther"),
};

export const locationKindLabels: Readonly<Record<LocationKind, string>> = {
  country: t("suggestionCountry"),
  city: t("suggestionCity"),
  location_text: t("suggestionLocationText"),
};

export function formatSourceLabel(source: string): string {
  return source.length === 0 ? source : `${source[0]?.toLocaleUpperCase("ru-RU")}${source.slice(1)}`;
}
