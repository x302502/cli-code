import { describe, expect, it } from "bun:test"
import { formatPromptTitle, isMeaningfulOscTitle, resolveTabTitle } from "../src/lib/tab-title.js"

describe("formatPromptTitle — Orca's 40-char budget with word-boundary … (no sentence/punctuation folding)", () => {
  it("keeps short prompts as typed, file names included", () => {
    expect(formatPromptTitle("hello world")).toBe("hello world")
    expect(formatPromptTitle("source ~/.zshrc")).toBe("source ~/.zshrc")
    expect(formatPromptTitle("Fix the login bug. Then merge it.")).toBe("Fix the login bug. Then merge it.")
  })
  it("cuts at a word boundary after 40 chars and appends …", () => {
    expect(formatPromptTitle("Rồi bây giờ bạn xóa cms-demo và làm lại toàn bộ phần đăng nhập")).toBe("Rồi bây giờ bạn xóa cms-demo và làm lại…")
    expect(formatPromptTitle("a".repeat(40))).toBe("a".repeat(40))
    expect(formatPromptTitle("a".repeat(41))).toBe("a".repeat(40) + "…")
    // A space too early in the string is ignored, otherwise the title loses too much.
    expect(formatPromptTitle("run demo-with-a-very-long-flag-that-keeps-going-on")).toBe("run demo-with-a-very-long-flag-that-keep…")
  })
  it("drops URLs and takes the first non-empty line", () => {
    expect(formatPromptTitle("Review PR này https://github.com/foo/bar/very/long/path/indeed and deploy")).toBe("Review PR này and deploy")
    expect(formatPromptTitle("\n\nsecond line first")).toBe("second line first")
  })
  it("strips slash commands like /goal, /clear, /plan and [Pasted text #…]", () => {
    expect(formatPromptTitle("/goal fix auth bugs")).toBe("fix auth bugs")
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
  it("Codex titles are `<task> | <folder>`: an empty task segment (spinner only) is dropped", () => {
    expect(resolveTabTitle({ oscTitle: "⠋ | my-ai-books", toolLabel: "Codex" })).toBe("my-ai-books")
    // A multiplexer's shell name and path segments say nothing about the agent.
    expect(resolveTabTitle({ oscTitle: "zsh | /workspace/project", promptTitle: "fix bug", toolLabel: "Claude" })).toBe("fix bug")
    expect(resolveTabTitle({ oscTitle: "zsh | vim notes.md", toolLabel: "Claude" })).toBe("vim notes.md")
    // Windows shells title the tab with the folder too: a drive or UNC path says nothing either.
    expect(resolveTabTitle({ oscTitle: "C:\\Users\\me\\repo", promptTitle: "fix bug", toolLabel: "Claude" })).toBe("fix bug")
    expect(resolveTabTitle({ oscTitle: "\\\\server\\share", promptTitle: "fix bug", toolLabel: "Claude" })).toBe("fix bug")
    expect(resolveTabTitle({ oscTitle: "Reply OK | my-ai-books", toolLabel: "Codex" })).toBe("Reply OK | my-ai-books")
    expect(resolveTabTitle({ oscTitle: "⠋ renaming... ⠋ | my-ai-books", toolLabel: "Codex" })).toBe("renaming... | my-ai-books")
  })
  it("caps long OSC titles at 40 chars with …, but never touches a title the user typed", () => {
    const long = "Refactor the authentication flow so tokens refresh silently"
    expect(resolveTabTitle({ oscTitle: long, toolLabel: "X" })).toBe("Refactor the authentication flow so…")
    expect(resolveTabTitle({ customTitle: long, toolLabel: "X" })).toBe(long)
  })
})

describe("formatPromptTitle — a long link first", () => {
  it("a prompt opening with a URL longer than the title window still yields its ask", () => {
    expect(formatPromptTitle(`https://example.com/${"x".repeat(700)} fix the login bug`)).toBe("fix the login bug")
  })
})

describe("formatPromptTitle — a leading path is not a /command", () => {
  it("/tmp/report.md keeps its folder; /review with an argument drops the command", () => {
    expect(formatPromptTitle("/tmp/report.md looks wrong")).toBe("/tmp/report.md looks wrong")
    expect(formatPromptTitle("/tmp is full, clean it")).toBe("/tmp is full, clean it")
    expect(formatPromptTitle("/review fix the tests")).toBe("fix the tests")
  })
})

describe("resolveTabTitle — a prompt marker is stripped only before a space", () => {
  it("#123, $HOME and %d keep their first character; '$ ls' and '# note' lose the marker", () => {
    expect(resolveTabTitle({ oscTitle: "#123 fix bug", toolLabel: "Claude" })).toBe("#123 fix bug")
    expect(resolveTabTitle({ oscTitle: "$HOME check", toolLabel: "Claude" })).toBe("$HOME check")
    expect(resolveTabTitle({ oscTitle: "$ ls -la", toolLabel: "Claude" })).toBe("ls -la")
    expect(resolveTabTitle({ oscTitle: "✳ ❯ review", toolLabel: "Claude" })).toBe("review")
  })
})
