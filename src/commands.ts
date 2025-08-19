import { Command } from "commander";
import fs from "fs";
import path from "path";

import {
  askConfirm,
  askInput,
  askMultiSelect,
  askSelect,
} from "./utils/prompt-handler";
import { logger } from "./utils/logger";
import { ContextError } from "./utils/error-handler";
import {
  fetchInitRegistry,
  fetchComponentsRegistry,
  installInitFiles,
} from "./utils/fetch";
import { getConfig, createConfig } from "./utils/config";
import { constants } from "./constants";
import { buildUrl } from "./utils/url-utils";

export interface ComponentRegistryEntry {
  name: string;
  files: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  // optional extra metadata if needed
  description?: string;
  category?: string;
}

const initRegUrl = buildUrl(constants.BASE_URL, constants.INIT_REG_FILE);

export function registerCommands(program: Command) {
  // INIT COMMAND
  program
    .command("init")
    .description("Set up Simple UI Components in your project")
    .option(
      "-i, --install-path <path>",
      "Custom installation directory",
      constants.DEFAULT_INSTALL_PATH
    )
    .action(async (opts) => {
      try {
        const confirmed = await askConfirm(
          "⚠ Make sure you're in your project root folder (where package.json lives). Continue?"
        );

        if (!confirmed) {
          logger.info("Initialization cancelled.");
          process.exit(0);
        }

        const installPath = opts.installPath || constants.DEFAULT_INSTALL_PATH;
        const cwd = process.cwd();

        // Create config file if not exists
        createConfig({ installPath });

        // Fetch init registry (bootstrap files)
        const initRegistry = await fetchInitRegistry(initRegUrl);

        // Write bootstrap files (utils, styles, etc.)
        installInitFiles(initRegistry, cwd, installPath);

        logger.success(
          `Simple UI Components setup initialized in '${installPath}'.\nRun 'suic-cli add [components...]' to start using components.`
        );
      } catch (err) {
        throw new ContextError(err, "initialization");
      }
    });

  // ADD COMMAND
  // program
  //   .command("add [components...]")
  //   .description("Add one or more components to your project")
  //   .action(async (componentArgs: string[]) => {
  //     try {
  //       const config = getConfig();
  //       const registry = await fetchComponentsRegistry(
  //         constants.COMPONENTS_URL
  //       );

  //       // Normalize registry names (case-insensitive)
  //       const registryMap = new Map(
  //         registry.map((c: any) => [c.name.toLowerCase(), c])
  //       );

  //       // If no args → prompt single component
  //       if (!componentArgs?.length) {
  //         const selected = await askMultiSelect(
  //           "Select components to add:",
  //           registry.map((c: any) => c.name)
  //         );
  //         componentArgs = selected;
  //       }

  //       for (const rawName of componentArgs) {
  //         const name = rawName.toLowerCase();
  //         const compEntry = registryMap.get(name) as ComponentRegistryEntry;

  //         if (!compEntry) {
  //           logger.error(`Component '${rawName}' not found in registry.`);
  //           continue;
  //         }

  //         // Fetch component files
  //         const files = await fetchComponentFiles(
  //           compEntry.name,
  //           ENV.COMPONENTS_URL
  //         );

  //         for (const [filename, content] of Object.entries(files)) {
  //           const filePath = path.join(
  //             config.cwd,
  //             config.installPath,
  //             filename
  //           );
  //           if (!fs.existsSync(path.dirname(filePath))) {
  //             fs.mkdirSync(path.dirname(filePath), { recursive: true });
  //           }
  //           fs.writeFileSync(filePath, content, "utf-8");
  //           logger.info(`Added ${path.relative(config.cwd, filePath)}`);
  //         }

  //         // Inject export into components.ts
  //         const indexFile = path.join(
  //           config.cwd,
  //           config.installPath,
  //           "components.ts"
  //         );
  //         const exportLine = `export * from "./${compEntry.name.toLowerCase()}";\n`;
  //         if (fs.existsSync(indexFile)) {
  //           const current = fs.readFileSync(indexFile, "utf-8");
  //           if (!current.includes(exportLine)) {
  //             fs.appendFileSync(indexFile, exportLine, "utf-8");
  //           }
  //         } else {
  //           fs.writeFileSync(indexFile, exportLine, "utf-8");
  //         }

  //         // Dependencies
  //         const {
  //           dependencies = {},
  //           devDependencies = {},
  //           peerDependencies = {},
  //         } = compEntry;

  //         if (
  //           Object.keys(dependencies).length ||
  //           Object.keys(devDependencies).length
  //         ) {
  //           const allDeps = {
  //             ...Object.fromEntries(
  //               Object.entries(dependencies).map(([k, v]) => [k, `dep: ${v}`])
  //             ),
  //             ...Object.fromEntries(
  //               Object.entries(devDependencies).map(([k, v]) => [
  //                 k,
  //                 `dev: ${v}`,
  //               ])
  //             ),
  //           };

  //           const selected = await askSelect(
  //             `Component '${compEntry.name}' requires dependencies. Select which you will install manually:`,
  //             Object.entries(allDeps).map(([pkg, label]) => `${pkg}@${label}`)
  //           );

  //           logger.warn(
  //             "⚠ Make sure you install the selected dependencies manually with correct versions."
  //           );
  //           console.log("Selected:", selected);
  //         }

  //         if (Object.keys(peerDependencies).length) {
  //           logger.warn(
  //             `Component '${compEntry.name}' also requires peerDependencies:`
  //           );
  //           for (const [pkg, version] of Object.entries(peerDependencies)) {
  //             console.log(`- ${pkg}@${version}`);
  //           }
  //           logger.warn("⚠ Ensure these are installed in your project.");
  //         }

  //         logger.success(`Component '${compEntry.name}' added successfully!`);
  //       }
  //     } catch (err) {
  //       handleError(err, "add command");
  //     }
  //   });

  // // REMOVE COMMAND

  // program
  //   .command("remove")
  //   .description("Remove a component from your project")
  //   .action(async () => {
  //     try {
  //       const config = getConfig();

  //       const componentName = await askInput(
  //         "Enter the name of the component to remove:"
  //       );

  //       const componentDir = path.join(
  //         config.cwd,
  //         config.installPath,
  //         componentName
  //       );

  //       if (fs.existsSync(componentDir)) {
  //         fs.rmSync(componentDir, { recursive: true, force: true });
  //         logger.success(`Component '${componentName}' removed successfully!`);
  //       } else {
  //         logger.warn(`Component '${componentName}' not found.`);
  //       }
  //     } catch (err) {
  //       handleError(err, "remove command");
  //     }
  //   });
}
