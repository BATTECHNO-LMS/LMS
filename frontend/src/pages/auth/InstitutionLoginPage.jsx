import { LoginPage } from './LoginPage.jsx';
import { PORTAL_TYPES } from '../../constants/portalConfig.js';

export function InstitutionLoginPage() {
  return <LoginPage portalType={PORTAL_TYPES.INSTITUTION} />;
}

export function UniversitiesLoginPage() {
  return <LoginPage portalType={PORTAL_TYPES.UNIVERSITY} />;
}
