#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


OWNED_UPSTREAMS = [
    ("127.0.0.1", 49915),
]

OWNED_PREFIX = "/xlightsdesigner/api"


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Helpful when testing alternate endpoint values from browser.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _proxy_request(self, method, upstreams, target_path, unavailable_message):
        content_length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(content_length) if content_length > 0 else b"{}"

        last_error = None
        for host, port in upstreams:
            try:
                target = f"http://{host}:{port}{target_path}"
                proc = subprocess.run(
                    [
                        "curl",
                        "-sS",
                        "-X",
                        method,
                        target,
                        "-H",
                        "Content-Type: application/json",
                        "--data-binary",
                        "@-",
                        "-w",
                        "\n%{http_code}",
                    ],
                    input=payload,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                    timeout=5,
                )
                if proc.returncode != 0:
                    raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip() or f"curl failed for {target}")
                raw = proc.stdout
                split = raw.rsplit(b"\n", 1)
                if len(split) != 2:
                    raise RuntimeError(f"curl proxy response missing status trailer for {target}")
                body, status_raw = split
                status = int(status_raw.decode("utf-8", "replace").strip() or "502")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            except Exception as exc:
                last_error = exc

        message = unavailable_message
        self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(message)))
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))
        if last_error:
            print(f"[dev-server] proxy error: {last_error}")

    def _read_json_payload(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            return json.loads(payload.decode("utf-8", "replace"))
        except Exception:
            return {}

    def _read_owned_health(self):
        last_error = None
        for host, port in OWNED_UPSTREAMS:
            try:
                target = f"http://{host}:{port}{OWNED_PREFIX}/health"
                proc = subprocess.run(
                    ["curl", "-sS", target],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                    timeout=5,
                )
                if proc.returncode != 0:
                    raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip() or f"curl failed for {target}")
                return json.loads(proc.stdout.decode("utf-8", "replace") or "{}")
            except Exception as exc:
                last_error = exc
        raise RuntimeError(str(last_error or "owned health unavailable"))

    def _read_owned_json(self, path):
        last_error = None
        for host, port in OWNED_UPSTREAMS:
            try:
                target = f"http://{host}:{port}{OWNED_PREFIX}{path}"
                proc = subprocess.run(
                    ["curl", "-sS", target],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                    timeout=5,
                )
                if proc.returncode != 0:
                    raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip() or f"curl failed for {target}")
                return json.loads(proc.stdout.decode("utf-8", "replace") or "{}")
            except Exception as exc:
                last_error = exc
        raise RuntimeError(str(last_error or f"owned endpoint unavailable for {path}"))

    def _post_owned_json(self, path, body):
        last_error = None
        encoded = json.dumps(body).encode("utf-8")
        for host, port in OWNED_UPSTREAMS:
            try:
                target = f"http://{host}:{port}{OWNED_PREFIX}{path}"
                proc = subprocess.run(
                    [
                        "curl",
                        "-sS",
                        "-X",
                        "POST",
                        target,
                        "-H",
                        "Content-Type: application/json",
                        "--data-binary",
                        "@-",
                    ],
                    input=encoded,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                    timeout=5,
                )
                if proc.returncode != 0:
                    raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip() or f"curl failed for {target}")
                return json.loads(proc.stdout.decode("utf-8", "replace") or "{}")
            except Exception as exc:
                last_error = exc
        raise RuntimeError(str(last_error or f"owned endpoint unavailable for POST {path}"))

    def _wait_owned_job_result(self, job_id, attempts=180, delay_seconds=0.5):
        import time

        job_id = str(job_id or "").strip()
        if not job_id:
            raise RuntimeError("Owned API returned no job id")
        for _ in range(attempts):
            settled = self._read_owned_json(f"/jobs/get?jobId={job_id}")
            data = settled.get("data") or {}
            state = str(data.get("state") or "").strip().lower()
            if state in {"queued", "running"}:
                time.sleep(delay_seconds)
                continue
            result = data.get("result") or {}
            if result.get("ok") is not True:
                error = result.get("error") or {}
                raise RuntimeError(str(error.get("message") or f"Owned job {job_id} failed"))
            return result.get("data") or {}
        raise RuntimeError(f"Timed out waiting for owned job {job_id}")

    def _handle_owned_command_post(self):
        payload = self._read_json_payload()
        cmd = str(payload.get("cmd", "")).strip()
        params = payload.get("params") or {}
        if cmd not in {
            "system.getCapabilities",
            "system.getVersion",
            "sequence.getOpen",
            "sequence.open",
            "sequence.getRevision",
            "sequence.getSettings",
            "media.getStatus",
            "layout.getModels",
            "timing.getTracks",
        }:
            print(f"[dev-server] unhandled owned root POST cmd={cmd or '<empty>'}")
            self.send_error(404, "Not Found")
            return
        try:
            health = self._read_owned_health()
            runtime_state = str((health.get("data") or {}).get("state", "")).strip()
            if cmd == "system.getCapabilities":
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": {
                        "version": "xlightsdesigner-owned-api",
                        "commands": [
                            "sequence.getOpen",
                            "sequence.getRevision",
                            "sequence.getSettings",
                            "sequence.open",
                            "sequence.create",
                            "sequence.save",
                            "timing.getTracks",
                            "timing.getMarks",
                            "timing.ensureTrack",
                            "timing.addMarks",
                            "media.getCurrent",
                            "layout.getModels",
                            "layout.getScene",
                            "elements.getSummary",
                            "effects.getWindow",
                            "effects.applyBatch",
                            "sequencing.applyBatchPlan",
                            "jobs.get",
                        ],
                        "runtimeState": runtime_state,
                    },
                }
            elif cmd == "system.getVersion":
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": {
                        "version": f"owned-api:{runtime_state}" if runtime_state else "owned-api",
                    },
                }
            elif cmd == "sequence.getOpen":
                owned = self._read_owned_json("/sequence/open")
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": owned.get("data") or {},
                }
            elif cmd == "sequence.open":
                owned = self._post_owned_json(
                    "/sequence/open",
                    {
                        "file": str(params.get("file") or ""),
                        "force": bool(params.get("force")),
                        "renderMode": bool(params.get("renderMode")),
                    },
                )
                if owned.get("ok") is not True:
                    error = owned.get("error") or {}
                    body = {
                        "res": owned.get("statusCode") or 409,
                        "cmd": cmd,
                        "error": {
                            "code": str(error.get("code") or "UNKNOWN"),
                            "message": str(error.get("message") or "sequence.open failed"),
                            "details": error.get("details") or {},
                        },
                    }
                    self.send_response(body["res"])
                    encoded = json.dumps(body).encode("utf-8")
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(encoded)))
                    self.end_headers()
                    self.wfile.write(encoded)
                    return
                accepted = owned.get("data") or {}
                result_data = self._wait_owned_job_result(accepted.get("jobId"))
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": result_data,
                }
            elif cmd == "sequence.getRevision":
                owned = self._read_owned_json("/sequence/revision")
                data = owned.get("data") or {}
                revision = str(data.get("revisionToken") or data.get("revision") or "").strip()
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": {
                        **data,
                        "revision": revision or "unknown",
                    },
                }
            elif cmd == "sequence.getSettings":
                owned = self._read_owned_json("/sequence/settings")
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": owned.get("data") or {},
                }
            elif cmd == "media.getStatus":
                owned = self._read_owned_json("/media/current")
                data = owned.get("data") or {}
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": {
                        "sequenceOpen": bool(data.get("sequenceOpen")),
                        "sequencePath": str(data.get("sequencePath") or ""),
                        "mediaFile": str(data.get("mediaFile") or ""),
                        "showDirectory": str(data.get("showDirectory") or ""),
                    },
                }
            elif cmd == "layout.getModels":
                owned = self._read_owned_json("/layout/models")
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": owned.get("data") or {},
                }
            else:
                owned = self._read_owned_json("/timing/tracks")
                body = {
                    "res": 200,
                    "cmd": cmd,
                    "data": owned.get("data") or {},
                }
            raw = json.dumps(body).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        except Exception as exc:
            message = json.dumps(
                {
                    "res": 503,
                    "error": {
                        "code": "ENDPOINT_UNAVAILABLE",
                        "message": str(exc) or "Owned API health unavailable",
                    },
                }
            ).encode("utf-8")
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)
            return

    def do_GET(self):
        if self.path.startswith(OWNED_PREFIX):
            self._proxy_request(
                "GET",
                OWNED_UPSTREAMS,
                self.path,
                '{"ok":false,"error":{"code":"ENDPOINT_UNAVAILABLE","message":"No local xLightsDesigner owned API responding on 49915"}}',
            )
            return
        super().do_GET()

    def do_POST(self):
        if self.path == OWNED_PREFIX:
            self._handle_owned_command_post()
            return
        if self.path.startswith(OWNED_PREFIX):
            self._proxy_request(
                "POST",
                OWNED_UPSTREAMS,
                self.path,
                '{"ok":false,"error":{"code":"ENDPOINT_UNAVAILABLE","message":"No local xLightsDesigner owned API responding on 49915"}}',
            )
            return
        self.send_error(404, "Not Found")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    args = parser.parse_args()

    server = ThreadingHTTPServer(("0.0.0.0", args.port), DevHandler)
    print(f"[dev-server] serving on http://localhost:{args.port}")
    print("[dev-server] proxying GET/POST /xlightsdesigner/api* -> 127.0.0.1:49915")
    server.serve_forever()


if __name__ == "__main__":
    main()
