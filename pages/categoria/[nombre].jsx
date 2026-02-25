import { useRouter } from "next/router";
import data from "../../data/videos.json";
import VideoCard from "../../components/VideoCard";

export default function CategoriaPage() {
  const router = useRouter();
  const { nombre } = router.query;
  const videos = data.filter((v) => v.category === nombre);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 text-white">
      <h1 className="text-3xl font-bold mb-8">Categoría: {nombre}</h1>
      {videos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <p className="text-neutral-400">No hay videos en esta categoría.</p>
      )}
    </main>
  );
}
