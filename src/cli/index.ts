import { createCreatorDraft } from "../core/project.js";

const [, , command, subCommandOrArg, ...rest] = process.argv;

function printHelp(): void {
  console.log(`
XHS Creator Archive

Usage:
  npm run collect -- <creator-profile-url>
  npm run export:pdf -- --creator <creator-id>

Current status:
  Project scaffold is ready. Collector and PDF exporter will be implemented next.
`);
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "collect") {
    const profileUrl = subCommandOrArg;

    if (!profileUrl) {
      throw new Error("Missing creator profile URL.");
    }

    const draft = createCreatorDraft(profileUrl);
    console.log("Creator archive draft:");
    console.log(JSON.stringify(draft, null, 2));
    console.log("Collector implementation will be added in the next development step.");
    return;
  }

  if (command === "export" && subCommandOrArg === "pdf") {
    const creatorFlagIndex = rest.indexOf("--creator");
    const creatorId = creatorFlagIndex >= 0 ? rest.at(creatorFlagIndex + 1) : undefined;

    if (!creatorId) {
      throw new Error("Missing --creator <creator-id>.");
    }

    console.log(`PDF export requested for creator: ${creatorId}`);
    console.log("PDF exporter implementation will be added in the next development step.");
    return;
  }

  printHelp();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

