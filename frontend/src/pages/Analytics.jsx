import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid rgba(165, 214, 167, 0.55)',
  borderRadius: '12px',
  padding: '20px',
};
// 
const labelStyle = {
  fontSize: '12px',
  color: '#4A6851',
  marginBottom: '6px',
  display: 'block',
  fontWeight: 600,
};

const selectStyle = {
  background: '#FFFFFF',
  border: '1px solid rgba(165, 214, 167, 0.55)',
  color: '#1B5E20',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  minWidth: '180px',
};

const dateInputStyle = {
  ...selectStyle,
  minWidth: '170px',
};

const downloadExcel = (title, rows, headers, meta = {}) => {
  const exportRows = rows.map((row) => {
    const out = {};
    headers.forEach((header) => {
      out[header.label] = row[header.key];
    });
    return out;
  });

  const metaRows = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => ({ [headers[0].label]: key, [headers[1].label]: value }));

  const worksheet = XLSX.utils.json_to_sheet([]);
  XLSX.utils.sheet_add_aoa(worksheet, [[title]], { origin: 'A1' });
  if (metaRows.length) {
    XLSX.utils.sheet_add_json(worksheet, metaRows, { origin: 'A3', skipHeader: false });
    XLSX.utils.sheet_add_json(worksheet, exportRows, { origin: `A${metaRows.length + 6}`, skipHeader: false });
  } else {
    XLSX.utils.sheet_add_json(worksheet, exportRows, { origin: 'A3', skipHeader: false });
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}.xlsx`);
};

const downloadPdf = (title, rows, headers, meta = {}) => {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  let currentY = 24;
  Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== '')
    .forEach(([key, value]) => {
      doc.setFontSize(10);
      doc.text(`${key}: ${value}`, 14, currentY);
      currentY += 6;
    });

  autoTable(doc, {
    startY: currentY,
    head: [[headers[0].label, headers[1].label]],
    body: rows.map((r) => [String(r[headers[0].key]), String(r[headers[1].key])]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 37, 64] },
  });
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
};

const MetricRow = ({ label, value, color }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(165, 214, 167, 0.55)' }}>
    <span style={{ color: '#2F4A36', fontSize: '13px', fontWeight: 600 }}>{label}</span>
    <span style={{ color, fontSize: '16px', fontWeight: 800, textAlign: 'right' }}>{value}</span>
  </div>
);

const ReportCard = ({ title, rows, headers, meta }) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h3 style={{ margin: 0, color: '#1B5E20', fontSize: '16px', fontWeight: 700 }}>{title}</h3>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => downloadExcel(title, rows, headers, meta)}
          style={{ background: '#F1F6F1', border: '1px solid rgba(165, 214, 167, 0.55)', color: '#256B29', padding: '7px 10px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Download size={13} /> Excel
        </button>
        <button
          onClick={() => downloadPdf(title, rows, headers, meta)}
          style={{ background: '#F1F6F1', border: '1px solid rgba(165, 214, 167, 0.55)', color: '#256B29', padding: '7px 10px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Download size={13} /> PDF
        </button>
      </div>
    </div>

    <div style={{ borderTop: '1px solid rgba(165, 214, 167, 0.55)' }}>
      {rows.map((row, idx) => (
        <MetricRow
          key={row[headers[0].key]}
          label={row[headers[0].key]}
          value={row[headers[1].key]}
          color={idx === 0 ? '#BBDEFB' : idx === 1 ? '#66BB6A' : idx === 2 ? '#7A4400' : '#B71C1C'}
        />
      ))}
    </div>
  </div>
);

const SkeletonCard = ({ title }) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h3 style={{ margin: 0, color: '#1B5E20', fontSize: '16px', fontWeight: 700 }}>{title}</h3>
    </div>
    <div style={{ borderTop: '1px solid rgba(165, 214, 167, 0.55)' }}>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(165, 214, 167, 0.55)' }}>
          <div style={{ height: '16px', width: '60%', borderRadius: '6px', background: '#F1F6F1' }} />
          <div style={{ height: '16px', width: '32px', justifySelf: 'end', borderRadius: '6px', background: '#F1F6F1' }} />
        </div>
      ))}
    </div>
  </div>
);

const Analytics = () => {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [societyLoading, setSocietyLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [society, setSociety] = useState('IPRS');
  const [societyOptions, setSocietyOptions] = useState([]);
  const [salesReport, setSalesReport] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [onboardingReport, setOnboardingReport] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [societyReport, setSocietyReport] = useState({ society: 'IPRS', total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [musicWorkReport, setMusicWorkReport] = useState({ totalWorks: 0, totalSongs: 0, totalBGMMovies: 0, totalTVBGM: 0, totalTVBGMEpisode: 0 });

  const selectedRangeLabel = startDate || endDate
    ? `${startDate || 'Beginning'} to ${endDate || 'Today'}`
    : 'All Time';

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ society, startDate, endDate });
        const res = await authFetch(`/api/analytics?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch reports');
        const data = await res.json();

        setSocietyOptions(data.filters?.societyOptions || []);
        setSalesReport(data.salesReport || { total: 0, completed: 0, inProgress: 0, overdue: 0 });
        setOnboardingReport(data.onboardingReport || { total: 0, completed: 0, inProgress: 0, overdue: 0 });
        setSocietyReport(data.societyReport || { society, total: 0, completed: 0, inProgress: 0, overdue: 0 });
        setMusicWorkReport(data.musicWorkReport || { totalWorks: 0, totalSongs: 0, totalBGMMovies: 0, totalTVBGM: 0, totalTVBGMEpisode: 0 });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setSocietyLoading(false);
      }
    };

    fetchReports();
  }, [authFetch, startDate, endDate]);

  useEffect(() => {
    const fetchSocietyReport = async () => {
      setSocietyLoading(true);
      try {
        const params = new URLSearchParams({ society, startDate, endDate });
        const res = await authFetch(`/api/analytics/society-report?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch society report');
        const data = await res.json();
        setSocietyOptions(data.filters?.societyOptions || []);
        setSocietyReport(data.societyReport || { society, total: 0, completed: 0, inProgress: 0, overdue: 0 });
      } catch (err) {
        console.error(err);
      } finally {
        setSocietyLoading(false);
      }
    };

    fetchSocietyReport();
  }, [authFetch, society, startDate, endDate]);

  const salesRows = useMemo(() => [
    { status: 'Total', count: salesReport.total },
    { status: 'Completed', count: salesReport.completed },
    { status: 'In Progress', count: salesReport.inProgress },
    { status: 'Overdue', count: salesReport.overdue },
  ], [salesReport]);

  const onboardingRows = useMemo(() => [
    { status: 'Total', count: onboardingReport.total },
    { status: 'Completed', count: onboardingReport.completed },
    { status: 'In Progress', count: onboardingReport.inProgress },
    { status: 'Overdue', count: onboardingReport.overdue },
  ], [onboardingReport]);

  const societyRows = useMemo(() => [
    { status: 'Total', count: societyReport.total },
    { status: 'Completed', count: societyReport.completed },
    { status: 'In Progress', count: societyReport.inProgress },
    { status: 'Overdue', count: societyReport.overdue },
  ], [societyReport]);

  const musicRows = useMemo(() => [
    { workType: 'Total Works', count: musicWorkReport.totalWorks },
    { workType: 'Total Songs', count: musicWorkReport.totalSongs },
    { workType: 'Total BGM Movies', count: musicWorkReport.totalBGMMovies },
    { workType: 'Total TV BGM', count: musicWorkReport.totalTVBGM },
    { workType: 'Total TV BGM Episodes', count: musicWorkReport.totalTVBGMEpisode },
  ], [musicWorkReport]);

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#1B5E20', fontSize: '22px', fontWeight: 700, margin: 0 }}>Reports</h1>
        <p style={{ color: '#4A6851', fontSize: '14px', margin: '4px 0 0' }}>Monthly or all-time downloadable reports (Excel / PDF)</p>
      </div>

      <div style={{ ...cardStyle, marginBottom: '18px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...dateInputStyle, colorScheme: 'light' }} />
        </div>

        <div>
          <label style={labelStyle}>End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ ...dateInputStyle, colorScheme: 'light' }} />
        </div>

        <div>
          <label style={labelStyle}>Society (for Society Report)</label>
          <select value={society} onChange={(e) => setSociety(e.target.value)} style={selectStyle}>
            {societyOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ ...cardStyle, color: '#4A6851', fontSize: '14px', textAlign: 'center' }}>Loading reports...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
          {societyLoading ? <SkeletonCard title={`${society} Society Report`} /> : <ReportCard title={`${societyReport.society} Society Report`} rows={societyRows} headers={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }]} meta={{ Range: selectedRangeLabel, Society: societyReport.society, Generated: new Date().toLocaleDateString() }} />}
          <ReportCard title="Sales Report" rows={salesRows} headers={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }]} meta={{ Range: selectedRangeLabel, Report: 'Sales', Generated: new Date().toLocaleDateString() }} />
          <ReportCard title="Onboarding Report" rows={onboardingRows} headers={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }]} meta={{ Range: selectedRangeLabel, Report: 'Onboarding', Generated: new Date().toLocaleDateString() }} />
          <ReportCard title="Music Works Report" rows={musicRows} headers={[{ key: 'workType', label: 'Work Type' }, { key: 'count', label: 'Count' }]} meta={{ Range: selectedRangeLabel, Report: 'Music Works', Generated: new Date().toLocaleDateString() }} />
        </div>
      )}
    </div>
  );
};

export default Analytics;
