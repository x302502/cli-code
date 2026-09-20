import { describe, expect, it } from "bun:test"
import { formatPromptTitle, isMeaningfulOscTitle, resolveTabTitle } from "../src/lib/tab-title.js"

describe("formatPromptTitle", () => {
  it("formats regular prompt strings", () => {
    expect(formatPromptTitle("hello world")).toBe("hello world")
    expect(formatPromptTitle("Review PR này, https://github.com/foo/bar/very/long/path/indeed")).toBe(
      "Review PR này,…",
    )
  })

  it("cuts long titles at a word boundary", () => {
    expect(formatPromptTitle("Rồi bây giờ bạn xóa cms-demo và làm lại")).toBe("Rồi bây giờ bạn xóa…")
    // Exactly at the cap stays whole.
    expect(formatPromptTitle("a".repeat(20))).toBe("a".repeat(20))
  })

  it("falls back to a hard cut when there is no usable word boundary", () => {
    expect(formatPromptTitle("Data/itsme/study/ai/sdlc-ts")).toBe("Data/itsme/study/ai/…")
    // A space too early in the string is ignored, otherwise the title loses too much.
    expect(formatPromptTitle("run demo-with-a-very-long-flag")).toBe("run demo-with-a-very…")
  })

  it("strips slash commands like /goal, /clear, /plan", () => {
    expect(formatPromptTitle("/goal fix auth bugs")).toBe("fix auth bugs")
    expect(formatPromptTitle("/plan create a new database model")).toBe("create a new…")
    expect(formatPromptTitle("/clear")).toBe("")
  })

  it("strips [Pasted text #...]", () => {
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
  })
})
