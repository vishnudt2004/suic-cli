export const ENV = {
  MODE: process.env.NODE_ENV === "production" ? "PROD" : "DEV",
};

export const constants = {
  BASE_URL:
    "https://raw.githubusercontent.com/vishnudt2004/test-repo/main/",
  INIT_REG_FILE: "registries/init.json",
  COMPS_REG_FILE: "registries/components.json",
  CONFIG_FILE: "suic.config.json",
  DEFAULT_INSTALL_PATH: "/src/suic",
};
