export type ConfigType = {
  cwd: string; // project root
  installPath: string; // e.g., "./components"
};

export type InitRegistry = {
  files: string[];
  additionalInstructions?: { title: string; description: string }[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export type ComponentsRegistry = {
  name: string;
  description: string;
  files: string[];
  dependencies?: Record<string, string>[];
  devDependencies?: Record<string, string>[];
  peerDependencies?: Record<string, string>[];
};
