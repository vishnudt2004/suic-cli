import chalk from "chalk";

type ENVType = {
  MODE: "DEV" | "PROD";
};

export const ENV: ENVType = {
  MODE: "PROD",
};

export const constants = {
  CLI_DOC_URL: "https://suic-docs.vercel.app/docs/cli",
  COMPS_DOC_URL: "https://suic-docs.vercel.app/docs/components",

  BASE_URL: "https://raw.githubusercontent.com/vishnudt2004/suic-core/main/",
  INIT_REG_FILE: "registries/init.json",
  COMPS_REG_FILE: "registries/components.json",
  CONFIG_FILE: "suic.config.json",
  DEFAULT_INSTALL_PATH: "./src/suic",

  // CLIENT
  INSTALLED_REG_FILE: ".suic/installed-registry.json",
  TS_PATH_ALIAS: {
    alias: "suic/*",
    value: (installPath: string) => `${installPath}/*`,
  },
};

export const cliUi = {
  accentColor: "#14B8A6",
  name: "suic-cli",
  logo: `${chalk.bgWhiteBright.black(" Simple UI ")}${chalk
    .bgHex("#14B8A6")
    .whiteBright(" Components ")}`,
  helpText: `\n${chalk.bold.hex("#9CA3AF")(
    "Documentation:"
  )} ${chalk.underline.hex("#60a5fa")(constants.CLI_DOC_URL)}\n`,
  version: chalk.green("suic-cli v1.0.0"),
};
