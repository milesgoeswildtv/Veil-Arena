import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(process.cwd(), "assets/telegram");
const destination = resolve(process.cwd(), "public/telegram");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const entries = await readdir(source, { withFileTypes: true });
const supportedExtensions = new Set([".svg", ".png"]);
const files = entries.filter(entry => {
  if (!entry.isFile()) return false;
  const name = entry.name.toLowerCase();
  return [...supportedExtensions].some(extension => name.endsWith(extension));
});

for (const entry of files) {
  await cp(resolve(source, entry.name), resolve(destination, entry.name));
}

console.log(`Copied ${files.length} Telegram visual assets into public/telegram.`);
