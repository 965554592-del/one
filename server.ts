import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import os from "os";
import nodemailer from "nodemailer";
import { Resend } from "resend";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit (supports 1080p video ≤30s)
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS: allow split-deployment (frontend on a different origin).
  // CORS_ORIGIN can be:
  //   - "*"  : allow any origin
  //   - comma-separated list of exact origins or wildcard patterns like "*.autoparts.fit"
  //     (matches any subdomain, e.g. www.autoparts.fit, vida.autoparts.fit)
  const corsOrigin = (process.env.CORS_ORIGIN || "*").trim();
  const corsMatchers = corsOrigin === "*"
    ? null
    : corsOrigin.split(",").map(s => s.trim()).filter(Boolean).map(pattern => {
        if (pattern.includes("*")) {
          // Convert "*.autoparts.fit" -> /^https?:\/\/([^.]+\.)?autoparts\.fit$/
          const escaped = pattern
            .replace(/^https?:\/\//, "")
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\\\*/g, "[^.]+");
          return new RegExp(`^https?:\\/\\/${escaped}$`, "i");
        }
        // Exact match, normalize to include protocol if missing
        return /^https?:\/\//i.test(pattern) ? pattern : `https://${pattern}`;
      });
  app.use(cors({
    origin: corsMatchers === null
      ? true
      : (origin, cb) => {
          if (!origin) return cb(null, true); // same-origin / curl
          const ok = corsMatchers.some(m =>
            typeof m === "string" ? m === origin : m.test(origin)
          );
          cb(ok ? null : new Error(`CORS blocked: ${origin}`), ok);
        },
  }));

  // PUBLIC_BASE_URL used to build absolute URLs for uploaded files so the
  // frontend (on another origin) can load them directly.
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  app.use(express.json());

  // Serve uploaded files explicitly with correct content types
  app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      }
    }
  }));

  // Prevent SPA fallback for missing files in /uploads
  app.use('/uploads', (req, res) => {
    res.status(404).send('File not found');
  });

  // API routes
  app.get("/api/health", (req, res) => {
    try {
      const files = fs.readdirSync(uploadsDir);
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        uploadsCount: files.length,
        backgroundTasks: [
          { name: "Daily Report Generation", status: "idle", lastRun: "2026-04-15T00:00:00Z" },
          { name: "Message Cleanup", status: "running", progress: "45%" }
        ]
      });
    } catch (err) {
      console.error("Health check error:", err);
      res.status(500).json({ error: "Failed to read uploads directory" });
    }
  });

  // File upload endpoint
  app.post("/api/upload", (req, res) => {
    console.log(`[Upload] Starting upload request: ${req.headers['content-length']} bytes`);
    
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error("[Upload] Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: "File too large (Max: 100MB)" });
        }
        return res.status(500).json({ error: `Upload error: ${err.message || 'Unknown'}` });
      }
      
      if (!req.file) {
        console.error("[Upload] No file found in request");
        return res.status(400).json({ error: "No file provided in the request" });
      }
      
      console.log(`[Upload] Success: ${req.file.filename} (${req.file.size} bytes)`);
      
      const relativeUrl = `/uploads/${req.file.filename}`;
      const fileUrl = publicBaseUrl ? `${publicBaseUrl}${relativeUrl}` : relativeUrl;
      // Ensure we always return JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ 
        url: fileUrl, 
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    });
  });

  // File deletion endpoint
  app.post("/api/delete-file", (req, res) => {
    const { fileUrl } = req.body;
    console.log(`[Delete] Request: ${fileUrl}`);
    
    // Accept either a relative "/uploads/..." path or an absolute URL ending with "/uploads/<file>".
    let uploadsPath: string | null = null;
    if (typeof fileUrl === "string") {
      const match = fileUrl.match(/\/uploads\/([^/?#]+)$/);
      if (match) uploadsPath = match[1];
    }
    if (!uploadsPath) {
      console.warn(`[Delete] Rejected invalid URL: ${fileUrl}`);
      return res.status(400).json({ error: "Invalid file URL" });
    }

    const fileName = uploadsPath;
    const filePath = path.join(uploadsDir, fileName);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[Delete] Success: ${fileName}`);
        res.json({ success: true });
      } catch (error) {
        console.error(`[Delete] Error unlinking ${fileName}:`, error);
        res.status(500).json({ error: "Failed to delete file" });
      }
    } else {
      console.warn(`[Delete] File not found on disk: ${fileName}`);
      res.status(404).json({ error: "File not found" });
    }
  });

  // ─── Video Transcode Endpoint ──────────────────────────────
  // Accepts an MP4/MOV upload, detects H.265/HEVC, transcodes to H.264,
  // and returns the transcoded file so the browser can upload it to
  // Firebase Storage via the normal client-side SDK.
  //
  // POST /api/transcode  (multipart/form-data, field name "file")
  // Response: the transcoded MP4 as application/octet-stream
  // ──────────────────────────────────────────────────────────
  app.post("/api/transcode", (req, res) => {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error("[Transcode] Multer error:", err);
        return res.status(500).json({ error: `Upload error: ${err.message}` });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Dynamically load ffmpeg so server can boot even if modules fail to load
      let ffmpeg: any;
      try {
        const ffmpegMod: any = await import("fluent-ffmpeg");
        ffmpeg = ffmpegMod.default || ffmpegMod;
        const ffmpegStaticMod: any = await import("ffmpeg-static");
        const ffmpegStatic = ffmpegStaticMod.default || ffmpegStaticMod;
        if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
      } catch (loadErr: any) {
        console.error("[Transcode] Failed to load ffmpeg modules:", loadErr);
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(500).json({ error: `ffmpeg unavailable: ${loadErr.message}` });
      }

      const inputPath = req.file.path;
      const outputPath = path.join(os.tmpdir(), `transcode-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

      console.log(`[Transcode] Starting: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)}MB)`);

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .outputOptions([
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-preset', 'fast',
          '-crf', '23',
        ])
        .audioCodec('aac')
        .on('start', (cmd: string) => console.log(`[Transcode] ffmpeg: ${cmd}`))
        .on('progress', (p: any) => {
          if (p.percent) console.log(`[Transcode] Progress: ${Math.round(p.percent)}%`);
        })
        .on('end', () => {
          console.log(`[Transcode] Done: ${outputPath}`);
          const stat = fs.statSync(outputPath);
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Length', stat.size.toString());
          res.setHeader('Content-Disposition', `attachment; filename="transcoded.mp4"`);

          const stream = fs.createReadStream(outputPath);
          stream.pipe(res);
          stream.on('end', () => {
            // Cleanup temp files
            try { fs.unlinkSync(inputPath); } catch {}
            try { fs.unlinkSync(outputPath); } catch {}
          });
        })
        .on('error', (ffErr: Error) => {
          console.error("[Transcode] ffmpeg error:", ffErr);
          try { fs.unlinkSync(inputPath); } catch {}
          try { fs.unlinkSync(outputPath); } catch {}
          if (!res.headersSent) {
            res.status(500).json({ error: `Transcode failed: ${ffErr.message}` });
          }
        })
        .save(outputPath);
    });
  });

  // Background task simulation
  let taskStatus = "idle";
  app.post("/api/admin/run-task", (req, res) => {
    taskStatus = "running";
    console.log("[Task] Starting sync task...");
    setTimeout(() => {
      taskStatus = "completed";
      console.log("[Task] Completed sync task.");
    }, 5000);
    res.json({ message: "Task started" });
  });

  app.get("/api/admin/task-status", (req, res) => {
    res.json({ status: taskStatus });
  });

  // ─── Email Sending Endpoint ───────────────────────────────
  // Supports two transports:
  //   1. Resend API (preferred) — pass { resendApiKey } in body
  //   2. SMTP/Nodemailer (fallback) — pass { smtp: { host, port, secure, user, pass } }
  // If both are provided, Resend takes priority.
  app.post("/api/send-email", async (req, res) => {
    const {
      resendApiKey, // Resend API key (takes priority over SMTP)
      smtp,         // { host, port, secure, user, pass }
      to,           // recipient email(s) — string or string[]
      subject,
      html,
      text,
      from,         // optional "Name <email>" override
      replyTo,
    } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: "Missing required fields (to, subject)" });
    }

    const recipients = Array.isArray(to) ? to : [to];

    // ── Resend transport ──
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const { data, error } = await resend.emails.send({
          from: from || "Vida Auto <onboarding@resend.dev>",
          to: recipients,
          replyTo: replyTo || undefined,
          subject,
          html: html || undefined,
          text: text || undefined,
        });

        if (error) {
          console.error("[Email/Resend] Error:", error);
          return res.status(400).json({ error: error.message || "Resend send failed" });
        }

        console.log(`[Email/Resend] Sent to ${recipients.join(", ")}: ${data?.id}`);
        return res.json({ success: true, messageId: data?.id, provider: "resend" });
      } catch (err: any) {
        console.error("[Email/Resend] Exception:", err);
        return res.status(500).json({ error: err.message || "Resend send failed" });
      }
    }

    // ── SMTP/Nodemailer transport (fallback) ──
    if (!smtp?.host || !smtp?.user || !smtp?.pass) {
      return res.status(400).json({ error: "Missing email configuration (provide resendApiKey or smtp config)" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: smtp.secure ?? (Number(smtp.port) === 465),
        auth: { user: smtp.user, pass: smtp.pass },
      });

      const info = await transporter.sendMail({
        from: from || `"Vida Auto" <${smtp.user}>`,
        to: recipients.join(", "),
        replyTo: replyTo || undefined,
        subject,
        text: text || undefined,
        html: html || undefined,
      });

      console.log(`[Email/SMTP] Sent to ${to}: ${info.messageId}`);
      res.json({ success: true, messageId: info.messageId, provider: "smtp" });
    } catch (err: any) {
      console.error("[Email/SMTP] Send failed:", err);
      res.status(500).json({ error: err.message || "Failed to send email" });
    }
  });

  // ─── Facebook Conversions API (CAPI) Proxy ──────────────────────
  // Server-side event tracking to supplement the browser pixel.
  // Accepts user data + event info, hashes PII, and sends to Meta Graph API.
  app.post("/api/fb-capi", async (req, res) => {
    const {
      pixelId,
      accessToken,
      testEventCode,    // optional – for testing in Events Manager
      eventName,        // e.g. 'Lead', 'Purchase', 'Contact'
      eventTime,        // unix seconds
      eventSourceUrl,   // page URL where event happened
      userData,         // { email, phone, fn, ln, country, city, ... }
      customData,       // { content_name, content_category, value, currency, ... }
      eventId,          // deduplication ID (should match fbq eventID)
    } = req.body;

    if (!pixelId || !accessToken) {
      return res.status(400).json({ error: "Missing pixelId or accessToken" });
    }
    if (!eventName) {
      return res.status(400).json({ error: "Missing eventName" });
    }

    // Hash user data fields with SHA-256 (Facebook requires lowercase pre-hash)
    const crypto = await import("crypto");
    const hash = (val: string | undefined) => {
      if (!val) return undefined;
      return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
    };

    const hashedUserData: Record<string, any> = {};
    if (userData) {
      if (userData.email) hashedUserData.em = [hash(userData.email)];
      if (userData.phone) hashedUserData.ph = [hash(userData.phone.replace(/[\s\-\(\)]/g, ''))];
      if (userData.fn) hashedUserData.fn = [hash(userData.fn)];
      if (userData.ln) hashedUserData.ln = [hash(userData.ln)];
      if (userData.country) hashedUserData.country = [hash(userData.country)];
      if (userData.city) hashedUserData.ct = [hash(userData.city)];
      // Pass-through non-PII
      if (userData.client_ip_address) hashedUserData.client_ip_address = userData.client_ip_address;
      if (userData.client_user_agent) hashedUserData.client_user_agent = userData.client_user_agent;
      if (userData.fbc) hashedUserData.fbc = userData.fbc;
      if (userData.fbp) hashedUserData.fbp = userData.fbp;
      if (userData.external_id) hashedUserData.external_id = [hash(userData.external_id)];
    }

    // Inject server-side IP if not provided
    if (!hashedUserData.client_ip_address) {
      hashedUserData.client_ip_address = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || "";
    }
    if (!hashedUserData.client_user_agent && req.headers["user-agent"]) {
      hashedUserData.client_user_agent = req.headers["user-agent"];
    }

    const eventData: any = {
      event_name: eventName,
      event_time: eventTime || Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: eventSourceUrl || "",
      user_data: hashedUserData,
    };
    if (customData) eventData.custom_data = customData;
    if (eventId) eventData.event_id = eventId;

    const payload: any = { data: [eventData] };
    if (testEventCode) payload.test_event_code = testEventCode;

    try {
      const fbRes = await fetch(
        `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const fbJson = await fbRes.json();
      if (!fbRes.ok) {
        console.error("[CAPI] Facebook error:", fbJson);
        return res.status(fbRes.status).json({ error: fbJson.error || fbJson });
      }
      console.log(`[CAPI] ${eventName} sent for pixel ${pixelId}:`, fbJson);
      res.json({ success: true, ...fbJson });
    } catch (err: any) {
      console.error("[CAPI] Network error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Task Scan Endpoint (cron alternative to Cloud Functions) ──
  // Hit this with an external cron service (e.g. cron-job.org) every hour:
  //   POST https://vida-api.onrender.com/api/tasks/scan
  //   Header: x-cron-key: <CRON_SECRET from env>
  //
  // Reads SMTP + tasks from Firestore, sends reminder email, marks tasks.
  app.post("/api/tasks/scan", async (req, res) => {
    // Simple auth – compare against env secret
    const cronSecret = process.env.CRON_SECRET || "";
    const providedKey = req.headers["x-cron-key"] || req.body?.cronKey || "";
    if (cronSecret && providedKey !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Dynamic import firebase-admin (only on this endpoint to keep startup fast)
      const { initializeApp, getApps } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");

      if (getApps().length === 0) {
        // Use default credentials in Cloud Run / Render with GOOGLE_APPLICATION_CREDENTIALS
        // or init with project ID only (Firestore in native mode)
        initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0915949910" });
      }

      const dbId = process.env.FIRESTORE_DB_ID || "ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140";
      const fdb = getFirestore(dbId);

      // Load settings
      const settingsSnap = await fdb.doc("settings/global").get();
      const s = settingsSnap.data() || {};
      if (!s.smtpHost || !s.smtpUser || !s.smtpPass || !s.notifyEmails) {
        return res.json({ skipped: true, reason: "SMTP or notify emails not configured" });
      }

      // Query due tasks
      const today = new Date().toISOString().slice(0, 10);
      const tasksSnap = await fdb
        .collection("tasks")
        .where("status", "==", "pending")
        .where("reminderSent", "==", false)
        .where("dueDate", "<=", today)
        .get();

      if (tasksSnap.empty) {
        return res.json({ reminded: 0 });
      }

      // Build email
      const taskRows = tasksSnap.docs.map(d => {
        const t = d.data();
        const overdue = t.dueDate < today;
        return `<tr style="background:${overdue ? '#fff5f5' : '#fff'};">
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.customerName || '-'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${overdue ? '#e53e3e' : '#333'};">${t.dueDate}${overdue ? ' OVERDUE' : ''}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.priority}</td>
        </tr>`;
      }).join("");

      const html = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:8px;">
        <h2 style="color:#FFB300;margin-top:0;">Task Reminder — ${tasksSnap.size} task(s) due</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#0A192F;color:#FFB300;">
            <th style="padding:10px 12px;text-align:left;">Task</th>
            <th style="padding:10px 12px;text-align:left;">Customer</th>
            <th style="padding:10px 12px;text-align:left;">Due Date</th>
            <th style="padding:10px 12px;text-align:left;">Priority</th>
          </tr></thead>
          <tbody>${taskRows}</tbody>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#666;">
          <a href="https://autoparts.fit/admin" style="color:#FFB300;">Open Admin Dashboard</a>
        </p>
      </div>`;

      const transporter = nodemailer.createTransport({
        host: s.smtpHost,
        port: Number(s.smtpPort) || 587,
        secure: s.smtpSecure ?? false,
        auth: { user: s.smtpUser, pass: s.smtpPass },
      });

      await transporter.sendMail({
        from: `"Vida Auto" <${s.smtpUser}>`,
        to: s.notifyEmails,
        subject: `[Vida Auto] ${tasksSnap.size} follow-up task(s) due`,
        html,
      });

      // Mark reminded
      const batch = fdb.batch();
      tasksSnap.docs.forEach(d => batch.update(d.ref, { reminderSent: true, lastRemindedAt: new Date().toISOString() }));
      await batch.commit();

      console.log(`[TaskScan] Reminded ${tasksSnap.size} tasks`);
      res.json({ reminded: tasksSnap.size });
    } catch (err: any) {
      console.error("[TaskScan] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Discord Weekly Report Webhook Receiver ─────────────────
  // Paste this URL into n8n: https://<your-domain>/api/webhooks/weekly-report
  // When n8n POSTs to this endpoint, it will:
  //   1. Save the weekly report to Firestore 'weeklyReports' collection.
  //   2. Forward the report to the Discord Webhook URL stored in settings/global.
  // ──────────────────────────────────────────────────────────
  app.post("/api/webhooks/weekly-report", async (req, res) => {
    const { title, content, embeds, author, metadata } = req.body;

    try {
      // Use Firebase Client SDK which authenticates via API Key from firebase-applet-config.json
      const { initializeApp, getApps, getApp } = await import("firebase/app");
      const { getFirestore, collection, addDoc, doc, getDoc } = await import("firebase/firestore");

      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      let app;
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }

      const fdb = getFirestore(app, firebaseConfig.firestoreDatabaseId || "vida-prod");

      // 1. Save the report to Firestore
      const reportData = {
        title: title || "Weekly Auto Parts Sourcing Report",
        content: content || "",
        embeds: embeds || null,
        author: author || "n8n Bot",
        metadata: metadata || null,
        receivedAt: new Date().toISOString(),
      };
      const reportRef = await addDoc(collection(fdb, "weeklyReports"), reportData);
      console.log(`[Webhook/WeeklyReport] Saved report ${reportRef.id} to Firestore.`);

      // 2. Fetch Discord settings
      const settingsSnap = await getDoc(doc(fdb, "settings", "global"));
      const s = settingsSnap.data() || {};
      const { discordWebhookUrl, discordWebhookEnabled } = s;

      if (!discordWebhookEnabled || !discordWebhookUrl) {
        console.log("[Webhook/WeeklyReport] Discord push is disabled or URL is missing - skipping Discord forward.");
        return res.json({ 
          success: true, 
          savedInFirestore: true, 
          reportId: reportRef.id, 
          discordPushed: false, 
          reason: "Discord integration disabled in settings" 
        });
      }

      // 3. Format Discord payload
      // If embeds are provided by n8n, use them; otherwise, build a clean, styled embed.
      let discordPayload: any = {};
      if (embeds && embeds.length > 0) {
        discordPayload = { embeds };
      } else {
        discordPayload = {
          content: content ? undefined : "🔔 **New Weekly Report Received!**",
          embeds: [
            {
              title: title || "Weekly Auto Parts Sourcing Report",
              description: content || "No content provided in report.",
              color: 16757504, // #FFB300 in decimal
              footer: {
                text: `Sender: ${author || 'n8n Bot'} • Vida Auto`,
              },
              timestamp: new Date().toISOString(),
            }
          ]
        };
      }

      // If content was sent as a raw string without embeds, we can also choose to send it as content
      if (content && !embeds) {
        discordPayload.content = `🔔 **${title || 'Weekly Report'}**\n\n${content}`;
        // If content is very long, Discord limit for 'content' is 2000 chars, so let's clip it if necessary
        if (discordPayload.content.length > 1950) {
          discordPayload.content = discordPayload.content.substring(0, 1900) + "\n\n... (content truncated)";
        }
        // Remove embeds since we are sending as raw content
        delete discordPayload.embeds;
      }

      // 4. POST to Discord
      const discordRes = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        console.error(`[Webhook/WeeklyReport] Discord Webhook error: ${discordRes.status} ${errText}`);
        return res.status(502).json({ 
          success: false, 
          savedInFirestore: true, 
          reportId: reportRef.id, 
          discordPushed: false, 
          error: `Discord Webhook returned status ${discordRes.status}` 
        });
      }

      console.log("[Webhook/WeeklyReport] Successfully pushed report to Discord.");
      res.json({ 
        success: true, 
        savedInFirestore: true, 
        reportId: reportRef.id, 
        discordPushed: true 
      });

    } catch (err: any) {
      console.error("[Webhook/WeeklyReport] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Discord Publish Log Webhook Receiver ─────────────────
  // Paste this URL into n8n: https://<your-domain>/api/webhooks/publish-log
  app.post("/api/webhooks/publish-log", async (req, res) => {
    const { topic, product, url, channels, status, timestamp } = req.body;

    try {
      const { initializeApp, getApps, getApp } = await import("firebase/app");
      const { getFirestore, collection, addDoc } = await import("firebase/firestore");

      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      let app;
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }

      const fdb = getFirestore(app, firebaseConfig.firestoreDatabaseId || "vida-prod");

      const logData = {
        topic: topic || "Unknown Topic",
        product: product || "Unknown Product",
        url: url || "",
        channels: channels || 1,
        status: status || "published",
        timestamp: timestamp || new Date().toISOString(),
        loggedAt: new Date().toISOString()
      };

      const logRef = await addDoc(collection(fdb, "publishLogs"), logData);
      console.log(`[Webhook/PublishLog] Saved publish log ${logRef.id} to Firestore.`);

      res.json({ success: true, savedInFirestore: true, logId: logRef.id });
    } catch (err: any) {
      console.error("[Webhook/PublishLog] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── AI Topic Hub Hook: Save Monitored Topics ─────────────
  // Paste this URL into n8n: https://<your-domain>/api/webhooks/save-topic
  app.post("/api/webhooks/save-topic", async (req, res) => {
    const { title, score, angle } = req.body;
    if (!title) return res.status(400).json({ error: "Missing title" });

    try {
      const { initializeApp, getApps } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");

      if (getApps().length === 0) {
        initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0915949910" });
      }

      const db = getFirestore();

      // Check if topic already exists to prevent duplication
      const snap = await db.collection("monitoredTopics").where("title", "==", title).get();
      if (!snap.empty) {
        return res.json({ success: true, message: "Duplicate topic, skipped.", alreadyExists: true });
      }

      // Determine product category
      const lowerTitle = title.toLowerCase();
      let product_name = "Auto Bulbs";
      if (lowerTitle.includes("mirror") || lowerTitle.includes("glass")) {
        product_name = "Mirror Lens";
      } else if (lowerTitle.includes("cover") || lowerTitle.includes("pc") || lowerTitle.includes("pmma") || lowerTitle.includes("housing")) {
        product_name = "Headlight Cover";
      }

      const topicData = {
        title,
        score: Number(score) || 5,
        angle: angle || "",
        product_name,
        used: false,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      const docRef = await db.collection("monitoredTopics").add(topicData);
      console.log(`[Webhook/SaveTopic] Saved topic ${docRef.id} to Firestore.`);

      res.json({ success: true, savedInFirestore: true, topicId: docRef.id });
    } catch (err: any) {
      console.error("[Webhook/SaveTopic] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── AI Topic Hub Hook: Get High-Scoring Topic and Mark Used ─────
  // Paste this URL into n8n: https://<your-domain>/api/webhooks/get-hot-topic
  app.get("/api/webhooks/get-hot-topic", async (req, res) => {
    try {
      const { initializeApp, getApps } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");

      if (getApps().length === 0) {
        initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0915949910" });
      }

      const db = getFirestore();

      const snap = await db.collection("monitoredTopics").where("used", "==", false).get();

      let chosenTopic: any = null;

      if (!snap.empty) {
        const topics = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        // Sort by score desc, then createdAt desc in-memory (highly robust, no composite indexes needed!)
        topics.sort((a, b) => {
          if (b.data.score !== a.data.score) {
            return (b.data.score || 0) - (a.data.score || 0);
          }
          return new Date(b.data.createdAt || 0).getTime() - new Date(a.data.createdAt || 0).getTime();
        });

        const top = topics[0];
        const docRef = db.collection("monitoredTopics").doc(top.id);
        await docRef.update({ used: true, status: "published", publishedAt: new Date().toISOString() });
        chosenTopic = {
          product_name: top.data.product_name,
          topic: top.data.title,
          angle: top.data.angle,
          source: "monitored"
        };
      }

      // Define standard fallbacks in case pool is empty
      const DB: any = {
        "Auto Bulbs": { name: 'Auto Bulbs', keywords: ['LED headlight manufacturer', 'headlight bulbs wholesale', 'auto lamp supplier'], topics: ['LED vs HID vs Halogen', 'Heat Dissipation & Lifespan', 'ECE R112 Anti-Glare', 'Automotive-Grade vs Generic', 'Canbus Compatibility'] },
        "Mirror Lens": { name: 'Mirror Lens', keywords: ['auto mirror glass manufacturer', 'replacement mirror wholesale', 'heated mirror glass'], topics: ['Blue Anti-glare Mirror', 'Heated Mirror Adoption', 'Blind Spot Assist', 'Durability & Quality', 'E-mark Certification'] },
        "Headlight Cover": { name: 'Headlight Cover', keywords: ['headlight lens wholesale', 'auto lamp cover manufacturer', 'UV resistant cover'], topics: ['UV Yellowing Prevention', 'PC vs PMMA vs Glass', 'Restore vs Replace', 'Light Transmittance', 'Mold Cost & MOQ'] }
      };

      if (!chosenTopic) {
        const keys = Object.keys(DB);
        const w = Math.floor(Date.now() / (7 * 864e5));
        const pk = keys[w % 3];
        const p = DB[pk];
        const t = p.topics[w % 5];
        chosenTopic = {
          product_name: p.name,
          topic: t,
          angle: "A general discussion on professional automotive aftermarket B2B sourcing standards.",
          source: "fallback"
        };
      }

      let keywords: string[] = [];
      if (chosenTopic.product_name === "Mirror Lens") {
        keywords = DB["Mirror Lens"].keywords;
      } else if (chosenTopic.product_name === "Headlight Cover") {
        keywords = DB["Headlight Cover"].keywords;
      } else {
        keywords = DB["Auto Bulbs"].keywords;
      }

      res.json({
        product_name: chosenTopic.product_name,
        topic: chosenTopic.topic,
        angle: chosenTopic.angle,
        keywords,
        source: chosenTopic.source,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[Webhook/GetHotTopic] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── AI Topic Hub Hook: Feedback Metrics (B2B Conversion Data) ───
  // Paste this URL into n8n: https://<your-domain>/api/webhooks/feedback-metrics
  app.get("/api/webhooks/feedback-metrics", async (req, res) => {
    try {
      const { initializeApp, getApps } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");

      if (getApps().length === 0) {
        initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0915949910" });
      }

      const db = getFirestore();

      // Query recent inquiries (B2B Conversions)
      const inquiriesSnap = await db.collection("inquiries").get();
      const inquiries = inquiriesSnap.docs.map(d => {
        const data = d.data();
        return {
          product: data.product || data.productName || "General Inquiry",
          message: data.message || data.comments || "",
          createdAt: data.createdAt || ""
        };
      });
      // Sort desc by createdAt and slice in memory
      inquiries.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      const recentInquiries = inquiries.slice(0, 15);

      // Query recent published logs
      const logsSnap = await db.collection("publishLogs").get();
      const logs = logsSnap.docs.map(d => {
        const data = d.data();
        return {
          topic: data.topic || "",
          product: data.product || "",
          channels: data.channels || 1,
          loggedAt: data.loggedAt || data.timestamp || ""
        };
      });
      logs.sort((a, b) => new Date(b.loggedAt || 0).getTime() - new Date(a.loggedAt || 0).getTime());
      const recentPublished = logs.slice(0, 15);

      res.json({
        success: true,
        recentInquiries,
        recentPublished,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[Webhook/FeedbackMetrics] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Comprehensive catch-all error handler for JSON responses
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[SERVER] Unhandled Error:", err);
    // Only send JSON error if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
