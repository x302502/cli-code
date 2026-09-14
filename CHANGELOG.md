# Changelog

## 0.2.0
- New: built-in terminal (webview + PTY daemon). CLI sessions survive Reload Window; tabs keep their coloured icon and title.
- New: automatic tab titles from the typed prompt; agent state (working / waiting / done) on the tab; completion notifications; optional Claude Code status hooks.
- New: Shift+Enter newline, in-terminal search, font zoom, restart chip, OSC 52 clipboard, link/file-path popovers, copy context, quick commands, resume past sessions.
- Changed: closing a tab ends the CLI process. Quitting VS Code ends all sessions.
- Removed: HTTP prompt injection for opencode (replaced by direct terminal input).
- Packaging: per-platform VSIX (darwin/win32/linux × x64/arm64).

## 0.1.7
- Tab labels capped at 20 characters, cut at word boundaries.
