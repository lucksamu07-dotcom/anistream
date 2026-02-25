// Simula una base de datos (leer datos)
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), "data", "videos.json");

  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const jsonData = JSON.parse(data);
    res.status(200).json(jsonData);
  } catch (error) {
    res.status(500).json({ message: "Error al leer los datos" });
  }
}
