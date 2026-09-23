import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import routes from "./routes/index.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { notFoundHandler, globalErrorHandler } from "./middleware/errorHandler.js";
import { UploadedImage } from "./models/UploadedImage.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS Configuration
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, tests)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev mode
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP Request Logger
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Global Rate Limiter
app.use(generalLimiter);

// Serve Uploaded Files Statically with Persistent MongoDB Atlas Fallback (for Ephemeral Cloud Disks like Render)
app.use("/uploads", express.static(uploadsDir));
app.get("/uploads/:filename", async (req, res, next) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  try {
    const cached = await UploadedImage.findOne({ filename: req.params.filename }).lean();
    if (cached && cached.base64Data) {
      const buffer = Buffer.from(cached.base64Data, "base64");
      try {
        fs.writeFileSync(filePath, buffer);
      } catch (_) {}
      res.setHeader("Content-Type", cached.mimetype || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(buffer);
    }
  } catch (_) {}
  return res.status(404).json({ success: false, message: "Image not found." });
});

// Mount API Routes
app.use("/api", routes);

// Root Welcome Route
app.get("/", (req, res) => {
  res.json({
    project: "ChainArt — An Upgradeable Loyalty-Based NFT Marketplace",
    status: "online",
    documentation: "/api",
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(globalErrorHandler);

export default app;
