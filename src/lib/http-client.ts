const READY_CHECK_RETRIES = 10
const READY_CHECK_INTERVAL_MS = 200

/** Polls an HTTP endpoint until it responds or the retry budget is exhausted. */
export async function waitForHttpServer(port: number, path: string): Promise<boolean> {
  for (let tries = 0; tries < READY_CHECK_RETRIES; tries++) {
    await delay(READY_CHECK_INTERVAL_MS)
    try {
      await fetch(`http://localhost:${port}${path}`)
      return true
    } catch {
      // Server not ready yet, retry.
    }
  }
  return false
}

/** Sends a prompt to a CLI's HTTP API. Returns false if the request fails. */
export async function appendPrompt(port: number, path: string, text: string): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    return true
  } catch {
    return false
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
