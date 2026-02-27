import express from "express";
import { handleIdentify } from "./identify";

const app = express();
app.use(express.json());

// health check — handy when deploying
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "bitespeed-identity" });
});

app.post("/identify", async (req, res) => {
  try {
    const result = await handleIdentify(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("identify error:", err);

    // if it's a validation-ish error, send 400
    if (err.message?.includes("Need at least")) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
