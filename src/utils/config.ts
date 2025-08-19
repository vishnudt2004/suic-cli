import fs from "fs";
import path from "path";
import { constants } from "../constants";
import { ConfigType } from "../lib/types";
import { ContextError } from "./error-handler";

export function getConfig(): ConfigType {
  const configPath = path.join(process.cwd(), constants.CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Run \`suic-cli init\` first.`
    );
  }

  const raw = fs.readFileSync(configPath, "utf-8");

  try {
    const parsed = JSON.parse(raw) as ConfigType;

    return parsed;
  } catch (err) {
    throw new Error(
      `Invalid config file format at ${configPath}: ${
        (err as Error).message
      } ` +
        `Try reinitializing the project with \`suic-cli init\`. ` +
        `Warning: this may overwrite modified data. ` +
        `Alternatively, you can manually edit the config by following the guide: <url>`
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
      path.join(cwd, constants.CONFIG_FILE),
      JSON.stringify(config, null, 2),
      "utf-8"
    );

    return config;
  } catch (err) {
    throw new ContextError(err, "create config file");
  }
}
