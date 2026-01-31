export default function ThemeScript() {
  const code = `
  (function () {
    try {
      var stored = localStorage.getItem('theme'); // 'light' | 'dark' | 'system'
      var theme = stored || 'system';
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = theme === 'dark' || (theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.dataset.theme = theme;
    } catch (e) {}
  })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
