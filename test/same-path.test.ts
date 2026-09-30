import { describe, expect, it } from "bun:test"
import { samePath } from "../src/lib/same-path.js"

describe("samePath", () => {
  it("normalises trailing separators and dot segments", () => {
    expect(samePath("/w/proj/", "/w/proj", "linux")).toBe(true)
    expect(samePath("/w/a/../proj", "/w/proj", "darwin")).toBe(true)
    expect(samePath("/w/proj", "/w/Proj", "linux")).toBe(false)
  })
  it("Windows paths compare case-insensitively and with either separator (VS Code says c:\\, CLIs say C:\\)", () => {
    expect(samePath("c:\\proj", "C:\\proj\\", "win32")).toBe(true)
    expect(samePath("C:/proj/src", "c:\\Proj\\SRC", "win32")).toBe(true)
    expect(samePath("C:\\proj", "D:\\proj", "win32")).toBe(false)
  })
})
