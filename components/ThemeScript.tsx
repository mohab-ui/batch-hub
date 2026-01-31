export default function ThemeScript() {
  const code = `
  (function () {
    try {
      var saved = localStorage.getItem("theme");
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var theme = saved ? saved : (prefersDark ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {}
  })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
