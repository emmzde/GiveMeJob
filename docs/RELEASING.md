# Releasing GiveMeJob!

The GitHub workflow builds Windows artifacts from the default branch. It can
stop after uploading a private Actions artifact or publish a GitHub Release.

## One-time repository setup

1. Create a protected GitHub Actions environment named `release`.
2. Restrict deployments to the default branch and add required reviewers if
   the repository plan supports them.
3. Optionally add these environment secrets for a public demo experience:
   `GIVEMEJOB_GROQ_DEMO_KEY`, `GIVEMEJOB_GEMINI_DEMO_KEY`,
   `GIVEMEJOB_OPENROUTER_DEMO_KEY`, `GIVEMEJOB_CEREBRAS_DEMO_KEY`.
4. Use only rate-limited, free-tier and billing-disabled credentials. The
   desktop binary cannot keep embedded values secret.

The app builds without demo credentials and users can configure BYOK providers
locally. Code signing is not configured yet; add a Windows signing certificate
before presenting the installer as a trusted commercial distribution.

## Release checklist

1. Update the version in `package.json`, `apps/desktop/package.json`,
   `apps/desktop/src-tauri/tauri.conf.json`,
   `apps/desktop/src-tauri/Cargo.toml` and `pyproject.toml`.
2. Run `pnpm quality:metadata` and `pnpm quality`.
3. Confirm `config/catalog-manifest.json` describes the intended frozen
   catalog. Host its `.sqlite.zst` archive at an HTTPS URL accessible to GitHub
   Actions.
4. Merge the release commit into `main` and wait for the `Quality` workflow.
5. Run **Actions → Windows release → Run workflow** from `main`.
6. Enter the catalog URL. Enable `publish_release`; keep `prerelease` enabled
   for preview versions.
7. Download the result and verify install, launch, offline search and original
   vacancy links on a clean Windows machine.

The workflow derives the tag from project metadata (for example, `v0.1.0`),
creates it at the selected `main` commit and publishes the NSIS installer,
portable ZIP and `SHA256SUMS.txt`. It refuses to overwrite an existing release.

CLI equivalent:

```powershell
gh workflow run windows-build.yml --ref main `
  -f catalog_url=https://example.invalid/catalog-v1.sqlite.zst `
  -f publish_release=true `
  -f prerelease=true
```

Replace the example URL with the real immutable catalog asset URL.
