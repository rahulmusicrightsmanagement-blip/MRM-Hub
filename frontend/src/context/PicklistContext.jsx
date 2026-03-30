import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { withApiBase } from '../utils/api';

// Hardcoded fallbacks used when the DB has no items for a category
const FALLBACKS = {
  lead_stage: ['New Enquiry', 'Meeting Set', 'Qualified Lead', 'Not Qualified'],
  lead_source: ['Website Form', 'LinkedIn Outreach', 'Instagram DM', 'Industry Event', 'Referral', 'Direct Outreach'],
  member_roles: ['Singer-Songwriter', 'Playback Singer', 'Composer', 'Lyricist', 'Music Producer', 'Instrumentalist'],
  onboarding_stage: ['Document Submission', 'KYC Verification', 'Contract Signing', 'Active Member', 'Contact Made', 'Completed', 'Not Qualified'],
  onboarding_roles: ['Singer-Songwriter', 'Music Composer', 'Lyricist', 'Producer', 'Publisher', 'Artist Manager'],
  contract_type: ['Retainer', 'Royalty', 'Work-Based', 'Inhouse'],
  renewal_type: ['Auto Renewal', 'Mutual Renewal', 'No Renewal'],
  task_category: ['Pipeline', 'Onboarding', 'Registration', 'Internal', 'Members'],
  document_types: ['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID', 'Driving License', 'Bank Statement', 'Cancelled Cheque', 'Photograph'],
};

// Rich fallbacks for categories that need metadata (e.g. societies need flag)
const RICH_FALLBACKS = {
  societies: [
    { value: 'IPRS',           label: 'Indian Performing Right Society',               metadata: { flag: '🇮🇳' } },
    { value: 'PRS',            label: 'PRS for Music',                                 metadata: { flag: '🇬🇧' } },
    { value: 'ASCAP',          label: 'American Society of Composers',                 metadata: { flag: '🇺🇸' } },
    { value: 'PPL(INDIA)',     label: 'Phonographic Performance Ltd (India)',           metadata: { flag: '🇮🇳' } },
    { value: 'PPL(UK)',        label: 'Phonographic Performance Ltd (UK)',              metadata: { flag: '🇬🇧' } },
    { value: 'SOUND EXCHANGE', label: 'SoundExchange',                                 metadata: { flag: '🇺🇸' } },
    { value: 'ISAMRA',         label: 'Indian Singers & Musicians Rights Association',  metadata: { flag: '🇮🇳' } },
    { value: 'BMI',            label: 'Broadcast Music Inc.',                          metadata: { flag: '🇺🇸' } },
    { value: 'GEMA',           label: 'Gesellschaft für musikalische Aufführungs',     metadata: { flag: '🇩🇪' } },
    { value: 'MLC',            label: 'The Mechanical Licensing Collective',           metadata: { flag: '🇺🇸' } },
    { value: 'IMRO',           label: 'Irish Music Rights Organisation',               metadata: { flag: '🇮🇪' } },
    { value: 'SOCAN',          label: 'Society of Composers, Authors',                metadata: { flag: '🇨🇦' } },
  ],
};

const CATEGORY_LABELS = {
  lead_stage: 'Lead Stage',
  lead_source: 'Lead Source',
  member_roles: 'Member Roles',
  onboarding_stage: 'Onboarding Stage',
  onboarding_roles: 'Onboarding Roles',
  contract_type: 'Contract Type',
  renewal_type: 'Renewal Type',
  task_category: 'Task Category',
  document_types: 'Document Types',
  societies: 'Societies',
};

const PicklistContext = createContext(null);

export const PicklistProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [picklists, setPicklists] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchPicklists = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(withApiBase('/api/picklists'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch picklists');
      const data = await res.json();
      setPicklists(data);
    } catch {
      setPicklists({});
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) fetchPicklists();
    else setPicklists({});
  }, [user, fetchPicklists]);

  // Returns array of value strings for a category, falls back to hardcoded defaults
  const getOptions = useCallback(
    (category) => {
      const cat = picklists[category];
      if (cat && cat.items && cat.items.length > 0) return cat.items.map((i) => i.value);
      if (RICH_FALLBACKS[category]) return RICH_FALLBACKS[category].map((i) => i.value);
      return FALLBACKS[category] || [];
    },
    [picklists],
  );

  // Returns full item objects { _id, value, label, metadata } for a category
  const getItems = useCallback(
    (category) => {
      const cat = picklists[category];
      if (cat && cat.items && cat.items.length > 0) return cat.items;
      if (RICH_FALLBACKS[category]) return RICH_FALLBACKS[category].map((i) => ({ ...i }));
      return (FALLBACKS[category] || []).map((v) => ({ value: v, label: v, metadata: {} }));
    },
    [picklists],
  );

  return (
    <PicklistContext.Provider
      value={{ picklists, getOptions, getItems, fetchPicklists, loading, CATEGORY_LABELS, FALLBACKS }}
    >
      {children}
    </PicklistContext.Provider>
  );
};

export const usePicklist = () => useContext(PicklistContext);
