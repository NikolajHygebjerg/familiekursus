import fs from "fs";
import path from "path";
import { syncFamilieloebAssignments, getAllFamilieloebHolds } from "../src/lib/airtable";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

async function main() {
  await syncFamilieloebAssignments();
  const holds = await getAllFamilieloebHolds();
  const klaus = holds
    .map((hold) => ({
      hold: hold.holdnavn,
      lines: hold.membersText
        .split("\n")
        .filter((line) => line.toLowerCase().includes("klaus") || line.toLowerCase().includes("trads")),
    }))
    .filter((item) => item.lines.length > 0);

  console.log("Familieløb gensynkroniseret.");
  for (const item of klaus) {
    console.log(`\n${item.hold}:`);
    for (const line of item.lines) console.log(`  ${line}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
