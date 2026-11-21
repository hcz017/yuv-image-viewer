import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_TITLE,
  deleteConfirmMessage,
  selectionPath,
  windowTitle,
} from "../common/listActions";

test("window title carries the open file name only in single view", () => {
  assert.equal(windowTitle(null), APP_TITLE);
  assert.equal(windowTitle("   "), APP_TITLE);
  assert.equal(windowTitle("frame.nv12"), `${APP_TITLE} - frame.nv12`);
});

test("rename and delete shortcuts act on the current selection", () => {
  assert.equal(selectionPath([]), null);
  assert.equal(selectionPath(["/tmp/a.nv12"]), "/tmp/a.nv12");
  assert.equal(selectionPath(["/tmp/a.nv12", "/tmp/b.nv12"]), null);
});

test("delete confirmation names one file and counts many", () => {
  assert.equal(deleteConfirmMessage([]), null);
  assert.equal(deleteConfirmMessage(["a.nv12"]), "确定将「a.nv12」移到回收站吗？");
  assert.equal(deleteConfirmMessage(["a.nv12", "b.nv12"]), "确定将这 2 个文件移到回收站吗？");
});
