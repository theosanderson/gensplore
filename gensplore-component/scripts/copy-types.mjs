import { readFile, writeFile } from "node:fs/promises";
const declarations = await readFile(new URL("../src/index.d.ts", import.meta.url), "utf8");
await writeFile(new URL("../dist/index.d.ts", import.meta.url), declarations);
await writeFile(new URL("../dist/index.d.cts", import.meta.url), declarations
  .replace("export interface GensploreProps", "interface GensploreProps")
  .replace("export default function Gensplore", "declare function Gensplore") + "\nexport = Gensplore;\n");
