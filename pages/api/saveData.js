// /pages/api/saveData.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }
  try {
    const filePath = path.join(process.cwd(), "data", "videos.json");
    const body = Array.isArray(req.body) ? req.body : [];
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf8");
    return res.status(200).json({ message: "✅ Datos guardados correctamente." });
  } catch (err) {
    console.error("saveData error:", err);
    return res.status(500).json({ message: "❌ Error al guardar los datos." });
  }
}
