import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { extname, resolve } from "node:path";

const source = resolve(process.cwd(), "assets/telegram");
const destination = resolve(process.cwd(), "public/telegram");
const supportedExtensions = new Set([".svg", ".png"]);

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

let copied = 0;

async function copySupportedTree(fromDir, toDir) {
  await mkdir(toDir, { recursive: true });
  const entries = await readdir(fromDir, { withFileTypes: true });

  for (const entry of entries) {
    const from = resolve(fromDir, entry.name);
    const to = resolve(toDir, entry.name);

    if (entry.isDirectory()) {
      await copySupportedTree(from, to);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!supportedExtensions.has(extname(entry.name).toLowerCase())) continue;

    await cp(from, to);
    copied += 1;
  }
}

await copySupportedTree(source, destination);

console.log(`Copied ${copied} Telegram visual assets into public/telegram.`);
