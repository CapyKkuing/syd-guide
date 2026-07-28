import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseLegacySources } from "./parse.mjs";
import { renderLegacySql } from "./render-sql.mjs";

const sourceNames = [
  "schedule.html",
  "food.html",
  "cafe.html",
  "booking.html",
  "tips.html"
];

export async function writeLegacySeed({
  rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  outputPath = path.join(rootDir, ".tmp", "legacy-sydney.sql")
} = {}) {
  const sources = Object.fromEntries(await Promise.all(sourceNames.map(
    async (name) => [
      name,
      await readFile(path.join(rootDir, name), "utf8")
    ]
  )));
  const data = parseLegacySources(sources);
  const sql = renderLegacySql(data);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, "utf8");
  return { outputPath, data, bytes: Buffer.byteLength(sql) };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";

if (invokedPath === import.meta.url) {
  const result = await writeLegacySeed();
  console.log(
    `legacy seed: ${result.data.days.length}/` +
    `${result.data.food.length}/${result.data.cafes.length}/` +
    `${result.data.bookings.length}/${result.data.tips.length} ` +
    `-> ${result.outputPath} (${result.bytes} bytes)`
  );
}
