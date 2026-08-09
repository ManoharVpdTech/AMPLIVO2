'use client';
import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { serviceCatalog } from '@/data/sales';

interface ServiceSelectorProps {
  selected: string[];
  onChange: (services: string[]) => void;
}

export function ServiceSelector({ selected, onChange }: ServiceSelectorProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const add = (name: string) => {
    if (!selected.includes(name)) onChange([...selected, name]);
    setQuery('');
    setShowDropdown(false);
  };

  const remove = (name: string) => {
    onChange(selected.filter((s) => s !== name));
  };

  const availableServices = serviceCatalog.filter(
    (svc) => !selected.includes(svc.name) && svc.name.toLowerCase().includes(query.toLowerCase())
  );
  const categories = [...new Set(availableServices.map((s) => s.category))];

  return (
    <div className="space-y-3">
      {/* Selected services rendered as concise, removable chips */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-xs font-semibold text-[#4C1D95]"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={`Remove ${name}`}
                className="p-0.5 rounded-full hover:bg-violet-100 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No services selected yet.</p>
      )}

      {/* Selective "add service" search/dropdown instead of the full catalog checklist */}
      <div className="relative">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Select a service to add..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
          />
        </div>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" role="button" tabIndex={0} onClick={() => setShowDropdown(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDropdown(false); }} />
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto py-1.5">
              {categories.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 italic">
                  {selected.length === serviceCatalog.length ? 'All services already added' : 'No matching services'}
                </div>
              ) : (
                categories.map((category) => (
                  <div key={category}>
                    <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {category}
                    </div>
                    {availableServices
                      .filter((s) => s.category === category)
                      .map((svc) => (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => add(svc.name)}
                          className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-sm text-slate-700 font-medium">{svc.name}</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {svc.monthlyPrice > 0 ? (
                              `₹${svc.monthlyPrice.toLocaleString('en-IN')}/mo`
                            ) : svc.setupFee > 0 ? (
                              `₹${svc.setupFee.toLocaleString('en-IN')}`
                            ) : (
                              ''
                            )}
                          </span>
                        </button>
                      ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
