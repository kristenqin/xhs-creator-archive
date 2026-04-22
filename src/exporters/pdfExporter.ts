export type ExportPdfInput = {
  creatorId: string;
  template?: "timeline" | "print-compact";
};

export type ExportPdfResult = {
  htmlPath: string;
  pdfPath: string;
};

export async function exportCreatorPdf(_input: ExportPdfInput): Promise<ExportPdfResult> {
  throw new Error(
    "PDF export is not implemented yet. Next step: render local archive data to HTML, then print to PDF."
  );
}

