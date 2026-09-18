import * as vscode from "vscode"
import * as fs from "node:fs"
import * as path from "node:path"
import type { TestApi } from "../../../src/extension.js"

export const EXTENSION_ID = "x302502.cli-code"

export async function api(): Promise<TestApi> {
  const ext = vscode.extensions.getExtension<TestApi>(EXTENSION_ID)
  if (!ext) throw new Error(`extension ${EXTENSION_ID} not found in the test host`)
  return ext.isActive ? ext.exports : await ext.activate()
}

export function outDir(): string {
  const dir = process.env.CLI_CODE_ITEST_OUT
  if (!dir) throw new Error("CLI_CODE_ITEST_OUT is not set — run via test/integration/run.mjs")
  return dir
}

export function stage(): "1" | "2" {
  return process.env.CLI_CODE_ITEST_STAGE === "2" ? "2" : "1"
}

/** Polls `pred` every 50 ms until it returns a truthy value or `ms` elapses. */
export async function waitFor<T>(pred: () => T | undefined | false, ms = 15_000, label = "condition"): Promise<T> {
  const deadline = Date.now() + ms
  for (;;) {
    const v = pred()
    if (v) return v
    if (Date.now() > deadline) throw new Error(`timed out after ${ms} ms waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

export function fixture(name: string): string {
  // dist-test/suite/index.js → ../../test/integration/fixtures/<name>
  return path.resolve(__dirname, "..", "..", "test", "integration", "fixtures", name)
}

export function readFileOr(p: string): string | undefined {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : undefined
}
