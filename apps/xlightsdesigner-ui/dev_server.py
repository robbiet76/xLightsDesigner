#!/usr/bin/env python3
import argparse
import http.client
import os
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
                conn = http.client.HTTPConnection(host, port, timeout=5)
                conn.request(
                    "POST",
                    "/xlDoAutomation",
                    body=payload,
                    headers={"Content-Type": "application/json"},
                )
                resp = conn.getresponse()
                body = resp.read()
                self.send_response(resp.status)
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
