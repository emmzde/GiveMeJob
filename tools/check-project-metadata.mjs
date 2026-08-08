import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTomlVersion(path, packageHeader) {
  const source = readFileSync(path, "utf8");
  const sectionPattern = packageHeader
    ? /\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m
    : /\[project\][\s\S]*?^version\s*=\s*"([^"]+)"/m;
  const match = source.match(sectionPattern);
  if (match === null) throw new Error(`Cannot read project version from ${path}`);
  return match[1];
}

const versions = new Map([
  ["package.json", readJson("package.json").version],
  ["apps/desktop/package.json", readJson("apps/desktop/package.json").version],
  ["apps/desktop/src-tauri/tauri.conf.json", readJson("apps/desktop/src-tauri/tauri.conf.json").version],
  ["apps/desktop/src-tauri/Cargo.toml", readTomlVersion("apps/desktop/src-tauri/Cargo.toml", true)],
  ["pyproject.toml", readTomlVersion("pyproject.toml", false)],
]);

const uniqueVersions = new Set(versions.values());
if (uniqueVersions.size !== 1) {
  const details = [...versions].map(([path, version]) => `${path}: ${version}`).join("\n");
  throw new Error(`Project versions are not aligned:\n${details}`);
}

const [version] = uniqueVersions;
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
if (tag !== undefined && tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match project version v${version}`);
}

console.log(`Project metadata is aligned at version ${version}.`);
