// test/osc-scan.test.ts
import { describe, expect, it } from "bun:test"
import { createOscScanner, parseFileUrlPath } from "../src/lib/osc-scan.js"

const BEL = "\x07"
const ST = "\x1b\\"

describe("createOscScanner", () => {
  it("bắt OSC 0/2 kết thúc bằng BEL hoặc ST", () => {
    const scan = createOscScanner()
    expect(scan(`abc\x1b]0;Claude • fix bug${BEL}def`)).toEqual([{ kind: "title", title: "Claude • fix bug" }])
    expect(scan(`\x1b]2;codex: refactor${ST}`)).toEqual([{ kind: "title", title: "codex: refactor" }])
  })

  it("bắt OSC 7 và giải mã đường dẫn file://", () => {
    const scan = createOscScanner()
    expect(scan(`\x1b]7;file://mac.local/Volumes/Data/my%20dir${BEL}`)).toEqual([
      { kind: "cwd", cwd: "/Volumes/Data/my dir" },
    ])
  })

  it("bắt OSC 9999 và trả payload thô", () => {
    const scan = createOscScanner()
    expect(scan(`\x1b]9999;{"state":"working"}${BEL}`)).toEqual([{ kind: "status", payload: '{"state":"working"}' }])
  })

  it("ghép sequence bị cắt giữa chừng qua nhiều chunk, kể cả cắt trong prefix", () => {
    const scan = createOscScanner()
    expect(scan("xin \x1b")).toEqual([])
    expect(scan("]0;ti")).toEqual([])
    expect(scan(`eu de${BEL} chao`)).toEqual([{ kind: "title", title: "tieu de" }])
  })

  it("xử lý nhiều sequence trong một chunk theo đúng thứ tự", () => {
    const scan = createOscScanner()
    expect(scan(`\x1b]0;a${BEL}x\x1b]7;file:///tmp${BEL}\x1b]2;b${ST}`)).toEqual([
      { kind: "title", title: "a" },
      { kind: "cwd", cwd: "/tmp" },
      { kind: "title", title: "b" },
    ])
  })

  it("bỏ qua OSC không quan tâm và ESC không phải OSC", () => {
    const scan = createOscScanner()
    expect(scan(`\x1b[31mred\x1b[0m \x1b]52;c;aGVsbG8=${BEL} \x1b]8;;http://x${BEL}link\x1b]8;;${BEL}`)).toEqual([])
  })

  it("vứt sequence dở dang khi vượt 64 KB", () => {
    const scan = createOscScanner()
    scan("\x1b]0;" + "x".repeat(70_000))
    expect(scan(`tail${BEL}`)).toEqual([])
    expect(scan(`\x1b]0;ok${BEL}`)).toEqual([{ kind: "title", title: "ok" }])
  })
})

describe("parseFileUrlPath", () => {
  it("bỏ host, giải mã percent-encoding, trả undefined khi không phải file://", () => {
    expect(parseFileUrlPath("file://host/a/b%20c")).toBe("/a/b c")
    expect(parseFileUrlPath("file:///a")).toBe("/a")
    expect(parseFileUrlPath("http://x/")).toBeUndefined()
    expect(parseFileUrlPath("file://host/%ZZ")).toBeUndefined()
  })
})

describe("parseFileUrlPath — Windows", () => {
  it("drops the slash before a drive letter (file:///C:/… is C:/…, not /C:/…)", () => {
    expect(parseFileUrlPath("file:///C:/proj/src/main.ts")).toBe("C:/proj/src/main.ts")
    expect(parseFileUrlPath("file://localhost/c:/proj")).toBe("c:/proj")
    expect(parseFileUrlPath("file:///C:/My%20Docs")).toBe("C:/My Docs")
    // POSIX paths are untouched.
    expect(parseFileUrlPath("file:///Users/x/proj")).toBe("/Users/x/proj")
  })
})
