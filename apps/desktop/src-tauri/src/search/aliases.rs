use std::{
    collections::{BTreeMap, BTreeSet},
    sync::OnceLock,
};

use serde::Deserialize;

use crate::ipc::IpcError;

use super::normalization::{normalize_lookup, parse_concepts, ParsedConcept};

const ALIAS_SCHEMA_VERSION: u8 = 1;
const MAX_CONCEPTS: usize = 12;
const SKILL_ALIASES_JSON: &str = include_str!("../../../../../config/search/skill_aliases.json");
const ROLE_ALIASES_JSON: &str = include_str!("../../../../../config/search/role_aliases.json");
const TYPO_DICTIONARY_JSON: &str =
    include_str!("../../../../../config/search/typo_dictionary.json");

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AliasFile {
    schema_version: u8,
    kind: String,
    entries: Vec<AliasEntry>,
    #[serde(default)]
    ambiguous_alias_targets: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AliasEntry {
    canonical: String,
    aliases: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct TypoFile {
    schema_version: u8,
    kind: String,
    terms: Vec<String>,
}

#[derive(Debug, Clone)]
struct IndexedAlias {
    canonical: String,
    variants: Vec<String>,
}

#[derive(Debug)]
struct AliasIndex {
    aliases: BTreeMap<String, IndexedAlias>,
    max_words: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ResolvedConcept {
    pub(super) variants: Vec<String>,
    pub(super) canonical_skills: Vec<String>,
    pub(super) quoted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ResolvedQuery {
    pub(super) concepts: Vec<ResolvedConcept>,
    pub(super) exact_text: String,
}

#[derive(Debug)]
pub(super) struct AliasMaps {
    skills: AliasIndex,
    roles: AliasIndex,
    typo_terms: Vec<String>,
}

static EMBEDDED_ALIAS_MAPS: OnceLock<Result<AliasMaps, String>> = OnceLock::new();

pub(super) fn embedded_alias_maps() -> Result<&'static AliasMaps, IpcError> {
    EMBEDDED_ALIAS_MAPS
        .get_or_init(|| {
            AliasMaps::load(SKILL_ALIASES_JSON, ROLE_ALIASES_JSON, TYPO_DICTIONARY_JSON)
        })
        .as_ref()
        .map_err(|_| IpcError::Internal)
}

impl AliasMaps {
    fn load(skill_json: &str, role_json: &str, typo_json: &str) -> Result<Self, String> {
        let skills = load_alias_index(skill_json, "skill_aliases")?;
        let roles = load_alias_index(role_json, "role_aliases")?;
        let typo: TypoFile = serde_json::from_str(typo_json)
            .map_err(|error| format!("invalid typo dictionary JSON: {error}"))?;
        if typo.schema_version != ALIAS_SCHEMA_VERSION || typo.kind != "search_typo_dictionary" {
            return Err("unsupported typo dictionary schema".to_owned());
        }
        let mut typo_terms = typo
            .terms
            .iter()
            .map(|term| normalize_lookup(term))
            .collect::<Vec<_>>();
        if typo_terms.iter().any(String::is_empty) {
            return Err("typo dictionary contains an empty term".to_owned());
        }
        typo_terms.sort_unstable();
        let original_len = typo_terms.len();
        typo_terms.dedup();
        if typo_terms.len() != original_len {
            return Err("typo dictionary contains duplicate normalized terms".to_owned());
        }
        Ok(Self {
            skills,
            roles,
            typo_terms,
        })
    }

    pub(super) fn resolve(&self, text: &str) -> ResolvedQuery {
        let parsed = parse_concepts(text);
        let exact_text = parsed
            .iter()
            .map(|concept| concept.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        let mut concepts = Vec::new();
        let mut index = 0;
        while index < parsed.len() && concepts.len() < MAX_CONCEPTS {
            let skill_match = self.skills.longest_match(&parsed, index);
            let role_match = self.roles.longest_match(&parsed, index);
            let matched_len = skill_match
                .as_ref()
                .map_or(0, |(length, _)| *length)
                .max(role_match.as_ref().map_or(0, |(length, _)| *length));

            if matched_len == 0 {
                concepts.push(ResolvedConcept {
                    variants: vec![parsed[index].text.clone()],
                    canonical_skills: Vec::new(),
                    quoted: parsed[index].quoted,
                });
                index += 1;
                continue;
            }

            let mut variants = BTreeSet::new();
            let mut canonical_skills = BTreeSet::new();
            if let Some((length, matched)) =
                skill_match.filter(|(length, _)| *length == matched_len)
            {
                variants.extend(matched.variants.iter().cloned());
                canonical_skills.insert(matched.canonical.clone());
                debug_assert_eq!(length, matched_len);
            }
            if let Some((length, matched)) = role_match.filter(|(length, _)| *length == matched_len)
            {
                variants.extend(matched.variants.iter().cloned());
                debug_assert_eq!(length, matched_len);
            }
            concepts.push(ResolvedConcept {
                variants: variants.into_iter().collect(),
                canonical_skills: canonical_skills.into_iter().collect(),
                quoted: parsed[index..index + matched_len]
                    .iter()
                    .any(|concept| concept.quoted),
            });
            index += matched_len;
        }
        ResolvedQuery {
            concepts,
            exact_text,
        }
    }

    pub(super) fn suggestion(&self, text: &str) -> Option<String> {
        let parsed = parse_concepts(text);
        if parsed.is_empty() {
            return None;
        }

        let whole = parsed
            .iter()
            .map(|concept| concept.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        if let Some(replacement) = unique_closest(&whole, &self.typo_terms) {
            return Some(if parsed.len() == 1 && parsed[0].quoted {
                format!("\"{replacement}\"")
            } else {
                replacement
            });
        }

        let mut best: Option<(usize, String)> = None;
        let mut tied = false;
        for (index, concept) in parsed.iter().enumerate() {
            let Some(replacement) = unique_closest(&concept.text, &self.typo_terms) else {
                continue;
            };
            let distance = bounded_damerau_levenshtein(
                &concept.text,
                &replacement,
                allowed_distance(&concept.text),
            )?;
            let mut corrected = parsed.clone();
            corrected[index].text = replacement;
            let candidate = render_concepts(&corrected);
            match &best {
                None => {
                    best = Some((distance, candidate));
                    tied = false;
                }
                Some((best_distance, _)) if distance < *best_distance => {
                    best = Some((distance, candidate));
                    tied = false;
                }
                Some((best_distance, best_candidate))
                    if distance == *best_distance && candidate != *best_candidate =>
                {
                    tied = true;
                }
                _ => {}
            }
        }
        if tied {
            None
        } else {
            best.map(|(_, suggestion)| suggestion)
        }
    }
}

impl AliasIndex {
    fn longest_match<'a>(
        &'a self,
        concepts: &[ParsedConcept],
        start: usize,
    ) -> Option<(usize, &'a IndexedAlias)> {
        let available = (concepts.len() - start).min(self.max_words);
        for length in (1..=available).rev() {
            if length > 1
                && concepts[start..start + length]
                    .iter()
                    .any(|concept| concept.quoted)
            {
                continue;
            }
            if concepts[start].quoted && length > 1 {
                continue;
            }
            let candidate = concepts[start..start + length]
                .iter()
                .map(|concept| concept.text.as_str())
                .collect::<Vec<_>>()
                .join(" ");
            if let Some(found) = self.aliases.get(&candidate) {
                return Some((length, found));
            }
        }
        None
    }
}

fn load_alias_index(json: &str, expected_kind: &str) -> Result<AliasIndex, String> {
    let file: AliasFile = serde_json::from_str(json)
        .map_err(|error| format!("invalid {expected_kind} JSON: {error}"))?;
    if file.schema_version != ALIAS_SCHEMA_VERSION || file.kind != expected_kind {
        return Err(format!("unsupported {expected_kind} schema"));
    }

    let mut entries = BTreeMap::<String, IndexedAlias>::new();
    for entry in file.entries {
        let canonical_key = normalize_lookup(&entry.canonical);
        if canonical_key.is_empty() || entry.aliases.is_empty() {
            return Err(format!("{expected_kind} contains an empty entry"));
        }
        let mut variants = entry
            .aliases
            .iter()
            .map(|alias| normalize_lookup(alias))
            .collect::<BTreeSet<_>>();
        variants.insert(canonical_key.clone());
        if variants.contains("") {
            return Err(format!("{expected_kind} contains an empty alias"));
        }
        let indexed = IndexedAlias {
            canonical: entry.canonical,
            variants: variants.into_iter().collect(),
        };
        if entries.insert(canonical_key, indexed).is_some() {
            return Err(format!(
                "{expected_kind} contains duplicate canonical entries"
            ));
        }
    }

    let mut candidates = BTreeMap::<String, BTreeSet<String>>::new();
    for entry in entries.values() {
        for alias in &entry.variants {
            candidates
                .entry(alias.clone())
                .or_default()
                .insert(entry.canonical.clone());
        }
    }

    let resolutions = file
        .ambiguous_alias_targets
        .into_iter()
        .map(|(alias, target)| (normalize_lookup(&alias), target))
        .collect::<BTreeMap<_, _>>();
    let mut aliases = BTreeMap::new();
    for (alias, canonical_candidates) in &candidates {
        let selected = if canonical_candidates.len() == 1 {
            if resolutions.contains_key(alias) {
                return Err(format!(
                    "{expected_kind} resolves an unambiguous alias: {alias}"
                ));
            }
            canonical_candidates.iter().next().expect("one candidate")
        } else {
            let target = resolutions.get(alias).ok_or_else(|| {
                format!("{expected_kind} alias `{alias}` is ambiguous without a canonical target")
            })?;
            if !canonical_candidates.contains(target) {
                return Err(format!(
                    "{expected_kind} alias `{alias}` selects a non-candidate canonical target"
                ));
            }
            target
        };
        let selected_key = normalize_lookup(selected);
        aliases.insert(
            alias.clone(),
            entries
                .get(&selected_key)
                .ok_or_else(|| format!("{expected_kind} canonical target is missing"))?
                .clone(),
        );
    }
    for resolution in resolutions.keys() {
        if !candidates.contains_key(resolution) {
            return Err(format!(
                "{expected_kind} resolves an unknown alias: {resolution}"
            ));
        }
    }
    let max_words = aliases
        .keys()
        .map(|alias| alias.split_whitespace().count())
        .max()
        .unwrap_or(1);
    Ok(AliasIndex { aliases, max_words })
}

fn render_concepts(concepts: &[ParsedConcept]) -> String {
    concepts
        .iter()
        .map(|concept| {
            if concept.quoted {
                format!("\"{}\"", concept.text)
            } else {
                concept.text.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn unique_closest(value: &str, dictionary: &[String]) -> Option<String> {
    let limit = allowed_distance(value);
    let mut best: Option<(usize, &str)> = None;
    let mut tied = false;
    for candidate in dictionary {
        if candidate == value {
            return None;
        }
        let Some(distance) = bounded_damerau_levenshtein(value, candidate, limit) else {
            continue;
        };
        match best {
            None => {
                best = Some((distance, candidate));
                tied = false;
            }
            Some((best_distance, _)) if distance < best_distance => {
                best = Some((distance, candidate));
                tied = false;
            }
            Some((best_distance, best_candidate))
                if distance == best_distance && candidate != best_candidate =>
            {
                tied = true;
            }
            _ => {}
        }
    }
    if tied {
        None
    } else {
        best.map(|(_, candidate)| candidate.to_owned())
    }
}

fn allowed_distance(value: &str) -> usize {
    if value.chars().count() >= 6 {
        2
    } else {
        1
    }
}

fn bounded_damerau_levenshtein(left: &str, right: &str, limit: usize) -> Option<usize> {
    let left = left.chars().collect::<Vec<_>>();
    let right = right.chars().collect::<Vec<_>>();
    if left.len().abs_diff(right.len()) > limit {
        return None;
    }
    let width = right.len() + 1;
    let mut distances = vec![0; (left.len() + 1) * width];
    for row in 0..=left.len() {
        distances[row * width] = row;
    }
    for (column, distance) in distances.iter_mut().take(width).enumerate() {
        *distance = column;
    }
    for row in 1..=left.len() {
        let mut row_minimum = usize::MAX;
        for column in 1..=right.len() {
            let substitution = usize::from(left[row - 1] != right[column - 1]);
            let mut distance = (distances[(row - 1) * width + column] + 1)
                .min(distances[row * width + column - 1] + 1)
                .min(distances[(row - 1) * width + column - 1] + substitution);
            if row > 1
                && column > 1
                && left[row - 1] == right[column - 2]
                && left[row - 2] == right[column - 1]
            {
                distance = distance.min(distances[(row - 2) * width + column - 2] + 1);
            }
            distances[row * width + column] = distance;
            row_minimum = row_minimum.min(distance);
        }
        if row_minimum > limit && row > right.len() {
            return None;
        }
    }
    let distance = distances[left.len() * width + right.len()];
    (distance <= limit).then_some(distance)
}

#[cfg(test)]
mod tests {
    use super::{bounded_damerau_levenshtein, load_alias_index, AliasMaps};

    const TYPOS: &str = r#"{
      "schema_version": 1,
      "kind": "search_typo_dictionary",
      "terms": ["python", "software engineer"]
    }"#;

    #[test]
    fn ambiguous_alias_requires_an_explicit_canonical_target() {
        let ambiguous = r#"{
          "schema_version": 1,
          "kind": "skill_aliases",
          "entries": [
            {"canonical": "Selenium", "aliases": ["playwright"]},
            {"canonical": "Playwright", "aliases": ["playwright"]}
          ]
        }"#;
        assert!(load_alias_index(ambiguous, "skill_aliases")
            .expect_err("collision must fail")
            .contains("ambiguous without a canonical target"));

        let resolved = r#"{
          "schema_version": 1,
          "kind": "skill_aliases",
          "ambiguous_alias_targets": {"playwright": "Playwright"},
          "entries": [
            {"canonical": "Selenium", "aliases": ["playwright"]},
            {"canonical": "Playwright", "aliases": ["playwright"]}
          ]
        }"#;
        load_alias_index(resolved, "skill_aliases")
            .expect("an explicit canonical target should resolve the collision");
    }

    #[test]
    fn embedded_alias_files_are_versioned_and_valid() {
        super::AliasMaps::load(
            super::SKILL_ALIASES_JSON,
            super::ROLE_ALIASES_JSON,
            super::TYPO_DICTIONARY_JSON,
        )
        .expect("embedded search config should validate");
    }

    #[test]
    fn primary_54_skills_and_curated_roles_have_russian_aliases() {
        let skills: super::AliasFile = serde_json::from_str(super::SKILL_ALIASES_JSON)
            .expect("skill aliases should deserialize");
        assert!(skills.entries.len() >= 54);
        for entry in skills.entries.iter().take(54) {
            assert!(
                entry.aliases.iter().any(|alias| alias
                    .chars()
                    .any(|character| ('\u{0400}'..='\u{04ff}').contains(&character))),
                "primary skill lacks a Russian alias: {}",
                entry.canonical
            );
        }

        let roles: super::AliasFile = serde_json::from_str(super::ROLE_ALIASES_JSON)
            .expect("role aliases should deserialize");
        assert!(!roles.entries.is_empty());
        for entry in roles.entries {
            assert!(
                entry.aliases.iter().any(|alias| alias
                    .chars()
                    .any(|character| ('\u{0400}'..='\u{04ff}').contains(&character))),
                "role lacks a Russian alias: {}",
                entry.canonical
            );
        }
    }

    #[test]
    fn punctuation_aliases_and_longest_role_aliases_expand_as_one_concept() {
        let maps = AliasMaps::load(super::SKILL_ALIASES_JSON, super::ROLE_ALIASES_JSON, TYPOS)
            .expect("maps should load");
        let resolved = maps.resolve("C++ backend developer");
        assert_eq!(resolved.concepts.len(), 2);
        assert!(resolved.concepts[0].variants.contains(&"c++".to_owned()));
        assert!(resolved.concepts[0].variants.contains(&"cpp".to_owned()));
        assert!(resolved.concepts[1]
            .variants
            .contains(&"backend developer".to_owned()));
    }

    #[test]
    fn typo_distance_is_bounded_and_supports_transposition() {
        assert_eq!(bounded_damerau_levenshtein("pyhton", "python", 2), Some(1));
        assert_eq!(bounded_damerau_levenshtein("python", "rust", 2), None);
    }
}
