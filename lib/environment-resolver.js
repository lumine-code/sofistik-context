const fs = require("node:fs");
const path = require("node:path");
const {
  parseDefinition,
  selectedVersion,
  selectedLanguage,
  selectedEdition,
} = require("./definition");
const {
  INSTALLATION_ROOT,
  EDITIONS,
  installationPath,
  cdbInterfacePath,
} = require("./installation");

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

  getCapabilities(version, edition = "professional") {
    const install = version ? installationPath(this.root, version) : "";
    const interfacePath = version ? cdbInterfacePath(this.root, version, edition) : "";
    const manualsPath = install ? path.join(install, "help") : "";
    return Object.freeze({
      calculation: Object.freeze({
        wps: Boolean(install && this.exists(path.join(install, "wps.exe"))),
        sps: Boolean(install && this.exists(path.join(install, "sps.exe"))),
      }),
      cdb: Object.freeze({
        path: interfacePath,
        available: Boolean(interfacePath && this.exists(interfacePath)),
      }),
      manuals: Object.freeze({
        path: manualsPath,
        available: Boolean(manualsPath && this.exists(manualsPath)),
      }),
    });
  }

  applicationPath(environment, name) {
    if (!/^[A-Za-z0-9_-]+(?:\.exe)?$/i.test(name))
      throw new TypeError(`Invalid SOFiSTiK application name: ${name}.`);
    if (!environment?.installPath) return null;
    const file = path.join(environment.installPath, /\.exe$/i.test(name) ? name : `${name}.exe`);
    return this.exists(file) ? file : null;
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
      : path.resolve(context.directoryPath || this.cwd());
    const definition = parseDefinition(
      context.readDefinition === false ? null : this.readFile(path.join(directory, "sofistik.def")),
    );
    const requested = selectedVersion(context.version);
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
      version = installed || selectedVersion(fallback);
      versionSource = installed ? "installed" : version ? "fallback" : "unresolved";
    }
    const language = selectedLanguage(context.language) || definition.language || "en";
    const edition = selectedEdition(context.edition) || definition.edition || "professional";
    return Object.freeze({
      version,
      language,
      edition,
      root: this.root,
      installPath: version ? installationPath(this.root, version) : "",
      installed: version ? this.isInstalled(version) : false,
      versionSource,
      capabilities: this.getCapabilities(version, edition),
    });
  }
}

module.exports = { SofistikEnvironmentResolver };
