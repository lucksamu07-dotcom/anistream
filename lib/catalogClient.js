export async function fetchCatalog() {
  try {
    const res = await fetch("/api/getData");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
