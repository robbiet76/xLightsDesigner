import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createSequenceBackup,
  renderCurrentSummary
} from "../../../../scripts/sequencing/native/apply-native-review.mjs";

test("createSequenceBackup copies xsq into project artifact backups", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-native-review-"));
  const projectDir = path.join(root, "Project");
  const showDir = path.join(root, "Show");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(showDir, { recursive: true });
  const projectFile = path.join(projectDir, "Project.xdproj");
  const sequencePath = path.join(showDir, "HolidayRoad.xsq");
  fs.writeFileSync(projectFile, JSON.stringify({ projectName: "Project" }), "utf8");
  fs.writeFileSync(sequencePath, "<xsequence>before</xsequence>", "utf8");

  const backupPath = createSequenceBackup({
    projectFile,
    sequencePath,
    revision: "rev:1/unsafe"
  });

  assert.equal(path.dirname(backupPath), path.join(projectDir, "artifacts", "backups"));
  assert.match(path.basename(backupPath), /^HolidayRoad-preapply-/);
  assert.match(path.basename(backupPath), /rev-1-unsafe\.xsq$/);
  assert.equal(fs.readFileSync(backupPath, "utf8"), "<xsequence>before</xsequence>");
});

test("renderCurrentSummary prefers rendered sequence path", () => {
  assert.equal(
    renderCurrentSummary({
      data: {
        rendered: true,
        sequence: {
          path: "/show/HolidayRoad.xsq"
        }
      }
    }),
    "Rendered xLights sequence: /show/HolidayRoad.xsq"
  );
  assert.equal(renderCurrentSummary({ data: { rendered: true } }), "Rendered current xLights sequence.");
});
