export default function ThemeScript() {
  const code = `
  (function () {
    try {
      var saved = localStorage.getItem("theme");
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var isDark = saved ? saved === "dark" : prefersDark;

      if (isDark) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch (e) {}
  })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
