const { SofistikEnvironmentResolver } = require("./environment-resolver");
const { parseDefinition, updateDefinition } = require("./definition");
const {
  INSTALLATION_ROOT,
  installationPath,
  cdbInterfaceFileName,
  cdbInterfacePath,
} = require("./installation");

module.exports = {
  INSTALLATION_ROOT,
  SofistikEnvironmentResolver,
  parseDefinition,
  updateDefinition,
  installationPath,
  cdbInterfaceFileName,
  cdbInterfacePath,
};
