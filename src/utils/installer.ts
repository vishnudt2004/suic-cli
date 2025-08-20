import fs from "fs";
import path from "path";
import { InitRegistry } from "../lib/types";
import { constants } from "../constants";
import { buildUrl } from "./url-utils";
import { fetchFileData } from "./fetch";

export async function installInitFiles(
  registry: InitRegistry,
  cwd: string,
  installPath: string
) {
  // Install files from registry
  for (const filePath of registry.files) {
    const targetPath = path.join(cwd, installPath, filePath);
    const content = await fetchFileData(buildUrl(constants.BASE_URL, filePath));

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf-8");
  }

  // Create empty components.ts for export handling
  const componentsFile = path.join(cwd, installPath, "components.ts");
  fs.mkdirSync(path.dirname(componentsFile), { recursive: true });
  if (!fs.existsSync(componentsFile)) {
    fs.writeFileSync(
      componentsFile,
      "// exports for suic components\n",
      "utf-8"
    );
  }

  // Add path alias in tsconfig.json
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigRaw = fs.readFileSync(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(tsconfigRaw);

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};

    // Only add if not already present
    if (!tsconfig.compilerOptions.paths["suic/*"]) {
      tsconfig.compilerOptions.paths["suic/*"] = [`${installPath}/*`];
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify(tsconfig, null, 2),
        "utf-8"
      );
    }
  }
}
