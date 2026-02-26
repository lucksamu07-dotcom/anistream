import fs from "fs";
import path from "path";
import { requireAdminApi } from "../../lib/adminAuth";

const DATA_PATH = path.join(process.cwd(), "data", "animes.json");

// Normaliza títulos
const normalizeTitle = (name) =>
  name
    .replace(/\.mp4|\.mkv/gi, "")
    .replace(/[_\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Extrae episodio desde nombre
const extractEpisode = (name) => {
  const match = name.match(/(\d{1,3})$/);
  return match ? parseInt(match[1]) : null;
};

// Convierte /v/ a /e/
const fixStreamtapeUrl = (url) =>
  url.replace("/v/", "/e/");

export default async function handler(req, res) {
  if (!requireAdminApi(req, res)) return;

  try {
    // Simulación: aquí deberías meter tu lista real de videos
    const streamtapeVideos = [
      {
        filename: "Hentai_Serie_X_01.mp4",
        url: "https://streamtape.com/v/abcd1234",
      },
    ];

    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const animes = JSON.parse(raw);

    streamtapeVideos.forEach((video) => {
      const episodeNumber = extractEpisode(video.filename);
      const baseTitle = normalizeTitle(video.filename.replace(/\d+$/, ""));

      let anime = animes.find(
        (a) => a.title.toLowerCase() === baseTitle.toLowerCase()
      );

      if (!anime) {
        anime = {
          id: baseTitle.toLowerCase().replace(/\s+/g, "-"),
          title: baseTitle,
          year: "",
          genre: "",
          description: "",
          cover: "/placeholder.jpg",
          episodes: [],
        };
        animes.push(anime);
      }

      const exists = anime.episodes.find(
        (e) => e.number === episodeNumber
      );

      if (!exists) {
        anime.episodes.push({
          id: `ep${episodeNumber}`,
          number: episodeNumber,
          title: `Episodio ${episodeNumber}`,
          sourceUrl: fixStreamtapeUrl(video.url),
        });
      }
    });

    fs.writeFileSync(DATA_PATH, JSON.stringify(animes, null, 2));

    res.json({ message: "Sincronización completada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
