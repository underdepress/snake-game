#!/usr/bin/env python3
"""Local server for the AcWing tracker. Serves static files and accepts
mark-done requests from the Tampermonkey userscript."""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8765
PROGRESS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'progress.json')

# Problem IDs that are in our 剑指Offer list (content_id - 1 mapping)
VALID_IDS = set(range(13, 89))  # problems 13-88


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return set(data.get('done', []))
        except (json.JSONDecodeError, KeyError):
            pass
    return set()


def save_progress(done_set):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump({'done': sorted(done_set)}, f, ensure_ascii=False)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == '/progress':
            done = load_progress()
            self.send_response(200)
            self.cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'done': sorted(done)}).encode())
            return

        # Serve the tracker page for root path
        if self.path == '/':
            self.path = '/index.html'
        super().do_GET()

    def do_POST(self):
        if self.path == '/mark-done':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                problem_id = int(data.get('problemId', 0))
            except (json.JSONDecodeError, ValueError):
                self.send_response(400)
                self.cors_headers()
                self.end_headers()
                self.wfile.write(b'{"error":"invalid json"}')
                return

            if problem_id not in VALID_IDS:
                self.send_response(400)
                self.cors_headers()
                self.end_headers()
                self.wfile.write(b'{"error":"problem not in list"}')
                return

            done = load_progress()
            if problem_id not in done:
                done.add(problem_id)
                save_progress(done)

            self.send_response(200)
            self.cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'problemId': problem_id, 'total': len(done)}).encode())
            return

        self.send_response(404)
        self.cors_headers()
        self.end_headers()

    def log_message(self, format, *args):
        # Only log API calls
        if '/mark-done' in str(args) or '/progress' in str(args):
            sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), format % args))


def main():
    # Ensure progress file exists
    if not os.path.exists(PROGRESS_FILE):
        save_progress(set())

    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Tracker server running at http://localhost:{PORT}/')
    print(f'Open that URL to use the tracker.')
    print(f'Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
        server.server_close()


if __name__ == '__main__':
    main()
