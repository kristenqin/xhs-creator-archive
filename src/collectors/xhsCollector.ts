import { createInterface } from "node:readline/promises";

import { chromium, type Page } from "playwright";

import { createCreatorDraft, sanitizeId } from "../core/project.js";
import { buildSampleArchive } from "../core/sampleData.js";
import type { Creator, Note, NoteMedia } from "../core/types.js";
import { resolvePlaywrightChromiumExecutablePath } from "../runtime/playwrightBrowser.js";
import { saveCreatorArchive } from "../storage/archiveStore.js";

export type CollectCreatorInput = {
  profileUrl: string;
  limit?: number;
  mode?: "sample" | "browser";
};

export type CollectCreatorResult = {
  creator: Creator;
  notes: Note[];
  failedUrls: string[];
  archiveRoot: string;
};

type ScrapedCreatorProfile = {
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
};

type ScrapedNoteCard = {
  sourceUrl: string;
  title: string;
  snippet: string;
  coverImageUrl?: string;
};

export async function collectCreator(input: CollectCreatorInput): Promise<CollectCreatorResult> {
  if (input.mode === "sample") {
    return collectSampleCreator(input);
  }

  return collectCreatorFromBrowser(input);
}

async function collectSampleCreator(input: CollectCreatorInput): Promise<CollectCreatorResult> {
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

async function collectCreatorFromBrowser(input: CollectCreatorInput): Promise<CollectCreatorResult> {
  ensureInteractiveTerminal();

  const browser = await chromium.launch({
    headless: false,
    executablePath: resolvePlaywrightChromiumExecutablePath()
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(input.profileUrl, {
      waitUntil: "domcontentloaded"
    });

    console.log("Browser opened for manual login and profile review.");
    console.log("1. Complete login if needed.");
    console.log("2. Make sure the creator profile page is visible.");
    console.log("3. Press Enter here to start collecting visible notes.");

    await waitForEnter();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await autoScrollProfile(page, input.limit ?? 24);

    const draft = createCreatorDraft(page.url());
    const scrapedProfile = await scrapeCreatorProfile(page);
    const noteCards = await scrapeVisibleNoteCards(page, input.limit ?? 24);
    const creator = buildCreatorRecord(draft, scrapedProfile, noteCards.length);
    const notes = noteCards.map((card, index) => buildNoteRecord(creator.id, card, index, creator.collectedAt));

    await saveCreatorArchive({
      creator,
      notes
    });

    return {
      creator,
      notes,
      failedUrls: [],
      archiveRoot: `archives/${creator.id}`
    };
  } finally {
    await browser.close();
  }
}

function ensureInteractiveTerminal(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Real browser collection requires an interactive terminal. Run this command locally, or use --sample."
    );
  }
}

async function waitForEnter(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    await rl.question("");
  } finally {
    rl.close();
  }
}

async function autoScrollProfile(page: Page, limit: number): Promise<void> {
  const maxPasses = Math.max(3, Math.min(8, Math.ceil(limit / 4)));
  let previousCount = 0;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const currentCount = await countVisibleNoteLinks(page);

    if (currentCount >= limit || currentCount === previousCount) {
      break;
    }

    previousCount = currentCount;
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(800);
  }
}

async function countVisibleNoteLinks(page: Page): Promise<number> {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const urls = new Set<string>();

    for (const anchor of anchors) {
      const href = anchor.href;

      if (href.includes("/explore/") || href.includes("/discovery/item/")) {
        urls.add(href);
      }
    }

    return urls.size;
  });
}

async function scrapeCreatorProfile(page: Page): Promise<ScrapedCreatorProfile> {
  return page.evaluate(() => {
    let nickname: string | undefined;
    let bio: string | undefined;
    let avatarUrl: string | undefined;

    for (const selector of [
      "h1",
      "[data-testid='user-name']",
      ".user-name",
      ".nickname",
      ".author-name"
    ]) {
      const element = document.querySelector<HTMLElement>(selector);
      const text = element?.textContent?.trim();

      if (text) {
        nickname = text;
        break;
      }
    }

    for (const selector of [
      "[data-testid='user-desc']",
      ".user-desc",
      ".desc",
      ".bio",
      ".author-desc"
    ]) {
      const element = document.querySelector<HTMLElement>(selector);
      const text = element?.textContent?.trim();

      if (text) {
        bio = text;
        break;
      }
    }

    for (const selector of [
      "img[alt*='头像']",
      ".avatar img",
      ".user-avatar img",
      ".author-avatar img"
    ]) {
      const element = document.querySelector<HTMLImageElement>(selector);
      const source = element?.src?.trim();

      if (source) {
        avatarUrl = source;
        break;
      }
    }

    return {
      nickname,
      bio,
      avatarUrl
    };
  });
}

async function scrapeVisibleNoteCards(page: Page, limit: number): Promise<ScrapedNoteCard[]> {
  const cards = await page.evaluate((maxItems) => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const results: ScrapedNoteCard[] = [];
    const seen = new Set<string>();

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");

      if (!href) {
        continue;
      }

      let absoluteUrl = href;

      try {
        absoluteUrl = new URL(href, window.location.href).toString();
      } catch {
        absoluteUrl = href;
      }

      const isNoteUrl =
        absoluteUrl.includes("/explore/") || absoluteUrl.includes("/discovery/item/");

      if (!isNoteUrl || seen.has(absoluteUrl)) {
        continue;
      }

      const cardRoot =
        anchor.closest<HTMLElement>("[data-index]") ??
        anchor.closest<HTMLElement>("section") ??
        anchor.closest<HTMLElement>("article") ??
        anchor.closest<HTMLElement>("div");
      const cardText = cardRoot?.innerText?.trim() ?? anchor.innerText?.trim() ?? "";
      const textLines = cardText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const title = textLines[0] ?? anchor.getAttribute("title") ?? "未命名笔记";
      const snippet = textLines.slice(1).join("\n");
      const coverImageUrl =
        anchor.querySelector<HTMLImageElement>("img")?.src ??
        cardRoot?.querySelector<HTMLImageElement>("img")?.src;

      seen.add(absoluteUrl);
      results.push({
        sourceUrl: absoluteUrl,
        title,
        snippet,
        coverImageUrl
      });

      if (results.length >= maxItems) {
        break;
      }
    }

    return results;
  }, limit);

  return cards;
}

function buildCreatorRecord(
  draft: Creator,
  scrapedProfile: ScrapedCreatorProfile,
  noteCount: number
): Creator {
  const nickname = scrapedProfile.nickname?.trim() || draft.nickname;
  const creatorIdBase =
    extractStableCreatorSlug(draft.profileUrl) || scrapedProfile.nickname?.trim() || draft.id;
  const creatorId = sanitizeId(creatorIdBase) || draft.id;

  return {
    ...draft,
    id: creatorId,
    nickname,
    bio: scrapedProfile.bio,
    avatarUrl: scrapedProfile.avatarUrl,
    stats: {
      notes: noteCount
    }
  };
}

function buildNoteRecord(
  creatorId: string,
  card: ScrapedNoteCard,
  index: number,
  collectedAt: string
): Note {
  const noteId = deriveNoteId(card.sourceUrl, index);
  const media: NoteMedia[] = card.coverImageUrl
    ? [
        {
          id: `${noteId}-cover`,
          type: "image",
          sourceUrl: card.coverImageUrl,
          alt: card.title
        }
      ]
    : [];

  return {
    id: noteId,
    creatorId,
    platform: "xhs",
    sourceUrl: card.sourceUrl,
    title: card.title,
    content: card.snippet || "当前阶段仅采集列表卡片摘要，详情正文后续补充。",
    media,
    collectedAt,
    status: "partial"
  };
}

function deriveNoteId(sourceUrl: string, index: number): string {
  try {
    const url = new URL(sourceUrl);
    const segment = url.pathname.split("/").filter(Boolean).at(-1);

    if (segment) {
      return sanitizeId(segment);
    }
  } catch {
    return `note-${String(index + 1).padStart(3, "0")}`;
  }

  return `note-${String(index + 1).padStart(3, "0")}`;
}

function extractStableCreatorSlug(profileUrl: string): string | undefined {
  try {
    const url = new URL(profileUrl);
    return url.pathname.split("/").filter(Boolean).at(-1);
  } catch {
    return undefined;
  }
}
