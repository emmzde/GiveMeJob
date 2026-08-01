# M4 implementation progress — 2026-08-01

Статус этой записи: **core implementation verified, M4 acceptance не закрыт**.
Rust/React вертикаль Emmy, fake-provider failover и нативная debug-сборка
готовы. Live provider и Windows Credential Manager restart smoke ещё не
зафиксированы, поэтому acceptance checklist M4 остаётся открытым и переход к M5 не
разрешён.

## Provenance

- source commit: `e1412202adbd95a519b15b4878549c182db69d5e`;
- worktree во время проверки: dirty; clean-commit claim не делается;
- Windows `10.0.26200`, AMD64;
- реальные provider credentials в evidence, Git, командах и fixtures
  отсутствуют.

## Реализованный контракт

- закрытые serde/zod-схемы для state, messages, response/tool-call union,
  turn result и `LlmError`;
- ровно пять локальных tools: `search_jobs`, `get_job`, `compare_jobs`,
  `get_match_breakdown`, `set_shortlist`;
- fake-provider вертикаль выполняет настоящий локальный search, передаёт
  минимальный untrusted tool result во второй model turn и возвращает реальные
  job cards;
- agent loop исполняет не больше четырёх tool steps и отправляет провайдеру не
  больше 12 последних сообщений;
- `set_shortlist` создаёт pending preview, а мутация выполняется отдельным
  confirmation IPC;
- последовательный router: Groq → Gemini → OpenRouter → Cerebras, без гонки;
  timeout, `429/Retry-After`, cooldown, EWMA latency и counters живут в памяти;
- Groq Llama/Qwen используют JSON Object Mode со схемой в system prompt;
  Gemini — `responseJsonSchema`; OpenRouter/Cerebras — очищенную JSON Schema
  со `strict: true`;
- история хранится локально; UI показывает одну активную и восемь последних
  бесед, а загрузка ограничена новейшими 500 сообщениями в хронологическом
  порядке;
- message timeline содержит tool activity, job cards, comparison table, quick
  replies и inline confirmation; восемь поз маскота следуют состояниям loop;
- ошибка инициализации AI runtime переводит Emmy в offline и не блокирует
  локальный каталог.

## Verification

| Gate | Evidence | Result |
|---|---|---:|
| Rust | 115 tests: 111 passed, 4 тяжёлых catalog diagnostics ignored | pass |
| Router/provider regressions | настоящий outer timeout, status/Retry-After mapping, strict schema ≤5 000 chars, exact fallback order | pass |
| Fake vertical | local search → minimal tool result → second model turn → real job card | pass |
| Frontend | 34 files / 159 tests; TypeScript strict; ESLint | pass |
| Production web build | Vite build, lazy Emmy chunk | pass |
| Python/data regression | Ruff, format, Mypy; Pytest 35 passed | pass |
| Native build | `pnpm -C apps/desktop exec tauri build --debug --no-bundle` | pass |
| Native executable | `apps/desktop/src-tauri/target/debug/givemejob-desktop.exe` | produced |
| Secret scan | provider-key-shaped values вне ignored build/artifact dirs | none found |
| Debug credential isolation | sentinel env при debug дал четыре пустых generated arrays | pass |
| Windows Credential Manager | isolated Win32 write → read → clear → absent target | pass |
| Mechanical UI scan | Impeccable detector до финальных focus-regressions | `[]` |

Root `pnpm quality` ранее останавливался только на отсутствии `uv` в PATH
desktop shell. Те же pinned `.venv` executables были запущены напрямую и
прошли. Финальный Pytest использовал отдельный `--basetemp` внутри
`.artifacts`.

## Credential boundary

BYOK записывается Rust-кодом в Windows Credential Manager и имеет приоритет
над demo credential. После сохранения frontend получает только booleans
`configured`, `byokConfigured` и `demoAvailable`; значение назад через IPC не
возвращается. Скопированный из Credential Manager временный Win32 blob и Rust
буферы очищаются перед освобождением.

Release workflow использует защищённый GitHub Environment `release` и передаёт
Rust release-step только четыре именованных Secrets. `build.rs` игнорирует их
при debug/test независимо от окружения. Встроенная compile-time XOR-фрагментация
остаётся осознанно обратимой: ключ из публичного локального бинарника можно
извлечь. Реальная неизвлекаемость возможна только при вызове провайдера через
контролируемый backend proxy.

Любые credentials, ранее опубликованные в сообщениях или ином открытом канале,
нужно отозвать и заменить перед live smoke. Эта проверка намеренно не переносила
такие значения в shell history, Credential Manager или release artifact.

## Открытые acceptance gates

1. Ввести ротированные BYOK через Settings и зафиксировать live structured
   response для каждого из четырёх adapters без записи ключей или raw response.
2. Проверить нативный Windows flow save → close → restart → configured/read →
   clear для Credential Manager.
3. Выполнить защищённый release workflow с отдельными free-tier demo projects,
   billing disabled и минимальными provider quotas; затем провести secret scan
   artifact/logs.
4. Повторить all-providers-unavailable smoke в нативном окне и подтвердить, что
   catalog/profile/shortlist продолжают работать.

До появления отдельной closing evidence эта запись не является
`M4_FINAL_ACCEPTANCE`.
