const path = require("node:path");

const INSTALLATION_ROOT = "C:\\Program Files\\SOFiSTiK";
const EDITIONS = Object.freeze({ professional: "", educational: "_edu" });

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

module.exports = {
  INSTALLATION_ROOT,
  EDITIONS,
  installationPath,
  cdbInterfaceFileName,
  cdbInterfacePath,
};
