"""Run the DARI v0.4 demo in a real Chromium browser and capture evidence."""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

import websocket


EXPECTED_RISKY_FINDINGS = {
    "finding-stale-frequency",
    "finding-search-added",
    "finding-evidentiality",
    "finding-certainty",
}


def find_browser() -> Path:
    candidates = [
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise RuntimeError("Edge 또는 Chrome 실행 파일을 찾지 못했습니다.")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_tab(port: int, timeout: float = 12.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1) as response:
                tabs = json.load(response)
            page = next((tab for tab in tabs if tab.get("type") == "page"), None)
            if page:
                return page
        except OSError:
            pass
        time.sleep(0.2)
    raise TimeoutError("브라우저 DevTools 연결 시간이 초과됐습니다.")


class Cdp:
    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=8, suppress_origin=True)
        self.sequence = 0

    def close(self) -> None:
        self.ws.close()

    def command(self, method: str, params: dict | None = None) -> dict:
        self.sequence += 1
        request_id = self.sequence
        self.ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") == request_id:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def evaluate(self, expression: str):
        result = self.command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )["result"]
        if result.get("subtype") == "error":
            raise RuntimeError(result.get("description", "browser evaluation failed"))
        return result.get("value")

    def screenshot(self, destination: Path) -> None:
        payload = self.command(
            "Page.captureScreenshot",
            {"format": "png", "captureBeyondViewport": True, "fromSurface": True},
        )
        destination.write_bytes(base64.b64decode(payload["data"]))


def click(cdp: Cdp, element_id: str) -> None:
    found = cdp.evaluate(
        f"(() => {{ const node = document.getElementById({json.dumps(element_id)}); "
        "if (!node) return false; node.click(); return true; })()"
    )
    if not found:
        raise AssertionError(f"버튼을 찾지 못했습니다: {element_id}")
    time.sleep(0.12)


def read_gate(cdp: Cdp) -> dict:
    return cdp.evaluate(
        "(() => ({ route: document.getElementById('gate-status').textContent.trim(), "
        "count: document.querySelectorAll('.finding-card').length, "
        "ids: JSON.parse(document.getElementById('gate-json').textContent).findings"
        ".map(item => item.finding_id) }))()"
    )


def run(url: str, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    port = free_port()
    browser = find_browser()
    profile_dir = tempfile.mkdtemp(prefix="dari-assurance-browser-")
    process = subprocess.Popen(
        [
            str(browser),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--remote-allow-origins=*",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile_dir}",
            "--window-size=1440,1400",
            url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    cdp = None
    try:
        tab = wait_for_tab(port)
        cdp = Cdp(tab["webSocketDebuggerUrl"])
        cdp.command("Page.enable")
        cdp.command("Runtime.enable")
        time.sleep(0.5)

        title = cdp.evaluate("document.title")
        if title != "DARI v0.4 Assurance Workflow Demo":
            raise AssertionError(f"예상하지 못한 페이지입니다: {title!r}")

        for element_id in ("analyze-button", "confirm-button", "draft-button", "faithful-preset", "verify-button"):
            click(cdp, element_id)
        safe = read_gate(cdp)
        if safe["route"] != "pass" or safe["count"] != 0:
            raise AssertionError(f"안전한 초안 검증 실패: {safe}")
        cdp.screenshot(output_dir / "01-safe-pass.png")

        cdp.evaluate("showStage('builder')")
        click(cdp, "risky-preset")
        click(cdp, "verify-button")
        risky = read_gate(cdp)
        if risky["route"] != "human_review" or set(risky["ids"]) != EXPECTED_RISKY_FINDINGS:
            raise AssertionError(f"오류 수정안 검증 실패: {risky}")
        cdp.screenshot(output_dir / "02-risky-findings.png")

        click(cdp, "review-button")
        blocked = cdp.evaluate("document.getElementById('export-status').textContent.trim()")
        if blocked != "BLOCKED":
            raise AssertionError(f"미처리 export가 차단되지 않았습니다: {blocked}")
        decided = cdp.evaluate(
            "(() => { const buttons = [...document.querySelectorAll(\"button[data-decision='corrected']\")]; "
            "buttons.forEach(button => button.click()); return buttons.length; })()"
        )
        ready = cdp.evaluate("document.getElementById('export-status').textContent.trim()")
        if decided != 4 or ready != "READY":
            raise AssertionError(f"review 처리 결과가 올바르지 않습니다: decided={decided}, status={ready}")
        cdp.screenshot(output_dir / "03-review-ready.png")

        return {"browser": str(browser), "safe": safe, "risky": risky, "initial_export": blocked, "final_export": ready}
    finally:
        if cdp is not None:
            cdp.close()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        shutil.rmtree(profile_dir, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8874")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).with_name("screenshots"))
    args = parser.parse_args()
    result = run(args.url, args.output_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
