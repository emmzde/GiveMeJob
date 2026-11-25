import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Lock, MapPin, Pencil, Plus, UserRound, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { FilterAutocomplete } from "@/features/feed/components/FilterAutocomplete";
import type { FilterSuggestion } from "@/features/feed/components/FilterAutocomplete";
import { remoteModeLabels, seniorityLabels } from "@/features/feed/searchLabels";
import {
  profileFieldErrors,
  profileFieldOrder,
} from "@/features/profile/profileValidation";
import type {
  ProfileField,
  ProfileFieldErrors,
} from "@/features/profile/profileValidation";
import { autocompleteSkills, remoteModeSchema, senioritySchema } from "@/lib/catalog";
import type { RemoteMode } from "@/lib/catalog";
import { getLocaleTag, t } from "@/lib/i18n";
import {
  getProfile,
  profileInputSchema,
  profileQueryKey,
  saveProfile,
} from "@/lib/profile";
import type { ProfileInput, UserProfile } from "@/lib/profile";

const emptyProfile: ProfileInput = {
  preferredRoles: [],
  seniority: null,
  skills: [],
  country: null,
  city: null,
  remoteModes: [],
  salaryMinUsdYear: null,
};

function toInput(profile: UserProfile | null | undefined): ProfileInput {
  if (!profile) return emptyProfile;
  return {
    preferredRoles: profile.preferredRoles,
    seniority: profile.seniority,
    skills: profile.skills,
    country: profile.country,
    city: profile.city,
    remoteModes: profile.remoteModes,
    salaryMinUsdYear: profile.salaryMinUsdYear,
  };
}

function Field({
  children,
  error,
  errorId,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  errorId?: string;
  label: string;
}) {
  return (
    <div className="profile-field">
      <p className="profile-field-label">{label}</p>
      <div className="profile-field-body">
        {children}
        {error && errorId ? (
          <p className="mt-2 text-[11px] leading-4 text-[var(--danger)]" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChipList({
  label,
  onRemove,
  values,
}: {
  label: "removeRole" | "removeSkill";
  onRemove(value: string): void;
  values: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge className="gap-1" key={value} tone="outline">
          {value}
          <button aria-label={`${t(label)}: ${value}`} className="rounded-[2px] hover:text-[var(--text)]" onClick={() => onRemove(value)} type="button">
            <X aria-hidden="true" className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function ProfileForm({ initial, onCancel, onSaved }: { initial: UserProfile | null; onCancel(): void; onSaved(): void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProfileInput>(() => toInput(initial));
  const [roleInput, setRoleInput] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [salaryInput, setSalaryInput] = useState(() => initial?.salaryMinUsdYear?.toString() ?? "");
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const skillRef = useRef<HTMLInputElement>(null);
  const seniorityRef = useRef<HTMLSelectElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const remoteModeRef = useRef<HTMLInputElement>(null);
  const salaryRef = useRef<HTMLInputElement>(null);
  const skillsQuery = useQuery({
    enabled: draft.skills.length < 50,
    queryFn: () => autocompleteSkills(skillQuery, 20),
    queryKey: ["catalog", "autocomplete", "profile-skills", skillQuery],
    retry: false,
  });
  const save = useMutation({
    mutationFn: saveProfile,
    onSuccess(profile) {
      queryClient.setQueryData(profileQueryKey, profile);
      void queryClient.invalidateQueries({ queryKey: ["user", "match"] });
      void queryClient.invalidateQueries({ queryKey: ["user", "matches"] });
      onSaved();
    },
  });
  const skillSuggestions: FilterSuggestion[] = useMemo(
    () => (skillsQuery.data ?? [])
      .filter(({ canonicalName }) => !draft.skills.includes(canonicalName))
      .map(({ canonicalName, count, label }) => ({ count, label, value: canonicalName })),
    [draft.skills, skillsQuery.data],
  );

  function addRole(): void {
    const role = roleInput.trim();
    if (!role || draft.preferredRoles.length >= 5) return;
    if (draft.preferredRoles.some((value) => value.toLocaleLowerCase(getLocaleTag()) === role.toLocaleLowerCase(getLocaleTag()))) return;
    setDraft({ ...draft, preferredRoles: [...draft.preferredRoles, role] });
    clearFieldError("preferredRoles");
    setRoleInput("");
  }

  function clearFieldError(field: ProfileField): void {
    setFieldErrors((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function focusField(field: ProfileField): void {
    const refs = {
      preferredRoles: roleRef,
      skills: skillRef,
      seniority: seniorityRef,
      country: countryRef,
      city: cityRef,
      remoteModes: remoteModeRef,
      salaryMinUsdYear: salaryRef,
    } as const;
    refs[field].current?.focus();
  }

  function handleRoleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      addRole();
    }
  }

  function toggleRemoteMode(value: RemoteMode): void {
    clearFieldError("remoteModes");
    setDraft({
      ...draft,
      remoteModes: draft.remoteModes.includes(value)
        ? draft.remoteModes.filter((mode) => mode !== value)
        : [...draft.remoteModes, value],
    });
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalizedSalary = salaryInput.trim() === "" ? null : Number(salaryInput.trim().replace(",", "."));
    const parsed = profileInputSchema.safeParse({ ...draft, salaryMinUsdYear: normalizedSalary });
    if (!parsed.success) {
      const nextErrors = profileFieldErrors(parsed.error.issues);
      setFieldErrors(nextErrors);
      setValidationError(Object.keys(nextErrors).length === 0 ? t("profileInvalid") : null);
      const firstInvalidField = profileFieldOrder.find((field) => nextErrors[field] !== undefined);
      if (firstInvalidField) requestAnimationFrame(() => focusField(firstInvalidField));
      return;
    }
    setFieldErrors({});
    setValidationError(null);
    save.mutate(parsed.data);
  }

  return (
    <form className="profile-form profile-form-canvas" onSubmit={submit}>
      <Field error={fieldErrors.preferredRoles} errorId="profile-roles-error" label={t("preferredRoles")}>
        <div className="flex gap-2">
          <input
            aria-label={t("preferredRoles")}
            aria-describedby={`profile-roles-hint${fieldErrors.preferredRoles ? " profile-roles-error" : ""}`}
            aria-invalid={fieldErrors.preferredRoles ? true : undefined}
            className="form-control min-w-0 flex-1"
            disabled={draft.preferredRoles.length >= 5}
            maxLength={100}
            onChange={(event) => {
              setRoleInput(event.target.value);
              clearFieldError("preferredRoles");
            }}
            onKeyDown={handleRoleKeyDown}
            placeholder={t("rolePlaceholder")}
            ref={roleRef}
            value={roleInput}
          />
          <Button aria-label={t("addRole")} className="size-9 px-0" disabled={!roleInput.trim() || draft.preferredRoles.length >= 5} onClick={addRole} type="button" variant="outline">
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)]" id="profile-roles-hint">{t("preferredRolesHint")}</p>
        {draft.preferredRoles.length > 0 ? <div className="mt-2"><ChipList label="removeRole" onRemove={(role) => {
          clearFieldError("preferredRoles");
          setDraft({ ...draft, preferredRoles: draft.preferredRoles.filter((value) => value !== role) });
        }} values={draft.preferredRoles} /></div> : null}
      </Field>

      <Field error={fieldErrors.skills} errorId="profile-skills-error" label={t("skills")}>
          <FilterAutocomplete
            ariaDescribedBy={fieldErrors.skills ? "profile-skills-error" : undefined}
            ariaInvalid={fieldErrors.skills !== undefined}
            inputRef={skillRef}
            isLoading={skillsQuery.isFetching}
            label={t("skills")}
            onQueryChange={setSkillQuery}
            onSelect={(suggestion) => {
              clearFieldError("skills");
              setDraft({ ...draft, skills: [...draft.skills, suggestion.value] });
              setSkillQuery("");
            }}
            placeholder={t("skillCanonicalHint")}
            query={skillQuery}
            suggestions={skillSuggestions}
          />
          {draft.skills.length > 0 ? <div className="mt-2"><ChipList label="removeSkill" onRemove={(skill) => {
            clearFieldError("skills");
            setDraft({ ...draft, skills: draft.skills.filter((value) => value !== skill) });
          }} values={draft.skills} /></div> : null}
      </Field>
      <Field error={fieldErrors.seniority} errorId="profile-seniority-error" label={t("seniority")}>
          <select
            aria-label={t("seniority")}
            aria-describedby={fieldErrors.seniority ? "profile-seniority-error" : undefined}
            aria-invalid={fieldErrors.seniority ? true : undefined}
            className="form-control w-full"
            onChange={(event) => {
              clearFieldError("seniority");
              setDraft({ ...draft, seniority: event.target.value === "" ? null : senioritySchema.parse(event.target.value) });
            }}
            ref={seniorityRef}
            value={draft.seniority ?? ""}
          >
            <option value="">{t("profileNoValue")}</option>
            {senioritySchema.options.map((value) => <option key={value} value={value}>{seniorityLabels[value]}</option>)}
          </select>
      </Field>

      <Field label={t("location")}>
          <div className="grid grid-cols-2 gap-2">
            <input aria-describedby={fieldErrors.country ? "profile-country-error" : undefined} aria-invalid={fieldErrors.country ? true : undefined} aria-label={t("country")} className="form-control" maxLength={100} onChange={(event) => {
              clearFieldError("country");
              setDraft({ ...draft, country: event.target.value || null });
            }} placeholder={t("country")} ref={countryRef} value={draft.country ?? ""} />
            <input aria-describedby={fieldErrors.city ? "profile-city-error" : undefined} aria-invalid={fieldErrors.city ? true : undefined} aria-label={t("city")} className="form-control" maxLength={100} onChange={(event) => {
              clearFieldError("city");
              setDraft({ ...draft, city: event.target.value || null });
            }} placeholder={t("city")} ref={cityRef} value={draft.city ?? ""} />
          </div>
          {fieldErrors.country ? <p className="mt-2 text-[11px] text-[var(--danger)]" id="profile-country-error" role="alert">{fieldErrors.country}</p> : null}
          {fieldErrors.city ? <p className="mt-2 text-[11px] text-[var(--danger)]" id="profile-city-error" role="alert">{fieldErrors.city}</p> : null}
      </Field>
      <Field error={fieldErrors.salaryMinUsdYear} errorId="profile-salary-error" label={t("minimumSalary")}>
          <input aria-describedby={fieldErrors.salaryMinUsdYear ? "profile-salary-error" : undefined} aria-invalid={fieldErrors.salaryMinUsdYear ? true : undefined} aria-label={t("minimumSalary")} className="form-control w-full tabular-nums" inputMode="decimal" maxLength={16} onChange={(event) => {
            clearFieldError("salaryMinUsdYear");
            setSalaryInput(event.target.value);
          }} placeholder="100000" ref={salaryRef} value={salaryInput} />
      </Field>

      <Field error={fieldErrors.remoteModes} errorId="profile-work-modes-error" label={t("preferredWorkModes")}>
        <div className="flex flex-wrap gap-2">
          {remoteModeSchema.options.map((value) => (
            <label className="flex min-h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 text-xs hover:bg-[var(--surface-hover)]" key={value}>
              <input aria-describedby={fieldErrors.remoteModes ? "profile-work-modes-error" : undefined} aria-invalid={fieldErrors.remoteModes ? true : undefined} checked={draft.remoteModes.includes(value)} className="size-4 accent-[var(--accent)]" onChange={() => toggleRemoteMode(value)} ref={value === remoteModeSchema.options[0] ? remoteModeRef : undefined} type="checkbox" />
              {remoteModeLabels[value]}
            </label>
          ))}
        </div>
      </Field>

      {validationError || save.isError ? <p aria-live="assertive" className="alert-card m-3" role="alert">{validationError ?? t("profileSaveError")}</p> : null}
      {save.isSuccess ? <p aria-live="polite" className="mx-3 mt-3 text-xs text-[var(--positive)]" role="status">{t("profileSaved")}</p> : null}
      <div className="profile-form-actions">
        <Button disabled={save.isPending} type="submit">{save.isPending ? t("savingProfile") : t("saveProfile")}</Button>
        <Button disabled={save.isPending} onClick={onCancel} type="button" variant="outline">{t("cancel")}</Button>
      </div>
    </form>
  );
}

function ProfileSummary({ onEdit, profile }: { onEdit(): void; profile: UserProfile }) {
  const location = [profile.city, profile.country].filter(Boolean).join(", ") || t("profileNoValue");
  return (
    <div className="profile-summary">
        <Field label={t("preferredRoles")}><div className="flex flex-wrap gap-1.5">{profile.preferredRoles.length > 0 ? profile.preferredRoles.map((value) => <Badge key={value} tone="outline">{value}</Badge>) : t("profileNoValue")}</div></Field>
        <Field label={t("skills")}><div className="flex flex-wrap gap-1.5">{profile.skills.length > 0 ? profile.skills.map((value) => <Badge key={value}>{value}</Badge>) : t("profileNoValue")}</div></Field>
        <Field label={t("location")}><p className="flex items-center gap-2 text-sm"><MapPin aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />{location}</p></Field>
        <Field label={t("seniority")}><p className="text-sm">{profile.seniority ? seniorityLabels[profile.seniority] : t("profileNoValue")}</p></Field>
        <Field label={t("preferredWorkModes")}><div className="flex flex-wrap gap-1.5">{profile.remoteModes.length > 0 ? profile.remoteModes.map((value) => <Badge key={value} tone="outline">{remoteModeLabels[value]}</Badge>) : t("profileNoValue")}</div></Field>
        <Field label={t("minimumSalary")}><p className="flex items-center gap-2 text-sm tabular-nums"><Banknote aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />{profile.salaryMinUsdYear === null ? t("profileNoValue") : `$${profile.salaryMinUsdYear.toLocaleString(getLocaleTag())}`}</p></Field>
      <div className="profile-form-actions justify-between">
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("profileVersion")}: {profile.version} · {t("profileUpdated")}: {new Intl.DateTimeFormat(getLocaleTag(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.updatedAt))}</p>
        <Button onClick={onEdit} type="button" variant="outline"><Pencil aria-hidden="true" className="size-4" />{t("editProfile")}</Button>
      </div>
    </div>
  );
}

export function ProfileView() {
  const profile = useQuery({ queryFn: getProfile, queryKey: profileQueryKey, retry: false });
  const [editing, setEditing] = useState(false);

  return (
    <div className="workspace-page profile-page">
      <section className="workspace-frame profile-workspace">
        <header className="workspace-header">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="workspace-header-glyph"><UserRound className="size-4" /></span>
            <div>
            <h1 className="workspace-title">{t("profileTitle")}</h1>
            <p className="workspace-description flex items-center gap-1.5"><Lock aria-hidden="true" className="size-3.5" />{t("profilePrivacy")}</p>
            </div>
          </div>
        </header>
        <div className="profile-content scroll-region min-h-0 flex-1 overflow-y-auto">
        {profile.isPending ? <div aria-label={t("profileTitle")} className="m-4 h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" role="status" /> : null}
        {profile.isError ? (
          <div className="alert-card m-4" role="alert">
            <p>{t("profileLoadError")}</p>
            <Button className="mt-3" onClick={() => void profile.refetch()} type="button" variant="outline">
              {t("profileRetry")}
            </Button>
          </div>
        ) : null}
        {!profile.isPending && !profile.isError && profile.data === null && !editing ? (
          <div className="profile-empty-state grid min-h-80 place-content-center px-6 py-12 text-center">
            <IconTile className="mx-auto" icon={UserRound} size="lg" tone="violet" />
            <h2 className="text-sm font-semibold">{t("profileEmpty")}</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--text-secondary)]">{t("profileEmptyHint")}</p>
            <Button className="mx-auto mt-5" onClick={() => setEditing(true)} type="button"><Plus aria-hidden="true" className="size-4" />{t("createProfile")}</Button>
          </div>
        ) : null}
        {!profile.isPending && !profile.isError && editing ? <ProfileForm initial={profile.data ?? null} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} /> : null}
        {!profile.isPending && !profile.isError && profile.data && !editing ? <ProfileSummary onEdit={() => setEditing(true)} profile={profile.data} /> : null}
        </div>
      </section>
    </div>
  );
}
