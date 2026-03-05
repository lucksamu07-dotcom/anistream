export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-black/70 backdrop-blur-lg">
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-neutral-400 mb-6">Página no encontrada.</p>
      <a href="/" className="text-pink-500 underline hover:text-pink-400">Volver al inicio</a>
    </div>
  );
}
