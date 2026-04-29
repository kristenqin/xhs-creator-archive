import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { resolvePlaywrightChromiumExecutablePath } from "../runtime/playwrightBrowser.js";
import { readCreatorArchive } from "../storage/archiveStore.js";
import { exportHtmlBook } from "./htmlExporter.js";

export type ExportPdfInput = {
  creatorId: string;
  template?: "timeline" | "print-compact";
};

export type ExportPdfResult = {
  htmlPath: string;
  pdfPath: string;
};

export async function exportCreatorPdf(input: ExportPdfInput): Promise<ExportPdfResult> {
  const archive = await readCreatorArchive(input.creatorId);
  const { htmlPath } = await exportHtmlBook({
    creator: archive.creator,
    notes: archive.notes,
    template: input.template
  });
  const pdfPath = path.join(path.dirname(htmlPath), "book.pdf");
  const browser = await chromium.launch({
    executablePath: resolvePlaywrightChromiumExecutablePath()
  });

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, {
      waitUntil: "networkidle"
    });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "16mm",
        right: "14mm",
        bottom: "18mm",
        left: "14mm"
      }
    });
  } finally {
    await browser.close();
  }

  return {
    htmlPath,
    pdfPath
  };
}
