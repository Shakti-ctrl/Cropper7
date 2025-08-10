import React from 'react';

interface FloatingPanelProps {
    visible: boolean;
    position: { x: number; y: number };
    selectedElement: { type: 'watermark' | 'signature' | null; id: string | null };
    moveMode: boolean;
    elementData: any;
    onClose: () => void;
    onMove: (position: { x: number; y: number }) => void;
    onMoveToggle: () => void;
    onResize: (size: number) => void;
    onRotate: (rotation: number) => void;
    onDelete: () => void;
    onEdit: () => void;
    onUndo: () => void;
    canUndo: boolean;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
    visible,
    position,
    selectedElement,
    moveMode,
    elementData,
    onClose,
    onMove,
    onMoveToggle,
    onResize,
    onRotate,
    onDelete,
    onEdit,
    onUndo,
    canUndo
}) => {
    if (!visible || !selectedElement.type || !selectedElement.id) {
        return null;
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        const startX = e.clientX - position.x;
        const startY = e.clientY - position.y;

        const handleMouseMove = (e: MouseEvent) => {
            onMove({
                x: e.clientX - startX,
                y: e.clientY - startY
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const currentSize = elementData?.size?.width || 200;
    const currentRotation = elementData?.rotation || 0;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                background: 'rgba(40, 44, 52, 0.95)',
                border: '2px solid #007bff',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '240px',
                maxWidth: '280px',
                zIndex: 2000,
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)',
                userSelect: 'none',
                backdropFilter: 'blur(10px)',
                cursor: 'move'
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
        >
            {/* Panel Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                paddingBottom: '6px',
                marginBottom: '4px'
            }}>
                <span style={{ 
                    color: '#007bff', 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    textTransform: 'capitalize'
                }}>
                    {selectedElement.type} Controls
                </span>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ff6b6b',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '2px'
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Control Buttons Row 1 */}
            <div style={{ display: 'flex', gap: '6px' }}>
                {/* Move Button */}
                <button
                    onClick={onMoveToggle}
                    style={{
                        flex: 1,
                        background: moveMode ? '#28a745' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontWeight: '500'
                    }}
                    title={moveMode ? 'Lock Position' : 'Enable Move Mode'}
                >
                    {moveMode ? '🔒' : '📐'} {moveMode ? 'Lock' : 'Move'}
                </button>

                {/* Delete Button */}
                <button
                    onClick={onDelete}
                    style={{
                        flex: 1,
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontWeight: '500'
                    }}
                    title="Delete Element"
                >
                    🗑️ Delete
                </button>
            </div>

            {/* Resize Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ color: 'white', fontSize: '12px', fontWeight: '500' }}>
                    📏 Size: {Math.round(currentSize / 2)}%
                </label>
                <input
                    type="range"
                    min="50"
                    max="400"
                    value={currentSize / 2}
                    onChange={(e) => onResize(parseInt(e.target.value))}
                    style={{
                        width: '100%',
                        accentColor: '#007bff'
                    }}
                />
            </div>

            {/* Rotate Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ color: 'white', fontSize: '12px', fontWeight: '500' }}>
                    🔄 Rotate:
                </label>
                <input
                    type="range"
                    min="0"
                    max="360"
                    value={currentRotation}
                    onChange={(e) => onRotate(parseInt(e.target.value))}
                    style={{
                        flex: 1,
                        accentColor: '#28a745'
                    }}
                />
                <span style={{ color: 'white', fontSize: '11px', minWidth: '35px' }}>
                    {Math.round(currentRotation)}°
                </span>
            </div>

            {/* Control Buttons Row 2 */}
            <div style={{ display: 'flex', gap: '6px' }}>
                {/* Edit Button */}
                <button
                    onClick={onEdit}
                    style={{
                        flex: 1,
                        background: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontWeight: '500'
                    }}
                    title="Edit Properties"
                >
                    ✏️ Edit
                </button>

                {/* Undo Button */}
                <button
                    onClick={onUndo}
                    style={{
                        flex: 1,
                        background: '#6f42c1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontWeight: '500',
                        opacity: canUndo ? 1 : 0.5
                    }}
                    disabled={!canUndo}
                    title="Undo Last Change"
                >
                    ↶ Undo
                </button>
            </div>
        </div>
    );
};

export default FloatingPanel;