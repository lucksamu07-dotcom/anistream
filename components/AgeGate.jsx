import { useState, useEffect } from "react";

export default function AgeGate({ onAccept }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const accepted = localStorage.getItem("ageVerified");
    if (accepted === "true") {
      setShow(false);
      onAccept();
    }
  }, [onAccept]);

  const handleAccept = () => {
    localStorage.setItem("ageVerified", "true");
    setShow(false);
    onAccept();
  };

  const handleReject = () => {
    alert("Debes tener 18 años o más para acceder a este sitio.");
    window.location.href = "https://google.com";
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md text-center p-6">
      <div className="bg-neutral-900 text-white rounded-2xl p-8 max-w-md w-full shadow-xl border border-white/10">
        <h1 className="text-3xl font-bold mb-4 text-purple-400">⚠️ Advertencia +18</h1>
        <p className="text-sm text-neutral-300 mb-6">
          Este sitio contiene contenido para adultos. Debes confirmar que tienes 18 años o más para continuar.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={handleAccept}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
          >
            Tengo +18
          </button>
          <button
            onClick={handleReject}
            className="px-6 py-2 bg-neutral-700 hover:bg-neutral-800 rounded-lg font-medium"
          >
            No tengo +18
          </button>
        </div>
      </div>
    </div>
  );
}
