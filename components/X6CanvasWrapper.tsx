'use client';

import dynamic from 'next/dynamic';

const X6CanvasPanel = dynamic(() => import('./X6CanvasPanel'), {
  ssr: false,
  loading: () => (
    <div className="canvas-panel">
      <div className="canvas-header">
        <div className="canvas-title">Canvas</div>
      </div>
      <div className="canvas-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ opacity: 0.5 }}>Loading canvas...</span>
      </div>
    </div>
  ),
});

export default X6CanvasPanel;
