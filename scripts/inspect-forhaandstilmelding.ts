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
const TABLE = "Forhåndstilmelding";

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("missing api key");

  const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
  const meta = (await metaRes.json()) as {
    tables?: { id: string; name?: string; fields?: { name: string; type: string }[] }[];
    error?: unknown;
  };

  if (!metaRes.ok) {
    console.log("Meta API failed:", metaRes.status, JSON.stringify(meta.error ?? meta));
  } else {
    const table = (meta.tables ?? []).find((t) => t.name === TABLE);
    if (!table) {
      console.log(
        "Tables:",
        (meta.tables ?? []).map((t) => t.name).join(", ")
      );
      return;
    }
    console.log("Schema fields:");
    for (const f of table.fields ?? []) {
      console.log(`- ${f.name} (${f.type})`);
    }
  }

  const dataUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE)}?maxRecords=3`;
  const dataRes = await fetch(dataUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = (await dataRes.json()) as { records?: { fields: Record<string, unknown> }[]; error?: unknown };
  if (!dataRes.ok) {
    console.log("Data API failed:", dataRes.status, JSON.stringify(data.error ?? data));
    return;
  }
  console.log("\nRecord field keys:");
  for (const rec of data.records ?? []) {
    console.log("-", Object.keys(rec.fields).join(", ") || "(empty)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
