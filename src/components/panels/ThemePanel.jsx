import React from 'react';
import { Sparkles } from 'lucide-react';

export default function ThemePanel({ themes, onApplyTheme }) {
  return (
    <>
      <div className="strip-header">
        <span><Sparkles size={11} style={{ display: 'inline' }} /> থিম ({themes.length})</span>
        <span>ট্যাপ করে অ্যাপ্লাই করুন</span>
      </div>
      <div className="scroll-row">
        {themes.map((th) => (
          <div
            key={th.id}
            className="theme-card"
            style={{ background: th.bg?.gradient || '#1e293b' }}
            onClick={() => onApplyTheme(th)}
          >
            {th.thumbnail ? (
              <img
                src={th.thumbnail}
                alt={th.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : th.bg?.useImage && (
              <img
                src={th.bg.imageSrc}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }}
              />
            )}
            <span>{th.title}</span>
          </div>
        ))}
        {themes.length === 0 && (
          <div style={{ fontSize: 11, color: '#64748b', padding: '24px 8px' }}>
            default-themes ফোল্ডারে এখনো কোনো .adp থিম নেই।
          </div>
        )}
      </div>
    </>
  );
}
