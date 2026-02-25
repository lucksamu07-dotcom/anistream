// Simula una base de datos (guardar cambios)
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  const filePath = path.join(process.cwd(), "data", "videos.json");

  try {
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), "utf-8");
    res.status(200).json({ message: "Cambios guardados correctamente ✅" });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar los datos" });
  }
}
