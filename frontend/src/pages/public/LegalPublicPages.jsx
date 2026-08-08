import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeFooter } from '../../components/landing/HomeFooter.jsx';
import { LandingBrandLogo } from '../../components/landing/LandingBrandLogo.jsx';
import { useLocale } from '../../features/locale/index.js';

const PRIVACY_EMAIL = 'privacy@battechno.com';

function LegalShell({ children, title }) {
  const { t } = useTranslation('landing');
  const { dir, locale, setLocale } = useLocale();

  return (
    <div id="battechno-landing" className="min-h-screen bg-[#F7F5F0]" dir={dir} lang={locale}>
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="landing-container flex items-center justify-between gap-4 py-4">
          <Link to="/" className="inline-flex items-center gap-3 no-underline">
            <LandingBrandLogo alt={t('brand')} className="!mb-0 !h-9" />
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="landing-footer__link"
              onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            >
              {locale === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link to="/login" className="landing-footer__link">
              {t('header.login')}
            </Link>
          </div>
        </div>
      </header>
      <main className="landing-container py-10 sm:py-14">
        <article className="mx-auto max-w-3xl rounded-[28px] border border-[#E6E8EC] bg-white p-6 shadow-sm sm:p-10">
          <h1 className="mb-2 text-3xl font-bold text-[#0F1C2E]">{title}</h1>
          {children}
        </article>
      </main>
      <HomeFooter />
    </div>
  );
}

function DeletionRequestForm() {
  const { t } = useTranslation('legal');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    const subject = encodeURIComponent('BATTECHNO LMS account deletion request');
    const body = encodeURIComponent(
      [
        'BATTECHNO LMS account deletion request',
        '',
        `Registered email: ${trimmedEmail}`,
        name.trim() ? `Name: ${name.trim()}` : null,
        '',
        message.trim() || 'I request deletion of my BATTECHNO LMS account and associated data.',
        '',
        'Please verify account ownership before processing.',
      ]
        .filter(Boolean)
        .join('\n')
    );

    window.location.href = `mailto:${PRIVACY_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-2xl border border-[#E6E8EC] bg-[#F9FAFB] p-4 sm:p-5">
      <p className="text-sm leading-6 text-[#4B5563]">{t('deletion.formIntro')}</p>
      <div>
        <label className="mb-1 block text-sm font-semibold text-[#0F1C2E]" htmlFor="deletion-email">
          {t('deletion.formEmail')}
        </label>
        <input
          id="deletion-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-[#1A2330] outline-none focus:border-[#0F1C2E]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-[#0F1C2E]" htmlFor="deletion-name">
          {t('deletion.formName')}
        </label>
        <input
          id="deletion-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-[#1A2330] outline-none focus:border-[#0F1C2E]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-[#0F1C2E]" htmlFor="deletion-message">
          {t('deletion.formMessage')}
        </label>
        <textarea
          id="deletion-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('deletion.formMessagePlaceholder')}
          className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-[#1A2330] outline-none focus:border-[#0F1C2E]"
        />
      </div>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#0F1C2E] px-4 py-3 text-sm font-semibold text-white sm:w-auto"
      >
        {t('deletion.formSubmit')}
      </button>
      <p className="text-sm text-[#6B7280]">{t('deletion.formHint')}</p>
    </form>
  );
}

export function PrivacyPolicyPage() {
  const { t } = useTranslation('legal');

  return (
    <LegalShell title={t('privacy.title')}>
      <p className="mb-6 text-sm text-[#6B7280]">{t('privacy.updated')}</p>
      <section className="space-y-5 text-[#1A2330] leading-7">
        <p>{t('privacy.intro')}</p>
        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('privacy.collectTitle')}</h2>
          <p>{t('privacy.collectBody')}</p>
        </div>
        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('privacy.useTitle')}</h2>
          <p>{t('privacy.useBody')}</p>
        </div>
        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('privacy.retentionTitle')}</h2>
          <p>{t('privacy.retentionBody')}</p>
        </div>
        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('privacy.deletionTitle')}</h2>
          <p>{t('privacy.deletionBody')}</p>
          <p className="mt-3">
            <Link className="landing-footer__link font-semibold" to="/account-deletion">
              {t('privacy.accountDeletionLink')}
            </Link>
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('privacy.contactTitle')}</h2>
          <p>{t('privacy.contactBody')}</p>
        </div>
      </section>
    </LegalShell>
  );
}

export function AccountDeletionPage() {
  const { t } = useTranslation('legal');

  return (
    <LegalShell title={t('deletion.title')}>
      <p className="mb-2 text-sm font-semibold text-[#B08A2E]">{t('deletion.subtitle')}</p>
      <section className="space-y-5 text-[#1A2330] leading-7">
        <p className="text-lg">{t('deletion.intro')}</p>

        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('deletion.verifyTitle')}</h2>
          <p>{t('deletion.verifyBody')}</p>
        </div>

        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('deletion.scopeTitle')}</h2>
          <p>{t('deletion.scopeBody')}</p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">{t('deletion.stepsTitle')}</h2>
          <ol className="list-decimal space-y-2 ps-5">
            <li>{t('deletion.step1')}</li>
            <li>{t('deletion.step2')}</li>
            <li>{t('deletion.step3')}</li>
            <li>{t('deletion.step4')}</li>
          </ol>
        </div>

        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('deletion.formTitle')}</h2>
          <DeletionRequestForm />
        </div>

        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('deletion.inactiveTitle')}</h2>
          <p>{t('deletion.inactiveBody')}</p>
        </div>

        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('deletion.deletedTitle')}</h2>
          <p>{t('deletion.deletedBody')}</p>
        </div>

        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('deletion.retainedTitle')}</h2>
          <p>{t('deletion.retainedBody')}</p>
        </div>

        <div>
          <h2 className="mb-1 text-xl font-semibold">{t('deletion.timingTitle')}</h2>
          <p>{t('deletion.timingBody')}</p>
        </div>

        <p>
          <Link className="landing-footer__link font-semibold" to="/privacy-policy">
            {t('deletion.privacyLink')}
          </Link>
        </p>

        <p className="text-sm text-[#6B7280]">
          {t('deletion.contactLabel')}:{' '}
          <a className="landing-footer__link font-semibold" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
        </p>
      </section>
    </LegalShell>
  );
}
