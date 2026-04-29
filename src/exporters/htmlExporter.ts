import fs from "node:fs/promises";
import path from "node:path";

import type { Creator, Note } from "../core/types.js";
import { getArchivePaths } from "../storage/archivePaths.js";

export type ExportHtmlBookInput = {
  creator: Creator;
  notes: Note[];
  template?: "timeline" | "print-compact";
};

export type ExportHtmlBookResult = {
  htmlPath: string;
};

export async function exportHtmlBook(input: ExportHtmlBookInput): Promise<ExportHtmlBookResult> {
  const template = input.template ?? "timeline";
  const archivePaths = getArchivePaths(input.creator.id);
  const htmlPath = path.join(archivePaths.exportsDir, "book.html");
  const html = renderHtmlBook(input.creator, input.notes, template);

  await fs.mkdir(archivePaths.exportsDir, { recursive: true });
  await fs.writeFile(htmlPath, html, "utf8");

  return { htmlPath };
}

function renderHtmlBook(
  creator: Creator,
  notes: Note[],
  template: "timeline" | "print-compact"
): string {
  const noteSections = notes
    .map((note, index) => {
      const mediaLabel =
        note.media.length > 0
          ? `<p class="note-media">媒体占位：${escapeHtml(note.media.map((media) => media.alt ?? media.type).join(" / "))}</p>`
          : "";

      return `
        <article class="note">
          <div class="note-index">${String(index + 1).padStart(2, "0")}</div>
          <div class="note-body">
            <h2>${escapeHtml(note.title)}</h2>
            <p class="note-meta">
              <span>发布时间：${formatDate(note.publishedAt ?? note.collectedAt)}</span>
              <span>状态：${escapeHtml(note.status)}</span>
            </p>
            <p>${escapeHtml(note.content)}</p>
            ${mediaLabel}
            <p class="note-source">来源：<a href="${escapeAttribute(note.sourceUrl)}">${escapeHtml(note.sourceUrl)}</a></p>
          </div>
        </article>
      `.trim();
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(creator.nickname)} - XHS Creator Archive</title>
    <style>
      :root {
        color-scheme: light;
        --page-bg: #f4f0e8;
        --card-bg: #fffdf8;
        --ink: #1e1d1a;
        --muted: #6f685c;
        --line: #d8ccbb;
        --accent: #9a3412;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Songti SC", "STSong", "Noto Serif SC", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top, rgba(154, 52, 18, 0.08), transparent 36%),
          linear-gradient(180deg, #f8f4ec 0%, var(--page-bg) 100%);
      }

      main {
        max-width: 860px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }

      .cover,
      .notice,
      .note {
        background: var(--card-bg);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: 0 18px 50px rgba(44, 36, 24, 0.08);
      }

      .cover,
      .notice {
        padding: 32px;
        margin-bottom: 24px;
      }

      .cover h1 {
        margin: 0 0 12px;
        font-size: 42px;
        line-height: 1.1;
      }

      .cover p,
      .notice p,
      .note p {
        line-height: 1.75;
      }

      .cover .meta,
      .note-meta,
      .note-source {
        color: var(--muted);
        font-size: 14px;
      }

      .cover .meta span,
      .note-meta span {
        display: inline-block;
        margin-right: 14px;
      }

      .section-title {
        margin: 42px 0 18px;
        font-size: 14px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .note {
        display: grid;
        grid-template-columns: 88px 1fr;
        gap: 0;
        overflow: hidden;
        margin-bottom: 18px;
      }

      .note-index {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 28px 12px;
        background: rgba(154, 52, 18, 0.08);
        color: var(--accent);
        font-size: 28px;
      }

      .note-body {
        padding: 26px 28px 28px;
      }

      .note-body h2 {
        margin: 0 0 12px;
        font-size: 28px;
      }

      .note-media {
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(111, 104, 92, 0.08);
        color: var(--muted);
      }

      a {
        color: inherit;
      }

      @media (max-width: 720px) {
        main {
          padding: 24px 14px 40px;
        }

        .cover h1 {
          font-size: 32px;
        }

        .note {
          grid-template-columns: 1fr;
        }

        .note-index {
          align-items: center;
          justify-content: flex-start;
          padding: 16px 20px 0;
          font-size: 18px;
        }
      }

      @media print {
        body {
          background: #fff;
        }

        main {
          max-width: none;
          padding: 0;
        }

        .cover,
        .notice,
        .note {
          box-shadow: none;
          break-inside: avoid;
        }

        .cover,
        .notice {
          min-height: ${template === "print-compact" ? "auto" : "80vh"};
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="cover">
        <p class="section-title">Creator Archive</p>
        <h1>${escapeHtml(creator.nickname)}</h1>
        <p>${escapeHtml(creator.bio ?? "暂无简介")}</p>
        <p class="meta">
          <span>博主 ID：${escapeHtml(creator.id)}</span>
          <span>采集时间：${formatDate(creator.collectedAt)}</span>
          <span>笔记数量：${notes.length}</span>
        </p>
        <p class="meta">主页链接：<a href="${escapeAttribute(creator.profileUrl)}">${escapeHtml(creator.profileUrl)}</a></p>
      </section>

      <section class="notice">
        <p class="section-title">Usage Notice</p>
        <p>本归档用于个人备份、稍后阅读和非商业打印。内容来源于当前账号正常可见页面，版权归原作者及相关权利人所有。</p>
        <p>第一版导出内容以文本时间线为主，图片与视频暂以占位信息呈现，后续接入真实采集后会补全本地媒体文件。</p>
      </section>

      <p class="section-title">Timeline</p>
      ${noteSections}
    </main>
  </body>
</html>
`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
