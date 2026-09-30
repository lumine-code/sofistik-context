const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  INSTALLATION_ROOT,
  SofistikEnvironmentResolver,
  parseDefinition,
  installationPath,
  cdbInterfaceFileName,
  cdbInterfacePath,
} = require("../lib");

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sofistik-env-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10 }));
  const root = path.join(directory, "installed");
  const projectPath = path.join(directory, "project");
  fs.mkdirSync(root);
  fs.mkdirSync(projectPath);
  const resolver = new SofistikEnvironmentResolver({ root, ...options });
  const definition = path.join(projectPath, "sofistik.def");
  function install(version, edition = "professional") {
    const file = cdbInterfacePath(root, version, edition);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "fixture");
  }
  return { directory, root, projectPath, definition, resolver, install };
}

test("resolves an absent installation without a schema dependency or invented year", () => {
  const resolver = new SofistikEnvironmentResolver({
    readFile: () => null,
    readdir: () => [],
    exists: () => false,
  });
  assert.equal(INSTALLATION_ROOT, "C:\\Program Files\\SOFiSTiK");
  assert.deepEqual(resolver.resolve(), {
    version: null,
    language: "en",
    edition: "professional",
    root: INSTALLATION_ROOT,
    installPath: "",
    installed: false,
    versionSource: "unresolved",
  });
  assert.deepEqual(require("../package.json").dependencies || {}, {});
});

test("normalizes integration declarations without using source headers", () => {
  assert.deepEqual(parseDefinition("@ SOFiSTiK 2026 DE\n"), {
    version: null,
    language: null,
    edition: null,
  });
  assert.deepEqual(
    parseDefinition(
      "\uFEFF sof_version = 2024\r\n SOF_LANGUAGE=German\r\n SOF_EDITION=Educational",
    ),
    { version: "2024", language: "de", edition: "educational" },
  );
  assert.equal(parseDefinition("SOF_VERSION=20245\nSOF_LANGUAGE=FR").version, null);
  assert.equal(parseDefinition("SOF_LANGUAGE=FR").language, null);
});

test("explicit overrides win and an unavailable selected year is preserved", (t) => {
  const { resolver, projectPath, definition, install } = fixture(t);
  install("2026");
  fs.writeFileSync(definition, "SOF_VERSION=2024\nSOF_LANGUAGE=DE\nSOF_EDITION=educational");
  const declared = resolver.resolve({ projectPath });
  assert.equal(declared.version, "2024");
  assert.equal(declared.versionSource, "definition");
  assert.equal(declared.installed, false);
  assert.equal(declared.language, "de");
  assert.equal(declared.edition, "educational");
  const explicit = resolver.resolve({
    projectPath,
    version: "2099",
    language: "English",
    edition: "professional",
  });
  assert.equal(explicit.version, "2099");
  assert.equal(explicit.versionSource, "explicit");
  assert.equal(explicit.installed, false);
  assert.equal(explicit.language, "en");
  assert.equal(explicit.edition, "professional");
  assert.equal(resolver.resolve({ projectPath, version: "Auto" }).version, "2024");
});

test("uses only the file directory even when a conflicting project root is supplied", (t) => {
  const { resolver, directory, projectPath, definition } = fixture(t);
  const external = path.join(directory, "external");
  fs.mkdirSync(external);
  fs.writeFileSync(definition, "SOF_VERSION=2024\nSOF_LANGUAGE=DE");
  fs.writeFileSync(path.join(external, "sofistik.def"), "SOF_VERSION=2026\n");
  const filePath = path.join(external, "model.cdb");
  assert.equal(resolver.resolve({ projectPath, filePath }).version, "2026");
  assert.equal(resolver.resolve({ filePath }).version, "2026");
  fs.unlinkSync(path.join(external, "sofistik.def"));
  assert.equal(resolver.resolve({ projectPath, filePath }).version, null);
  assert.equal(resolver.resolve({ projectPath }).version, "2024");
});

test("selects independent language and edition for sibling file directories", (t) => {
  const { resolver, projectPath, definition } = fixture(t);
  const first = path.join(projectPath, "first");
  const second = path.join(projectPath, "second");
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  fs.writeFileSync(definition, "SOF_VERSION=2018\nSOF_LANGUAGE=EN\nSOF_EDITION=professional");
  fs.writeFileSync(
    path.join(first, "sofistik.def"),
    "SOF_VERSION=2024\nSOF_LANGUAGE=DE\nSOF_EDITION=educational",
  );
  fs.writeFileSync(
    path.join(second, "sofistik.def"),
    "SOF_VERSION=2099\nSOF_LANGUAGE=EN\nSOF_EDITION=professional",
  );
  const german = resolver.resolve({ filePath: path.join(first, "a.dat"), projectPath });
  const english = resolver.resolve({ filePath: path.join(second, "b.dat"), projectPath });
  assert.deepEqual(
    [german.version, german.language, german.edition],
    ["2024", "de", "educational"],
  );
  assert.deepEqual(
    [english.version, english.language, english.edition],
    ["2099", "en", "professional"],
  );
  assert.equal(german.installed, false);
  assert.equal(english.installed, false);
  assert.equal(resolver.resolve({ directoryPath: first, projectPath }).version, "2024");
});

test("can explicitly skip definitions for an untitled document", () => {
  let reads = 0;
  const resolver = new SofistikEnvironmentResolver({
    readFile: () => {
      reads++;
      return "SOF_VERSION=2018\nSOF_LANGUAGE=DE";
    },
    readdir: () => [],
    exists: () => false,
    fallbackVersion: "2026",
  });
  const resolved = resolver.resolve({ readDefinition: false });
  assert.deepEqual(
    [resolved.version, resolved.language, resolved.edition],
    ["2026", "en", "professional"],
  );
  assert.equal(reads, 0);
  assert.equal(resolver.resolve({ readDefinition: false, version: "2024" }).version, "2024");
  assert.equal(reads, 0);
});

test("never reads source files or parent definitions, and defaults to cwd", (t) => {
  const { root, projectPath, definition } = fixture(t);
  fs.writeFileSync(definition, "SOF_VERSION=2022");
  const reads = [];
  const resolver = new SofistikEnvironmentResolver({
    root,
    cwd: () => projectPath,
    readFile: (file) => {
      reads.push(file);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    },
  });
  assert.equal(resolver.resolve({ text: "@ SOFiSTiK 2026" }).version, "2022");
  assert.deepEqual(reads, [definition]);
  const child = path.join(projectPath, "child");
  fs.mkdirSync(child);
  assert.equal(resolver.resolve({ filePath: path.join(child, "input.dat") }).version, null);
});

test("discovers only actual installations and accepts either licensed interface", (t) => {
  const { root, resolver, install } = fixture(t);
  install("2022");
  install("2024", "educational");
  const calculation = installationPath(root, "2026");
  fs.mkdirSync(calculation, { recursive: true });
  fs.writeFileSync(path.join(calculation, "sps.exe"), "fixture");
  fs.mkdirSync(installationPath(root, "2027"), { recursive: true });
  fs.mkdirSync(path.join(root, "2028"));
  fs.mkdirSync(path.join(root, "not-a-year"));
  assert.deepEqual(resolver.getInstalledVersions(), ["2026", "2024", "2022"]);
  assert.equal(resolver.resolve().version, "2026");
  assert.equal(resolver.resolve().versionSource, "installed");
  assert.equal(resolver.resolve({ version: "2027" }).installed, false);
  assert.equal(resolver.resolve({ version: "2024" }).edition, "professional");
  assert.equal(resolver.resolve({ version: "2024" }).installed, true);
});

test("calls an optional dataset fallback only when no selected year exists", (t) => {
  let calls = 0;
  const { resolver, projectPath, definition, install } = fixture(t, {
    fallbackVersion: () => {
      calls++;
      return "2026";
    },
  });
  assert.equal(resolver.resolve({ projectPath }).version, "2026");
  assert.equal(resolver.resolve({ projectPath }).versionSource, "fallback");
  assert.equal(calls, 2);
  install("2024");
  resolver.clearCache();
  assert.equal(resolver.resolve({ projectPath }).version, "2024");
  fs.writeFileSync(definition, "SOF_VERSION=2022");
  assert.equal(resolver.resolve({ projectPath }).version, "2022");
  assert.equal(resolver.resolve({ projectPath, version: "2099" }).version, "2099");
  assert.equal(calls, 2);
});

test("observes definition creation, replacement and deletion without caching declarations", (t) => {
  const { resolver, projectPath, definition } = fixture(t, { fallbackVersion: "2026" });
  assert.equal(resolver.resolve({ projectPath }).version, "2026");
  fs.writeFileSync(definition, "SOF_VERSION=2024\nSOF_LANGUAGE=DE\nSOF_EDITION=educational");
  assert.equal(resolver.resolve({ projectPath }).version, "2024");
  const replacement = path.join(projectPath, "replacement.def");
  fs.writeFileSync(replacement, "SOF_VERSION=2022");
  fs.renameSync(replacement, definition);
  assert.equal(resolver.resolve({ projectPath }).version, "2022");
  assert.equal(resolver.resolve({ projectPath }).edition, "professional");
  fs.unlinkSync(definition);
  assert.equal(resolver.resolve({ projectPath }).version, "2026");
});

test("bounds installation caching, isolates returned lists and invalidates explicitly", () => {
  let now = 0,
    scans = 0;
  const resolver = new SofistikEnvironmentResolver({
    now: () => now,
    installationCacheMs: 100,
    readFile: () => null,
    exists: () => true,
    readdir: () => {
      scans++;
      return [now ? "2026" : "2024"];
    },
  });
  resolver.getInstalledVersions().push("2099");
  assert.equal(resolver.resolve().version, "2024");
  now = 50;
  assert.equal(resolver.resolve().version, "2024");
  assert.equal(scans, 1);
  now = 100;
  assert.equal(resolver.resolve().version, "2026");
  assert.equal(scans, 2);
  resolver.clearCache();
  resolver.resolve();
  assert.equal(scans, 3);
});

test("uses exact legacy and current CDB interface paths", () => {
  for (const [year, professional, educational] of [
    ["2018", "cdb_w50_x64.dll", "cdb_w_edu50_x64.dll"],
    ["2020", "sof_cdb_w-70.dll", "sof_cdb_w_edu-70.dll"],
    ["2026", "sof_cdb_w-2026.dll", "sof_cdb_w_edu-2026.dll"],
  ]) {
    assert.equal(cdbInterfaceFileName(year), professional);
    assert.equal(cdbInterfaceFileName(year, "educational"), educational);
    assert.equal(
      cdbInterfacePath("installed", year, "educational"),
      path.join("installed", year, `SOFiSTiK ${year}`, "interfaces", "64bit", educational),
    );
  }
  assert.throws(() => cdbInterfaceFileName("2026", "unknown"), /Unknown SOFiSTiK edition/);
});
