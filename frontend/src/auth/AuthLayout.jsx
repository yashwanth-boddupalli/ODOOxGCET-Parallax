import React from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Boxes, FileSpreadsheet } from 'lucide-react';

const features = [
  { icon: ArrowDownLeft, tone: 'receipt', text: 'Receive from vendors' },
  { icon: ArrowUpRight, tone: 'delivery', text: 'Ship to customers' },
  { icon: ArrowLeftRight, tone: 'transfer', text: 'Move between racks' },
  { icon: FileSpreadsheet, tone: 'ledger', text: 'Audit-ready ledger' },
];

// Decorative only: heights of the little bar chart on the preview card.
const bars = [38, 52, 44, 66, 58, 74, 62, 88, 70, 82, 76, 94];

export function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-brand">
          <div className="brand-icon">
            <Boxes size={22} strokeWidth={2.3} />
          </div>
          <span className="auth-brand-name">StockSense</span>
          <span className="auth-brand-badge">Inventory Hub</span>
        </div>

        <div className="auth-hero">
          <h1>
            Every unit, every warehouse, <em>in real time.</em>
          </h1>
          <p>
            Receipts, deliveries, transfers and stock counts in one place — with a ledger that
            never forgets a move.
          </p>
          <div className="auth-features">
            {features.map(({ icon: Icon, tone, text }) => (
              <div key={text} className="auth-feature">
                <span className={`auth-feature-icon ${tone}`}>
                  <Icon size={15} />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="auth-preview">
          <div className="auth-preview-top">
            <span>Stock Available</span>
            <span className="auth-live-dot">Live</span>
          </div>
          <div className="auth-preview-value">
            1,156 units <small>+4.2% this week</small>
          </div>
          <div className="auth-preview-bars">
            {bars.map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="auth-aside-footer">Built for the Odoo × GCET Hyderabad Hackathon</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-brand">
            <div className="brand-icon">
              <Boxes size={19} strokeWidth={2.3} />
            </div>
            <strong>StockSense</strong>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
