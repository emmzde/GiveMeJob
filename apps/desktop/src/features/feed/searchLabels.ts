import type {
  EmploymentType,
  LocationKind,
  RemoteMode,
  SearchSort,
  Seniority,
} from "@/lib/catalog";
import { getLocaleTag, t } from "@/lib/i18n";

export const searchSortLabels: Readonly<Record<SearchSort, string>> = {
  get relevance() {
    return t("sortRelevance");
  },
  get newest() {
    return t("sortNewest");
  },
  get salary() {
    return t("sortSalary");
  },
};

export const remoteModeLabels: Readonly<Record<RemoteMode, string>> = {
  get remote() {
    return t("remoteModeRemote");
  },
  get hybrid() {
    return t("remoteModeHybrid");
  },
  get onsite() {
    return t("remoteModeOnsite");
  },
};

export const seniorityLabels: Readonly<Record<Seniority, string>> = {
  get intern() {
    return t("seniorityIntern");
  },
  get junior() {
    return t("seniorityJunior");
  },
  get middle() {
    return t("seniorityMiddle");
  },
  get senior() {
    return t("senioritySenior");
  },
  get lead() {
    return t("seniorityLead");
  },
  get staff() {
    return t("seniorityStaff");
  },
  get principal() {
    return t("seniorityPrincipal");
  },
  get manager() {
    return t("seniorityManager");
  },
  get director() {
    return t("seniorityDirector");
  },
  get executive() {
    return t("seniorityExecutive");
  },
};

export const employmentTypeLabels: Readonly<Record<EmploymentType, string>> = {
  get full_time() {
    return t("employmentFullTime");
  },
  get contract() {
    return t("employmentContract");
  },
  get part_time() {
    return t("employmentPartTime");
  },
  get internship() {
    return t("employmentInternship");
  },
  get temporary() {
    return t("employmentTemporary");
  },
  get volunteer() {
    return t("employmentVolunteer");
  },
  get other() {
    return t("employmentOther");
  },
};

export const locationKindLabels: Readonly<Record<LocationKind, string>> = {
  get country() {
    return t("suggestionCountry");
  },
  get city() {
    return t("suggestionCity");
  },
  get location_text() {
    return t("suggestionLocationText");
  },
};

export function formatSourceLabel(source: string): string {
  return source.length === 0 ? source : `${source[0]?.toLocaleUpperCase(getLocaleTag())}${source.slice(1)}`;
}
