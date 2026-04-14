#!/usr/bin/env /mnt/c/Users/Floyd.Lee/playground/talk/backend/.venv/bin/python
import asyncio
import http.cookiejar
import json
import os
import secrets
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websockets
from websockets.exceptions import InvalidStatus

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'
GOAPP = ROOT / 'go-app'
GO = Path.home() / '.local' / 'go' / 'bin' / 'go'
PYTHON = BACKEND / '.venv' / 'bin' / 'python'

PY_BASE = 'http://127.0.0.1:18100'
GO_BASE = 'http://127.0.0.1:18101'


def wait_for(url: str, timeout: float = 60.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f'timeout waiting for {url}')


def login_guest(base: str) -> str:
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(base + '/api/auth/guest', data=b'{"display_name":"Guest User"}', headers={'Content-Type': 'application/json'}, method='POST')
    with op.open(req):
        pass
    for cookie in jar:
        if cookie.name == 'talk_session':
            return f'talk_session={cookie.value}'
    raise RuntimeError('missing session cookie')


async def read_n(ws, n):
    return [json.loads(await ws.recv()) for _ in range(n)]


def simplify(events):
    out = []
    for e in events:
        item = {k: e.get(k) for k in ['t', 'dst', 'text', 'status', 'original', 'sender_display_name', 'code', 'fallback', 'provider', 'model'] if k in e}
        out.append(item)
    return out


async def compare_backend(base: str):
    cookie = login_guest(base)
    ws_base = 'ws' + base[len('http'):]
    unauth = None
    try:
        async with websockets.connect(ws_base + '/ws/chat/room-1?lang=en'):
            pass
    except InvalidStatus as e:
        unauth = {'mode': 'http_status', 'status_code': e.response.status_code}

    async with websockets.connect(ws_base + '/ws/chat/room-1?lang=en', additional_headers={'Cookie': cookie}) as ws:
        await ws.send(json.dumps({'type': 'send_message', 'client_msg_id': 'm-' + secrets.token_hex(4), 'text': 'hello', 'source_lang': 'en'}))
        single = simplify(await read_n(ws, 2))

    async with websockets.connect(ws_base + '/ws/chat/room-1?lang=en', additional_headers={'Cookie': cookie}) as en_ws, \
               websockets.connect(ws_base + '/ws/chat/room-1?lang=ko', additional_headers={'Cookie': cookie}) as ko_ws:
        await en_ws.send(json.dumps({'type': 'send_message', 'client_msg_id': 'm2-' + secrets.token_hex(4), 'text': 'hello', 'source_lang': 'en'}))
        initial_en = simplify(await read_n(en_ws, 2))
        initial_ko = simplify(await read_n(ko_ws, 2))
    return {'unauth': unauth, 'single': single, 'initial_en': initial_en, 'initial_ko': initial_ko}


async def main_async():
    with tempfile.TemporaryDirectory(prefix='talk-ws-parity-') as tmp:
        py_db = Path(tmp) / 'python.db'
        go_db = Path(tmp) / 'go.db'
        py_proc = subprocess.Popen([str(PYTHON), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '18100'], cwd=BACKEND, env={**os.environ, 'DATABASE_URL': f'sqlite+aiosqlite:///{py_db}', 'DEFAULT_PROVIDER': 'groq'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        go_proc = subprocess.Popen([str(GO), 'run', './cmd/server'], cwd=GOAPP, env={**os.environ, 'PATH': f"{GO.parent}:{os.environ.get('PATH','')}", 'DATABASE_URL': str(go_db), 'DEFAULT_PROVIDER': 'groq', 'PORT': '18101'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            wait_for(PY_BASE + '/health')
            wait_for(GO_BASE + '/health')
            py = await compare_backend(PY_BASE)
            go = await compare_backend(GO_BASE)
            summary = {'python': py, 'go': go, 'match': py == go}
            print(json.dumps(summary, indent=2))
            return 0 if py == go else 1
        finally:
            for proc in (py_proc, go_proc):
                proc.terminate()
            for proc in (py_proc, go_proc):
                try:
                    proc.wait(timeout=5)
                except Exception:
                    proc.kill()


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main_async()))
