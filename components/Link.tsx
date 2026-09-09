import React from 'react';

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}

// A real <a href> for crawlability and native browser affordances (cmd/ctrl-click
// to open in a new tab, middle-click, "copy link", status-bar preview), which
// still drives the SPA's own client-side view state for a plain left-click —
// without pulling in react-router. `onNavigate` should carry exactly the same
// setView/id-setter logic the old onClick handler had.
const Link: React.FC<LinkProps> = ({ href, onNavigate, children, onClick, ...rest }) => (
  <a
    href={href}
    onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onNavigate();
    }}
    {...rest}
  >
    {children}
  </a>
);

export default Link;
