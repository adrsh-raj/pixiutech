import asyncio
import json
import unittest
from unittest.mock import patch

import httpx
from starlette.requests import Request

from config import config
from engine import VisibleText
from loader import model_holder
from server import ChatCompletionRequest, worker_generation
from worker_relay import relay_generation


class WorkerStreamingTests(unittest.TestCase):
    def test_split_reasoning_tags(self):
        visible = VisibleText()
        parts = ["<thi", "nk>private", "</thin", "k>Haan ", "bhai"]
        self.assertEqual("".join(visible.feed(part) for part in parts), "Haan bhai")
        self.assertEqual(VisibleText().feed("<think>unfinished", final=True), "")
        self.assertEqual(VisibleText().feed('print("<think>")', final=True), 'print("<think>")')

    def test_worker_posts_first_chunk_before_reading_completion(self):
        uploads = []
        def events():
            yield b'{"delta":"Haan "}\n'
            self.assertEqual(uploads, [{"seq": 1, "worker_id": "w", "delta": "Haan "}])
            yield b'{"delta":"bhai"}\n{"completion":{"answer":"Haan bhai"}}\n'

        def handle(request):
            if request.url.host == "127.0.0.1":
                self.assertNotIn("X-Worker-Secret", request.headers)
                return httpx.Response(200, stream=Chunks())
            self.assertEqual(request.url.path, "/api/v1/xen/worker/jobs/j/chunk")
            self.assertEqual(request.headers["X-Worker-Secret"], "fixture")
            uploads.append(json.loads(request.content))
            return httpx.Response(200)

        class Chunks(httpx.SyncByteStream):
            def __iter__(self):
                yield from events()

        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            final = relay_generation(client, "internal", "https://fixture.invalid", "fixture", "w", "j", {})
        self.assertEqual(final["answer"], "".join(item["delta"] for item in uploads))

    def test_server_yields_before_generation_finishes(self):
        async def check():
            permit = asyncio.Event()
            async def generate(*args, emit, **kwargs):
                emit("Haan ")
                await permit.wait()
                emit("bhai")
                return dict(text="Haan bhai", finish_reason="stop", prompt_tokens=1, completion_tokens=2,
                            total_tokens=3, latency_seconds=1, throughput_tok_s=2)
            req = Request({"type":"http", "headers":[(b"x-api-key", b"fixture")]})
            body = ChatCompletionRequest(model="pixiumind-step-700", messages=[{"role":"user","content":"Hi"}])
            with patch.object(config, "api_key", "fixture"), patch.object(model_holder, "is_ready", True), \
                    patch.object(model_holder, "is_verified", True), patch("server.async_generate", generate):
                response = await worker_generation(body, req)
                iterator = response.body_iterator
                self.assertEqual(json.loads(await asyncio.wait_for(anext(iterator), 2)), {"delta":"Haan "})
                permit.set()
                self.assertEqual(json.loads(await anext(iterator)), {"delta":"bhai"})
                self.assertIn("completion", json.loads(await anext(iterator)))
                await iterator.aclose()
        asyncio.run(check())
