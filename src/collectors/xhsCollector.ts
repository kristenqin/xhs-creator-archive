import { createCreatorDraft } from "../core/project.js";
import { buildSampleArchive } from "../core/sampleData.js";
import type { Creator, Note } from "../core/types.js";
import { saveCreatorArchive } from "../storage/archiveStore.js";

export type CollectCreatorInput = {
  profileUrl: string;
  limit?: number;
  mode?: "sample";
};

export type CollectCreatorResult = {
  creator: Creator;
  notes: Note[];
  failedUrls: string[];
  archiveRoot: string;
};

export async function collectCreator(input: CollectCreatorInput): Promise<CollectCreatorResult> {
  const creator = createCreatorDraft(input.profileUrl);
  const archive = buildSampleArchive({ creator });
  const limitedNotes = archive.notes.slice(0, input.limit);

  await saveCreatorArchive(
    {
      creator: archive.creator,
      notes: limitedNotes
    },
    "archives"
  );

  return {
    creator: archive.creator,
    notes: limitedNotes,
    failedUrls: [],
    archiveRoot: `archives/${archive.creator.id}`
  };
}
