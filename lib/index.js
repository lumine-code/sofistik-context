const fs = require("node:fs");
const path = require("node:path");

const INSTALLATION_ROOT = "C:\\Program Files\\SOFiSTiK";
const EDITIONS = Object.freeze({ professional: "", educational: "_edu" });

function languageCode(value) {
  return (
    { en: "en", english: "en", de: "de", german: "de" }[
      String(value ?? "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

function explicitVersion(value) {
  const version = String(value ?? "").trim();
  return version && version.toLowerCase() !== "auto" ? version : null;
}

function parseDefinition(text) {
  const source = String(text ?? "");
  return {
    version: /^\s*SOF_VERSION\s*=\s*(\d{4})\b/im.exec(source)?.[1] || null,
    language: languageCode(/^\s*SOF_LANGUAGE\s*=\s*(\w+)/im.exec(source)?.[1]),
    edition: /^\s*SOF_EDITION\s*=\s*(\w+)/im.exec(source)?.[1]?.toLowerCase() || null,
  };
}

function installationPath(root, version) {
  return path.join(root, String(version), `SOFiSTiK ${version}`);
}

function cdbInterfaceFileName(version, edition = "professional") {
  if (!Object.hasOwn(EDITIONS, edition))
    throw new RangeError(`Unknown SOFiSTiK edition: ${edition}.`);
  const mark = EDITIONS[edition];
  if (String(version) === "2018") return `cdb_w${mark}50_x64.dll`;
  if (String(version) === "2020") return `sof_cdb_w${mark}-70.dll`;
  return `sof_cdb_w${mark}-${version}.dll`;
}

function cdbInterfacePath(root, version, edition) {
  return path.join(
    installationPath(root, version),
    "interfaces",
    "64bit",
    cdbInterfaceFileName(version, edition),
  );
}

class SofistikEnvironmentResolver {
  constructor(options = {}) {
    this.root = options.root ?? INSTALLATION_ROOT;
    this.exists = options.exists || fs.existsSync;
    this.readFile =
      options.readFile ||
      ((file) => {
        try {
          return fs.readFileSync(file, "utf8");
        } catch {
          return null;
        }
      });
    this.readdir =
      options.readdir ||
      ((directory) => {
        try {
          return fs.readdirSync(directory);
        } catch {
          return [];
        }
      });
    this.cwd = options.cwd || (() => process.cwd());
    this.now = options.now || Date.now;
    this.installationCacheMs = options.installationCacheMs ?? 5000;
    this.fallbackVersion = options.fallbackVersion ?? null;
    this._installed = null;
    this._scannedAt = 0;
  }

  isInstalled(version) {
    const install = installationPath(this.root, version);
    if (!this.exists(install)) return false;
    return [
      path.join(install, "sps.exe"),
      path.join(install, "wps.exe"),
      ...Object.keys(EDITIONS).map((edition) => cdbInterfacePath(this.root, version, edition)),
    ].some((file) => this.exists(file));
  }

  getInstalledVersions() {
    const now = this.now();
    if (this._installed && now - this._scannedAt < this.installationCacheMs)
      return [...this._installed];
    this._installed = this.readdir(this.root)
      .filter((version) => /^\d{4}$/.test(version))
      .filter((version) => this.isInstalled(version))
      .sort()
      .reverse();
    this._scannedAt = now;
    return [...this._installed];
  }

  clearCache() {
    this._installed = null;
  }

  resolve(context = {}) {
    const filePath = context.filePath ? path.resolve(context.filePath) : null;
    const directory = filePath
      ? path.dirname(filePath)
      : context.directoryPath || context.projectPath
        ? path.resolve(context.directoryPath || context.projectPath)
        : path.resolve(this.cwd());
    const definition = parseDefinition(
      context.readDefinition === false ? null : this.readFile(path.join(directory, "sofistik.def")),
    );
    const requested = explicitVersion(context.version);
    let version, versionSource;
    if (requested) {
      version = requested;
      versionSource = "explicit";
    } else if (definition.version) {
      version = definition.version;
      versionSource = "definition";
    } else {
      const installed = this.getInstalledVersions()[0];
      const fallback =
        !installed && typeof this.fallbackVersion === "function"
          ? this.fallbackVersion()
          : this.fallbackVersion;
      version = installed || explicitVersion(fallback);
      versionSource = installed ? "installed" : version ? "fallback" : "unresolved";
    }
    const language = languageCode(context.language) || definition.language || "en";
    const edition = String(context.edition || definition.edition || "professional")
      .trim()
      .toLowerCase();
    return {
      version,
      language,
      edition,
      root: this.root,
      installPath: version ? installationPath(this.root, version) : "",
      installed: version ? this.isInstalled(version) : false,
      versionSource,
    };
  }
}

module.exports = {
  INSTALLATION_ROOT,
  SofistikEnvironmentResolver,
  parseDefinition,
  installationPath,
  cdbInterfaceFileName,
  cdbInterfacePath,
};
