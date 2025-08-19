import fs from "fs";
import path from "path";
import axios from "axios";
import { logger } from "./logger";
import { InitRegistry } from "../lib/types";
import { constants } from "../constants";
import { buildUrl } from "./url-utils";
import { ContextError } from "./error-handler";

// Fetch init registry (global setup files)
export async function fetchInitRegistry(url: string): Promise<any> {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    throw new ContextError(err, "fetch init registry");
  }
}

// Fetch components registry (list of available components)
export async function fetchComponentsRegistry(url: string): Promise<any> {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    throw new ContextError(err, "fetch components registry");
  }
}

export async function fetchFileData(url: string): Promise<string | any> {
  try {
    const { data } = await axios.get(url, { responseType: "text" });
    return data;
  } catch (err) {
    throw new ContextError(err, "fetch file data");
  }
}

export async function installInitFiles(
  registry: InitRegistry,
  cwd: string,
  installPath: string
) {
  for (const filePath of registry.files) {
    const targetPath = path.join(cwd, installPath, filePath);

    // Fetch raw file data
    const content = await fetchFileData(buildUrl(constants.BASE_URL, filePath));

    // Ensure directory exists
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // Write
    fs.writeFileSync(targetPath, content, "utf-8");
  }

  // Handle deps/devDeps/peerDeps
  if (registry.dependencies && Object.keys(registry.dependencies).length) {
    logger.warn("Dependencies required:");
    for (const [pkg, version] of Object.entries(registry.dependencies)) {
      console.log(`- ${pkg}@${version}`);
    }
  }

  if (
    registry.devDependencies &&
    Object.keys(registry.devDependencies).length
  ) {
    logger.warn("DevDependencies required:");
    for (const [pkg, version] of Object.entries(registry.devDependencies)) {
      console.log(`- ${pkg}@${version}`);
    }
  }

  if (
    registry.peerDependencies &&
    Object.keys(registry.peerDependencies).length
  ) {
    logger.warn("PeerDependencies required:");
    for (const [pkg, version] of Object.entries(registry.peerDependencies)) {
      console.log(`- ${pkg}@${version}`);
    }
  }

  // Additional instructions
  if (registry.additionalInstructions?.length) {
    logger.info("Additional setup instructions:");
    for (const i of registry.additionalInstructions) {
      console.log(`- ${i.title ? `${i.title}: ` : ""}${i.description}`);
    }
  }
}
