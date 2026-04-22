import type { Creator, Note } from "../core/types.js";

export type CollectCreatorInput = {
  profileUrl: string;
  limit?: number;
};

export type CollectCreatorResult = {
  creator: Creator;
  notes: Note[];
  failedUrls: string[];
};

export async function collectCreator(_input: CollectCreatorInput): Promise<CollectCreatorResult> {
  throw new Error(
    "XHS collector is not implemented yet. Next step: add Playwright-based local browser collection."
  );
}

