import http from "node:http";

const port = 4010;
const maximumBodyBytes = 16 * 1024;
const messages = [];

const sendJson = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
};

const readJson = async (request) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodyBytes) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { status: "ok" });
  }

  if (request.method === "DELETE" && url.pathname === "/messages") {
    messages.length = 0;
    return sendJson(response, 200, { cleared: true });
  }

  if (request.method === "GET" && url.pathname === "/messages") {
    return sendJson(response, 200, messages);
  }

  if (request.method === "GET" && url.pathname.startsWith("/messages/")) {
    const phone = decodeURIComponent(url.pathname.slice("/messages/".length));
    const message = messages.find((candidate) => candidate.phone === phone);
    return message
      ? sendJson(response, 200, message)
      : sendJson(response, 404, { error: "No message found for phone" });
  }

  if (request.method === "POST" && url.pathname === "/sms") {
    try {
      const body = await readJson(request);
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const message = typeof body.message === "string" ? body.message : "";
      const codeFromMessage = message.match(/\b\d{4,8}\b/)?.[0];
      const code = body.code == null ? codeFromMessage : String(body.code);

      if (!phone || (!message && !code)) {
        return sendJson(response, 400, {
          error: "Expected { phone, message } or { phone, code }",
        });
      }

      const record = {
        phone,
        message: message || `Your Futzone code is ${code}`,
        code: code ?? null,
        receivedAt: new Date().toISOString(),
      };

      messages.unshift(record);
      messages.splice(50);

      console.log("\n========================================");
      console.log(`MOCK SMS  PHONE: ${record.phone}`);
      console.log(`MOCK SMS  OTP:   ${record.code ?? "not detected"}`);
      console.log(`MOCK SMS  TEXT:  ${record.message}`);
      console.log("========================================\n");

      return sendJson(response, 202, { accepted: true });
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "REQUEST_TOO_LARGE";
      return sendJson(response, tooLarge ? 413 : 400, {
        error: tooLarge ? "Request body is too large" : "Invalid JSON body",
      });
    }
  }

  return sendJson(response, 404, { error: "Not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Mock SMS server listening on http://0.0.0.0:${port}`);
});
