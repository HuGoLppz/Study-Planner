// Aplica el tema antes de pintar para evitar un destello de color. Se carga desde index.html sin
// diferir, antes que la app; va en un archivo aparte porque la CSP de la API no admite scripts en línea.
(function () {
  try {
    var stored = localStorage.getItem("sp-theme");
    var dark =
      stored === "dark" ||
      (stored !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
