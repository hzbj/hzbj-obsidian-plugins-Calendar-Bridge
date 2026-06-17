import esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const outdir = ".test-dist";
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const tests = readdirSync("tests").filter((name) => name.endsWith(".test.ts"));
for (const testFile of tests) {
  await esbuild.build({
    entryPoints: [join("tests", testFile)],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile: join(outdir, testFile.replace(".ts", ".cjs")),
    external: ["obsidian"]
  });
}

const result = spawnSync(
  process.execPath,
  ["--test", ...tests.map((name) => join(outdir, name.replace(".ts", ".cjs")))],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
