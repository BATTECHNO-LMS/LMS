import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../../config/brand.js';

export function AppFooter() {
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer">
      <p className="app-footer__text">
        © {year} {APP_NAME}. {t('rights')}
      </p>
    </footer>
  );
}
