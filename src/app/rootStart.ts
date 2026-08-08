import { pathForLibrary } from "./router";

export async function resolveRootStartPath(): Promise<string> {
  return pathForLibrary();
}
