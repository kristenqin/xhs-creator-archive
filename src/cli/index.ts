import { collectCreator } from "../collectors/xhsCollector.js";
import { exportCreatorPdf } from "../exporters/pdfExporter.js";

const [, , command, subCommandOrArg, ...rest] = process.argv;
const supportedTemplates = ["timeline", "print-compact"] as const;
type SupportedTemplate = (typeof supportedTemplates)[number];

function printHelp(): void {
  console.log(`
XHS Creator Archive

Usage:
  npm run collect -- <creator-profile-url> [--sample] [--limit 12]
  npm run export:pdf -- --creator <creator-id>

Current status:
  Real browser collection is available for visible note-card capture.
`);
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "collect") {
    const profileUrl = subCommandOrArg;
    const sampleMode = rest.includes("--sample");
    const limitFlagIndex = rest.indexOf("--limit");
    const limitValue = limitFlagIndex >= 0 ? rest.at(limitFlagIndex + 1) : undefined;

    if (!profileUrl) {
      throw new Error("Missing creator profile URL.");
    }

    if (limitValue && !/^\d+$/.test(limitValue)) {
      throw new Error("Invalid --limit value. Use a positive integer.");
    }

    const result = await collectCreator({
      profileUrl,
      mode: sampleMode ? "sample" : "browser",
      limit: limitValue ? Number(limitValue) : undefined
    });

    console.log(`Created local archive for ${result.creator.nickname} (${result.creator.id})`);
    console.log(`Archive path: ${result.archiveRoot}`);
    console.log(`Saved notes: ${result.notes.length}`);
    console.log(
      sampleMode
        ? "Collection completed in sample mode."
        : "Collection completed from the visible browser page."
    );
    return;
  }

  if (command === "export" && subCommandOrArg === "pdf") {
    const creatorFlagIndex = rest.indexOf("--creator");
    const creatorId = creatorFlagIndex >= 0 ? rest.at(creatorFlagIndex + 1) : undefined;
    const templateFlagIndex = rest.indexOf("--template");
    const templateValue = templateFlagIndex >= 0 ? rest.at(templateFlagIndex + 1) : undefined;

    if (!creatorId) {
      throw new Error("Missing --creator <creator-id>.");
    }

    if (templateValue && !isSupportedTemplate(templateValue)) {
      throw new Error("Invalid --template value. Use timeline or print-compact.");
    }

    const resolvedTemplate = resolveTemplate(templateValue);
    const result = await exportCreatorPdf({
      creatorId,
      template: resolvedTemplate
    });

    console.log(`Exported book for creator: ${creatorId}`);
    console.log(`HTML path: ${result.htmlPath}`);
    console.log(`PDF path: ${result.pdfPath}`);
    console.log("Generated a real PDF from the local HTML archive.");
    return;
  }

  printHelp();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

function isSupportedTemplate(value: string): value is SupportedTemplate {
  return supportedTemplates.includes(value as SupportedTemplate);
}

function resolveTemplate(value: string | undefined): SupportedTemplate | undefined {
  if (!value) {
    return undefined;
  }

  return isSupportedTemplate(value) ? value : undefined;
}
