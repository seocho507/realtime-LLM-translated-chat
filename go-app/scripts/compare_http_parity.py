#!/usr/bin/env python3
import http.cookiejar
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'
GOAPP = ROOT / 'go-app'
GO = Path.home() / '.local' / 'go' / 'bin' / 'go'
PYTHON = BACKEND / '.venv' / 'bin' / 'python'

PY_BASE = 'http://127.0.0.1:18000'
GO_BASE = 'http://127.0.0.1:18001'


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


def normalize_json(text: str):
    if not text:
        return None
    try:
        data = json.loads(text)
    except Exception:
        return text

    def walk(v):
        if isinstance(v, dict):
            out = {}
            for k, val in v.items():
                if k in {'session_id', 'user_id', 'expires_at'}:
                    out[k] = f'<{k}>'
                else:
                    out[k] = walk(val)
            return out
        if isinstance(v, list):
            return [walk(x) for x in v]
        return v

    return walk(data)


def normalize_headers(headers):
    out = {}
    for k, v in headers.items():
        lk = k.lower()
        if lk in {'date', 'server', 'content-length'}:
            continue
        if lk == 'set-cookie':
            parts = v.split(';')
            attrs = []
            for i, p in enumerate(parts):
                p = p.strip()
                if i == 0:
                    name = p.split('=', 1)[0]
                    attrs.append(name + '=<cookie>')
                else:
                    attrs.append(p)
            out[lk] = '; '.join(attrs)
        else:
            out[lk] = v
    return out


def opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def request(op, method, url, body=None):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with op.open(req, timeout=10) as resp:
            return resp.status, dict(resp.headers), resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


def main():
    with tempfile.TemporaryDirectory(prefix='talk-http-parity-') as tmp:
        py_db = Path(tmp) / 'python.db'
        go_db = Path(tmp) / 'go.db'
        py_proc = subprocess.Popen([
            str(PYTHON), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '18000'
        ], cwd=BACKEND, env={**os.environ, 'DATABASE_URL': f'sqlite+aiosqlite:///{py_db}', 'DEFAULT_PROVIDER': 'groq'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        go_proc = subprocess.Popen([
            str(GO), 'run', './cmd/server'
        ], cwd=GOAPP, env={**os.environ, 'PATH': f"{GO.parent}:{os.environ.get('PATH','')}", 'DATABASE_URL': str(go_db), 'DEFAULT_PROVIDER': 'groq', 'PORT': '18001'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            wait_for(PY_BASE + '/health')
            wait_for(GO_BASE + '/health')

            ops = {name: opener()[0] for name in ('python', 'go')}
            bases = {'python': PY_BASE, 'go': GO_BASE}
            cases = []
            for name, method, path, body in [
                ('health', 'GET', '/health', None),
                ('metrics_initial', 'GET', '/metrics', None),
                ('session_unauth', 'GET', '/api/auth/session', None),
                ('root', 'GET', '/', None),
                ('google_invalid', 'POST', '/api/auth/google', {'credential': 'bad-token'}),
            ]:
                res = {}
                for backend in bases:
                    status, headers, text = request(ops[backend], method, bases[backend] + path, body)
                    res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
                cases.append((name, res))

            res = {}
            for backend in bases:
                status, headers, text = request(ops[backend], 'POST', bases[backend] + '/api/auth/guest', {'display_name': 'Guest User'})
                res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
            cases.append(('guest_login', res))

            res = {}
            for backend in bases:
                status, headers, text = request(ops[backend], 'GET', bases[backend] + '/api/auth/session')
                res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
            cases.append(('session_after_guest', res))

            res = {}
            for backend in bases:
                status, headers, text = request(ops[backend], 'POST', bases[backend] + '/api/auth/logout')
                res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
            cases.append(('logout_after_guest', res))

            res = {}
            for backend in bases:
                status, headers, text = request(ops[backend], 'GET', bases[backend] + '/api/auth/session')
                res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
            cases.append(('session_after_logout', res))

            local_ops = {name: opener()[0] for name in ('python', 'go')}
            res = {}
            for backend in bases:
                status, headers, text = request(local_ops[backend], 'POST', bases[backend] + '/api/auth/signup', {'display_name': 'Local User', 'email': 'local@example.com', 'password': 'password123'})
                res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
            cases.append(('local_signup', res))

            res = {}
            for backend in bases:
                status, headers, text = request(local_ops[backend], 'POST', bases[backend] + '/api/auth/login', {'email': 'local@example.com', 'password': 'password123'})
                res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
            cases.append(('local_login', res))

            res = {}
            for backend in bases:
                status, headers, text = request(local_ops[backend], 'POST', bases[backend] + '/api/auth/signup', {'display_name': 'Another User', 'email': 'local@example.com', 'password': 'password123'})
                res[backend] = {'status': status, 'headers': normalize_headers(headers), 'raw_body': text, 'norm_body': normalize_json(text)}
            cases.append(('local_signup_duplicate', res))
            summary = []
            failures = []
            for name, res in cases:
                p = res['python']
                g = res['go']
                exact = (p['status'], p['headers'], p['raw_body']) == (g['status'], g['headers'], g['raw_body'])
                normalized = (p['status'], p['headers'], p['norm_body']) == (g['status'], g['headers'], g['norm_body'])
                summary.append({'case': name, 'exact_match': exact, 'normalized_match': normalized})
                if not normalized:
                    failures.append(name)
            print(json.dumps(summary, indent=2))
            if failures:
                print('HTTP parity failures:', ', '.join(failures), file=sys.stderr)
                return 1
            return 0
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
