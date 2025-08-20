import fs from "fs";
import path from "path";
import { logger } from "./logger";
import chalk from "chalk";

type Dependencies = Record<string, string>;

// Logs required dependencies for the user to install manually.
export function ensureDependencies(
  requiredDeps: {
    dependencies?: Dependencies;
    devDependencies?: Dependencies;
    peerDependencies?: Dependencies;
  },
  cwd: string
) {
  const { dependencies, devDependencies, peerDependencies } = requiredDeps;

  const packageJsonPath = path.join(cwd, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    logger.warn(
      "package.json not found. Cannot detect installed dependencies."
    );
  }

  const pkg = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
    : { dependencies: {}, devDependencies: {} };
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const printDeps = (deps: Dependencies | undefined, type: string) => {
    if (!deps || Object.keys(deps).length === 0) return;

    logger.info(`${type}:`);
    for (const [dep, version] of Object.entries(deps)) {
      const installedVersion = allDeps[dep];
      if (installedVersion) {
        console.log(
          `${" ".repeat(2)} - ${chalk.cyanBright(dep)}@${version} (${chalk.dim(
            "installed:"
          )} ${installedVersion})`
        );
      } else {
        console.log(`${" ".repeat(2)} - ${chalk.cyanBright(dep)}@${version}`);
      }
    }
    logger.break(); // spacing
  };

  logger.break();
  logger.warn(
    `Required dependencies (${chalk.yellow(
      "install if missing, skip if already installed and compatible"
    )}):`
  );
  logger.break();

  printDeps(dependencies, "Dependencies");
  printDeps(devDependencies, "Dev Dependencies");
  printDeps(peerDependencies, "Peer Dependencies");
}
