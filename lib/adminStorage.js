import fs from "fs";
import path from "path";
import { dedupeCatalog } from "./adminCatalog";

const DATA_PATH = path.join(process.cwd(), "data", "videos.json");
const AUDIT_PATH = path.join(process.cwd(), "data", "admin_audit.json");
const SNAPSHOTS_DIR = path.join(process.cwd(), "data", "snapshots");

function safeReadJson(filePath, fallback) {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

export function readCatalog() {
  return dedupeCatalog(safeReadJson(DATA_PATH, []));
}

export function writeCatalog(catalog) {
  const normalized = dedupeCatalog(catalog);
  fs.writeFileSync(DATA_PATH, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

export function readAuditLog() {
  return safeReadJson(AUDIT_PATH, []);
}

export function appendAudit(entry) {
  const existing = readAuditLog();
  const next = [
    ...existing,
    {
      id: `audit-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    },
  ].slice(-300);
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next[next.length - 1];
}

export function createSnapshot(catalog, reason = "manual") {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${stamp}-${reason}.json`;
  const fullPath = path.join(SNAPSHOTS_DIR, fileName);
  fs.writeFileSync(fullPath, JSON.stringify(catalog, null, 2), "utf-8");
  return { fileName, fullPath };
}

export function rollbackFromSnapshot(fileName) {
  const safeName = String(fileName || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeName) throw new Error("Snapshot invalido");
  const fullPath = path.join(SNAPSHOTS_DIR, safeName);
  const snapshotData = safeReadJson(fullPath, null);
  if (!Array.isArray(snapshotData)) throw new Error("No se pudo leer snapshot");
  return writeCatalog(snapshotData);
}

export function listSnapshots() {
  try {
    if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
    return fs
      .readdirSync(SNAPSHOTS_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 50);
  } catch {
    return [];
  }
}

