import type { FormEvent, KeyboardEvent } from "react";

export interface FindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export default function FindBar({
  query,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: FindBarProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onNext();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      onPrev();
    }
  };

  return (
    <form
      className="find-bar find-bar-enter"
      data-testid="find-bar"
      onSubmit={handleSubmit}
      role="search"
    >
      <input
        className="find-bar__input"
        type="search"
        value={query}
        placeholder="Find"
        aria-label="Find in terminal"
        autoFocus
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="find-bar__btn"
        aria-label="Find previous"
        title="Previous"
        onClick={onPrev}
      >
        ↑
      </button>
      <button
        type="submit"
        className="find-bar__btn"
        aria-label="Find next"
        title="Next"
      >
        ↓
      </button>
      <button
        type="button"
        className="find-bar__btn find-bar__btn--close"
        aria-label="Close find"
        title="Close"
        onClick={onClose}
      >
        ×
      </button>
    </form>
  );
}
