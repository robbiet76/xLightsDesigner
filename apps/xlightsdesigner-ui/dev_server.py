#!/usr/bin/env python3
import argparse
import os
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


UPSTREAMS = [
    ("127.0.0.1", 49914),
    ("127.0.0.1", 49913),
]


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

    def do_POST(self):
        if self.path != "/xlDoAutomation":
            self.send_error(404, "Not Found")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(content_length) if content_length > 0 else b"{}"

        last_error = None
        for host, port in UPSTREAMS:
            try:
                target = f"http://{host}:{port}/xlDoAutomation"
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
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        message = (
            '{"res":503,"error":{"code":"ENDPOINT_UNAVAILABLE","message":"No local xLights endpoint responding on 49914/49913"}}'
        )
        self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(message)))
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))
        if last_error:
            print(f"[dev-server] proxy error: {last_error}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    args = parser.parse_args()

    server = ThreadingHTTPServer(("0.0.0.0", args.port), DevHandler)
    print(f"[dev-server] serving on http://localhost:{args.port}")
    print("[dev-server] proxying POST /xlDoAutomation -> 127.0.0.1:49914,49913")
    server.serve_forever()


if __name__ == "__main__":
    main()
