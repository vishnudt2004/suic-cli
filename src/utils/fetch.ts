import axios from "axios";
import { CLIError } from "./error-handler";
import { extractFilePathFromUrl } from "./url-utils";

export async function fetchRegistry<T>(
  url: string,
  errMessage: string = "Failed to fetch registry"
): Promise<T> {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    throw new CLIError(errMessage, err);
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
