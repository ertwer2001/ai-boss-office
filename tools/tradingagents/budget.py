"""Per-run model budget enforced before a provider request; no implicit retries."""
import json
import threading
from datetime import datetime, timezone
from langchain_core.callbacks import BaseCallbackHandler


class Budget(BaseCallbackHandler):
    raise_error = True
    run_inline = True

    def __init__(self, limit):
        self.limit = limit
        self.calls = 0
        self.lock = threading.Lock()
        self.seen = set()
        self.tools = []
        self.tool_calls = {}

    def on_chat_model_start(self, serialized, messages, *, run_id, **kwargs):
        self.reserve(run_id)

    def on_llm_start(self, serialized, prompts, *, run_id, **kwargs):
        self.reserve(run_id)

    def reserve(self, run_id):
        with self.lock:
            if run_id in self.seen:
                return
            if self.calls >= self.limit:
                raise RuntimeError("TradingAgents model call budget reached")
            self.seen.add(run_id)
            self.calls += 1
        print(json.dumps({"event": "call", "calls": self.calls}), flush=True)

    def on_tool_end(self, output, *, run_id, **kwargs):
        content = getattr(output, "content", str(output))
        self.tools.append({"runId": str(run_id), **self.tool_calls.pop(str(run_id), {}), "retrievedAt": datetime.now(timezone.utc).isoformat(), "content": content})

    def on_tool_start(self, serialized, input_str, *, run_id, **kwargs):
        self.tool_calls[str(run_id)] = {"tool": (serialized or {}).get("name", "unknown"), "input": input_str}
