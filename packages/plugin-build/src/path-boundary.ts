import * as path from "node:path";

interface PathBoundaryOperations {
  isAbsolute(candidatePath: string): boolean;
  relative(rootPath: string, candidatePath: string): string;
  sep: string;
}

/** True when candidatePath is rootPath itself or a descendant on this OS. */
export function isPathWithinRoot(
  rootPath: string,
  candidatePath: string,
  pathOperations: PathBoundaryOperations = path,
): boolean {
  const relativePath = pathOperations.relative(rootPath, candidatePath);
  return (
    relativePath.length === 0 ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${pathOperations.sep}`) &&
      !pathOperations.isAbsolute(relativePath))
  );
}
