import { readdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve("dist");
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      if (entry.name.endsWith(".js"))
        execFileSync(process.execPath, ["--check", path], { stdio: "inherit" });
      if (entry.name.endsWith(".html")) {
        const source = await readFile(path, "utf8");
        for (const [, reference] of source.matchAll(
          /(?:src|href)="([^"#]+)"/g,
        )) {
          if (/^(https?:|data:|mailto:)/.test(reference)) continue;
          const target = reference.endsWith("/")
            ? reference + "index.html"
            : reference;
          await readFile(resolve(dirname(path), target));
        }
        if (
          !source.includes('lang="ko"') ||
          !source.includes('name="viewport"')
        )
          throw new Error("Missing document metadata");
      }
    }
  }
}
await walk(root);
console.log("Static asset references and JavaScript syntax: PASS");
