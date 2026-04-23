import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

const SearchableSelect = ({ options = [], value, onChange, placeholder = 'Search...', emptyMessage = 'No options found', label, required, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtered = options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));
  const selected = options.find((o) => o.name === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleSelect = (name) => {
    if (disabled) return;
    onChange(name);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onChange('');
    setQuery('');
  };

  const labelStyle = { fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>}

      {/* Trigger */}
      <div
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        title={disabled ? 'Edit from the Members page' : undefined}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: '8px',
          border: `1px solid ${isOpen && !disabled ? '#6366f1' : '#2d3348'}`,
          backgroundColor: disabled ? '#141823' : '#1a1e2e',
          color: selected ? '#e5e7eb' : '#6b7280',
          opacity: disabled ? 0.75 : 1,
          fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {selected && !disabled && (
            <X size={14} style={{ color: '#9ca3af', cursor: 'pointer' }} onClick={handleClear} />
          )}
          {!disabled && (
            <ChevronDown size={16} style={{ color: '#9ca3af', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: '#1e2235', border: '1px solid #2d3348', borderRadius: '10px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 100, overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #2d3348' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#141720', border: '1px solid #2d3348' }}>
              <Search size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search..."
                style={{
                  width: '100%', border: 'none', outline: 'none', backgroundColor: 'transparent',
                  color: '#e5e7eb', fontSize: '13px',
                }}
              />
            </div>
          </div>

          {/* Options list */}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>{emptyMessage}</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o._id || o.name}
                  onClick={() => handleSelect(o.name)}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                    backgroundColor: o.name === value ? '#252b45' : 'transparent',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252b45'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = o.name === value ? '#252b45' : 'transparent'; }}
                >
                  {o.initials && (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: o.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {o.initials}
                    </div>
                  )}
                  <div>
                    <div style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: 500 }}>{o.name}</div>
                    {(o.role || o.email) && (
                      <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '1px' }}>
                        {o.role}{o.role && o.email ? ' · ' : ''}{o.email}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
