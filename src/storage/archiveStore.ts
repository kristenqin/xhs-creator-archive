import fs from "node:fs/promises";

import type { Creator, Note } from "../core/types.js";
import { getArchivePaths, type ArchivePaths } from "./archivePaths.js";

export type CreatorArchive = {
  creator: Creator;
  notes: Note[];
};

export type SaveArchiveResult = {
  paths: ArchivePaths;
  noteCount: number;
};

export async function ensureArchiveLayout(
  creatorId: string,
  root = "archives"
): Promise<ArchivePaths> {
  const paths = getArchivePaths(creatorId, root);

  await Promise.all([
    fs.mkdir(paths.creatorRoot, { recursive: true }),
    fs.mkdir(paths.notesDir, { recursive: true }),
    fs.mkdir(paths.mediaDir, { recursive: true }),
    fs.mkdir(paths.exportsDir, { recursive: true }),
    fs.mkdir(paths.logsDir, { recursive: true })
  ]);

  return paths;
}

export async function saveCreatorArchive(
  archive: CreatorArchive,
  root = "archives"
): Promise<SaveArchiveResult> {
  const paths = await ensureArchiveLayout(archive.creator.id, root);

  await writeJson(paths.creatorFile, archive.creator);

  await Promise.all(
    archive.notes.map((note) => writeJson(`${paths.notesDir}/${note.id}.json`, note))
  );

  return {
    paths,
    noteCount: archive.notes.length
  };
}

export async function readCreatorArchive(
  creatorId: string,
  root = "archives"
): Promise<CreatorArchive> {
  const paths = getArchivePaths(creatorId, root);
  const creator = await readJson<Creator>(paths.creatorFile);

  let notes: Note[] = [];

  try {
    const files = await fs.readdir(paths.notesDir);
    const noteFiles = files.filter((file) => file.endsWith(".json")).sort();

    notes = await Promise.all(noteFiles.map((file) => readJson<Note>(`${paths.notesDir}/${file}`)));
  } catch (error: unknown) {
    const errorCode = getErrorCode(error);

    if (errorCode !== "ENOENT") {
      throw error;
    }
  }

  return {
    creator,
    notes: sortNotesByTimeline(notes)
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function sortNotesByTimeline(notes: Note[]): Note[] {
  return [...notes].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt ?? left.collectedAt);
    const rightTime = Date.parse(right.publishedAt ?? right.collectedAt);

    return leftTime - rightTime;
  });
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }

  return undefined;
}
