export function trackEvent(event, payload = {}) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(localStorage.getItem("anistreamEvents") || "[]");
    const next = [
      ...current,
      {
        event: String(event || "unknown"),
        payload: payload || {},
        at: new Date().toISOString(),
      },
    ].slice(-300);
    localStorage.setItem("anistreamEvents", JSON.stringify(next));
  } catch {
    // Ignore analytics write failures to avoid breaking UX.
  }
}
