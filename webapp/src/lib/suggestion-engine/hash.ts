/**
 * djb2 hash -- fast, no crypto dependency, produces a compact string key.
 * Pure function, isomorphic (no browser or Node.js APIs).
 */
export function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
