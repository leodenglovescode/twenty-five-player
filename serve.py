#!/usr/bin/env python3
"""Serve the independent scroll-wheel tribute on loopback only. No dependencies."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8766)
parser.add_argument('--open', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except OSError as exc:
    raise SystemExit(f'Cannot start server: {exc}. Try --port 8767.')
url = f'http://127.0.0.1:{args.port}'
print(f'Twenty Five is ready: {url}\nPress Ctrl-C to stop.', flush=True)
if args.open:
    threading.Timer(0.4, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
