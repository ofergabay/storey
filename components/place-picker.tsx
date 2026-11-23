"use client";

import { useId, useState, type KeyboardEvent } from "react";

export type PlaceOption = {
  id: string;
  label: string;
};

export function PlacePicker({
  id,
  label,
  ariaLabel,
  options,
  selectedId,
  onSelect,
  disabled = false,
  placeholder,
  invalid = false,
}: {
  id: string;
  label?: string;
  ariaLabel: string;
  options: PlaceOption[];
  selectedId: string;
  onSelect: (option: PlaceOption | null) => void;
  disabled?: boolean;
  placeholder: string;
  invalid?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const selected = options.find((option) => option.id === selectedId) ?? null;
  const needle = query.trim().replace(/\s+/g, " ");
  const matches = needle ? options.filter((option) => option.label.includes(needle)).slice(0, 12) : [];
  const active = matches.length === 0 ? 0 : Math.min(highlight, matches.length - 1);
  const shown = open ? query : (selected?.label || picked || query);

  function choose(option: PlaceOption) {
    setPicked(option.label);
    onSelect(option);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length === 0) return;
      setOpen(true);
      setHighlight((current) => {
        const index = Math.min(current, matches.length - 1);
        return event.key === "ArrowDown" ? (index + 1) % matches.length : (index - 1 + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === "Enter" && open && matches.length > 0) {
      event.preventDefault();
      const option = matches[active];
      if (option) choose(option);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div className="place-field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <input
        id={id}
        role="combobox"
        aria-label={label ? undefined : ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches.length > 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        disabled={disabled}
        value={shown}
        onFocus={() => {
          if (disabled) return;
          setQuery(selected?.label ?? query);
          setOpen(true);
          setHighlight(0);
        }}
        onBlur={(event) => {
          const typed = event.currentTarget.value.trim().replace(/\s+/g, " ");
          const exact = options.filter((option) => option.label === typed);
          if (exact.length === 1 && exact[0]) {
            choose(exact[0]);
            return;
          }
          setOpen(false);
          setPicked("");
          if ((selected && typed !== selected.label) || (!selected && typed)) onSelect(null);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setPicked("");
          setOpen(true);
          setHighlight(0);
          if (selected) onSelect(null);
        }}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 ? (
        <ul className="place-list" id={listId} role="listbox">
          {matches.map((option, index) => (
            <li key={option.id}>
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && needle && matches.length === 0 ? <p className="field-note">אין התאמה ברשימה.</p> : null}
    </div>
  );
}
