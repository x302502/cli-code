import * as vscode from "vscode"
import * as fs from "node:fs"
import * as path from "node:path"
import type { TestApi } from "../../../src/extension.js"
import type { CliTool } from "../../../src/lib/config.js"

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

export function makeTool(tag: string, extraEnv: Record<string, string> = {}): CliTool {
  return {
    id: `itest-${tag}`,
    label: `itest ${tag}`,
    icon: "claude.svg",
    themeIcon: "terminal",
    command: `sh "${fixture("echo-tool.sh")}"`,
    hasHttpApi: false,
    extraEnv: { ITEST_OUT: outDir(), ITEST_TAG: tag, ...extraEnv },
  }
}

export function envFile(tag: string): string {
  return path.join(outDir(), `${tag}.env`)
}
export function inputFile(tag: string): string {
  return path.join(outDir(), `${tag}.in`)
}

export function readEnvFile(tag: string): Record<string, string> | undefined {
  const text = readFileOr(envFile(tag))
  if (!text) return undefined
  const env: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const i = line.indexOf("=")
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1)
  }
  return env
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Opens a panel for `tool`, waits for the webview's ready and the fake tool's env file. */
export async function openReady(tag: string, extraEnv: Record<string, string> = {}, options: Parameters<TestApi["openTerminalPanel"]>[2] = {}) {
  const a = await api()
  const tool = makeTool(tag, extraEnv)
  const before = new Set(a.activePanels())
  await a.openTerminalPanel(a.context, tool, options)
  const panel = await waitFor(() => a.activePanels().find((p) => !before.has(p)), 15_000, `panel for ${tag}`)
  try {
    await waitFor(() => a.inspectPanel(panel).ready, 15_000, `webview ready for ${tag}`)
    const env = await waitFor(() => readEnvFile(tag), 15_000, `${tag}.env`)
    return { a, tool, panel, env }
  } catch (err) {
    // The panel was already found above; a failure past this point must not leak it (and
    // its PTY) into the next test — the caller never gets `panel` back to dispose itself.
    panel.dispose()
    throw err
  }
}
