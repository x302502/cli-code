import { describe, expect, it } from "bun:test"
import { imageViewFileName, parseAppleScriptPng } from "../src/lib/clipboard-image.js"

describe("parseAppleScriptPng", () => {
  it("decodes the «data PNGf…» osascript prints for a PNG on the clipboard", () => {
    expect(parseAppleScriptPng("«data PNGf89504E470D0A»\n")).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))
  })
  it("is undefined when the clipboard holds no image", () => {
    expect(parseAppleScriptPng("")).toBeUndefined()
    expect(parseAppleScriptPng("some text")).toBeUndefined()
  })
})

describe("imageViewFileName", () => {
  it("names the file after the image's content, so opening it twice reuses one file", () => {
    const a = imageViewFileName(new Uint8Array([1, 2, 3]))
    expect(a).toMatch(/^cli-code-image-[0-9a-f]{16}\.png$/)
    expect(imageViewFileName(new Uint8Array([1, 2, 3]))).toBe(a)
    expect(imageViewFileName(new Uint8Array([1, 2, 4]))).not.toBe(a)
  })
})
