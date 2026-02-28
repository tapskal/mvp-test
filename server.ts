import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("appointments.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/appointments", (req, res) => {
    const appointments = db.prepare("SELECT * FROM appointments ORDER BY appointment_date ASC, appointment_time ASC").all();
    res.json(appointments);
  });

  app.post("/api/appointments", (req, res) => {
    const { client_name, phone_number, appointment_date, appointment_time } = req.body;
    const info = db.prepare(
      "INSERT INTO appointments (client_name, phone_number, appointment_date, appointment_time) VALUES (?, ?, ?, ?)"
    ).run(client_name, phone_number, appointment_date, appointment_time);
    
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/appointments/:id", (req, res) => {
    db.prepare("DELETE FROM appointments WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsMap = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsMap);
  });

  app.post("/api/settings", (req, res) => {
    const { n8n_webhook_url } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("n8n_webhook_url", n8n_webhook_url);
    res.json({ success: true });
  });

  // Proxy for n8n trigger (to avoid CORS issues if needed, or just for convenience)
  app.post("/api/trigger-reminder/:id", async (req, res) => {
    try {
      const appointment: any = db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id);
      const webhookUrl: any = db.prepare("SELECT value FROM settings WHERE key = ?").get("n8n_webhook_url");

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (!webhookUrl?.value) {
        return res.status(400).json({ error: "n8n Webhook URL not configured in settings" });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(webhookUrl.value, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointment),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        db.prepare("UPDATE appointments SET status = 'sent' WHERE id = ?").run(req.params.id);
        res.json({ success: true });
      } else {
        const errorText = await response.text();
        console.error("n8n error response:", errorText);
        res.status(502).json({ error: `n8n returned an error: ${response.status}` });
      }
    } catch (error: any) {
      console.error("Trigger error:", error);
      if (error.name === 'AbortError') {
        res.status(504).json({ error: "Request to n8n timed out" });
      } else {
        res.status(500).json({ error: "Failed to connect to n8n. Check your Webhook URL." });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
