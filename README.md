# sofistik-env

Resolves SOFiSTiK project declarations and installed releases.

> **NOTE**: This package is not an official SOFiSTiK product and is not affiliated with or endorsed by SOFiSTiK AG.

## Features

- **File context**: reads sofistik.def beside the input file for the selected year, language and edition without reading source-file headers.
- **Installation discovery**: finds releases containing calculation executables or CDB interfaces and ignores empty leftover directories.
- **Lightweight API**: uses only Node built-ins, with no schemas, native modules, editor service or runtime dependencies.
- **Shared paths**: derives installation and CDB interface paths, including the older 2018 and 2020 naming conventions.
- **Offline behavior**: reports a missing installation without throwing or inventing an installed release.

## Installation

Install from an immutable Git commit:

```sh
npm install github:lumine-code/sofistik-env#<commit-sha>
```

This is a Node library, not an editor package. It is distributed through Git pins and is not published to the npm registry.

## Usage

```js
const { SofistikEnvironmentResolver } = require("@lumine-code/sofistik-env");
const environment = new SofistikEnvironmentResolver();
const resolved = environment.resolve({ filePath: "C:/Projects/Bridge/model.dat" });
```

The order is an explicit caller version, then SOF_VERSION in the sofistik.def beside the input file, then the newest installed release below C:\Program Files\SOFiSTiK. A saved file always uses its own directory, even when a caller also supplies projectPath or directoryPath. A missing adjacent definition does not inherit one from a parent or workspace root. Files in different directories can select different environments. Source-file headers never participate. SOF_LANGUAGE accepts EN or DE; SOF_EDITION accepts professional or educational. Defaults are English and professional. An explicitly selected year is preserved even when it is not installed.

An optional constructor fallbackVersion, either a year or a function returning one, runs only when no declaration or installation selects a year. sofistik-data supplies its own latest dataset through this option; this library does not maintain a second release catalogue or depend on the dataset package. Runtime-only consumers leave it unset and receive version: null and installed: false when no release is available.

These definition keys are integration declarations, not a claim that SOFiSTiK itself interprets them. Definitions are read fresh, while installation scans are cached for at most five seconds by default. clearCache() explicitly invalidates that scan. A CDB session should retain its chosen environment until reopened so a definition edit cannot replace an already loaded interface DLL.

## API

resolve({ filePath, directoryPath, projectPath, readDefinition, version, language, edition }) returns { version, language, edition, root, installPath, installed, versionSource }. Every context field is optional. Without filePath, directoryPath supplies an explicit directory context; projectPath remains a compatibility alias, then the working directory applies. readDefinition: false skips declaration lookup entirely for callers such as untitled documents. versionSource is explicit, definition, installed, fallback or unresolved. Constructor filesystem and clock hooks support deterministic tests; normal consumers use the default installation root.

getInstalledVersions() returns installed release years newest first. installationPath(root, version), cdbInterfaceFileName(version, edition) and cdbInterfacePath(root, version, edition) expose the same path conventions used by the resolver and native reader.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
