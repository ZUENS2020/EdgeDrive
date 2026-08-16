import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  en,
  htmlLang,
  interpolate,
  parseLocale,
  t,
  translate,
  zh,
} from "./i18n";

describe("i18n dictionaries", () => {
  it("has matching zh/en keys", () => {
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(zhKeys);
    expect(zhKeys.length).toBeGreaterThan(50);
    for (const key of zhKeys) {
      expect(zh[key as keyof typeof zh].length).toBeGreaterThan(0);
      expect(en[key as keyof typeof en].length).toBeGreaterThan(0);
    }
  });

  it("translates known keys and interpolates vars", () => {
    expect(t("zh", "fileManager.upload")).toBe("上传");
    expect(t("en", "fileManager.upload")).toBe("Upload");
    expect(t("zh", "batchPage.title", { count: 3 })).toBe("3 个文件");
    expect(t("en", "batchPage.title", { count: 3 })).toBe("3 files");
    expect(t("zh", "fileManager.folderDeleteBody", { name: "资料" })).toContain("「资料」");
    expect(t("en", "fileManager.folderDeleteBody", { name: "docs" })).toContain('"docs"');
  });

  it("falls back to zh then the key itself", () => {
    expect(translate("en", "missing.key")).toBe("missing.key");
    expect(translate("zh", "missing.key")).toBe("missing.key");
    const dict = en as Record<string, string>;
    const prev = dict["nav.files"];
    try {
      delete dict["nav.files"];
      expect(translate("en", "nav.files")).toBe(zh["nav.files"]);
    } finally {
      dict["nav.files"] = prev;
    }
  });

  it("keeps unknown placeholders", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
    expect(interpolate("Hello {name}", { name: "Ada" })).toBe("Hello Ada");
  });
});

describe("parseLocale", () => {
  it("defaults to zh and accepts en", () => {
    expect(DEFAULT_LOCALE).toBe("zh");
    expect(parseLocale(undefined)).toBe("zh");
    expect(parseLocale("")).toBe("zh");
    expect(parseLocale("zh")).toBe("zh");
    expect(parseLocale("ZH-CN")).toBe("zh");
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("en-US")).toBe("en");
    expect(parseLocale("fr")).toBe("zh");
    expect(htmlLang("zh")).toBe("zh-CN");
    expect(htmlLang("en")).toBe("en");
  });
});
