import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

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
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS: allow split-deployment (frontend on a different origin).
  // Set CORS_ORIGIN to a comma-separated whitelist, or "*" to allow any origin.
  const corsOrigin = (process.env.CORS_ORIGIN || "*").trim();
  app.use(cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(",").map(s => s.trim()),
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
          return res.status(413).json({ error: "File too large (Max: 15MB)" });
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
