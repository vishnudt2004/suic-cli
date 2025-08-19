import prompts from "prompts";
import { logger } from "./logger";

export async function askInput(
  message: string,
  defaultValue?: string
): Promise<string> {
  const response = await prompts({
    type: "text",
    name: "value",
    message,
    initial: defaultValue,
    validate: (val) => (val.trim() ? true : "This field cannot be empty."),
  });

  if (!response.value) {
    logger.error("No input provided.");
    process.exit(1);
  }
  return response.value;
}

export async function askSelect(
  message: string,
  choices: string[]
): Promise<string> {
  const response = await prompts({
    type: "select",
    name: "value",
    message,
    choices: choices.map((c) => ({ title: c, value: c })),
  });

  if (!response.value) {
    logger.error("No selection made.");
    process.exit(1);
  }
  return response.value;
}

export async function askMultiSelect(message: string, choices: string[]) {
  const response = await prompts({
    type: "multiselect",
    name: "value",
    message,
    choices: choices.map((c) => ({ title: c, value: c })),
    instructions: false,
    min: 1,
  });

  if (!response.value) {
    logger.error("No selection made.");
    process.exit(1);
  }
  return response.value;
}

export async function askConfirm(message: string): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "value",
    message,
    initial: true,
  });

  return response.value ?? false;
}

export const prompt = {
  input: askInput,
  select: askSelect,
  MultiSelect: askMultiSelect,
  confirm: askConfirm,
};
