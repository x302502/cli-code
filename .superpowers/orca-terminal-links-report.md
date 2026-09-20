# Orca terminal link detection & activation — reverse-engineering report

Source: Orca's extracted Electron build at
`/private/tmp/claude-501/-Volumes-Data-itsme-study-ai-best-clone-project-cli-code/eb81f4b7-6c16-4126-b9d3-165a99ae722a/scratchpad/orca/app`
(`out/renderer/assets/*.js`, `out/main/index.js`). All renderer JS is Vite-built and minified to a
single physical line per file, so "file:line" below means "file:line 1, search for this
identifier" — I cite the (deobfuscated-by-reading, still-minified) local variable/function names
verbatim so you can `grep` them back to the exact spot.

Key files (all under `out/renderer/assets/`):

| File | Role |
|---|---|
| `terminal-links-BqhQIB-h.js` | Pure detection/parsing engine: path & `file://` regexes, `path:line:col` parsing, `~`/Windows/UNC normalization, trailing-punctuation trimming, workspace-root containment checks. No DOM/xterm code. |
| `terminal-link-open-hints-D_TgWg3d.js` | Builds the tooltip strings ("⌘+click to open, or ⇧⌘+click for default app", etc.) and the primary/alternate destination policy for HTTP links (system browser vs. "Orca Browser"). |
| `OnboardingInlineCommandTerminal-CJi11Vbj.js` | Despite the name, this is the shared terminal-pane-manager chunk that both the onboarding demo terminal and the real CLI-agent terminal panes lazy-load. Contains the actual `registerLinkProvider(...)` wiring, OSC 7 cwd tracking, the file/URL open dispatcher, and the click-gesture state machine. |
| `terminal-native-copy-gutter-CSEKYFMy.js` | Bundled xterm.js core: the built-in OSC-8 hyperlink `ILinkProvider` (class `U`), the `WebLinksAddon`-equivalent (`Ls`/`Ms`), and the low-level click/modifier helpers. |
| `out/main/index.js` | Electron main-process IPC handlers backing `window.api.shell.*` (`openFilePath` → `shell.openPath`, `openPath`/`openInFileManager` → `shell.showItemInFolder`, `openUrl` → `shell.openExternal`). |

---

## (a) Summary table

| Target type | Detection | Click gesture | Action | Where |
|---|---|---|---|---|
| File path (rel/abs, optional `:line:col`) | Regex passes over each *logical* (line-wrap-joined) row; validated, existence-checked | Plain click → popover; Cmd/Ctrl+click → open in editor; Shift+Cmd/Ctrl+click → "open with default app" | `openFile(...)` (editor tab) at resolved `line`/`column`, or download+open for remote paths | `terminal-links-BqhQIB-h.js` (`u`,`f`,`d`), `OnboardingInlineCommandTerminal-CJi11Vbj.js` (`yZ`, `MH`, `Ck`) |
| Directory path that is a known worktree root | Same detector; root-ness via `fk()` lookup in worktree table | Plain click → popover; Cmd/Ctrl+click → "Switch workspace"; Shift+Cmd/Ctrl+click → "Open in Finder"/"Open folder" (only if outside current workspace) | Switches Orca to that workspace, or `shell.openPath` (Finder reveal) | `OnboardingInlineCommandTerminal-CJi11Vbj.js` (`MH`, `Ck`) |
| Directory path that is **not** a worktree root, inside current workspace | Same detector, but `l=fk()` is false | Cmd/Ctrl+click → calls `Ck()`, which stats the path, sees `isDirectory`, and **silently no-ops** (no popover alternate offered either) | Effectively a dead link | `Ck()` in `OnboardingInlineCommandTerminal-CJi11Vbj.js` |
| `~`/Windows drive/UNC path | Same regex, root normalized via `n()`/tilde resolved via `a()` using `terminalHomePath` or a guessed home dir | same as file/dir above | same | `terminal-links-BqhQIB-h.js` (`n`,`a`,`r`,`o`,`s`) |
| Bare well-known filename, no slash (`README`, `Makefile`, `package.json`…) | Word-tokenizer `x` + allow-list `C()`/`S` | same as file above | same | `terminal-links-BqhQIB-h.js` (`w`,`C`,`S`) |
| Path containing spaces | 3 extra regex passes (`F`,`I`,`L`) with heuristics for "space before slash", "trailing extension after spaces", "spaced path is rest-of-line" | same as file above | same | `terminal-links-BqhQIB-h.js` (`X`,`Y`,`B`,`U`,`V`,`H`,`K`,`J`) |
| `file://…` URL (incl. GitHub-style `#L10C5` and `:line:col`) | Dedicated regex `k`, bracket-aware trailing-punct trimmer `j`, parsed via `URL` + hash/path line-col parsers `T`/`E` | same as file above | same; `hostname` must be empty/`localhost` unless `allowUncHost` | `terminal-links-BqhQIB-h.js` (`N`,`M`,`D`,`T`,`E`) |
| `http://`/`https://` URL in plain text | xterm's own scheme-aware regex inside the fallback click handler (`PH`), plus Orca's URL-vs-path disambiguator `G()` in the path detector to avoid double-matching | Plain click → popover; Cmd/Ctrl(+Shift)+click → direct open | Opens in system browser **or** "Orca Browser" (in-app tab), per `openLinksInApp` setting, with Shift inverting the choice | `terminal-link-open-hints-D_TgWg3d.js` (`r`,`o`,`f`), `OnboardingInlineCommandTerminal-CJi11Vbj.js` (`DH`,`kH`) |
| Real OSC 8 hyperlink (`\e]8;;url\e\\text\e]8;;\e\\`) | xterm.js's **built-in** `OscLinkProvider` (class `U`), keyed by per-cell `extended.urlId` | Same click gating as xterm's stock `WebLinksAddon` (any click/modifier per `Us`) | **No Orca override found** (`linkHandler` never set on the `Terminal` instance) → falls back to xterm's stock handler: a JS `confirm()` dialog then `window.open()` | `terminal-native-copy-gutter-CSEKYFMy.js` (class `U`, function `De`) |
| Orca-internal `term_…` / `task_…` handles (agent/session tokens Orca itself prints) | Dedicated non-regex scanners `kZ`/`CZ` (find literal `term_`/`task_` prefixes, extend over `[A-Za-z0-9_-]`) | Cmd/Ctrl+click → direct switch; plain click → popover ("Switch terminal"/"Open task") | Focuses another terminal pane / opens a task tab | `OnboardingInlineCommandTerminal-CJi11Vbj.js` (`PZ`, `kZ`, `CZ`, `FZ`) |

---

## (b) Verbatim key snippets

**1. Path/line/col + validity gate** (`terminal-links-BqhQIB-h.js`):
```js
function c(e){let t=/^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(e),n=t?.[1];if(!n)return null;
  let r=t[2]?Number.parseInt(t[2],10):null,i=t[3]?Number.parseInt(t[3],10):null;
  return r!==null&&r<1||i!==null&&i<1?null:{pathText:n,line:r,column:i}}
function u(e,t={}){let n=c(e);if(!n)return null;let{pathText:r,line:i,column:a}=n,o=i!==null||a!==null;
  if(/^[\\/]\s/.test(r))return null;
  if(/[\\/]$/.test(r)){let e=t.allowRelativeDirectoryPath===!0&&!o;if(o||!e&&!l(r))return null}
  return{pathText:r,line:i,column:a}}
```

**2. `file://` link, bracket-aware trailing-punctuation trim** (`terminal-links-BqhQIB-h.js`):
```js
var k=/\bfile:\/\/[^\s"`<>|]{1,2049}/gi,
    A=new Set([`.`,`,`,`;`,`:`,`!`,`?`,`>`,`"`,`'`,"`"]);
function j(e){ /* counts unmatched ( [ { and only trims trailing A-chars
                  that don't close an unmatched open bracket */ }
```

**3. `~`, Windows drive, UNC root normalization** (`terminal-links-BqhQIB-h.js`):
```js
function n(e){
  let n=/^([A-Za-z]):[\\/]*(.*)$/.exec(e);            // C:\... or C:/...
  if(n){...return{normalized:i,comparisonKey:i.toLowerCase(),rootKind:`windows`}}
  let r=/^(?:\\\\|\/\/)([^\\/]+)[\\/]+([^\\/]+)(?:[\\/]*(.*))?$/.exec(e); // \\host\share or //host/share
  if(r){...return{...rootKind:`unc`}}
  if(e.startsWith(`/`)){...return{...rootKind:`posix`}}
  return null}
```

**4. Modifier gating — plain click opens the popover, modifier click acts directly**
(`OnboardingInlineCommandTerminal-CJi11Vbj.js`; `Lf`=Cmd/Ctrl-click regardless of Shift, `Kf`=plain click, no modifier at all):
```js
function nP(e,t,n){return!e||!t||!Kf(e)||!t.pointerGesture.canRequestAction(e)||!t.claimPtyMouse()
  ?!1:(e.preventDefault(),t.request({...n,paneId:t.paneId,anchorX:e.clientX,anchorY:e.clientY,restoreFocus:t.focusTerminal}),!0)}

function MH(e,t,n,r,i,a,o){
  if(Lf(r))return r?.preventDefault?.(),Ck(e,t,n,{...i,openWithSystemDefault:!!r.shiftKey}),!0; // direct open, shift = alternate
  // ...else build primary/alternate for the popover:
  let l=fk(s), u=vk(c,s); // l = "is a known worktree root", u = "is outside current workspace"
  let f = l ? (u ? {label: isMac?`Open in Finder`:`Open folder`, run:()=>Ck(e,t,n,{...i,openWithSystemDefault:!0})} : null)
            : (u ? {label:`Open with default app`, run:()=>Ck(...)} : (/[/\\]$/.test(s) ? null : {label:`Download & open with default app`, run:()=>tk(c,s)}));
  return nP(r,a,{destination:o??s, kind:l?`workspace`:`file`,
    primary:{label: l?`Switch workspace`:`Open file`, run:()=>Ck(e,t,n,i)}, ...(f?{alternate:f}:{})});
}
```

**5. Existence probe gates whether a path is shown as a link at all** (in `yZ`'s `provideLinks`):
```js
let b=fk(m); // already-open-in-editor?
if(/[\\/]$/.test(l.pathText)&&!b)return null; // bare trailing-slash "dir" candidates without other evidence: drop
if(!b){
  let e=tH(o,y)??await h(_,m,v);      // cached result, else async existence probe (batched, debounced via queueMicrotask)
  if(nH(o,y,e),!e)return null;         // path doesn't exist on disk -> not a link
}
```

**6. Directory activation — unifies "open with default app" and "reveal folder" via one Electron call**
(`out/main/index.js`):
```js
async function Fdi(e){let t=await o1(e);if(!t.ok)return!1;
  try{return(await M.shell.openPath(t.path)).length===0}catch{return!1}}
// shell:openFilePath -> Fdi -> Electron shell.openPath (opens dirs in Finder, files with default app)
// shell:openPath / shell:openInFileManager -> Ndi -> M.shell.showItemInFolder (select item in parent folder)
```

**7. OSC 8 hyperlink default (no `linkHandler` override found anywhere in the renderer bundle)**
(`terminal-native-copy-gutter-CSEKYFMy.js`):
```js
function De(e,t){if(confirm(`Do you want to navigate to ${t}?\n\nWARNING: This link could potentially be dangerous`)){
  let e=window.open();if(e){try{e.opener=null}catch{}e.location.href=t}
  else console.warn(`Opening link blocked as opener could not be cleared`)}}
```

**8. OSC 7 cwd tracking, used as the primary resolution base for relative paths**
(`OnboardingInlineCommandTerminal-CJi11Vbj.js`):
```js
let T=t.terminal.parser.registerOscHandler(7, eU(`osc-7-cwd`, e=>{
  let n=ZH(e,{uncHost:c}); if(n){...d.current.set(t.id, VB(d.current.get(t.id), n, ...))}
  return!0}));
// consumer: u = t.getPaneLinkCwd?.(e) ?? i   where i = startupCwd (the pane's spawn/worktree cwd)
```

---

## (c) Test-case list for a VS Code reimplementation

| # | Input text a CLI prints | Gesture | Expected result |
|---|---|---|---|
| 1 | `src/index.ts` (cwd = workspace root) | Cmd/Ctrl+click | Opens `src/index.ts` in editor |
| 2 | `src/index.ts:42` | Cmd/Ctrl+click | Opens file, cursor at line 42 |
| 3 | `src/index.ts:42:7` | Cmd/Ctrl+click | Opens file, cursor at line 42, col 7 |
| 4 | `./relative/dir/file.ts` | Cmd/Ctrl+click | Resolves relative to OSC7 cwd (fallback: pane's startup/workspace cwd) |
| 5 | `~/notes.md` | Cmd/Ctrl+click | Resolves `~` against configured home path (or a guessed `/Users/<name>` / `/home/<name>` derived from cwd) |
| 6 | `C:\Users\bob\project\file.ts:10` (Windows) | Cmd/Ctrl+click | Normalizes drive path, opens at line 10 |
| 7 | `\\server\share\file.ts` (UNC) | Cmd/Ctrl+click | Only matched as a link if `allowUncHost` behavior is intended — otherwise treat like Orca: UNC hostnames are rejected for `file://` unless explicitly allowed |
| 8 | `README` (bare, no slash) | Cmd/Ctrl+click | Detected via allow-list of extension-less well-known filenames only (`Makefile`,`Dockerfile`,`Rakefile`,`Gemfile`,`Procfile`,`LICENSE`,`README`,`CHANGELOG`,`AUTHORS`,`NOTICE`,`CONTRIBUTING`); `randomWord` should NOT be detected |
| 9 | `Read(src/components/Button.tsx)` (Claude Code tool-call line) | Cmd/Ctrl+click on the path | Parens are trimmed (opening `(` and closing `)` are in the trim set); the bare `src/components/Button.tsx` becomes the link — no Claude-specific parsing needed |
| 10 | `⎿  Read src/x.ts` | Cmd/Ctrl+click | Same generic path detector applies; the `⎿` glyph is unrelated to link detection (it's used elsewhere for agent-busy/spinner detection) |
| 11 | `"My Documents/notes.txt"` (quoted, has a space) | Cmd/Ctrl+click | Quotes trimmed; space-containing path detected via the "space before slash" heuristic |
| 12 | `open src/file.txt and docs/readme.md` (two paths, space-joined) | Cmd/Ctrl+click on each | Spaced-path heuristic must not merge the two into one link; each resolves independently |
| 13 | `file:///Users/bob/project/file.ts#L12C4` | Cmd/Ctrl+click | Parsed as `file://` URL; `#L12C4` hash becomes line 12, col 4 |
| 14 | `file:///Users/bob/project/file.ts:12:4` | Cmd/Ctrl+click | Same, but line/col taken from path suffix since no `#L` hash present |
| 15 | `https://example.com/path(with)parens` | Cmd/Ctrl+click | Trailing-punct trimmer is bracket-aware: doesn't strip `)` that closes an unmatched `(` inside the URL |
| 16 | `https://example.com/x` | Plain click (no modifier) | Shows an action popover (primary = open, alternate = open in other surface) rather than navigating immediately |
| 17 | `https://example.com/x` | Shift+Cmd/Ctrl+click | Opens via the *alternate* destination (system browser vs. in-app browser, inverted from primary) |
| 18 | `/tmp/does/not/exist.ts` | Cmd/Ctrl+click | **Not** shown as a clickable link at all — existence is probed (async, cached) before the link is rendered |
| 19 | `/path/to/some/dir/` (a directory that is a registered workspace root) | Cmd/Ctrl+click vs Shift+Cmd/Ctrl+click | Cmd/Ctrl+click switches to that workspace; Shift+Cmd/Ctrl+click reveals it in Finder/Explorer (only offered when the dir is judged "outside" the current workspace) |
| 20 | `/path/to/some/plain/subdir/` (directory, not a workspace root, inside current workspace) | Cmd/Ctrl+click | No-op — stat confirms it's a directory and nothing else fires (arguably a bug/gap worth deliberately fixing in the VS Code port rather than copying) |
| 21 | `/path/outside/the/workspace/file.ts` | Cmd/Ctrl+click | Requires an "authorize external path" step before stat/open (Orca's `fs.authorizeExternalPath`); a VS Code port should decide its own trust story here |
| 22 | An OSC-8 hyperlink (`\e]8;;https://x\e\\click me\e]8;;\e\\`) | any click | Distinct code path from plain-text URL detection (xterm's native OSC-8 provider), and in Orca's own build it isn't wired to the same popover/system-browser logic |
| 23 | Hover over any detected link, no click | — | Underline + pointer cursor + tooltip showing the resolved absolute path and a gesture hint string (varies by target type) |

---

## (d) Things Orca does that a VS Code extension cannot replicate 1:1

- **OSC 7 cwd tracking per pane**: Orca registers a real xterm OSC handler (`parser.registerOscHandler(7, …)`) to know the shell's *actual* current directory, independent of the workspace root, and prefers it over the pane's startup cwd for relative-path resolution. VS Code's terminal API exposes `Terminal.shellIntegration.cwd` (shell-integration-dependent, not guaranteed) — closest analog, but not identical in reliability/timing.
- **Its own multi-pane terminal engine with full buffer access**: Orca scans raw xterm `Buffer`/`BufferLine` cells directly (including wrapped-line joining, per-cell `extended.urlId` for OSC 8, and screen-position math to hit-test mouse events against cells). VS Code's link-provider API (`window.registerTerminalLinkProvider`) gives you plain text per line plus offsets — no raw cell/attribute access, so OSC-8 per-cell `urlId` detection and the box-drawing/"nearby row" context scan (`PV=/[│┃║╎╏┆┇┊┋|]/`) used for boxed tool-output context aren't reproducible the same way.
- **Native `shell.openPath` / `shell.showItemInFolder` / `shell.openExternal` via Electron**: VS Code extensions have their own equivalents (`vscode.env.openExternal`, `revealFileInOS` command via `vscode.commands.executeCommand('revealFileInOS', uri)`), which is close enough — but there's no single VS Code API that mirrors Electron's `shell.openPath` "open dir in Finder, or open file with OS default app" duality in one call; you'd branch on `isDirectory` yourself.
- **"Authorize external path" trust gate + a first-class notion of "workspace root switch"**: Orca can literally switch its whole window to a different project/workspace on click, because Orca IS the multi-workspace shell. A VS Code extension can at best `vscode.commands.executeCommand('vscode.openFolder', uri)`, which replaces/opens a new window — coarser than Orca's in-place pane-level workspace switch, and it can't offer a "no-op" vs. "reveal" nuance as cheaply.
- **A `confirm()`-dialog fallback for unhandled OSC-8 links**: this is literally a browser `window.confirm()` call inside xterm.js core, meaningful in a Chromium renderer; in a VS Code extension host you'd have to replace it with a `vscode.window.showWarningMessage` confirmation if you want the same "external URL scariness" prompt.

---

## Biggest surprises

1. **Plain click opens an action popover; only Cmd/Ctrl+click (any Shift state) acts immediately.** The gesture model is inverted from what you'd guess: modifier-click is the "just do it" gesture, unmodified click is the "ask me" gesture (`nP()` requires `Kf` = no-modifier click; `MH()`'s direct-action branch requires `Lf` = Cmd/Ctrl held).
2. **Links are existence-checked before they're ever shown**, via a debounced, cached, batched filesystem probe (`gZ()`/`tH`/`nH`) inside `provideLinks` itself — a nonexistent path never gets underlined, it's not just a no-op on click.
3. **Directories that aren't registered workspace roots are effectively dead links inside the current workspace** — `Ck()`'s `isDirectory` branch only calls `shell.openPath` when the path is judged "outside" the workspace; otherwise it silently does nothing, and `MH()` doesn't even offer an alternate action for that case. This looks like an edge case Orca hasn't fully closed, not an intentional design.
4. **Real OSC-8 hyperlinks are NOT unified with Orca's own path/URL link system.** No `Terminal.options.linkHandler` override was found anywhere in the renderer bundle, so genuine OSC-8 escape-sequence links fall through to xterm.js's stock handler — a plain `confirm()` dialog + `window.open()` — completely bypassing Orca's popover, in-app-browser preference, and workspace-switch logic that plain-text URLs and paths get.
5. **No CLI-specific parsing at all.** Despite Claude Code/Codex printing structured markers (`⎿`, `Read(...)`, spinner glyphs), the link layer is 100% generic text/regex scanning; the only "CLI-aware" code (`bJ=[·○◇☆✧⌘✻⎿]`, spinner-word list) is unrelated to links — it's agent-busy-status detection.
6. **Bare filenames are allow-listed, not just "any dotted word."** Detecting `README`/`Makefile`/`package.json` as a link requires either an extension or membership in a fixed 11-name set — a random capitalized word never becomes a link.

Report written to `/Volumes/Data/itsme/study/ai/best-clone-project/cli-code/.superpowers/orca-terminal-links-report.md`.
