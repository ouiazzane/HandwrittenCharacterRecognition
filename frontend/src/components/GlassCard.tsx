import type { PropsWithChildren } from "react";

interface GlassCardProps extends PropsWithChildren {
  className?: string;
  title?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}

export function GlassCard({ children, className = "", title, eyebrow, action }: GlassCardProps) {
  return (
    <section className={`glass-card ${className}`}>
      {(title || eyebrow || action) && (
        <div className="card-heading">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
