const DECLARATIONS = Object.freeze({
  version: "SOF_VERSION",
  language: "SOF_LANGUAGE",
  edition: "SOF_EDITION",
});

function selectedVersion(value) {
  const version = String(value ?? "").trim();
  if (!version || version.toLowerCase() === "auto") return null;
  if (!/^\d{4}$/.test(version)) throw new RangeError(`Invalid SOFiSTiK release: ${version}.`);
  return version;
}

function selectedLanguage(value) {
  const language = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!language) return null;
  if (language !== "en" && language !== "de")
    throw new RangeError(`Unknown SOFiSTiK language: ${value}. Use EN or DE.`);
  return language;
}

function selectedEdition(value) {
  const edition = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!edition) return null;
  if (edition !== "professional" && edition !== "educational")
    throw new RangeError(`Unknown SOFiSTiK edition: ${value}.`);
  return edition;
}

function parseDefinition(text) {
  const source = String(text ?? "");
  const version = /^\s*SOF_VERSION\s*=\s*(\d{4})\b/im.exec(source)?.[1] || null;
  const language = /^\s*SOF_LANGUAGE\s*=\s*(EN|DE)\b/im.exec(source)?.[1]?.toLowerCase() || null;
  const edition = /^\s*SOF_EDITION\s*=\s*(\w+)/im.exec(source)?.[1];
  return Object.freeze({ version, language, edition: selectedEdition(edition) });
}

/** Changes integration declarations while retaining all other definition content. */
function updateDefinition(text, changes) {
  const source = String(text ?? "");
  const eol = source.match(/\r\n|\n|\r/)?.[0] || "\n";
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  const normalizers = {
    version: selectedVersion,
    language: selectedLanguage,
    edition: selectedEdition,
  };
  const updates = new Map();
  for (const [field, value] of Object.entries(changes)) {
    if (!Object.hasOwn(DECLARATIONS, field))
      throw new TypeError(`Unknown SOFiSTiK declaration: ${field}.`);
    const normalized = value == null ? null : normalizers[field](value);
    updates.set(DECLARATIONS[field], field === "language" ? normalized?.toUpperCase() : normalized);
  }
  const emitted = new Set();
  const lines = source.slice(bom.length).split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  const result = [];
  for (const line of lines) {
    const key = /^\s*(SOF_VERSION|SOF_LANGUAGE|SOF_EDITION)\s*=/i.exec(line)?.[1].toUpperCase();
    if (!updates.has(key)) {
      result.push(line);
      continue;
    }
    const value = updates.get(key);
    if (value != null && !emitted.has(key)) result.push(`${key} = ${value}`);
    emitted.add(key);
  }
  for (const [key, value] of updates)
    if (value != null && !emitted.has(key)) result.push(`${key} = ${value}`);
  return bom + (result.length ? result.join(eol) + eol : "");
}

module.exports = {
  parseDefinition,
  updateDefinition,
  selectedVersion,
  selectedLanguage,
  selectedEdition,
};
