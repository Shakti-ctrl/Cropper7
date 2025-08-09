import React, { useState, useRef } from 'react';

interface Props {
  showAdjustments: boolean;
  onToggleAdjustments: () => void;
  showEffects: boolean;
  onToggleEffects: () => void;
  onSharePDF: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAddWatermark: () => void;
  onAddBorder: () => void;
  onAddSignature: () => void;
  onShowPreview: () => void;
  onSaveAdjustments: () => void;
  onUndoAdjustments: () => void;
  enableWatermark: boolean;
  onToggleWatermark: () => void;
  enableBorder: boolean;
  onToggleBorder: () => void;
  enableSignature: boolean;
  onToggleSignature: () => void;
  watermarkOpacity: number;
  onWatermarkOpacityChange: (value: number) => void;
  signatureOpacity: number;
  onSignatureOpacityChange: (value: number) => void;
}

const QualityPanel: React.FC<Props> = ({
  showAdjustments,
  onToggleAdjustments,
  showEffects,
  onToggleEffects,
  onSharePDF,
  darkMode,
  onToggleDarkMode,
  onAddWatermark,
  onAddBorder,
  onAddSignature,
  onShowPreview,
  onSaveAdjustments,
  onUndoAdjustments,
  enableWatermark,
  onToggleWatermark,
  enableBorder,
  onToggleBorder,
  enableSignature,
  onToggleSignature,
  watermarkOpacity,
  onWatermarkOpacityChange,
  signatureOpacity,
  onSignatureOpacityChange
}) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: 320, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number }>({
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0
  });

  const handleSharePDF = async () => {
    try {
      onSharePDF();
      if (typeof navigator.share === 'function') {
        // Will be handled by the parent component
      } else {
        // Fallback for browsers without Web Share API
        alert('PDF sharing initiated! Check your downloads.');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging && !isResizing) return;

    if (isDragging) {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, dragRef.current.startPosX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, dragRef.current.startPosY + deltaY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, position, size]);

  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleResizeMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      setSize({
        width: Math.max(280, startWidth + deltaX),
        height: Math.max(400, startHeight + deltaY)
      });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  return (
    <div 
      className="quality-panel-container"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
        background: 'white',
        border: '2px solid #007bff',
        borderRadius: '10px',
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none'
      }}
    >
      {/* Header with drag handle */}
      <div 
        className="quality-panel-header"
        onMouseDown={handleMouseDown}
        style={{
          background: '#007bff',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '8px 8px 0 0',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #0056b3'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px' }}>🎛️ Quality Tools</h3>
        <div className="no-drag" style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px'
            }}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '🔼' : '🔽'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div 
          className="quality-panel-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '15px'
          }}
        >
          <div className="quality-controls">
            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '0 0 10px 0', fontSize: '14px' }}>🎨 Image Enhancement</h4>
              <button 
                className={`quality-btn ${showAdjustments ? 'active' : ''}`}
                onClick={onToggleAdjustments}
                style={{ 
                  width: '100%',
                  marginBottom: '8px',
                  color: showAdjustments ? 'white' : '#000000',
                  background: showAdjustments ? '#007bff' : '#f8f9fa'
                }}
              >
                🎛️ Adjustments Panel
              </button>
              <button 
                className={`quality-btn ${showEffects ? 'active' : ''}`}
                onClick={onToggleEffects}
                style={{ 
                  width: '100%',
                  marginBottom: '8px',
                  color: showEffects ? 'white' : '#000000',
                  background: showEffects ? '#007bff' : '#f8f9fa'
                }}
              >
                🎨 Effect Filters
              </button>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>🖼️ Add Elements</h4>
              <div className="toggle-control" onClick={onToggleWatermark} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '4px',
                background: enableWatermark ? '#e7f3ff' : 'transparent'
              }}>
                <input type="checkbox" checked={enableWatermark} readOnly />
                <span>Enable Watermark</span>
              </div>
              {enableWatermark && (
                <button className="quality-btn" onClick={onAddWatermark} style={{ 
                  width: '100%',
                  marginBottom: '8px',
                  color: '#000000' 
                }}>
                  🏷️ Add/Edit Watermark
                </button>
              )}

              <div className="toggle-control" onClick={onToggleBorder} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '4px',
                background: enableBorder ? '#e7f3ff' : 'transparent'
              }}>
                <input type="checkbox" checked={enableBorder} readOnly />
                <span>Enable Border</span>
              </div>
              {enableBorder && (
                <button className="quality-btn" onClick={onAddBorder} style={{ 
                  width: '100%',
                  marginBottom: '8px',
                  color: '#000000' 
                }}>
                  🎨 Add/Edit Border
                </button>
              )}

              <div className="toggle-control" onClick={onToggleSignature} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '4px',
                background: enableSignature ? '#e7f3ff' : 'transparent'
              }}>
                <input type="checkbox" checked={enableSignature} readOnly />
                <span>Enable Signature</span>
              </div>
              {enableSignature && (
                <button className="quality-btn" onClick={onAddSignature} style={{ 
                  width: '100%',
                  marginBottom: '8px',
                  color: '#000000' 
                }}>
                  📝 Add/Edit Signature
                </button>
              )}
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>🎯 Smart Features</h4>
              <button className="quality-btn" onClick={() => {
                onToggleEffects();
                setTimeout(() => {
                  const event = new CustomEvent('select-filter', { detail: { id: 'dreamy' } });
                  window.dispatchEvent(event);
                }, 100);
              }} style={{ width: '100%', marginBottom: '8px', color: '#000000' }}>
                🌊 AI Background Blur
              </button>
              <button className="quality-btn" onClick={() => {
                const event = new CustomEvent('auto-enhance');
                window.dispatchEvent(event);
              }} style={{ width: '100%', marginBottom: '8px', color: '#000000' }}>
                ✨ Auto Enhance
              </button>
              <button className="quality-btn" onClick={() => {
                onToggleEffects();
                setTimeout(() => {
                  const event = new CustomEvent('select-filter', { detail: { id: 'colors' } });
                  window.dispatchEvent(event);
                }, 100);
              }} style={{ width: '100%', marginBottom: '8px', color: '#000000' }}>
                🎯 Smart Color Pop
              </button>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>📥 Import Elements</h4>
              <button 
                className="quality-btn" 
                onClick={() => {
                  const event = new CustomEvent('import-watermark');
                  window.dispatchEvent(event);
                }} 
                style={{ width: '100%', marginBottom: '8px', color: '#000000' }}
              >
                💧 Import Watermark Image
              </button>
              <button 
                className="quality-btn" 
                onClick={() => {
                  const event = new CustomEvent('import-signature');
                  window.dispatchEvent(event);
                }} 
                style={{ width: '100%', marginBottom: '8px', color: '#000000' }}
              >
                ✍️ Import Signature Image
              </button>
              <button 
                className="quality-btn" 
                onClick={() => {
                  const event = new CustomEvent('import-border');
                  window.dispatchEvent(event);
                }} 
                style={{ width: '100%', marginBottom: '8px', color: '#000000' }}
              >
                🖼️ Import Border Pattern
              </button>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>➕ Multiple Elements</h4>
              <button 
                className="quality-btn" 
                onClick={() => {
                  const event = new CustomEvent('add-watermark');
                  window.dispatchEvent(event);
                }} 
                style={{ width: '100%', marginBottom: '8px', color: '#000000' }}
              >
                ➕ Add New Watermark
              </button>
              <button 
                className="quality-btn" 
                onClick={() => {
                  const event = new CustomEvent('add-signature');
                  window.dispatchEvent(event);
                }} 
                style={{ width: '100%', marginBottom: '8px', color: '#000000' }}
              >
                ➕ Add New Signature
              </button>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>🗑️ Delete Elements</h4>
              <button 
                className="quality-btn" 
                onClick={() => {
                  if (window.confirm('Delete current watermark?')) {
                    const event = new CustomEvent('delete-watermark');
                    window.dispatchEvent(event);
                  }
                }} 
                style={{ width: '100%', marginBottom: '8px', color: '#000000', background: '#ffebee' }}
              >
                🗑️ Delete Watermark
              </button>
              <button 
                className="quality-btn" 
                onClick={() => {
                  if (window.confirm('Delete current signature?')) {
                    const event = new CustomEvent('delete-signature');
                    window.dispatchEvent(event);
                  }
                }} 
                style={{ width: '100%', marginBottom: '8px', color: '#000000', background: '#ffebee' }}
              >
                🗑️ Delete Signature
              </button>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>⚙️ Opacity Controls (Fixed)</h4>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ color: '#666', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  💧 Watermark Opacity
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={watermarkOpacity}
                  onChange={(e) => onWatermarkOpacityChange(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '10px', color: '#999' }}>
                  {watermarkOpacity}%
                </span>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ color: '#666', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  ✍️ Signature Opacity
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={signatureOpacity}
                  onChange={(e) => onSignatureOpacityChange(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '10px', color: '#999' }}>
                  {signatureOpacity}%
                </span>
              </div>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>🔄 Preview Controls</h4>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                <button 
                  className="quality-btn" 
                  onClick={() => {
                    const event = new CustomEvent('undo-preview');
                    window.dispatchEvent(event);
                  }} 
                  style={{ flex: 1, color: '#000000', fontSize: '11px' }}
                >
                  ↶ Undo
                </button>
                <button 
                  className="quality-btn" 
                  onClick={() => {
                    const event = new CustomEvent('redo-preview');
                    window.dispatchEvent(event);
                  }} 
                  style={{ flex: 1, color: '#000000', fontSize: '11px' }}
                >
                  ↷ Redo
                </button>
              </div>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>👁️ Preview & Save</h4>
              <button className="quality-btn" onClick={onShowPreview} style={{ 
                width: '100%', 
                marginBottom: '8px', 
                color: '#000000' 
              }}>
                👁️ Preview Effects
              </button>
              <button className="quality-btn save-btn" onClick={onSaveAdjustments} style={{
                width: '100%',
                marginBottom: '8px',
                background: '#28a745',
                color: 'white',
                fontWeight: 'bold'
              }}>
                💾 Apply to All Images
              </button>
              <button
                onClick={() => {
                  const loadFunction = (window as any).loadSavedAdjustments;
                  if (loadFunction) loadFunction(true);
                }}
                className="quality-btn"
                style={{
                  width: '100%',
                  marginBottom: '8px',
                  background: '#4CAF50',
                  color: 'white'
                }}
              >
                📥 Load Saved Settings
              </button>
              <button
                onClick={() => {
                  const event = new CustomEvent('reset-all-effects');
                  window.dispatchEvent(event);
                }}
                className="quality-btn"
                style={{
                  width: '100%',
                  marginBottom: '8px',
                  background: '#dc3545',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                🔄 Reset All Effects
              </button>
            </div>

            <div className="control-section">
              <h4 style={{ color: '#000000', margin: '15px 0 10px 0', fontSize: '14px' }}>📲 Share & Export</h4>
              <button className="quality-btn share-btn" onClick={handleSharePDF} style={{
                width: '100%',
                background: '#007bff',
                color: 'white',
                fontWeight: 'bold'
              }}>
                📲 Share Enhanced PDF
              </button>
              <div className="share-info" style={{ marginTop: '5px' }}>
                <small style={{ color: '#666', fontSize: '11px' }}>📋 Share without downloading to device</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!isMinimized && (
        <div
          className="resize-handle no-drag"
          onMouseDown={handleResize}
          style={{
            position: 'absolute',
            bottom: '0px',
            right: '0px',
            width: '20px',
            height: '20px',
            background: '#007bff',
            cursor: 'nw-resize',
            borderRadius: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px'
          }}
          title="Drag to resize"
        >
          ↘
        </div>
      )}
    </div>
  );
};

export default QualityPanel;