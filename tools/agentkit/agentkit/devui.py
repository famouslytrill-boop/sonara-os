"""A small web UI for testing, debugging and chatting with an agent.

    python -m agentkit.devui examples/research_team.py

## What it is for

Reading a final answer tells you very little about a multi-agent run. The
question is nearly always *why did that agent get the work*, and the only thing
that answers it is the trace: every transfer, every tool call with the arguments
the model actually sent, every result, and -- when the model searched -- the
queries it ran and the pages it read.

So the trace is not a debug panel tucked behind a toggle. It is half the screen.

## Two things it does not do

**It does not authenticate.** It binds to 127.0.0.1 by default and says so on
startup. Anybody who can reach the port can spend your API credit; that is
acceptable on a loopback interface and nowhere else, and the banner says that
rather than leaving it to be discovered.

**It does not present an unfinished run as an answer.** A run stopped at the
step limit is drawn as an interruption, in the colour used for problems, with
the step count -- because the last thing a model said before it ran out of turns
looks exactly like an answer and is not one.
"""

from __future__ import annotations

import argparse
import http.server
import importlib.util
import json
import os
import pathlib
import socketserver
import sys
import traceback

from .agents import Agent
from .errors import AgentkitError, NotConfigured
from .models import GeminiClient, OpenAICompatibleClient
from .runner import Runner

DEFAULT_PORT = 8900


# --- loading somebody's agent file ---------------------------------------


def load_agent(path: str, *, variable: str = "") -> Agent:
    """Import a Python file and take the agent out of it.

    Named `root_agent` by convention -- the same name Google's ADK uses, so a
    file written for one is loadable by the other. A file with exactly one
    `Agent` at module level is also accepted, because refusing it would be
    pedantry; a file with several and no `root_agent` is refused, naming them,
    since picking one would be a guess.
    """
    file = pathlib.Path(path).resolve()
    if not file.is_file():
        raise FileNotFoundError(f"no such file: {file}")

    spec = importlib.util.spec_from_file_location(file.stem, file)
    if spec is None or spec.loader is None:  # pragma: no cover - importlib contract
        raise ImportError(f"could not import {file}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)

    if variable:
        found = getattr(module, variable, None)
        if not isinstance(found, Agent):
            raise ValueError(f"{file.name} has no Agent called {variable!r}")
        return found

    root = getattr(module, "root_agent", None)
    if isinstance(root, Agent):
        return root

    agents = [value for name, value in vars(module).items() if isinstance(value, Agent) and not name.startswith("_")]
    if len(agents) == 1:
        return agents[0]
    if not agents:
        raise ValueError(f"{file.name} defines no Agent. Name one `root_agent`.")
    raise ValueError(
        f"{file.name} defines several agents ({', '.join(sorted(agent.name for agent in agents))}) and no `root_agent`. "
        "Name the one to serve `root_agent`, or pass --agent."
    )


def client_for(name: str):
    if name == "gemini":
        return GeminiClient()
    if name in ("openai", "openai-compatible"):
        return OpenAICompatibleClient()
    raise ValueError(f"unknown provider {name!r}; use gemini or openai")


# --- the page -------------------------------------------------------------

PAGE = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>__TITLE__ &middot; agentkit</title>
<link rel="stylesheet" href="/app.css">
</head><body>
<header>
  <strong id="root-name">&hellip;</strong>
  <span class="fine" id="provider"></span>
  <span class="fine warn">development only &mdash; no authentication</span>
</header>
<div class="panes">
  <aside id="tree" aria-label="The team"></aside>
  <main>
    <div id="chat" aria-live="polite"></div>
    <form id="ask">
      <input id="message" autocomplete="off" placeholder="Ask the agent something" aria-label="Message">
      <button type="submit">Send</button>
      <button type="button" id="reset" class="quiet">New session</button>
    </form>
  </main>
  <section id="trace" aria-label="What happened">
    <h2>Trace</h2>
    <p class="fine">Every transfer, tool call and result, in order, with the agent that made it.</p>
    <ol id="events"></ol>
  </section>
</div>
<script src="/app.js" defer></script>
</body></html>
"""

CSS = """
:root{color-scheme:dark light;--ink:#eceaf5;--quiet:#a6a1bb;--paper:#12111a;--raised:#1b1926;
--line:#2c2939;--accent:#9db8ff;--good:#79e0b4;--bad:#ff8f9e;--warm:#ffcf86;--radius:8px}
@media (prefers-color-scheme:light){:root{--ink:#181428;--quiet:#5b5470;--paper:#f8f7fc;--raised:#fff;
--line:#e3dff0;--accent:#3550a8;--good:#12704a;--bad:#ab2135;--warm:#8a5600}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{display:flex;gap:1rem;align-items:baseline;flex-wrap:wrap;padding:.7rem 1rem;
border-bottom:1px solid var(--line);background:var(--raised)}
.fine{font-size:.82rem;color:var(--quiet)}
.warn{color:var(--warm)}
.panes{display:grid;grid-template-columns:1fr;gap:1px;background:var(--line);min-height:calc(100vh - 50px)}
@media(min-width:70rem){.panes{grid-template-columns:15rem 1fr 24rem}}
aside,main,#trace{background:var(--paper);padding:1rem;overflow-y:auto;max-height:calc(100vh - 50px)}
h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--quiet);margin:0 0 .4rem}
.agent{border:1px solid var(--line);border-radius:var(--radius);padding:.6rem .7rem;margin:0 0 .6rem}
.agent.sub{margin-left:.9rem}
.agent b{display:block}
.tool{display:inline-block;font-size:.75rem;border:1px solid var(--line);border-radius:99px;
padding:.05rem .45rem;margin:.2rem .2rem 0 0;color:var(--quiet)}
.tool.native{border-color:var(--accent);color:var(--accent)}
#chat{display:flex;flex-direction:column;gap:.7rem;margin-bottom:1rem}
.turn{border:1px solid var(--line);border-radius:var(--radius);padding:.6rem .8rem;white-space:pre-wrap}
.turn.you{border-color:var(--accent)}
.turn.stopped{border-color:var(--bad);color:var(--bad)}
.turn .who{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--quiet);display:block}
form#ask{display:flex;gap:.5rem;flex-wrap:wrap;position:sticky;bottom:0;background:var(--paper);padding-top:.5rem}
input{flex:1 1 12rem;min-width:0;padding:.55rem .7rem;border:1px solid var(--line);border-radius:var(--radius);
background:var(--raised);color:var(--ink);font:inherit}
button{min-height:40px;padding:.5rem .9rem;border:1px solid transparent;border-radius:var(--radius);
background:var(--accent);color:var(--paper);font:inherit;font-weight:600;cursor:pointer}
button.quiet{background:transparent;color:var(--ink);border-color:var(--line);font-weight:500}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#events{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.45rem}
#events li{border-left:3px solid var(--line);padding:.35rem .6rem;font-size:.86rem}
#events li .k{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--quiet)}
#events li.tool_call{border-left-color:var(--warm)}
#events li.tool_result{border-left-color:var(--good)}
#events li.tool_result.failed,#events li.error,#events li.limit{border-left-color:var(--bad);color:var(--bad)}
#events li.transfer{border-left-color:var(--accent);color:var(--accent)}
pre{margin:.25rem 0 0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Menlo,Consolas,monospace;
font-size:.78rem;color:var(--quiet)}
.sources{margin:.4rem 0 0;padding-left:1rem;font-size:.8rem}
"""

SCRIPT = """
'use strict';
// No framework and no build step. The dev UI is meant to be readable by
// somebody debugging their agent, not another thing to debug.
(function () {
  var session = null;
  var chat = document.getElementById('chat');
  var events = document.getElementById('events');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  fetch('/api/agent').then(function (r) { return r.json(); }).then(function (info) {
    document.getElementById('root-name').textContent = info.name;
    document.getElementById('provider').textContent = info.provider + ' \\u00b7 ' + info.model;
    var tree = document.getElementById('tree');
    tree.appendChild(el('h2', null, 'The team'));
    info.agents.forEach(function (agent) {
      var box = el('div', 'agent' + (agent.depth ? ' sub' : ''));
      box.appendChild(el('b', null, agent.name));
      if (agent.description) box.appendChild(el('span', 'fine', agent.description));
      box.appendChild(el('div', 'fine', agent.model));
      agent.tools.forEach(function (tool) {
        box.appendChild(el('span', 'tool' + (tool.native ? ' native' : ''), tool.name));
      });
      tree.appendChild(box);
    });
  });

  function drawEvents(list) {
    events.innerHTML = '';
    list.forEach(function (event) {
      var failed = event.data && event.data.ok === false;
      var item = el('li', event.kind + (failed ? ' failed' : ''));
      item.appendChild(el('span', 'k', event.agent + ' \\u00b7 ' + event.kind));
      item.appendChild(el('div', null, event.text));
      var detail = event.data || {};
      var interesting = detail.arguments || (detail.value !== undefined ? { result: detail.value } : null);
      if (detail.error) item.appendChild(el('pre', null, detail.error));
      else if (interesting) item.appendChild(el('pre', null, JSON.stringify(interesting)));
      events.appendChild(item);
    });
  }

  function drawGrounding(grounding) {
    if (!grounding) return;
    var queries = grounding.webSearchQueries || [];
    var chunks = grounding.groundingChunks || [];
    var box = el('div', 'turn');
    box.appendChild(el('span', 'who', 'searched'));
    if (queries.length) box.appendChild(el('div', 'fine', queries.join(' \\u00b7 ')));
    var list = el('ul', 'sources');
    chunks.forEach(function (chunk) {
      var web = chunk.web || {};
      var row = el('li');
      if (web.uri) {
        var link = el('a', null, web.title || web.uri);
        link.href = web.uri;
        link.rel = 'noreferrer noopener';
        link.target = '_blank';
        row.appendChild(link);
      } else {
        row.textContent = web.title || 'a source with no address';
      }
      list.appendChild(row);
    });
    if (chunks.length) box.appendChild(list);
    if (queries.length || chunks.length) chat.appendChild(box);
  }

  function say(who, text, className) {
    var box = el('div', 'turn ' + (className || ''));
    box.appendChild(el('span', 'who', who));
    box.appendChild(el('div', null, text));
    chat.appendChild(box);
    box.scrollIntoView({ block: 'end' });
  }

  document.getElementById('ask').addEventListener('submit', function (submitted) {
    submitted.preventDefault();
    var input = document.getElementById('message');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    say('you', text, 'you');
    say('...', 'thinking');
    var waiting = chat.lastChild;

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: session, message: text })
    }).then(function (r) { return r.json(); }).then(function (answer) {
      chat.removeChild(waiting);
      session = answer.session || session;
      if (answer.problem) { say('problem', answer.problem, 'stopped'); return; }
      drawGrounding(answer.grounding);
      // An unfinished run is drawn as an interruption. The last thing a model
      // said before running out of turns looks exactly like an answer.
      if (answer.stop_reason !== 'final') {
        say(answer.agent + ' \\u2014 stopped after ' + answer.steps + ' steps, this is not a finished answer',
            answer.text || '(nothing was said)', 'stopped');
      } else {
        say(answer.agent, answer.text || '(the model said nothing)');
      }
      drawEvents(answer.events || []);
    }).catch(function (error) {
      chat.removeChild(waiting);
      say('problem', String(error), 'stopped');
    });
  });

  document.getElementById('reset').addEventListener('click', function () {
    session = null;
    chat.innerHTML = '';
    events.innerHTML = '';
  });
})();
"""


def build_handler(runner: Runner):
    """The request handler, closed over one runner."""
    sessions: dict = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = "agentkit-devui"

        def log_message(self, format, *args):  # noqa: A002 - stdlib signature
            # Quiet by default: the interesting log is the trace in the page.
            if os.environ.get("AGENTKIT_DEVUI_VERBOSE"):
                super().log_message(format, *args)

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            # Same policy as everything else here: no inline script, nothing
            # framing this, no third-party anything.
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'",
            )
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, status: int, payload: dict) -> None:
            self._send(status, json.dumps(payload).encode("utf-8"), "application/json")

        def do_GET(self) -> None:  # noqa: N802 - stdlib name
            if self.path in ("/", "/index.html"):
                page = PAGE.replace("__TITLE__", runner.agent.name)
                return self._send(200, page.encode("utf-8"), "text/html; charset=utf-8")
            if self.path == "/app.css":
                return self._send(200, CSS.encode("utf-8"), "text/css; charset=utf-8")
            if self.path == "/app.js":
                return self._send(200, SCRIPT.encode("utf-8"), "text/javascript; charset=utf-8")
            if self.path == "/api/agent":
                return self._json(200, describe(runner))
            return self._json(404, {"problem": "no such page"})

        def do_POST(self) -> None:  # noqa: N802 - stdlib name
            if self.path != "/api/chat":
                return self._json(404, {"problem": "no such endpoint"})
            length = int(self.headers.get("Content-Length") or 0)
            if length > 512 * 1024:
                return self._json(413, {"problem": "that message is too long"})
            try:
                asked = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                return self._json(400, {"problem": "that was not JSON"})

            message = str(asked.get("message") or "").strip()
            if not message:
                return self._json(400, {"problem": "say something"})

            key = asked.get("session")
            session = sessions.get(key) if key else None
            if session is None:
                session = runner.new_session()
                sessions[session.id] = session

            before = len(session.events)
            try:
                result = runner.run(message, session=session)
            except NotConfigured as error:
                return self._json(200, {"session": session.id, "problem": str(error)})
            except AgentkitError as error:
                return self._json(200, {"session": session.id, "problem": str(error)})
            except Exception as error:  # noqa: BLE001 - a dev UI must survive a bad agent
                traceback.print_exc()
                return self._json(200, {"session": session.id, "problem": f"{type(error).__name__}: {error}"})

            return self._json(200, {
                "session": session.id,
                "text": result.text,
                "agent": result.agent,
                "steps": result.steps,
                "stop_reason": result.stop_reason,
                "usage": result.usage,
                "grounding": result.grounding,
                # Only what this turn added, so the panel is the turn rather
                # than the whole session growing without bound.
                "events": [event.as_dict() for event in session.events[before:]],
            })

    return Handler


def describe(runner: Runner) -> dict:
    """The team, flattened for the sidebar."""
    rows = []

    def walk(agent: Agent, depth: int) -> None:
        rows.append({
            "name": agent.name,
            "description": agent.description,
            "model": agent.model,
            "depth": depth,
            "tools": [{"name": tool.name, "native": tool.native} for tool in agent.tools],
        })
        for sub in agent.sub_agents:
            walk(sub, depth + 1)

    walk(runner.agent, 0)
    return {
        "name": runner.agent.name,
        "model": runner.agent.model,
        "provider": getattr(runner.client, "name", "unknown"),
        "agents": rows,
    }


class _Server(socketserver.ThreadingTCPServer):
    # Otherwise a restart within the TIME_WAIT window fails to bind, which for
    # a tool you restart constantly is the most annoying possible default.
    allow_reuse_address = True
    daemon_threads = True


def serve(runner: Runner, *, host: str = "127.0.0.1", port: int = DEFAULT_PORT):
    return _Server((host, port), build_handler(runner))


def banner(runner: Runner, host: str, port: int) -> str:
    team = ", ".join(agent.name for agent in runner.agent.walk())
    return "\n".join([
        "",
        f"  agentkit dev UI on http://{host}:{port}",
        "",
        f"  agent      {runner.agent.name} ({runner.agent.model})",
        f"  team       {team}",
        f"  provider   {getattr(runner.client, 'name', 'unknown')}",
        "",
        # Said every time, because it is the thing nobody should discover later.
        "  no authentication. Anybody who reaches this port can spend your API credit.",
        f"  {'bound to loopback, which is the only place that is acceptable.' if host in ('127.0.0.1', 'localhost') else 'WARNING: not bound to loopback.'}",
        "",
    ])


def main(argv: "list[str] | None" = None) -> int:
    parser = argparse.ArgumentParser(prog="agentkit-devui", description="Chat with, test and debug an agent.")
    parser.add_argument("file", help="a Python file defining root_agent")
    parser.add_argument("--agent", default="", help="the variable to serve, if not root_agent")
    parser.add_argument("--provider", default="gemini", help="gemini (default) or openai")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--max-steps", type=int, default=12)
    arguments = parser.parse_args(argv)

    agent = load_agent(arguments.file, variable=arguments.agent)
    runner = Runner(agent, client=client_for(arguments.provider), max_steps=arguments.max_steps)

    server = serve(runner, host=arguments.host, port=arguments.port)
    sys.stdout.write(banner(runner, arguments.host, arguments.port))
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
