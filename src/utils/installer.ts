import fs from "fs";
import path from "path";
import { ComponentsRegistryEntry, InitRegistry } from "../lib/types";
import { constants } from "../constants";
import { buildUrl } from "./url-utils";
import { fetchFileData } from "./fetch";
import { askConfirm } from "./prompt-handler";
import chalk from "chalk";

export async function installInitFiles(
  registry: InitRegistry,
  cwd: string,
  installPath: string
) {
  // Install files from registry
  for (const filePath of registry.files) {
    const targetPath = path.join(cwd, installPath, filePath);
    const content = await fetchFileData(buildUrl(constants.BASE_URL, filePath));

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf-8");
  }

  // Create empty components.ts for export handling
  const componentsFile = path.join(cwd, installPath, "components.ts");
  fs.mkdirSync(path.dirname(componentsFile), { recursive: true });
  if (!fs.existsSync(componentsFile)) {
    fs.writeFileSync(
      componentsFile,
      "// exports for suic components\n",
      "utf-8"
    );
  }

  // Add path alias in tsconfig.json
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigRaw = fs.readFileSync(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(tsconfigRaw);

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};

    // Only add if not already present
    if (!tsconfig.compilerOptions.paths["suic/*"]) {
      tsconfig.compilerOptions.paths["suic/*"] = [`${installPath}/*`];
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify(tsconfig, null, 2),
        "utf-8"
      );
    }
  }
}

export async function installComponentFiles(
  compEntry: ComponentsRegistryEntry,
  cwd: string,
  installPath: string
) {
  // Check if any file already exists
  const anyFileExists = compEntry.files.some((f) =>
    fs.existsSync(path.join(cwd, installPath, f))
  );

  let proceed = true;

  if (anyFileExists) {
    const reinstall = await askConfirm(
      `Component '${chalk.cyanBright(
        compEntry.name
      )}' already exists. Reinstall? (${chalk.yellow(
        "Warning: modified data will be lost"
      )})`
    );
    proceed = reinstall;
  }

  if (!proceed) {
    // logger.info(`Skipped component '${chalk.cyanBright(compEntry.name)}'`);
    return "skipped"; // Exit early, do not overwrite files
  }

  for (const filePath of compEntry.files) {
    const targetPath = path.join(cwd, installPath, filePath);
    const content = await fetchFileData(buildUrl(constants.BASE_URL, filePath));

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf-8");
    // logger.info(`Added ${path.relative(cwd, targetPath)}`);
  }

  // Update components.ts
  const indexFile = path.join(cwd, installPath, "components.ts");

  const mainFile = compEntry.files[0]; // Pick the first file as main export
  const exportPath = mainFile.replace(/\.[^/.]+$/, ""); // Remove file extension: .ts/.tsx/.js/.jsx
  const exportLine = `export * from "./${exportPath}";\n`;

  if (fs.existsSync(indexFile)) {
    const current = fs.readFileSync(indexFile, "utf-8");
    if (!current.includes(exportLine))
      fs.appendFileSync(indexFile, exportLine, "utf-8");
  } else {
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(
      indexFile,
      `// exports for suic components\n${exportLine}`,
      "utf-8"
    );
  }

  return "installed";
}
