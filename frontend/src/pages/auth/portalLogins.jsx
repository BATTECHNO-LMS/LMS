import { LoginPage } from './LoginPage.jsx';
import { ROLES } from '../../constants/roles.js';

export function AdminLoginPage() {
  return <LoginPage forcedRole={ROLES.SUPER_ADMIN} forcedRoleLabelAr="مسؤول النظام" forcedRoleLabelEn="System admin" />;
}

export function InstructorLoginPage() {
  return <LoginPage forcedRole={ROLES.INSTRUCTOR} forcedRoleLabelAr="مدرّس" forcedRoleLabelEn="Instructor" />;
}

export function StudentLoginPage() {
  return <LoginPage forcedRole={ROLES.STUDENT} forcedRoleLabelAr="طالب" forcedRoleLabelEn="Student" />;
}

export function ReviewerLoginPage() {
  return (
    <LoginPage
      forcedRole={ROLES.UNIVERSITY_REVIEWER}
      forcedRoleLabelAr="مراجع أكاديمي"
      forcedRoleLabelEn="Academic reviewer"
    />
  );
}
