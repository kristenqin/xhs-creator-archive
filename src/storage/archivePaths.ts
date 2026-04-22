import path from "node:path";

export type ArchivePaths = {
  root: string;
  creatorRoot: string;
  creatorFile: string;
  notesDir: string;
  mediaDir: string;
  exportsDir: string;
  logsDir: string;
};

export function getArchivePaths(creatorId: string, root = "archives"): ArchivePaths {
  const creatorRoot = path.join(root, creatorId);

  return {
    root,
    creatorRoot,
    creatorFile: path.join(creatorRoot, "creator.json"),
    notesDir: path.join(creatorRoot, "notes"),
    mediaDir: path.join(creatorRoot, "media"),
    exportsDir: path.join(creatorRoot, "exports"),
    logsDir: path.join(creatorRoot, "logs")
  };
}

