import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { userSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

export function UserCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'instructor',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(userSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    adminCrudStore.users.create({ ...res.data, lastLogin: '—' });
    navigate('/admin/users');
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="إنشاء مستخدم" description="أدخل بيانات المستخدم الجديد ثم احفظ." />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title="البيانات الأساسية"
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/users">
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> حفظ
              </button>
            </>
          }
        >
          <div className="crud-form-grid">
            <FormInput
              id="name"
              label="الاسم"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
              autoComplete="name"
            />
            <FormInput
              id="email"
              label="البريد الإلكتروني"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              error={errors.email}
              autoComplete="email"
            />
            <FormSelect
              id="role"
              label="الدور"
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              error={errors.role}
            >
              <option value="instructor">مدرّس</option>
              <option value="student">طالب</option>
              <option value="admin">إداري</option>
              <option value="qa_officer">مسؤول جودة</option>
            </FormSelect>
            <FormSelect
              id="status"
              label="الحالة"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
