import { describe, expect, it } from "vitest";

import { isEditableTarget } from "@/lib/keyboard";

describe("isEditableTarget", () => {
  it.each(["input", "textarea", "select"])("recognizes %s controls", (tagName) => {
    expect(isEditableTarget(document.createElement(tagName))).toBe(true);
  });

  it("recognizes contenteditable targets and their descendants", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editable.append(child);
    document.body.append(editable);

    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(child)).toBe(true);
  });

  it("does not classify regular controls or missing targets as editable", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
