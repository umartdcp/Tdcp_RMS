import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function uploadsDir() {
  return process.env.TDCP_UPLOADS_DIR || path.join(__dirname, "../uploads");
}

function fail(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function saveDataUrl(prefix, dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) throw fail(400, "Invalid image data");
  const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(match[2], "base64");
  if (!buf.length) throw fail(400, "Image file is required");
  if (buf.length > 5 * 1024 * 1024) throw fail(400, "Image must be under 5MB");

  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const safePrefix = String(prefix || "image").replace(/[^a-zA-Z0-9_-]/g, "") || "image";
  const filename = `${safePrefix}-${Date.now()}.${ext}`;
  const filePath = path.join(dir, filename);
  try {
    fs.writeFileSync(filePath, buf);
  } catch (err) {
    if (err?.code === "EACCES" || err?.code === "EPERM" || err?.code === "EROFS") {
      throw fail(500, "The uploads folder is not writable.");
    }
    throw err;
  }
  return `/uploads/${filename}`;
}

export function readUpload(urlPath) {
  const name = path.basename(String(urlPath || ""));
  if (!name || (!name.startsWith("menu-") && !name.startsWith("resort-"))) return null;
  const root = path.resolve(uploadsDir());
  const filePath = path.resolve(root, name);
  if (path.dirname(filePath) !== root) return null;
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}
