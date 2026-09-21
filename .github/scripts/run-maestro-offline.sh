#!/usr/bin/env bash
set +e

failures=()

run_flow() {
  local name="$1"
  local file="$2"

  echo "Running $name: $file"
  MAESTRO_CLI_NO_ANALYTICS=1 \
    timeout 900s \
    maestro test "$file" \
    --debug-output "/tmp/maestro-offline/$name"

  local status=$?
  echo "$name exit code: $status"
  return "$status"
}

run_flow onboarding mobile/.maestro/01-onboarding.yaml || failures+=("onboarding")
m1=$?

adb shell uiautomator dump /sdcard/off1.xml 2>/dev/null
adb shell cat /sdcard/off1.xml 2>/dev/null \
  | grep -oE '(text|content-desc)="[^"]*"' \
  | sort -u | head -80
adb shell screencap -p /sdcard/off1.png
adb pull /sdcard/off1.png /tmp/off1.png 2>/dev/null

run_flow myday mobile/.maestro/02-myday.yaml || failures+=("myday")
m2=$?

run_flow alerts mobile/.maestro/03-alerts.yaml || failures+=("alerts")
m3=$?

run_flow me-privacy mobile/.maestro/04-me-privacy.yaml || failures+=("me-privacy")
m4=$?

adb shell uiautomator dump /sdcard/me4.xml 2>/dev/null
adb shell cat /sdcard/me4.xml 2>/dev/null \
  | grep -oE '(text|content-desc)="[^"]*"' \
  | sort -u | head -80
adb shell screencap -p /sdcard/me4.png
adb pull /sdcard/me4.png /tmp/me4.png 2>/dev/null

echo "offline Maestro exit codes: 01=$m1 02=$m2 03=$m3 04=$m4"

if [ "${#failures[@]}" -gt 0 ]; then
  echo "Failed flows: ${failures[*]}"
  exit 1
fi
