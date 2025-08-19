import { logger } from "./logger";
import { ENV } from "../constants";

export class CLIError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause instanceof Error) this.cause = cause;
  }
}

export function handleError(err: unknown, level = 0) {
  const indent = "  ".repeat(level);
  const isDev = ENV.MODE === "DEV";

  if (err instanceof Error) {
    logger.error(`${indent} ${err.message}`);
    if (isDev && (err as any).cause) {
      handleError((err as any).cause, level + 1);
    }
    if (isDev && err.stack && level === 0) {
      logger.break();
      logger.error(err.stack);
    }
  } else {
    logger.error(`${indent} ${String(err)}`);
  }

  if (level === 0) process.exit(1);
}
