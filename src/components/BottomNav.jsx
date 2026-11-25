import React from 'react';
import { Sparkles, Type, Shapes, Image as ImageIcon, Palette } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 0, label: 'থিম', icon: <Sparkles size={18} /> },
    { id: 1, label: 'টেক্সট', icon: <Type size={18} /> },
    { id: 2, label: 'শেপ', icon: <Shapes size={18} /> },
    { id: 3, label: 'ব্যাকগ্রাউন্ড', icon: <ImageIcon size={18} /> },
    { id: 4, label: 'কালার', icon: <Palette size={18} /> }
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => setActiveTab(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}