import React, { Suspense, lazy } from 'react';

const ThemePanel = lazy(() => import('./panels/ThemePanel'));
const TextPanel = lazy(() => import('./panels/TextPanel'));
const ShapePanel = lazy(() => import('./panels/ShapePanel'));
const BackgroundPanel = lazy(() => import('./panels/BackgroundPanel'));
const ColorPanel = lazy(() => import('./panels/ColorPanel'));

export default function MiddleStrip(props) {
  const { activeTab } = props;

  return (
    <section className="middle-strip">
      <Suspense fallback={<div style={{ fontSize: 11, color: '#64748b', padding: 14 }}>লোড হচ্ছে...</div>}>
        {activeTab === 0 && <ThemePanel {...props} />}
        {activeTab === 1 && <TextPanel {...props} />}
        {activeTab === 2 && <ShapePanel {...props} />}
        {activeTab === 3 && <BackgroundPanel {...props} />}
        {activeTab === 4 && <ColorPanel {...props} />}
      </Suspense>
    </section>
  );
}
