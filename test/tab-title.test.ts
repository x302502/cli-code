import { describe, expect, it } from "bun:test"
import { formatPromptTitle, isMeaningfulOscTitle, resolveTabTitle } from "../src/lib/tab-title.js"

describe("formatPromptTitle — Orca's generated-tab-title rule (40 chars, first clause, ellipsis)", () => {
  it("keeps short prompts, capitalised", () => {
    expect(formatPromptTitle("hello world")).toBe("Hello world")
    expect(formatPromptTitle("sửa bug đăng nhập")).toBe("Sửa bug đăng nhập")
  })
  it("cuts at a word boundary after 40 chars and appends …", () => {
    expect(formatPromptTitle("Rồi bây giờ bạn xóa cms-demo và làm lại toàn bộ phần đăng nhập")).toBe("Rồi bây giờ bạn xóa cms demo và làm lại…")
    expect(formatPromptTitle("a".repeat(40))).toBe("A" + "a".repeat(39))
    expect(formatPromptTitle("a".repeat(41))).toBe("A" + "a".repeat(39) + "…")
    // A space too early in the string is ignored, otherwise the title loses too much.
    expect(formatPromptTitle("run demo-with-a-very-long-flag-that-keeps-going-on")).toBe("Run demo with a very long flag that…")
  })
  it("takes the first clause and drops URLs, markdown punctuation and leading filler", () => {
    expect(formatPromptTitle("Review PR này https://github.com/foo/bar/very/long/path/indeed and deploy")).toBe("Review PR này and deploy")
    expect(formatPromptTitle("Fix the login bug. Then merge it.")).toBe("Fix the login bug")
    expect(formatPromptTitle("Can you please fix the **login** bug? It breaks on iOS")).toBe("Fix the login bug")
    expect(formatPromptTitle("Issue #42: add `retry` to the client")).toBe("Add retry to the client")
    expect(formatPromptTitle("let's refactor   the	parser")).toBe("Refactor the parser")
  })
  it("strips slash commands like /goal, /clear, /plan and [Pasted text #…]", () => {
    expect(formatPromptTitle("/goal fix auth bugs")).toBe("Fix auth bugs")
    expect(formatPromptTitle("/clear")).toBe("")
    expect(formatPromptTitle("Check this code\n[Pasted text #3 +14 lines]")).toBe("Check this code")
  })
  it("handles empty or single char inputs", () => {
    expect(formatPromptTitle("")).toBe("")
    expect(formatPromptTitle("a")).toBe("")
    expect(formatPromptTitle("   ")).toBe("")
  })
})

describe("isMeaningfulOscTitle", () => {
  it("bỏ tiêu đề rỗng và tên shell", () => {
    expect(isMeaningfulOscTitle("")).toBe(false)
    expect(isMeaningfulOscTitle("   ")).toBe(false)
    expect(isMeaningfulOscTitle("zsh")).toBe(false)
    expect(isMeaningfulOscTitle("bash")).toBe(false)
    expect(isMeaningfulOscTitle("powershell.exe")).toBe(false)
  })

  it("bỏ tiêu đề chỉ là đường dẫn thư mục", () => {
    expect(isMeaningfulOscTitle("/Volumes/Data/itsme/study")).toBe(false)
    expect(isMeaningfulOscTitle("~/study/ai")).toBe(false)
  })

  it("giữ tiêu đề do CLI đặt", () => {
    expect(isMeaningfulOscTitle("Claude • sửa bug đăng nhập")).toBe(true)
    expect(isMeaningfulOscTitle("codex: refactor auth")).toBe(true)
  })
})

describe("resolveTabTitle", () => {
  const toolLabel = "Claude Code"

  it("tên do user đặt thắng tất cả", () => {
    expect(
      resolveTabTitle({ customTitle: "Tab của tôi", oscTitle: "Claude • abc", promptTitle: "xyz", toolLabel }),
    ).toBe("Tab của tôi")
  })

  it("tên lệnh nhanh thắng OSC/prompt nhưng thua tên do user đặt", () => {
    expect(resolveTabTitle({ quickCommandLabel: "Test", oscTitle: "Claude • abc", promptTitle: "xyz", toolLabel })).toBe(
      "Test",
    )
    expect(
      resolveTabTitle({ customTitle: "Tab của tôi", quickCommandLabel: "Test", toolLabel }),
    ).toBe("Tab của tôi")
  })

  it("kế đến là OSC title nếu có nghĩa", () => {
    expect(resolveTabTitle({ oscTitle: "Claude • abc", promptTitle: "xyz", toolLabel })).toBe("Claude • abc")
  })

  it("bỏ qua OSC title vô nghĩa và dùng tiêu đề từ prompt", () => {
    expect(resolveTabTitle({ oscTitle: "zsh", promptTitle: "sửa bug", toolLabel })).toBe("sửa bug")
  })

  it("cuối cùng lùi về nhãn của tool", () => {
    expect(resolveTabTitle({ toolLabel })).toBe("Claude Code")
    expect(resolveTabTitle({ oscTitle: "  ", promptTitle: "", toolLabel })).toBe("Claude Code")
  })
})

describe("OSC title prompt prefixes", () => {
  it("strips a leading prompt marker some CLIs (Cline) put in the title", () => {
    expect(resolveTabTitle({ oscTitle: "> hello", toolLabel: "Cline" })).toBe("hello")
    expect(resolveTabTitle({ oscTitle: "❯  sửa bug", toolLabel: "Cline" })).toBe("sửa bug")
    expect(resolveTabTitle({ oscTitle: "$ ", toolLabel: "Cline" })).toBe("Cline")
    expect(resolveTabTitle({ oscTitle: "Review PR", toolLabel: "Cline" })).toBe("Review PR")
    // status glyphs / spinners some CLIs put in front (Claude ✳, Gemini ✦, braille spinner)
    expect(resolveTabTitle({ oscTitle: "✳ sửa bug đăng nhập", toolLabel: "Claude" })).toBe("sửa bug đăng nhập")
    expect(resolveTabTitle({ oscTitle: "⠋ Grok", toolLabel: "Grok" })).toBe("Grok")
    expect(resolveTabTitle({ oscTitle: "* thinking", toolLabel: "X" })).toBe("thinking")
  })
  it("caps long OSC titles at 40 chars with …, but never touches a title the user typed", () => {
    const long = "Refactor the authentication flow so tokens refresh silently"
    expect(resolveTabTitle({ oscTitle: long, toolLabel: "X" })).toBe("Refactor the authentication flow so…")
    expect(resolveTabTitle({ customTitle: long, toolLabel: "X" })).toBe(long)
  })
})
