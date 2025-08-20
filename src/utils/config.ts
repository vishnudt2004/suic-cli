import fs from "fs";
import path from "path";
import chalk from "chalk";
import { constants } from "../constants";
import { ConfigType } from "../lib/types";
import { CLIError } from "./error-handler";

const configFile = constants.CONFIG_FILE;

export function getConfig(): ConfigType {
  const configPath = path.join(process.cwd(), configFile);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ./${configFile}. Run '${chalk.cyanBright(
        "suic-cli init"
      )}' first.`
    );
  }

  const raw = fs.readFileSync(configPath, "utf-8");

  try {
    const parsed = JSON.parse(raw) as ConfigType;

    return parsed;
  } catch (err) {
    throw new Error(
      `Invalid config at ./${configFile}.\n  Run '${chalk.cyanBright(
        "suic-cli init"
      )}' to reinitialize (${chalk.yellow(
        "may overwrite changes"
      )}) or fix manually by following the docs.`
    );
  }
}

export function createConfig(userInput?: Partial<ConfigType>): ConfigType {
  try {
    const cwd = process.cwd().replace(/\\/g, "/"); // normalize slashes
    const installPath = (
      userInput?.installPath ?? constants.DEFAULT_INSTALL_PATH
    ).replace(/^[/\\]+/, ""); // strip leading slash

    const config: ConfigType = {
      cwd,
      installPath,
    };

    fs.writeFileSync(
      path.join(cwd, configFile),
      JSON.stringify(config, null, 2),
      "utf-8"
    );

    return config;
  } catch (err) {
    throw new CLIError("Failed to create config file", err);
  }
}
