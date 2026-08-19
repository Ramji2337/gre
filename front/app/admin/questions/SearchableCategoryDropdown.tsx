"use client";

import { useState, useRef, useEffect } from "react";

interface SearchableCategoryDropdownProps {
  value: string;
  options: string[];
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function SearchableCategoryDropdown({
  value,
  options,
  onChange,
  placeholder = "Select or type a category...",
}: SearchableCategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (cat: string) => {
    onChange(cat);
    setOpen(false);
    setSearch("");
  };

  const inputClass =
    "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div ref={ref} className="relative">
      <div
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <input
          type="text"
          value={open ? search : value}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={inputClass}
          placeholder={value || placeholder}
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {search.trim() && !filtered.includes(search.trim()) && (
            <button
              onClick={() => handleSelect(search.trim())}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium border-b border-gray-100"
            >
              + Create &quot;{search.trim()}&quot;
            </button>
          )}
          {filtered.length === 0 && !search.trim() && (
            <div className="px-3 py-2 text-sm text-gray-400">
              No categories found
            </div>
          )}
          {filtered.map((cat) => (
            <button
              key={cat}
              onClick={() => handleSelect(cat)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition ${
                cat === value
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
