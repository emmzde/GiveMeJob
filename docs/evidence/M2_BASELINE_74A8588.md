# M2 baseline — 74a8588

Статус: зафиксирован 31 июля 2026 года. Этот файл — evidence конкретного
состояния и не задаёт новый scope или ADR.

## Commit и CI

- commit: `74a8588e9fbd9db95e55843965a15e479803bb3e`;
- workflow: `quality.yml`;
- exact-SHA run: [30624049746](https://github.com/emmzde/GiveMeJob/actions/runs/30624049746);
- conclusion: `success`;
- успешные jobs: `Desktop web layer`, `Desktop Rust`, `Catalog exporter`.

Workflow был запущен через временный CI-only pull request к base-ветке на
непосредственном родителе commit. Это потребовалось потому, что прежний PR той
же feature-ветки уже был squash-merged, а новый PR в `main` конфликтовал.
Временные PR и base-ветка после зелёного run закрыты/удалены; SHA проверяемого
commit не переписывался.

## Тесты

В exact-SHA run прошли 24 теста:

| Gate | Тесты |
|---|---:|
| Vitest | 5 |
| Rust unit tests | 11 |
| pytest | 8 |
| **Всего** | **24** |

Дополнительно workflow успешно выполнил TypeScript typecheck, ESLint, Vite
production build, Ruff lint/format check, mypy, `cargo fmt`, `cargo check` и
Clippy с `-D warnings`.

## Web bundle

Размеры из Vite output exact-SHA CI run:

| Файл | Raw | Gzip |
|---|---:|---:|
| `dist/index.html` | 0,39 kB | 0,27 kB |
| `dist/assets/index-DxZHZCqc.css` | 14,45 kB | 3,89 kB |
| `dist/assets/index-qBJHhPE2.js` | 305,76 kB | 93,92 kB |

Локальная повторная сборка того же commit дала точные raw-размеры 395,
14 453 и 305 768 bytes соответственно.

## Frozen catalog

`source_frozen_at`: `2026-07-29T20:30:03.846872Z`.

| Artifact/контракт | Размер | SHA-256 |
|---|---:|---|
| `catalog-v1.sqlite` | 1 120 321 536 bytes | `dcdfa747a2c51e49c539238467d74dc0d6b9e17efa2f281f9c6508bf27c23375` |
| `catalog-v1.sqlite.zst` | 354 444 310 bytes | `7536e669f60ea90aee85b1642359dff7e6efe5d3c0bb17bad8cc4ca5e0bd610c` |
| logical rows | — | `1ef6792c62ef099b21974805fbade6c6eec1eeeb2db249a97a355ef1ffc8776b` |

Оба file checksum были пересчитаны по локальным artifacts и совпали с
`config/catalog-manifest.json`; значения не взяты только на доверии из
manifest.
