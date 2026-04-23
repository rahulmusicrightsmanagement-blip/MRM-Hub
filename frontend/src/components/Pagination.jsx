import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 50, 100],
  label = 'Rows per page',
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const btn = (disabled) => ({
    background: '#141720',
    border: '1px solid #1e2540',
    borderRadius: '6px',
    color: disabled ? '#4b5563' : '#e5e7eb',
    padding: '6px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', flexWrap: 'wrap', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '12px' }}>
        <span>{label}:</span>
        <select
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          style={{ background: '#1a1e2e', color: '#e5e7eb', border: '1px solid #2d3348', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
        >
          {pageSizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: '12px' }}>{from}–{to} of {total}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1} style={btn(safePage <= 1)}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ color: '#e5e7eb', fontSize: '12px', padding: '0 8px', fontWeight: 600 }}>
          {safePage} / {totalPages}
        </span>
        <button onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} style={btn(safePage >= totalPages)}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
