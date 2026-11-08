import fs from "fs";
import path from "path";

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

const AIRTABLE_BASE_ID = "appWYXnvNcnZS3yPu";
const TABLE_2026 = "tblbCaeQzsAhNQyF3";

type AirtableRecord = { id: string; fields: Record<string, unknown> };

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("missing api key");

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_2026}?maxRecords=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json();
  console.log("fields:", Object.keys(data.records?.[0]?.fields || {}));
  for (const rec of data.records || []) {
    console.log(JSON.stringify(rec.fields, null, 2));
  }
}

main();
