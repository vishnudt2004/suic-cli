import { HelpConfiguration } from "commander";

export type CLIDef = {
  name: string;
  brandLogo: string;
  description: string;
  help: string;
  version: string;
  style?: HelpConfiguration;
};

export type CommandDef = {
  command: string;
  description: string;
  options?: { flags: string; description: string; defaultValue?: any }[];
  action: (...args: any) => Promise<void>;
  errDescription: string;
};

export type ConfigType = {
  installPath: string; // e.g., "./components"
};

export type InitRegistry = {
  files: string[];
  additionalInstructions?: { title: string; description: string }[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export type ComponentsRegistryEntry = {
  name: string;
  description: string;
  files: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

// Client
export type InstalledRegistryEntry = {
  files: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
