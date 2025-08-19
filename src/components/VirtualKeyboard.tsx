import React, { useState, useRef, useEffect } from 'react';

interface VirtualKeyboardProps {
  isVisible: boolean;
  onClose: () => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  size: { width: number; height: number };
  onSizeChange: (size: { width: number; height: number }) => void;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  isVisible,
  onClose,
  opacity,
  onOpacityChange,
  position,
  onPositionChange,
  size,
  onSizeChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const keyboardRef = useRef<HTMLDivElement>(null);

  const keys = [
    // Function keys row
    ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
    // Number row
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
    // QWERTY row
    ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
    // ASDF row
    ['CapsLock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
    // ZXCV row
    ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
    // Bottom row
    ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Fn', 'Menu', 'Ctrl']
  ];

  const handleKeyPress = (key: string) => {
    // Send keyboard events to the active element
    const activeElement = document.activeElement as HTMLElement;
    
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      const inputElement = activeElement as HTMLInputElement | HTMLTextAreaElement;
      
      switch (key) {
        case 'Backspace':
          inputElement.value = inputElement.value.slice(0, -1);
          break;
        case 'Space':
          inputElement.value += ' ';
          break;
        case 'Enter':
          inputElement.value += '\n';
          break;
        case 'Tab':
          inputElement.value += '\t';
          break;
        default:
          if (key.length === 1) {
            inputElement.value += key;
          }
          break;
      }
      
      // Trigger input event
      const event = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(event);
    } else {
      // Send keyboard events to document
      const keyCode = getKeyCode(key);
      const keyEvent = new KeyboardEvent('keydown', {
        key: key,
        keyCode: keyCode,
        bubbles: true
      });
      document.dispatchEvent(keyEvent);
    }
  };

  const getKeyCode = (key: string): number => {
    const keyCodes: { [key: string]: number } = {
      'Backspace': 8,
      'Tab': 9,
      'Enter': 13,
      'Shift': 16,
      'Ctrl': 17,
      'Alt': 18,
      'CapsLock': 20,
      'Esc': 27,
      'Space': 32,
      'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117,
      'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123
    };
    return keyCodes[key] || key.charCodeAt(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === keyboardRef.current || (e.target as HTMLElement).classList.contains('keyboard-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      onPositionChange({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    } else if (isResizing) {
      onSizeChange({
        width: Math.max(400, e.clientX - position.x),
        height: Math.max(200, e.clientY - position.y)
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, position]);

  if (!isVisible) return null;

  return (
    <div
      ref={keyboardRef}
      className="virtual-keyboard"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        opacity: opacity / 100,
        background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
        border: '2px solid #444',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        zIndex: 10000,
        overflow: 'hidden',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div 
        className="keyboard-header"
        style={{
          background: 'linear-gradient(90deg, #444, #333)',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'move',
          borderBottom: '1px solid #555'
        }}
      >
        <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
          Virtual Keyboard
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#ccc', fontSize: '10px' }}>Opacity:</span>
            <input
              type="range"
              min="20"
              max="100"
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              style={{ width: '60px' }}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ff5555',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '4px 8px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Keyboard Layout */}
      <div
        style={{
          padding: '12px',
          height: 'calc(100% - 40px)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {keys.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: 'flex',
              gap: '2px',
              justifyContent: rowIndex === keys.length - 1 ? 'center' : 'flex-start'
            }}
          >
            {row.map((key, keyIndex) => (
              <button
                key={keyIndex}
                onClick={() => handleKeyPress(key)}
                style={{
                  background: 'linear-gradient(145deg, #555, #333)',
                  border: '1px solid #666',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: key === 'Space' ? '8px 60px' : 
                           ['Backspace', 'CapsLock', 'Enter', 'Shift'].includes(key) ? '8px 20px' :
                           key === 'Tab' ? '8px 16px' : '8px 12px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  minWidth: key === 'Space' ? '200px' : '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.1s ease'
                }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #666, #444)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #555, #333)';
                }}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Resize Handle */}
      <div
        style={{
          position: 'absolute',
          bottom: '0',
          right: '0',
          width: '20px',
          height: '20px',
          background: '#666',
          cursor: 'nw-resize',
          borderTopLeftRadius: '4px'
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsResizing(true);
        }}
      >
        <div style={{
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          width: '0',
          height: '0',
          borderLeft: '8px solid transparent',
          borderBottom: '8px solid #999'
        }} />
      </div>
    </div>
  );
};

// Floating Keyboard Button Component
interface FloatingKeyboardButtonProps {
  onClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  opacity: number;
}

export const FloatingKeyboardButton: React.FC<FloatingKeyboardButtonProps> = ({
  onClick,
  onRightClick,
  position,
  onPositionChange,
  opacity
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      onPositionChange({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      onClick();
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, position]);

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '50px',
        height: '50px',
        background: 'linear-gradient(145deg, #4a90e2, #357abd)',
        border: '2px solid #2c5282',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 9999,
        opacity: opacity / 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: isDragging ? 'none' : 'all 0.2s ease',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={onRightClick}
      title="Virtual Keyboard (Right-click for options)"
    >
      <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>⌨</span>
    </div>
  );
};