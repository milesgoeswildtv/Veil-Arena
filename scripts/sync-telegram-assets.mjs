import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(process.cwd(), "assets/telegram");
const destination = resolve(process.cwd(), "public/telegram");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const entries = await readdir(source, { withFileTypes: true });
const files = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".svg"));

for (const entry of files) {
  await cp(resolve(source, entry.name), resolve(destination, entry.name));
}

console.log(`Copied ${files.length} Telegram SVG assets into public/telegram.`);
