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
    background: '#FFFFFF',
    border: '1px solid rgba(165, 214, 167, 0.55)',
    borderRadius: '6px',
    color: disabled ? '#5B7362' : '#1B5E20',
    padding: '6px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', flexWrap: 'wrap', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4A6851', fontSize: '12px' }}>
        <span>{label}:</span>
        <select
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          style={{ background: '#FFFFFF', color: '#1B5E20', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
        >
          {pageSizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: '12px' }}>{from}–{to} of {total}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1} style={btn(safePage <= 1)}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ color: '#1B5E20', fontSize: '12px', padding: '0 8px', fontWeight: 600 }}>
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
