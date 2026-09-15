#!/usr/bin/env python3
"""Dismiss the Expo Go first-launch dev-menu onboarding (CI helper).

Expo Go shows a one-time bottom sheet ("This is the developer menu...") the
first time it opens a project. Its "Continue" button dismisses the onboarding
and reveals the actual dev-menu sheet below (Reload / Go to Home / ...), which
is closed with a single Back press. Pressing Back while the *onboarding* is up
however closes Expo Go entirely and returns to the launcher.

So: tap "Continue" (dismiss onboarding), then dismiss the dev-menu sheet if it
appears (one Back), and finally log what text is on screen.

Usage: python3 dismiss_dev_menu.py [adb_serial]
"""
import re
import subprocess
import sys
import time

ADB = "adb"


def sh(*args: str, check: bool = False) -> str:
    try:
        proc = subprocess.run([ADB, *args], capture_output=True, text=True, check=check)
        return proc.stdout
    except subprocess.CalledProcessError as err:
        return f"[cmd failed: {err}]"


def dump_ui() -> str:
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    return sh("shell", "cat", "/sdcard/ui.xml")


def visible_texts(ui: str) -> list:
    return sorted(set(re.findall(r'(?:text|content-desc)="([^"]+)"', ui) - {""}))


def node_bounds(ui: str, text: str) -> str | None:
    m = re.search(rf'<node[^>]*text="{re.escape(text)}"[^>]*bounds="(\[[^\"]+\])"', ui)
    if not m:
        m = re.search(rf'<node[^>]*bounds="(\[[^\"]+\])"[^>]*text="{re.escape(text)}"', ui)
    return m.group(1) if m else None


def tap_center(bounds: str) -> bool:
    m = re.search(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if not m:
        return False
    x1, y1, x2, y2 = (int(g) for g in m.groups())
    sh("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
    return True


DEV_MENU_SHEET_MARKERS = ("Reload", "Go to Home", "Copy Debug URL", "Copy debug URL", "Performance Monitor")


def main() -> int:
    if len(sys.argv) > 1:
        global ADB
        ADB = f"adb -s {sys.argv[1]}"

    ui = dump_ui()
    print("[dismiss_dev_menu] visible:", visible_texts(ui))

    # Step 1: dismiss the one-time onboarding via its Continue button.
    bounds = node_bounds(ui, "Continue")
    if bounds:
        if not tap_center(bounds):
            print("[dismiss_dev_menu] unparsable Continue bounds")
            return 1
        print("[dismiss_dev_menu] tapped Continue")
        time.sleep(3)
        ui = dump_ui()
        print("[dismiss_dev_menu] after Continue visible:", visible_texts(ui))
    else:
        print("[dismiss_dev_menu] no Continue button (onboarding already dismissed)")

    # Step 2: if the dev-menu sheet is up (Reload / Go to Home / ...), close it.
    if any(marker in " ".join(visible_texts(ui)) for marker in DEV_MENU_SHEET_MARKERS):
        sh("shell", "input", "keyevent", "4")  # Back closes the dev-menu sheet
        print("[dismiss_dev_menu] dev-menu sheet detected; pressed Back")
        time.sleep(3)
        ui = dump_ui()
        print("[dismiss_dev_menu] final visible:", visible_texts(ui))

    return 0


if __name__ == "__main__":
    sys.exit(main())