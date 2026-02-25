// /pages/api/getData.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Método no permitido" });
  }
  try {
    const filePath = path.join(process.cwd(), "data", "videos.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(raw || "[]");
    return res.status(200).json(json);
  } catch (err) {
    console.error("getData error:", err);
    return res.status(500).json({ message: "❌ Error leyendo videos.json" });
  }
}
