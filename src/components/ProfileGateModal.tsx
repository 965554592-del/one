import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { X } from 'lucide-react';

interface Props {
  onComplete: () => void;
  onClose: () => void;
}

export default function ProfileGateModal({ onComplete, onClose }: Props) {
  const { t } = useTranslation();
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        company: company.trim(),
        phone: phone.trim(),
        country: country.trim(),
        profileCompleted: true,
      }, { merge: true });
      onComplete();
    } catch (err) {
      console.error('[ProfileGate] Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#112240] rounded-2xl border border-white/10 shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-[#8892B0] hover:text-white transition-colors">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <h3 className="text-lg font-bold text-[#E6F1FF] mb-1">
          {t('profile_gate.title', 'Complete Your Profile')}
        </h3>
        <p className="text-sm text-[#8892B0] mb-5">
          {t('profile_gate.desc', 'Please provide your contact information to download documents.')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8892B0] mb-1">
              {t('profile_gate.company', 'Company Name')} *
            </label>
            <input
              type="text"
              required
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. ABC Trading Co."
              className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8892B0] mb-1">
              {t('profile_gate.phone', 'Phone / WhatsApp')} *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +86 138 0000 0000"
              className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8892B0] mb-1">
              {t('profile_gate.country', 'Country / Region')} *
            </label>
            <input
              type="text"
              required
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="e.g. United Arab Emirates"
              className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-[#FFB300] text-[#0A192F] font-bold rounded-lg hover:bg-[#FFCA28] transition-colors disabled:opacity-50"
          >
            {saving
              ? t('profile_gate.saving', 'Saving...')
              : t('profile_gate.submit', 'Save & Download')}
          </button>
        </form>
      </div>
    </div>
  );
}
