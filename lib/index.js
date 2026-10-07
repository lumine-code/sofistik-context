const { SofistikContextResolver } = require("./context-resolver");
const { parseDefinition, updateDefinition } = require("./definition");
const {
  INSTALLATION_ROOT,
  installationPath,
  cdbInterfaceFileName,
  cdbInterfacePath,
} = require("./installation");

module.exports = {
  INSTALLATION_ROOT,
  SofistikContextResolver,
  parseDefinition,
  updateDefinition,
  installationPath,
  cdbInterfaceFileName,
  cdbInterfacePath,
};
