import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { chromium, type BrowserContext, type BrowserContextOptions, type Page } from "playwright";

import { createCreatorDraft, sanitizeId } from "../core/project.js";
import { buildSampleArchive } from "../core/sampleData.js";
import type { Creator, Note, NoteMedia } from "../core/types.js";
import {
  resolvePersistentProfileDir,
  resolvePlaywrightChromiumExecutablePath
} from "../runtime/playwrightBrowser.js";
import { saveCreatorArchive } from "../storage/archiveStore.js";

export type CollectCreatorInput = {
  profileUrl: string;
  limit?: number;
  mode?: "sample" | "browser";
  linksOnly?: boolean;
  detailOnlyUrl?: string;
  debugDir?: string;
  profileDir?: string;
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

type ScrapedNoteDetail = {
  title?: string;
  content?: string;
  publishedAt?: string;
  mediaUrls: string[];
  authorName?: string;
  authorProfileUrl?: string;
  expectedNoteId?: string;
  actualNoteId?: string;
  resolvedUrl: string;
  pageKind: "note" | "login-wall" | "redirected" | "unknown";
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
  const profileDir = resolvePersistentProfileDir(input.profileDir);
  const contextOptions: BrowserContextOptions = {
    viewport: {
      width: 1440,
      height: 960
    }
  };
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    executablePath: resolvePlaywrightChromiumExecutablePath(),
    ...contextOptions
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();

    await page.goto(input.profileUrl, {
      waitUntil: "domcontentloaded"
    });

    console.log("Browser opened for manual login and profile review.");
    console.log(`Persistent profile dir: ${profileDir}`);
    console.log("1. Complete login if needed.");
    console.log("2. Make sure the creator profile page is visible.");
    console.log("3. Press Enter here to start collecting.");

    await waitForEnter();
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const draft = createCreatorDraft(page.url());
    const scrapedProfile = await scrapeCreatorProfile(page);
    const creator = buildCreatorRecord(draft, scrapedProfile, input.limit ?? 60);

    if (input.detailOnlyUrl) {
      const singleResult = await collectSingleNoteDetail(
        context,
        creator,
        creator.collectedAt,
        input.detailOnlyUrl,
        input.debugDir
      );

      await saveCreatorArchive({
        creator: {
          ...creator,
          stats: {
            notes: singleResult.notes.length
          }
        },
        notes: singleResult.notes
      });

      return {
        creator: {
          ...creator,
          stats: {
            notes: singleResult.notes.length
          }
        },
        notes: singleResult.notes,
        failedUrls: singleResult.failedUrls,
        archiveRoot: `archives/${creator.id}`
      };
    }

    const noteCards = await collectProfileNoteCards(page, input.limit ?? 60);
    await maybeWriteDebugJson(
      input.debugDir,
      "profile-note-links.json",
      noteCards
    );

    const creatorWithCount = buildCreatorRecord(draft, scrapedProfile, noteCards.length);

    if (input.linksOnly) {
      const notes = noteCards.map((card, index) =>
        buildLinksOnlyNoteRecord(creatorWithCount.id, card, index, creatorWithCount.collectedAt)
      );

      await saveCreatorArchive({
        creator: creatorWithCount,
        notes
      });

      return {
        creator: creatorWithCount,
        notes,
        failedUrls: [],
        archiveRoot: `archives/${creatorWithCount.id}`
      };
    }

    const { notes, failedUrls } = await collectNoteDetails(
      context,
      creatorWithCount,
      creatorWithCount.collectedAt,
      noteCards,
      input.debugDir
    );

    await saveCreatorArchive({
      creator: {
        ...creatorWithCount,
        stats: {
          notes: notes.length
        }
      },
      notes
    });

    return {
      creator: {
        ...creatorWithCount,
        stats: {
          notes: notes.length
        }
      },
      notes,
      failedUrls,
      archiveRoot: `archives/${creatorWithCount.id}`
    };
  } finally {
    await context.close();
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

async function collectProfileNoteCards(page: Page, limit: number): Promise<ScrapedNoteCard[]> {
  const cardsByUrl = new Map<string, ScrapedNoteCard>();
  let staleRounds = 0;
  let previousHeight = 0;
  const maxRounds = Math.max(12, Math.ceil(limit / 3));

  for (let round = 0; round < maxRounds; round += 1) {
    const visibleCards = await scanVisibleNoteCards(page, limit);
    const sizeBefore = cardsByUrl.size;

    for (const card of visibleCards) {
      if (!cardsByUrl.has(card.sourceUrl)) {
        cardsByUrl.set(card.sourceUrl, card);
      }
    }

    const sizeAfter = cardsByUrl.size;
    console.log(`Collected ${sizeAfter} unique note links from the profile page.`);

    if (sizeAfter >= limit) {
      break;
    }

    const metrics = await scrollProfilePage(page);

    if (sizeAfter === sizeBefore && metrics.scrollHeight === previousHeight) {
      staleRounds += 1;
    } else {
      staleRounds = 0;
    }

    previousHeight = metrics.scrollHeight;

    if (staleRounds >= 3 || metrics.reachedBottom) {
      break;
    }
  }

  return Array.from(cardsByUrl.values()).slice(0, limit);
}

async function scanVisibleNoteCards(page: Page, limit: number): Promise<ScrapedNoteCard[]> {
  return page.evaluate((maxItems) => {
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
}

async function scrollProfilePage(page: Page): Promise<{ scrollHeight: number; reachedBottom: boolean }> {
  return page.evaluate(async () => {
    const startY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const maxScrollSteps = 4;

    for (let step = 0; step < maxScrollSteps; step += 1) {
      window.scrollBy(0, Math.floor(viewportHeight * 0.9));
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    }

    const scrollHeight = document.documentElement.scrollHeight;
    const reachedBottom = window.scrollY + viewportHeight >= scrollHeight - 80;

    return {
      scrollHeight,
      reachedBottom: reachedBottom || window.scrollY === startY
    };
  });
}

async function collectSingleNoteDetail(
  context: BrowserContext,
  creator: Creator,
  collectedAt: string,
  noteUrl: string,
  debugDir: string | undefined
): Promise<{ notes: Note[]; failedUrls: string[] }> {
  const card: ScrapedNoteCard = {
    sourceUrl: noteUrl,
    title: "单篇详情调试",
    snippet: ""
  };

  return collectNoteDetails(context, creator, collectedAt, [card], debugDir);
}

async function collectNoteDetails(
  context: BrowserContext,
  creator: Creator,
  collectedAt: string,
  noteCards: ScrapedNoteCard[],
  debugDir: string | undefined
): Promise<{ notes: Note[]; failedUrls: string[] }> {
  const detailPage = await context.newPage();
  const notes: Note[] = [];
  const failedUrls: string[] = [];
  const targetProfileKey = extractStableCreatorSlug(creator.profileUrl);
  const targetNickname = creator.nickname.trim();

  try {
    for (let index = 0; index < noteCards.length; index += 1) {
      const card = noteCards[index];

      console.log(`Scraping note ${index + 1}/${noteCards.length}: ${card.sourceUrl}`);

      try {
        const detail = await scrapeNoteDetailWithRetry(
          detailPage,
          card.sourceUrl,
          debugDir,
          `${String(index + 1).padStart(3, "0")}-${deriveNoteId(card.sourceUrl, index)}`
        );

        if (detail.pageKind !== "note") {
          await maybeRecoverDetailPage(detailPage, detail, card.sourceUrl);
          const recoveredDetail = await scrapeNoteDetail(
            detailPage,
            card.sourceUrl,
            debugDir,
            `${String(index + 1).padStart(3, "0")}-${deriveNoteId(card.sourceUrl, index)}-manual-retry`
          );

          if (recoveredDetail.pageKind === "note") {
            if (!isTargetCreatorNote(recoveredDetail, targetProfileKey, targetNickname)) {
              console.log(`Skipping unrelated note after manual retry: ${card.sourceUrl}`);
              failedUrls.push(card.sourceUrl);
              continue;
            }

            notes.push(buildCollectedNoteRecord(creator.id, card, recoveredDetail, index, collectedAt));
            continue;
          }

          console.log(`Skipping invalid detail page (${detail.pageKind}): ${detail.resolvedUrl}`);
          failedUrls.push(card.sourceUrl);
          continue;
        }

        if (!isTargetCreatorNote(detail, targetProfileKey, targetNickname)) {
          console.log(`Skipping unrelated note: ${card.sourceUrl}`);
          failedUrls.push(card.sourceUrl);
          await maybeWriteDebugJson(debugDir, `${deriveNoteId(card.sourceUrl, index)}-author-mismatch.json`, {
            targetProfileUrl: creator.profileUrl,
            targetNickname,
            noteUrl: card.sourceUrl,
            detail
          });
          continue;
        }

        notes.push(buildCollectedNoteRecord(creator.id, card, detail, index, collectedAt));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Failed to scrape note detail: ${message}`);
        notes.push(buildFallbackNoteRecord(creator.id, card, index, collectedAt));
        failedUrls.push(card.sourceUrl);
      }
    }
  } finally {
    await detailPage.close();
  }

  return {
    notes,
    failedUrls
  };
}

async function scrapeNoteDetailWithRetry(
  page: Page,
  sourceUrl: string,
  debugDir: string | undefined,
  debugLabel: string
): Promise<ScrapedNoteDetail> {
  const attempts = 2;
  let lastDetail: ScrapedNoteDetail | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const detail = await scrapeNoteDetail(page, sourceUrl, debugDir, `${debugLabel}-attempt-${attempt + 1}`);
    lastDetail = detail;

    if (detail.pageKind === "note") {
      return detail;
    }

    await page.waitForTimeout(1200);
  }

  if (!lastDetail) {
    throw new Error(`Unable to open detail page: ${sourceUrl}`);
  }

  return lastDetail;
}

async function scrapeNoteDetail(
  page: Page,
  sourceUrl: string,
  debugDir: string | undefined,
  debugLabel: string
): Promise<ScrapedNoteDetail> {
  await page.goto(sourceUrl, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1200);

  const detail: ScrapedNoteDetail = await page.evaluate(() => {
    let title: string | undefined;
    let content: string | undefined;
    let publishedAt: string | undefined;
    let authorName: string | undefined;
    let authorProfileUrl: string | undefined;
    const mediaUrls: string[] = [];
    const seenMedia = new Set<string>();
    const resolvedUrl = window.location.href;
    const bodyText = document.body.innerText;
    const loginWallDetected =
      bodyText.includes("登录后") ||
      bodyText.includes("扫码登录") ||
      bodyText.includes("二维码登录") ||
      bodyText.includes("请先登录");
    const noteUrlDetected =
      resolvedUrl.includes("/explore/") || resolvedUrl.includes("/discovery/item/");
    const profileUrlDetected = resolvedUrl.includes("/user/profile/");
    const expectedMatch = window.location.pathname.match(/(?:explore|discovery\/item)\/([^/?#]+)/);
    const actualNoteId = expectedMatch?.[1];
    let pageKind: "note" | "login-wall" | "redirected" | "unknown" = "unknown";

    if (loginWallDetected) {
      pageKind = "login-wall";
    } else if (profileUrlDetected && !noteUrlDetected) {
      pageKind = "redirected";
    } else if (noteUrlDetected) {
      pageKind = "note";
    }

    for (const selector of [
      "h1",
      "[data-testid='note-title']",
      ".title",
      ".note-title",
      ".desc-title"
    ]) {
      const element = document.querySelector<HTMLElement>(selector);
      const text = element?.textContent?.trim();

      if (text) {
        title = text;
        break;
      }
    }

    for (const selector of [
      "[data-testid='note-content']",
      ".note-content",
      ".content",
      ".desc",
      ".note-desc",
      "article"
    ]) {
      const element = document.querySelector<HTMLElement>(selector);
      const text = element?.innerText?.trim();

      if (text && text.length >= 8) {
        content = text;
        break;
      }
    }

    for (const selector of [
      "time",
      "[data-testid='publish-time']",
      ".publish-time",
      ".date",
      ".note-date"
    ]) {
      const element = document.querySelector<HTMLElement>(selector);
      const text = element?.textContent?.trim();
      const datetime = element?.getAttribute("datetime")?.trim();

      if (datetime) {
        publishedAt = datetime;
        break;
      }

      if (text) {
        publishedAt = text;
        break;
      }
    }

    if (!publishedAt) {
      const match = bodyText.match(/\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日/);

      if (match) {
        publishedAt = match[0];
      }
    }

    const authorAnchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href*='/user/profile/']")
    );

    for (const anchor of authorAnchors) {
      const href = anchor.href?.trim();
      const text = anchor.textContent?.trim();

      if (href && !authorProfileUrl) {
        authorProfileUrl = href;
      }

      if (text && !authorName) {
        authorName = text;
      }

      if (authorProfileUrl && authorName) {
        break;
      }
    }

    const images = Array.from(document.querySelectorAll<HTMLImageElement>("img"));

    for (const image of images) {
      const candidates = [
        image.currentSrc,
        image.src,
        image.getAttribute("data-src") ?? "",
        image.getAttribute("data-original") ?? "",
        image.getAttribute("data-xhs-img") ?? ""
      ];
      const altText = `${image.alt ?? ""} ${
        typeof image.className === "string" ? image.className : ""
      }`.toLowerCase();
      const width = image.naturalWidth || image.width || 0;
      const height = image.naturalHeight || image.height || 0;
      const decorative =
        altText.includes("avatar") ||
        altText.includes("头像") ||
        altText.includes("icon") ||
        altText.includes("logo") ||
        altText.includes("emoji") ||
        altText.includes("二维码") ||
        (width > 0 && width < 120 && height > 0 && height < 120);

      if (decorative) {
        continue;
      }

      for (const candidate of candidates) {
        const source = candidate.trim();

        if (!source || source.startsWith("data:")) {
          continue;
        }

        if (seenMedia.has(source)) {
          continue;
        }

        seenMedia.add(source);
        mediaUrls.push(source);
      }
    }

    return {
      title,
      content,
      publishedAt,
      mediaUrls,
      authorName,
      authorProfileUrl,
      actualNoteId,
      resolvedUrl,
      pageKind
    };
  });

  detail.expectedNoteId = extractNoteIdFromUrl(sourceUrl);

  if (
    detail.pageKind === "note" &&
    detail.expectedNoteId &&
    detail.actualNoteId &&
    detail.expectedNoteId !== detail.actualNoteId
  ) {
    detail.pageKind = "redirected";
  }

  if (debugDir && detail.pageKind !== "note") {
    await writeDebugSnapshot(page, debugDir, debugLabel, {
      sourceUrl,
      detail
    });
  }

  return detail;
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

function buildCollectedNoteRecord(
  creatorId: string,
  card: ScrapedNoteCard,
  detail: ScrapedNoteDetail,
  index: number,
  collectedAt: string
): Note {
  const noteId = deriveNoteId(card.sourceUrl, index);
  const imageSources = detail.mediaUrls.length > 0
    ? detail.mediaUrls
    : card.coverImageUrl
      ? [card.coverImageUrl]
      : [];
  const media: NoteMedia[] = imageSources.map((sourceUrl, mediaIndex) => ({
    id: `${noteId}-image-${String(mediaIndex + 1).padStart(3, "0")}`,
    type: "image",
    sourceUrl,
    alt: detail.title || card.title
  }));

  return {
    id: noteId,
    creatorId,
    platform: "xhs",
    sourceUrl: card.sourceUrl,
    title: detail.title || card.title,
    content: detail.content || card.snippet || "未能提取到正文，保留了列表摘要。",
    media,
    publishedAt: normalizePublishedAt(detail.publishedAt),
    collectedAt,
    status: detail.content || media.length > 1 ? "collected" : "partial"
  };
}

function buildLinksOnlyNoteRecord(
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
    content: card.snippet || "仅保存链接与卡片摘要，用于快速测试列表抓取。",
    media,
    collectedAt,
    status: "partial"
  };
}

function buildFallbackNoteRecord(
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
    content: card.snippet || "详情页抓取失败，当前仅保留列表摘要。",
    media,
    collectedAt,
    status: "failed"
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

function normalizePublishedAt(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const direct = Date.parse(trimmed);

  if (!Number.isNaN(direct)) {
    return new Date(direct).toISOString();
  }

  const normalized = trimmed
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "")
    .replace(/\//g, "-")
    .replace(/\./g, "-");
  const parsed = Date.parse(normalized);

  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return trimmed;
}

function isTargetCreatorNote(
  detail: ScrapedNoteDetail,
  targetProfileKey: string | undefined,
  targetNickname: string
): boolean {
  const detailProfileKey = extractStableCreatorSlug(detail.authorProfileUrl ?? "");

  if (targetProfileKey && detailProfileKey) {
    return targetProfileKey === detailProfileKey;
  }

  if (detail.authorName?.trim()) {
    return detail.authorName.trim() === targetNickname;
  }

  return true;
}

async function maybeRecoverDetailPage(
  page: Page,
  detail: ScrapedNoteDetail,
  sourceUrl: string
): Promise<void> {
  if (detail.pageKind !== "login-wall" && detail.pageKind !== "redirected" && detail.pageKind !== "unknown") {
    return;
  }

  console.log("");
  console.log(`Detail page needs manual recovery for: ${sourceUrl}`);
  console.log(`Detected page kind: ${detail.pageKind}`);
  console.log(`Current page URL: ${detail.resolvedUrl}`);
  console.log("If a login QR code or redirect page is visible, complete the step in the browser now.");
  console.log("Then press Enter here to retry this same note once.");
  await waitForEnter();
}

function extractNoteIdFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.pathname.split("/").filter(Boolean).at(-1);
  } catch {
    return undefined;
  }
}

async function maybeWriteDebugJson(
  debugDir: string | undefined,
  fileName: string,
  value: unknown
): Promise<void> {
  if (!debugDir) {
    return;
  }

  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(
    path.join(debugDir, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

async function writeDebugSnapshot(
  page: Page,
  debugDir: string,
  label: string,
  metadata: unknown
): Promise<void> {
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(
    path.join(debugDir, `${label}.html`),
    await page.content(),
    "utf8"
  );
  await page.screenshot({
    path: path.join(debugDir, `${label}.png`),
    fullPage: true
  });
  await fs.writeFile(
    path.join(debugDir, `${label}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );
}
