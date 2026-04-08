import { useTranslation } from 'react-i18next';

export function AppFooter() {
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer">
      <p className="app-footer__text">
        © {year} {t('brand')} — {t('rights')}
      </p>
    </footer>
  );
}
