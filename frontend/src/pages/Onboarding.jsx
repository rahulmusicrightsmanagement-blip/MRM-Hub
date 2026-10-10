import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, X, AlertTriangle, CheckCircle2, ArrowRight, ChevronRight,
  Flame, Mail, Clock, CalendarClock,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch } from '../context/DataCacheContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useUrlState } from '../hooks/useUrlState';
import { useNotificationDeeplink } from '../hooks/useNotificationDeeplink';
import Pagination from '../components/Pagination';
import { journeyStages } from '../components/onboardingStyles';
import { T, TONES, TD, toneOf } from '../theme';
import {
  PageHeader, Button, Segmented, Card, Pill, DistributionBar,
  SearchInput, TH, EmptyState, Checkbox, SelectionBar, TableSkeleton, Banner, Panel,
  Avatar, PersonChip,
} from '../components/studio';

const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const daysToDeadline = (entry) => {
  if (!entry.deadline) return Infinity;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(entry.deadline);
  if (Number.isNaN(dl.getTime())) return Infinity;
  dl.setHours(0, 0, 0, 0);
  return Math.round((dl - now) / 86400000);
};

const describeTiming = (entry) => {
  const days = daysToDeadline(entry);
  if (days === Infinity) return { text: '', late: false, soon: false };
  if (days < 0) return { text: days === -1 ? 'was due yesterday' : `was due ${-days} days ago`, late: true, soon: false };
  if (days === 0) return { text: 'due today', late: true, soon: false };
  if (days === 1) return { text: 'due tomorrow', late: false, soon: true };
  if (days <= 7) return { text: `due in ${days} days`, late: false, soon: true };
  return { text: `due ${fmtDate(entry.deadline)}`, late: false, soon: false };
};

/* A client still being worked on — not finished. */
const isActive = (e) => e.stage !== 'Completed';
const isOverdue = (e) => isActive(e) && describeTiming(e).late;

const STAGE_TONES = {
  'Document Submission': 'blue',
  'KYC Verification': 'amber',
  'Contract Signing': 'purple',
  'Active Member': 'green',
  'Contact Made': 'teal',
  'Completed': 'grey',
};
const stageTone = (stage) => STAGE_TONES[stage] || 'indigo';

/* Progress through the stage list, so the Stage column can be sorted in
   journey order rather than alphabetically. */
const stageRank = (entry, stages) => {
  const i = stages.indexOf(entry.stage);
  return i < 0 ? stages.length : i;
};

const text = (v) => (v || '').toString().toLowerCase();
const blanksLast = (v) => (text(v) === '' ? 1 : 0);

const buildComparators = (stages) => ({
  name: (a, b) => text(a.name).localeCompare(text(b.name)),
  stage: (a, b) => stageRank(a, stages) - stageRank(b, stages),
  spoc: (a, b) => blanksLast(a.spoc) - blanksLast(b.spoc) || text(a.spoc).localeCompare(text(b.spoc)),
  deadline: (a, b) => { const d = daysToDeadline(a) - daysToDeadline(b); return Number.isNaN(d) ? 0 : d; },
  createdAt: (a, b) => (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0),
});

/* Contract type moved into the client cell — it is an attribute of the client,
   not a column worth 130px of scanning. */
const COLUMNS = [
  { key: 'name', label: 'Client', width: 'auto' },
  { key: 'stage', label: 'Stage', width: '190px' },
  { key: 'spoc', label: 'Owner', width: '150px' },
  { key: 'deadline', label: 'Timeline', width: '165px' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'active', label: 'In progress', test: isActive },
  { id: 'overdue', label: 'Overdue', test: isOverdue },
  { id: 'unassigned', label: 'No owner', test: (e) => !e.spoc },
  { id: 'done', label: 'Completed', test: (e) => e.stage === 'Completed' },
];

const VIEW_DEFAULTS = { q: '', stage: 'all', status: 'all', sort: 'createdAt', dir: 'desc', page: 1, size: 25 };

/* One spreadsheet row per client. Column order here is the column order in Excel. */
const toExportRow = (e) => ({
  'Client Name': e.name || '',
  'MRM ID': e.clientNumber || '',
  'Email': e.email || '',
  'Phone': e.phone || '',
  'Stage': e.stage || '',
  'Contract': e.contractType || '',
  'Owner': e.spoc || '',
  'Priority': e.priority || '',
  'WhatsApp Group Name': e.whatsAppGroupName || '',
  'Created Email': e.createdEmailAddress || '',
  'Password': e.createdEmailPassword || '',
  'Deadline': e.deadline ? fmtDate(e.deadline) : '',
  'Added on': fmtDate(e.createdAt) || '',
});

/* The one inline text link on this page. A link is not a control, so it takes
   the accent colour and an underline rather than a border. */
const LINK = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: T.accent, fontSize: '13.5px', fontWeight: 600, textDecoration: 'underline',
};

/**
 * How far along this client is, as six little bars rather than the words
 * "Step 3 of 6".
 *
 * It is the same fact, so nothing is being said twice — but a column of these
 * has a shape you can read down the page in one sweep, which a column of
 * sentences does not. The exact number is on the tooltip for anyone who wants
 * it, and the whole thing costs 4px of height. It deliberately echoes the
 * stepper on the detail page, so "where is this client" looks the same in both
 * places.
 */
const StepRail = ({ index, total, tone }) => {
  const c = toneOf(tone);
  return (
    <div
      title={`Step ${index + 1} of ${total}`}
      aria-label={`Step ${index + 1} of ${total}`}
      style={{ display: 'flex', gap: '3px', marginTop: '6px', maxWidth: '132px' }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: i < index ? c.bd : i === index ? c.fg : T.border,
          }}
        />
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════
   ONE ROW OF THE TABLE
   ═══════════════════════════════════════════ */
const ClientRow = ({ entry, stages, onOpen, selected, onToggleSelect }) => {
  const live = isActive(entry);
  // a deadline on a finished client is history — show it plainly, never as a warning
  const timing = live ? describeTiming(entry) : { text: '', late: false, soon: false };
  const dueTone = timing.late ? 'red' : timing.soon ? 'amber' : null;
  const idx = stages.indexOf(entry.stage);
  // only "high" earns a marker; flagging medium as well would flag most of the table
  const urgent = live && entry.priority === 'high';
  const name = entry.name || 'Unnamed client';

  /* The row is the click target, so it carries the whole hover — a faint wash
     plus a brand edge on the leading side. `T.raised` was far too saturated a
     fill for a hover on the light theme. */
  const rest = selected ? TONES.indigo.bg : 'transparent';
  const edge = selected ? T.accent : 'transparent';

  return (
    <tr
      onClick={() => onOpen(entry)}
      title={`Open ${name}`}
      style={{
        cursor: 'pointer', background: rest,
        boxShadow: `inset 3px 0 0 ${edge}`,
        transition: 'background 0.14s ease, box-shadow 0.14s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = TONES.grey.bg;
        e.currentTarget.style.boxShadow = `inset 3px 0 0 ${T.borderHi}`;
        const chev = e.currentTarget.querySelector('[data-chev]');
        if (chev) { chev.style.opacity = '1'; chev.style.transform = 'translateX(0)'; }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = rest;
        e.currentTarget.style.boxShadow = `inset 3px 0 0 ${edge}`;
        const chev = e.currentTarget.querySelector('[data-chev]');
        if (chev) { chev.style.opacity = '0'; chev.style.transform = 'translateX(-4px)'; }
      }}
    >
      {/* ticking a box is not "open this client" — without this, selecting a
          row navigated away from the list you were selecting in */}
      <td style={TD} onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={!!selected} onChange={onToggleSelect} label={`Select ${name}`} />
      </td>

      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <Avatar name={name} size={36} tone="auto" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span style={{
                fontSize: '14px', fontWeight: 600, color: T.heading,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {name}
              </span>
              {urgent && (
                <span title="High priority" style={{ display: 'inline-flex', flexShrink: 0, color: TONES.red.fg }}>
                  <Flame style={{ width: '13px', height: '13px' }} />
                </span>
              )}
              {entry.contractType && <Pill tone="teal">{entry.contractType}</Pill>}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px',
              fontSize: '12px', color: T.muted, minWidth: 0,
            }}>
              {entry.email && <Mail style={{ width: '11px', height: '11px', flexShrink: 0, color: T.faint }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.email || 'No email'}
              </span>
              {entry.clientNumber && (
                <>
                  <span style={{ color: T.faint, flexShrink: 0 }}>·</span>
                  <span style={{ flexShrink: 0, color: T.faint }}>MRM {entry.clientNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>

      <td style={TD}>
        <Pill tone={stageTone(entry.stage)} dot>{entry.stage}</Pill>
        {idx >= 0
          ? <StepRail index={idx} total={stages.length} tone={stageTone(entry.stage)} />
          : (
            <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '5px' }}>
              Not one of the configured stages
            </div>
          )}
      </td>

      <td style={TD}>
        <PersonChip name={entry.spoc} size={24} empty="Unassigned" />
      </td>

      <td style={TD}>
        {entry.deadline ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {dueTone
              ? <Pill tone={dueTone} icon={Clock}>{timing.text}</Pill>
              : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: T.body }}>
                  <CalendarClock style={{ width: '13px', height: '13px', color: T.faint }} />
                  {fmtDate(entry.deadline)}
                </span>
              )}
          </div>
        ) : (
          <span style={{ fontSize: '13.5px', color: T.faint }}>No deadline</span>
        )}
        <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '5px' }}>
          Added {fmtDate(entry.createdAt) || 'unknown'}
        </div>
      </td>

      {/* The row itself opens the client; this is the affordance that says so,
          which is why it appears on hover rather than sitting there always. */}
      <td style={{ ...TD, textAlign: 'right' }}>
        <span
          data-chev
          aria-hidden
          style={{
            display: 'inline-flex', color: T.accent, opacity: 0,
            transform: 'translateX(-4px)', transition: 'opacity 0.14s ease, transform 0.14s ease',
          }}
        >
          <ChevronRight style={{ width: '17px', height: '17px' }} />
        </span>
      </td>
    </tr>
  );
};

/* ═══════════════════════════════════════════
   MAIN ONBOARDING PAGE
   ═══════════════════════════════════════════ */
const Onboarding = () => {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { getOptions } = usePicklist();
  const STAGES = useMemo(() => journeyStages(getOptions('onboarding_stage')), [getOptions]);

  const [view, setView] = useUrlState(VIEW_DEFAULTS);
  const [selected, setSelected] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const searchRef = useRef(null);

  const entriesQ = useCachedFetch('onboarding:list', async () => {
    const r = await authFetch('/api/onboarding');
    const d = await r.json();
    return d.entries || [];
  });

  const entries = useMemo(() => entriesQ.data || [], [entriesQ.data]);
  const loading = entriesQ.loading && !entriesQ.data;

  const openEntry = useCallback((entry) => navigate(`/onboarding/${entry._id}`), [navigate]);

  // the search box stays local so typing is instant, then lands in the URL
  useEffect(() => {
    if (debouncedQuery !== view.q) setView({ q: debouncedQuery, page: 1 });
  }, [debouncedQuery, view.q, setView]);

  // "/" jumps to the search box
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el && el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
      e.preventDefault();
      if (searchRef.current) searchRef.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useNotificationDeeplink({
    expectedType: 'onboarding',
    records: entries,
    isReady: !loading,
    onOpen: openEntry,
    onMissing: () => addToast('This onboarding entry is no longer available (deleted or archived).', 'error'),
  });

  const comparators = useMemo(() => buildComparators(STAGES), [STAGES]);

  const rows = useMemo(() => {
    let list = entries;
    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e._id && e._id.toLowerCase().includes(q)) ||
        (e.clientNumber && e.clientNumber.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.phone && e.phone.includes(q)) ||
        (e.spoc && e.spoc.toLowerCase().includes(q)) ||
        (e.contractType && e.contractType.toLowerCase().includes(q))
      );
    }
    if (view.stage !== 'all') list = list.filter((e) => e.stage === view.stage);
    const sf = STATUS_FILTERS.find((s) => s.id === view.status);
    if (sf && sf.id !== 'all') list = list.filter(sf.test);

    const cmp = comparators[view.sort] || comparators.createdAt;
    return [...list].sort((a, b) => (view.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
  }, [entries, debouncedQuery, view.stage, view.status, view.sort, view.dir, comparators]);

  const totalPages = Math.max(1, Math.ceil(rows.length / view.size));
  const safePage = Math.min(Math.max(1, view.page), totalPages);
  const pageRows = rows.slice((safePage - 1) * view.size, safePage * view.size);

  const stageSegments = useMemo(() => STAGES.map((stage) => ({
    id: stage,
    label: stage,
    tone: stageTone(stage),
    value: entries.filter((e) => e.stage === stage).length,
  })), [entries, STAGES]);

  const statusOptions = STATUS_FILTERS.map((f) => ({
    value: f.id, label: f.label, count: entries.filter(f.test).length,
  }));

  const overdueCount = entries.filter(isOverdue).length;
  const filtersOn = !!searchQuery || view.stage !== 'all' || view.status !== 'all';
  const resetAll = () => { setSearchQuery(''); setView({ q: '', stage: 'all', status: 'all', page: 1 }); };
  const pickStage = (v) => setView({ stage: v, page: 1 });
  const pickStatus = (v) => setView({ status: v, page: 1 });
  const toggleSort = (key) => setView(
    view.sort === key
      ? { sort: key, dir: view.dir === 'asc' ? 'desc' : 'asc', page: 1 }
      : { sort: key, dir: ['name', 'stage', 'spoc'].includes(key) ? 'asc' : 'desc', page: 1 },
  );

  const pageIds = pageRows.map((e) => e._id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePage = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    return next;
  });

  const exportRows = (list, scope) => {
    try {
      if (!list.length) { addToast('Nothing to export', 'error'); return; }
      const data = list.map(toExportRow);
      const sheet = XLSX.utils.json_to_sheet(data);
      sheet['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 14 },
        { wch: 20 }, { wch: 10 }, { wch: 26 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Onboarding');
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Onboarding_${scope}_${stamp}.xlsx`);
      addToast(`Exported ${data.length} client${data.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error('Export error:', err);
      addToast('Failed to export Excel', 'error');
    }
  };

  return (
    // capped, because a table stretched across 1600px puts the owner column
    // an inch from the name it belongs to
    <div style={{ padding: '26px 30px 50px', maxWidth: '1560px', margin: '0 auto' }}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', to: '/' }, { label: 'Onboarding' }]}
        title="Onboarding"
        subtitle="Track every client from document submission through to an active membership."
        actions={
          <Button
            variant="ghost"
            icon={Download}
            disabled={loading || rows.length === 0}
            title={rows.length ? `Download these ${rows.length} client${rows.length === 1 ? '' : 's'} as Excel` : 'Nothing to export'}
            onClick={() => exportRows(rows, 'view')}
          >
            Export
          </Button>
        }
      />

      {/* A pointer, not a report: it says something needs attention and takes
          you there. The number itself stays on the Overdue chip. */}
      {!loading && entries.length > 0 && (
        overdueCount > 0
          ? (
            <Banner
              tone="amber"
              icon={AlertTriangle}
              action={(
                <Button
                  icon={ArrowRight}
                  onClick={() => pickStatus('overdue')}
                  title="Filter the list down to the clients past their deadline"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                >
                  Show them
                </Button>
              )}
            >
              Some clients have passed their deadline.
            </Banner>
          )
          : <Banner tone="green" icon={CheckCircle2}>Nothing is overdue. Everything here is on track.</Banner>
      )}

      {/* Where everything sits, and how to narrow it — one panel, no heading:
          the page is named once, and each count appears once. */}
      <Panel>
        <DistributionBar
          segments={stageSegments}
          active={view.stage}
          onSelect={pickStage}
          emptyLabel="Nobody is being onboarded yet"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${T.border}` }}>
          <Segmented options={statusOptions} value={view.status} onChange={pickStatus} tone="purple" />
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '400px', marginLeft: 'auto' }}>
            <SearchInput
              ref={searchRef}
              icon={Search}
              placeholder="Search name, MRM ID, email or owner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
            {/* the shortcut, shown as a key rather than smuggled into the
                placeholder where it read as part of the sentence */}
            {!searchQuery && (
              <kbd
                aria-hidden
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  padding: '2px 7px', borderRadius: '5px', pointerEvents: 'none',
                  background: T.bg, border: `1px solid ${T.border}`,
                  color: T.faint, fontSize: '11px', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                /
              </kbd>
            )}
          </div>
          {filtersOn && (
            <Button variant="ghost" icon={X} onClick={resetAll} title="Clear the search, the stage and the status filter" style={{ padding: '9px 14px', fontSize: '13px' }}>Reset</Button>
          )}
        </div>
      </Panel>

      <Card bodyStyle={{ padding: 0 }}>
        {selected.size > 0 && (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button
              variant="ghost"
              icon={Download}
              title={`Download the ${selected.size} ticked client${selected.size === 1 ? '' : 's'} as Excel`}
              style={{ padding: '7px 13px', fontSize: '13px' }}
              onClick={() => exportRows(entries.filter((e) => selected.has(e._id)), 'selected')}
            >
              Export selected
            </Button>
          </SelectionBar>
        )}

        {!loading && rows.length === 0 ? (
          <EmptyState icon={Search} title={entries.length === 0 ? 'Nobody is being onboarded yet' : 'Nothing matches these filters'}>
            {entries.length === 0
              ? (
                <>
                  Clients arrive here when a qualified lead is handed over.{' '}
                  <button type="button" onClick={() => navigate('/sales-pipeline')} style={LINK}>Open the Sales Pipeline</button>
                </>
              )
              : <button type="button" onClick={resetAll} style={LINK}>Reset the filters</button>}
          </EmptyState>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH width="44px">
                      {!loading && pageIds.length > 0 && (
                        <Checkbox
                          checked={allPageSelected}
                          indeterminate={selectedOnPage > 0 && !allPageSelected}
                          onChange={togglePage}
                          label="Select every client on this page"
                        />
                      )}
                    </TH>
                    {COLUMNS.map((col) => (
                      <TH
                        key={col.key}
                        sortable
                        width={col.width}
                        active={view.sort === col.key}
                        dir={view.dir}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                      </TH>
                    ))}
                    <TH width="56px" align="right" />
                  </tr>
                </thead>
                {loading ? (
                  <TableSkeleton columns={['17px', '60%', '70%', '55%', '65%', '18px']} rows={8} />
                ) : (
                  <tbody>
                    {pageRows.map((entry) => (
                      <ClientRow
                        key={entry._id}
                        entry={entry}
                        stages={STAGES}
                        onOpen={openEntry}
                        selected={selected.has(entry._id)}
                        onToggleSelect={() => toggleRow(entry._id)}
                      />
                    ))}
                  </tbody>
                )}
              </table>
            </div>
            {!loading && (
              <div style={{ padding: '0 16px' }}>
                <Pagination
                  page={safePage}
                  pageSize={view.size}
                  total={rows.length}
                  onPageChange={(p) => setView({ page: p })}
                  onPageSizeChange={(n) => setView({ size: n, page: 1 })}
                  pageSizeOptions={[25, 50, 100]}
                  label="Rows per page"
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default Onboarding;
