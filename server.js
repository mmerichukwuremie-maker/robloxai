// server.js
// Minimal backend proxy so your API key never touches Roblox.
// Uses Groq's free API (https://console.groq.com) instead of a paid one.
// Deploy this somewhere like Render, Railway, Fly.io, or a small VPS,
// then point BACKEND_URL in 3_ChatServer.lua at it.

const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Get a free key at https://console.groq.com/keys
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Fast, capable, free-tier model. Other options: "llama-3.3-70b-versatile",
// "gemma2-9b-it". Check console.groq.com/docs/models for the current list.
const MODEL = "llama-3.1-8b-instant";

if (!GROQ_API_KEY) {
  console.warn("WARNING: GROQ_API_KEY is not set.");
}

// Simple shared-secret check so random people can't hit your endpoint and
// burn through your free-tier limits. Must match SHARED_SECRET in
// 3_ChatServer.lua.
const SHARED_SECRET = process.env.ROBLOX_SHARED_SECRET || "";

app.post("/chat", async (req, res) => {
  try {
    if (SHARED_SECRET) {
      const provided = req.header("x-shared-secret");
      if (provided !== SHARED_SECRET) {
        return res.status(401).json({ error: "unauthorized" });
      }
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }

    // Keep only role/content fields, cap length defensively
    const cleanMessages = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, 2000),
    }));

    // Groq's API is OpenAI-compatible: chat/completions with a
    // system + messages array, not Anthropic's /v1/messages shape.
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 400,
          messages: [
            {
              role: "system",
              content:
                "You are a friendly, upbeat in-game assistant inside a " +
                "Roblox experience. Keep replies short (1-3 sentences), " +
                "safe for all ages, and avoid anything inappropriate for " +
                "a general audience.",
            },
            ...cleanMessages,
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error:", response.status, errText);
      return res.status(502).json({ error: "upstream_error" });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "(no response)";

    res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/", (req, res) => {
  res.send("Roblox AI chat backend is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
