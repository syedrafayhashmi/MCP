import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const src = path.join(repoRoot, "frontend", "dist");
const dest = path.join(repoRoot, "backend", "public");

async function main() {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });

  await fs.cp(src, dest, { recursive: true });
  console.log(`Copied frontend build from ${src} to ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
