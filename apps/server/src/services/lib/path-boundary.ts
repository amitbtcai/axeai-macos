import { isAbsolute, relative, sep } from "node:path";

export function isPathWithinRoot(
  rootPath: string,
  candidatePath: string,
): boolean {
  const relativePath = relative(rootPath, candidatePath);
  return (
    relativePath.length === 0 ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}
