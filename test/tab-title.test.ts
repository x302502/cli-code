import { describe, expect, it } from "bun:test"
import { isMeaningfulOscTitle, resolveTabTitle } from "../src/lib/tab-title.js"

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
