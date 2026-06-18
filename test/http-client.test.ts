import { afterEach, describe, expect, it, mock } from "bun:test"
import { appendPrompt, waitForHttpServer } from "../src/lib/http-client.js"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

describe("appendPrompt", () => {
  it("POSTs the text as JSON and returns true on success", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const ok = await appendPrompt(7777, "/tui/append-prompt", "hello")

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://localhost:7777/tui/append-prompt")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ text: "hello" })
  })

  it("returns false when the request throws", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("connection refused")
    }) as unknown as typeof fetch

    expect(await appendPrompt(7777, "/x", "y")).toBe(false)
  })
})

describe("waitForHttpServer", () => {
  it("returns true as soon as the server responds", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await waitForHttpServer(7777, "/app")).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("retries while the server is down, then succeeds", async () => {
    let calls = 0
    globalThis.fetch = mock(async () => {
      calls++
      if (calls < 3) throw new Error("not ready")
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    expect(await waitForHttpServer(7777, "/app")).toBe(true)
    expect(calls).toBe(3)
  })

  it("gives up and returns false after exhausting retries", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("never ready")
    }) as unknown as typeof fetch

    expect(await waitForHttpServer(7777, "/app")).toBe(false)
  })
})
