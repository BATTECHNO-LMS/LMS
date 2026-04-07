export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer">
      <p className="app-footer__text">
        © {year} BATTECHNO-LMS — جميع الحقوق محفوظة
      </p>
    </footer>
  );
}
