from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlparse


VIEWER_DIR = Path(__file__).resolve().parent
DEFAULT_TRACE_DIR = VIEWER_DIR.parents[1] / "demos" / "graph_pipeline" / "outputs"
CASE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def list_cases(trace_dir: Path) -> list[dict[str, object]]:
    cases: list[dict[str, object]] = []
    for trace_path in sorted(trace_dir.glob("*.trace.json")):
        try:
            trace = json.loads(trace_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        case_id = trace.get("case_id")
        if not isinstance(case_id, str) or not CASE_ID_PATTERN.fullmatch(case_id):
            continue
        report_path = trace_dir / f"{case_id}.report.json"
        cases.append(
            {
                "case_id": case_id,
                "title": trace.get("title", case_id),
                "purpose": trace.get("purpose", ""),
                "model_used": trace.get("model_used"),
                "updated_at": trace_path.stat().st_mtime_ns,
                "has_report": report_path.is_file(),
            }
        )
    return cases


def load_case(trace_dir: Path, case_id: str) -> dict[str, object]:
    if not CASE_ID_PATTERN.fullmatch(case_id):
        raise ValueError("invalid case ID")
    trace_path = trace_dir / f"{case_id}.trace.json"
    if not trace_path.is_file():
        raise FileNotFoundError(case_id)
    trace = json.loads(trace_path.read_text(encoding="utf-8"))
    report_path = trace_dir / f"{case_id}.report.json"
    report = (
        json.loads(report_path.read_text(encoding="utf-8"))
        if report_path.is_file()
        else None
    )
    return {"trace": trace, "report": report}


class ViewerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, trace_dir: Path, **kwargs):
        self.trace_dir = trace_dir
        super().__init__(*args, directory=str(VIEWER_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send_json(self, value: object, status: int = 200) -> None:
        encoded = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        path = urlparse(self.path).path
        if path == "/api/cases":
            self._send_json({"cases": list_cases(self.trace_dir)})
            return
        if path.startswith("/api/cases/"):
            case_id = unquote(path.removeprefix("/api/cases/"))
            try:
                self._send_json(load_case(self.trace_dir, case_id))
            except ValueError as error:
                self._send_json({"error": str(error)}, 400)
            except FileNotFoundError:
                self._send_json({"error": "case not found"}, 404)
            except (OSError, json.JSONDecodeError) as error:
                self._send_json({"error": f"cannot read trace: {error}"}, 500)
            return
        super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the DARI graph trace viewer")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--trace-dir", type=Path, default=DEFAULT_TRACE_DIR)
    args = parser.parse_args()
    trace_dir = args.trace_dir.resolve()
    if not trace_dir.is_dir():
        parser.error(f"trace directory does not exist: {trace_dir}")
    handler = partial(ViewerHandler, trace_dir=trace_dir)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"DARI graph viewer: http://{args.host}:{args.port}")
    print(f"Watching traces in: {trace_dir}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
