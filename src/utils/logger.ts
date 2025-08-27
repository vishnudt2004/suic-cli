import chalk from "chalk";

const prefix = "";

type Indent = { char?: string; level?: number };

const logMessage = (
  msg: string,
  colorFn: (txt: string) => string,
  method: "log" | "warn" | "error" = "log",
  indent: Indent = { char: " ", level: 0 }
) => {
  console[method](
    (indent.char || " ").repeat(indent.level || 0) + prefix + colorFn(msg)
  );
};

const core = {
  log: (msg: string, indent?: Indent, symbol: string = "") =>
    logMessage(
      msg,
      (txt) => (symbol ? symbol + " " : "") + chalk.whiteBright(txt),
      "log",
      indent
    ),
  info: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.blueBright("ℹ") + " " + chalk.whiteBright(txt),
      "log",
      indent
    ),
  success: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.greenBright("✔") + " " + chalk.whiteBright(txt),
      "log",
      indent
    ),
  warn: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.yellowBright("⚠") + " " + chalk.whiteBright(txt),
      "warn",
      indent
    ),
  error: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.redBright("✖") + " " + chalk.whiteBright(txt),
      "error",
      indent
    ),
};

const utils = {
  break: (n: number = 0) => console.log("\n".repeat(n)), // n=1 prints 2 line breaks
  divider: (
    n: number = 30,
    char: string = "_",
    indent: Indent = { char: " ", level: 0 }
  ) =>
    console.log(
      (indent.char || " ").repeat(indent.level || 0) + char.repeat(n)
    ),
  title: (
    title: string,
    symbol: string = "",
    divider: {
      char?: string;
      length: number;
      prefix?: string;
      postfix?: string;
    } = { char: "-", length: 0 },
    indent: Indent = { char: " ", level: 0 }
  ) => {
    logMessage(
      title,
      (txt) => (symbol ? symbol + " " : "") + chalk.whiteBright(txt),
      "log",
      indent
    );
    if (divider?.length > 0)
      console.log(
        (indent.char || " ").repeat(indent.level || 0) +
          `${divider.prefix || ""}${(divider.char || "-").repeat(
            divider.length
          )}${divider.postfix || ""}`
      );
    utils.break();
  },
};

export const logger = { ...core, ...utils };
