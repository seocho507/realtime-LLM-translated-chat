#!/usr/bin/env python3
import http.cookiejar
import json
import os
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'
GOAPP = ROOT / 'go-app'
GO = Path.home() / '.local' / 'go' / 'bin' / 'go'
PYTHON = BACKEND / '.venv' / 'bin' / 'python'

PY_BASE = 'http://127.0.0.1:18200'
GO_BASE = 'http://127.0.0.1:18201'


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


def post_with_jar(base, path, payload):
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(base + path, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with op.open(req) as resp:
        body = json.load(resp)
    cookie = next((c for c in jar if c.name == 'talk_session'), None)
    return body, cookie


def post(base, path, payload):
    req = urllib.request.Request(base + path, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.load(resp)


def get_session(base, cookie):
    req = urllib.request.Request(base + '/api/auth/session', method='GET')
    req.add_header('Cookie', f'{cookie.name}={cookie.value}')
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.load(resp)


def main():
    with tempfile.TemporaryDirectory(prefix='talk-shared-compat-') as tmp:
        db = Path(tmp) / 'shared.db'
        py_proc = subprocess.Popen([str(PYTHON), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '18200'], cwd=BACKEND, env={**os.environ, 'DATABASE_URL': f'sqlite+aiosqlite:///{db}', 'DEFAULT_PROVIDER': 'groq'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        go_proc = subprocess.Popen([str(GO), 'run', './cmd/server'], cwd=GOAPP, env={**os.environ, 'PATH': f"{GO.parent}:{os.environ.get('PATH','')}", 'DATABASE_URL': str(db), 'DEFAULT_PROVIDER': 'groq', 'PORT': '18201'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            wait_for(PY_BASE + '/health')
            wait_for(GO_BASE + '/health')
            summary = {}
            summary['py_signup_go_login'] = post(PY_BASE, '/api/auth/signup', {'display_name': 'Shared User Py', 'email': 'sharedpy@example.com', 'password': 'password123'})[0] == 200 and post(GO_BASE, '/api/auth/login', {'email': 'sharedpy@example.com', 'password': 'password123'})[0] == 200
            summary['go_signup_py_login'] = post(GO_BASE, '/api/auth/signup', {'display_name': 'Shared User Go', 'email': 'sharedgo@example.com', 'password': 'password123'})[0] == 200 and post(PY_BASE, '/api/auth/login', {'email': 'sharedgo@example.com', 'password': 'password123'})[0] == 200
            _, py_cookie = post_with_jar(PY_BASE, '/api/auth/guest', {'display_name': 'Guest User'})
            _, go_cookie = post_with_jar(GO_BASE, '/api/auth/guest', {'display_name': 'Guest User'})
            summary['go_verifies_python_cookie'] = get_session(GO_BASE, py_cookie)[0] == 200
            summary['python_verifies_go_cookie'] = get_session(PY_BASE, go_cookie)[0] == 200
            print(json.dumps(summary, indent=2))
            return 0 if all(summary.values()) else 1
        finally:
            for proc in (py_proc, go_proc):
                proc.terminate()
            for proc in (py_proc, go_proc):
                try:
                    proc.wait(timeout=5)
                except Exception:
                    proc.kill()

if __name__ == '__main__':
    raise SystemExit(main())
