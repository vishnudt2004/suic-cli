import axios from "axios";
import { CLIError } from "./error-handler";
import { extractFilePathFromUrl } from "./url-utils";

// Fetch init registry (global setup files)
export async function fetchInitRegistry(url: string): Promise<any> {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    throw new CLIError("Failed to fetch init registry", err);
  }
}

// Fetch components registry (list of available components)
export async function fetchComponentsRegistry(url: string): Promise<any> {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    throw new CLIError("Failed to fetch components registry", err);
  }
}

export async function fetchFileData(url: string): Promise<string | any> {
  try {
    const { data } = await axios.get(url, { responseType: "text" });
    return data;
  } catch (err) {
    throw new CLIError(
      `Failed to fetch file data from ${extractFilePathFromUrl(url)}`,
      err
    );
  }
}
