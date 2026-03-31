"use client";

import { useState } from "react";

type ModuleActionsProps = {
  onArrange?: () => void;
  onDelete?: () => void;
  ariaLabel?: string;
};

export default function ModuleActions({ onArrange, onDelete, ariaLabel = "Module actions" }: ModuleActionsProps) {
  const [open, setOpen] = useState(false);
  const hasActions = Boolean(onArrange || onDelete);

  if (!hasActions) {
    return null;
  }

  return (
    <div className="module-actions">
      <button
        type="button"
        className="module-actions-btn"
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="19" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <>
          <button className="popover-backdrop" type="button" onClick={() => setOpen(false)} />
          <div className="module-actions-menu">
            {onArrange && (
              <button
                type="button"
                className="module-actions-item"
                onClick={() => {
                  onArrange();
                  setOpen(false);
                }}
              >
                Arrange
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="module-actions-item danger"
                onClick={() => {
                  onDelete();
                  setOpen(false);
                }}
              >
                Delete form
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
