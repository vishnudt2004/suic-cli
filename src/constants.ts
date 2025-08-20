import chalk from "chalk";

export const ENV = {
  MODE: "PROD",
};

export const constants = {
  CLI_DOCS_URL: "https://suic-docs.vercel.app/docs/cli",

  BASE_URL: "https://raw.githubusercontent.com/vishnudt2004/test-repo/main/",
  INIT_REG_FILE: "registries/init.json",
  COMPS_REG_FILE: "registries/components.json",
  CONFIG_FILE: "suic.config.json",
  DEFAULT_INSTALL_PATH: "/src/suic",
};

export const cliUi = {
  accentColor: "#14B8A6",
  name: "suic-cli",
  logo: `${chalk.bgWhiteBright.black(" Simple UI ")}${chalk
    .bgHex("#14B8A6")
    .whiteBright(" Components ")}`,
  helpText: `\n${chalk.bold.hex("#9CA3AF")(
    "Documentation:"
  )} ${chalk.underline.hex("#60a5fa")(constants.CLI_DOCS_URL)}\n`,
  version: chalk.green("1.0.0"),
  commands: {
    init: "init",
    add: "add",
    remove: "remove",
  },
};
