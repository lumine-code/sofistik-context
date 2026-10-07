const test = require("node:test");
const assert = require("node:assert/strict");
const { SofistikEnvironmentResolver, updateDefinition } = require("../lib");
const path = require("node:path");

test("separates selected-edition CDB capabilities from calculation installations", () => {
  const root = path.resolve("installed");
  const install = path.join(root, "2026", "SOFiSTiK 2026");
  const resolver = new SofistikEnvironmentResolver({
    root,
    readFile: () => null,
    readdir: () => ["2026"],
    exists: (file) => file === install || file === path.join(install, "sps.exe"),
  });
  const snapshot = resolver.resolve();
  assert.equal(snapshot.installed, true);
  assert.deepEqual(snapshot.capabilities.calculation, { wps: false, sps: true });
  assert.equal(snapshot.capabilities.cdb.available, false);
  assert.equal(resolver.applicationPath(snapshot, "sps"), path.join(install, "sps.exe"));
  assert.equal(resolver.applicationPath(snapshot, "wps.exe"), null);
  assert.throws(() => resolver.applicationPath(snapshot, "../sps"), /Invalid.*application/);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.capabilities.calculation));
});

test("rejects invalid explicit context rather than selecting an unrelated release", () => {
  const resolver = new SofistikEnvironmentResolver({ readFile: () => null, readdir: () => [] });
  assert.throws(() => resolver.resolve({ version: "../2026" }), /Invalid.*release/);
  assert.throws(() => resolver.resolve({ language: "German" }), /language/);
  assert.throws(() => resolver.resolve({ edition: "../educational" }), /edition/);
});

test("updates declarations without rewriting unrelated content or newline conventions", () => {
  const source =
    "\uFEFF! project\r\nSOF_VERSION=2024\r\nSOF_VERSION=2022\r\nOTHER = keep\r\nSOF_LANGUAGE=EN\r\n";
  assert.equal(
    updateDefinition(source, { version: "2026", language: "DE" }),
    "\uFEFF! project\r\nSOF_VERSION = 2026\r\nOTHER = keep\r\nSOF_LANGUAGE = DE\r\n",
  );
  assert.equal(
    updateDefinition(source, { version: null }),
    "\uFEFF! project\r\nOTHER = keep\r\nSOF_LANGUAGE=EN\r\n",
  );
  assert.equal(updateDefinition("", { edition: "educational" }), "SOF_EDITION = educational\n");
  assert.throws(() => updateDefinition(source, { root: "elsewhere" }), /Unknown.*declaration/);
});
