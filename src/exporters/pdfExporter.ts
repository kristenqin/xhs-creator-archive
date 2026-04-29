import fs from "node:fs/promises";
import path from "node:path";

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

  await fs.writeFile(
    pdfPath,
    [
      "PDF placeholder",
      `creatorId=${input.creatorId}`,
      `template=${input.template ?? "timeline"}`,
      `generatedAt=${new Date().toISOString()}`,
      `htmlPath=${htmlPath}`,
      "Next step: replace this placeholder with real browser-based PDF printing."
    ].join("\n"),
    "utf8"
  );

  return {
    htmlPath,
    pdfPath
  };
}
