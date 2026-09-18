#!/bin/sh
# Fake CLI for integration tests. Driven entirely by env vars set through CliTool.extraEnv:
#   ITEST_OUT        directory for the files below
#   ITEST_TAG        base name: $TAG.env (env/argv/pid), $TAG.in (every byte received)
#   ITEST_EXIT_CODE  when set, exit with this code right after writing $TAG.env
out="$ITEST_OUT/$ITEST_TAG"
{
  echo "pid=$$"
  echo "ppid=$PPID"
  echo "argv=$*"
  echo "cwd=$(pwd)"
  echo "CLI_CODE_SESSION_ID=$CLI_CODE_SESSION_ID"
  echo "CLI_CODE_DAEMON_SOCK=$CLI_CODE_DAEMON_SOCK"
  echo "CLI_CODE_HOOK=$CLI_CODE_HOOK"
} > "$out.env"
if [ -n "$ITEST_EXIT_CODE" ]; then exit "$ITEST_EXIT_CODE"; fi
# Bracketed paste on (what Claude/Codex do) and an OSC 7 cwd report, then raw mode so
# every byte xterm sends reaches tee unchanged (no ICRNL, no line buffering).
printf '\033[?2004h'
printf '\033]7;file://localhost/tmp\007'
stty raw
exec tee "$out.in"
