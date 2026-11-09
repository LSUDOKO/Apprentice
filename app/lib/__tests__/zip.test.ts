import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { crc32, zipFiles } from "../zip";

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("produces an archive that unzip accepts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zip-"));
    const file = path.join(dir, "skill.zip");
    writeFileSync(file, zipFiles([{ path: "s/SKILL.md", content: "# Hi ✓" }, { path: "s/playbook.json", content: "{}" }]));
    const listing = execFileSync("unzip", ["-l", file]).toString();
    expect(listing).toContain("s/SKILL.md");
    expect(execFileSync("unzip", ["-p", file, "s/SKILL.md"]).toString()).toBe("# Hi ✓");
  });
});
