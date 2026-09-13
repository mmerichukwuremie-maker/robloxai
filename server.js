```javascript
const express = require("express");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ROBLOX_SHARED_SECRET = process.env.ROBLOX_SHARED_SECRET || "";

const MODEL = "openai/gpt-oss-20b";

if (!GROQ_API_KEY) {
  console.warn("[Backend] WARNING: GROQ_API_KEY is not set.");
}

if (!ROBLOX_SHARED_SECRET) {
  console.warn("[Backend] WARNING: ROBLOX_SHARED_SECRET is not set.");
}

app.get("/", (req, res) => {
  res.send("Roblox AI chat backend is running.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    groqKeyConfigured: !!GROQ_API_KEY,
    sharedSecretConfigured: !!ROBLOX_SHARED_SECRET
  });
});

app.post("/chat", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      console.error("[Backend] GROQ_API_KEY is missing.");
      return res.status(500).json({
        error: "groq_api_key_missing"
      });
    }

    if (ROBLOX_SHARED_SECRET) {
      const providedSecret = req.header("x-shared-secret");

      if (providedSecret !== ROBLOX_SHARED_SECRET) {
        console.warn("[Backend] Invalid Roblox shared secret.");
        return res.status(401).json({
          error: "unauthorized"
        });
      }
    }

    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "messages array required"
      });
    }

    const cleanMessages = messages
      .slice(-20)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || "").slice(0, 2000)
      }));

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a friendly, upbeat AI assistant inside a Roblox experience. " +
                "Keep replies short, around 1 to 3 sentences. " +
                "Be helpful, fun, and appropriate for a general Roblox audience. " +
                "Do not produce inappropriate or unsafe content."
            },
            ...cleanMessages
          ],
          max_completion_tokens: 400
        })
      }
    );

    const responseText = await groqResponse.text();

    if (!groqResponse.ok) {
      console.error("[Backend] Groq API error:");
      console.error("[Backend] Status:", groqResponse.status);
      console.error("[Backend] Response:", responseText);

      return res.status(502).json({
        error: "upstream_error",
        upstreamStatus: groqResponse.status
      });
    }

    let data;

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[Backend] Failed to parse Groq response:");
      console.error(responseText);

      return res.status(502).json({
        error: "invalid_upstream_response"
      });
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "(The AI didn't return a response.)";

    console.log("[Backend] Groq response received successfully.");

    return res.json({
      reply
    });

  } catch (error) {
    console.error("[Backend] Server error:", error);

    return res.status(500).json({
      error: "server_error"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Backend] Listening on port ${PORT}`);
  console.log(`[Backend] Model: ${MODEL}`);
});
```
