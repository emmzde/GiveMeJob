use unicode_normalization::UnicodeNormalization;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ParsedConcept {
    pub(super) text: String,
    pub(super) quoted: bool,
}

fn normalize_with_case(value: &str, lowercase: bool) -> String {
    let compatible = value.nfkc().collect::<String>();
    let cased = if lowercase {
        compatible.to_lowercase()
    } else {
        compatible
    };
    cased.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub(super) fn normalize_search_text(value: &str) -> String {
    normalize_with_case(value, true)
}

pub(super) fn normalize_filter_value(value: &str) -> String {
    normalize_with_case(value, false)
}

pub(super) fn normalize_lookup(value: &str) -> String {
    normalize_search_text(value)
}

pub(super) fn normalize_filter_values(values: &[String]) -> Vec<String> {
    let mut normalized = values
        .iter()
        .map(|value| normalize_filter_value(value))
        .collect::<Vec<_>>();
    normalized.sort_unstable();
    normalized.dedup();
    normalized
}

pub(super) fn parse_concepts(value: &str) -> Vec<ParsedConcept> {
    let mut concepts = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut characters = value.chars().peekable();

    while let Some(character) = characters.next() {
        if character == '\\' && characters.peek() == Some(&'"') {
            current.push('"');
            characters.next();
            continue;
        }
        if character == '"' {
            push_concept(&mut concepts, &mut current, quoted);
            quoted = !quoted;
            continue;
        }
        if character.is_whitespace() && !quoted {
            push_concept(&mut concepts, &mut current, false);
        } else {
            current.push(character);
        }
    }
    push_concept(&mut concepts, &mut current, quoted);
    concepts
}

fn push_concept(concepts: &mut Vec<ParsedConcept>, current: &mut String, quoted: bool) {
    let text = normalize_search_text(current);
    current.clear();
    if !text.is_empty() {
        concepts.push(ParsedConcept { text, quoted });
    }
}

pub(super) fn fts_literal(value: &str, _force_phrase: bool) -> Option<String> {
    let tokens = fts_tokens(value);
    let phrase = quoted_tokens(&tokens)?;
    let use_prefix = tokens
        .last()
        .is_some_and(|token| token.chars().count() >= 3);
    Some(if use_prefix {
        format!("{phrase}*")
    } else {
        phrase
    })
}

pub(super) fn fts_exact_literal(value: &str) -> Option<String> {
    fts_phrase(value)
}

fn fts_phrase(value: &str) -> Option<String> {
    quoted_tokens(&fts_tokens(value))
}

fn fts_tokens(value: &str) -> Vec<&str> {
    value
        .split(|character: char| !(character.is_alphanumeric() || character == '_'))
        .filter(|token| !token.is_empty())
        .collect()
}

fn quoted_tokens(tokens: &[&str]) -> Option<String> {
    if tokens.is_empty() {
        return None;
    }
    let joined = tokens.join(" ");
    Some(format!("\"{joined}\""))
}

#[cfg(test)]
mod tests {
    use super::{
        fts_exact_literal, fts_literal, normalize_search_text, parse_concepts, ParsedConcept,
    };

    #[test]
    fn whitespace_and_canonical_unicode_normalize_identically() {
        assert_eq!(
            normalize_search_text("  Café\tDeveloper  "),
            normalize_search_text("Cafe\u{301} Developer")
        );
        assert_eq!(normalize_search_text("  A\u{00a0}B\nC "), "a b c");
    }

    #[test]
    fn quoted_phrase_parser_is_bounded_and_treats_syntax_as_text() {
        assert_eq!(
            parse_concepts("\"machine learning\" AND (python OR NEAR)"),
            vec![
                ParsedConcept {
                    text: "machine learning".to_owned(),
                    quoted: true,
                },
                ParsedConcept {
                    text: "and".to_owned(),
                    quoted: false,
                },
                ParsedConcept {
                    text: "(python".to_owned(),
                    quoted: false,
                },
                ParsedConcept {
                    text: "or".to_owned(),
                    quoted: false,
                },
                ParsedConcept {
                    text: "near)".to_owned(),
                    quoted: false,
                },
            ]
        );
        assert_eq!(
            parse_concepts("\"unterminated phrase"),
            vec![ParsedConcept {
                text: "unterminated phrase".to_owned(),
                quoted: true,
            }]
        );
    }

    #[test]
    fn punctuation_significant_terms_survive_until_alias_expansion() {
        let concepts = parse_concepts("C++ C# .NET Node.js");
        assert_eq!(
            concepts
                .iter()
                .map(|concept| concept.text.as_str())
                .collect::<Vec<_>>(),
            vec!["c++", "c#", ".net", "node.js"]
        );
        assert_eq!(fts_literal("c++", false), Some("\"c\"".to_owned()));
        assert_eq!(fts_literal("cpp", false), Some("\"cpp\"*".to_owned()));
        assert_eq!(fts_literal("go", false), Some("\"go\"".to_owned()));
        assert_eq!(
            fts_exact_literal("New York"),
            Some("\"New York\"".to_owned())
        );
    }
}
