import React, { useState, useEffect } from 'react';

interface EffectFilter {
  id: string;
  name: string;
  category: string;
  cssFilter: string;
  preview?: string;
}

const effectFilters: EffectFilter[] = [
  // Black & White Presets
  { id: 'monochrome', name: 'Monochrome', category: 'bw', cssFilter: 'grayscale(100%)' },
  { id: 'grayscale', name: 'Grayscale', category: 'bw', cssFilter: 'grayscale(80%) contrast(1.2)' },
  { id: 'high-key', name: 'High Key', category: 'bw', cssFilter: 'grayscale(100%) brightness(1.3) contrast(0.8)' },
  { id: 'low-key', name: 'Low Key', category: 'bw', cssFilter: 'grayscale(100%) brightness(0.7) contrast(1.5)' },
  { id: 'high-contrast-bw', name: 'High Contrast', category: 'bw', cssFilter: 'grayscale(100%) contrast(2)' },
  { id: 'tinted-bw', name: 'Tinted B&W', category: 'bw', cssFilter: 'grayscale(100%) sepia(30%)' },
  { id: 'noir', name: 'Noir', category: 'bw', cssFilter: 'grayscale(100%) contrast(1.8) brightness(0.8)' },
  { id: 'classic-bw', name: 'Classic', category: 'bw', cssFilter: 'grayscale(100%) contrast(1.4) brightness(0.9)' },

  // Vintage / Retro Effects
  { id: 'film', name: 'Film', category: 'vintage', cssFilter: 'sepia(50%) contrast(1.2) brightness(0.9)' },
  { id: 'sepia', name: 'Sepia', category: 'vintage', cssFilter: 'sepia(100%)' },
  { id: 'lomo', name: 'Lomo', category: 'vintage', cssFilter: 'contrast(1.5) brightness(0.8) saturate(2)' },
  { id: 'digital', name: 'Digital', category: 'vintage', cssFilter: 'contrast(1.1) saturate(1.3)' },
  { id: 'retro', name: 'Retro', category: 'vintage', cssFilter: 'sepia(40%) contrast(1.3) saturate(1.5)' },
  { id: 'polaroid', name: 'Polaroid', category: 'vintage', cssFilter: 'contrast(1.2) brightness(0.95) sepia(20%)' },
  { id: 'aged', name: 'Aged', category: 'vintage', cssFilter: 'sepia(60%) contrast(1.1) brightness(0.9)' },
  { id: 'faded', name: 'Faded', category: 'vintage', cssFilter: 'brightness(1.1) contrast(0.8) saturate(0.7)' },

  // Creative Filters
  { id: 'dramatic', name: 'Dramatic', category: 'creative', cssFilter: 'contrast(1.8) brightness(0.9) saturate(1.4)' },
  { id: 'fantasy', name: 'Fantasy', category: 'creative', cssFilter: 'hue-rotate(45deg) saturate(1.8) brightness(1.1)' },
  { id: 'cinematic', name: 'Cinematic', category: 'creative', cssFilter: 'contrast(1.3) brightness(0.85) sepia(10%)' },
  { id: 'dreamy', name: 'Dreamy', category: 'creative', cssFilter: 'brightness(1.2) contrast(0.8) blur(0.5px)' },
  { id: 'glow-effect', name: 'Glow', category: 'creative', cssFilter: 'brightness(1.3) contrast(1.1) saturate(1.2)' },
  { id: 'neon', name: 'Neon', category: 'creative', cssFilter: 'saturate(2) contrast(1.5) hue-rotate(90deg)' },
  { id: 'cyberpunk', name: 'Cyberpunk', category: 'creative', cssFilter: 'hue-rotate(270deg) saturate(1.8) contrast(1.4)' },
  { id: 'ethereal', name: 'Ethereal', category: 'creative', cssFilter: 'brightness(1.3) contrast(0.7) saturate(0.8)' },
  { id: 'mystic', name: 'Mystic', category: 'creative', cssFilter: 'hue-rotate(180deg) saturate(1.5) contrast(1.2)' },
  { id: 'surreal', name: 'Surreal', category: 'creative', cssFilter: 'hue-rotate(120deg) saturate(2) brightness(1.1)' },

  // Instagram-style Filters
  { id: 'instage', name: 'Instage', category: 'instagram', cssFilter: 'contrast(1.1) brightness(1.1) saturate(1.3)' },
  { id: 'retro-insta', name: 'Retro', category: 'instagram', cssFilter: 'sepia(20%) contrast(1.2) brightness(0.9)' },
  { id: 'tuning', name: 'Tuning', category: 'instagram', cssFilter: 'contrast(1.4) saturate(1.5)' },
  { id: 'portrait', name: 'Portrait', category: 'instagram', cssFilter: 'brightness(1.1) contrast(1.1)' },
  { id: 'food', name: 'Food', category: 'instagram', cssFilter: 'contrast(1.2) saturate(1.8) brightness(1.1)' },
  { id: 'urban', name: 'Urban', category: 'instagram', cssFilter: 'contrast(1.3) brightness(0.9) hue-rotate(10deg)' },
  { id: 'nature', name: 'Nature', category: 'instagram', cssFilter: 'saturate(1.4) contrast(1.1) brightness(1.05)' },
  { id: 'colors', name: 'Colors', category: 'instagram', cssFilter: 'saturate(2) contrast(1.2) hue-rotate(15deg)' },
  { id: 'valencia', name: 'Valencia', category: 'instagram', cssFilter: 'sepia(25%) brightness(1.1) contrast(1.1)' },
  { id: 'hudson', name: 'Hudson', category: 'instagram', cssFilter: 'contrast(1.2) brightness(1.2) saturate(1.05)' },
  { id: 'xpro2', name: 'X-Pro II', category: 'instagram', cssFilter: 'sepia(30%) contrast(1.3) brightness(0.8)' },
  { id: 'earlybird', name: 'Early Bird', category: 'instagram', cssFilter: 'sepia(20%) contrast(1.2) saturate(0.8)' },
  { id: 'rise', name: 'Rise', category: 'instagram', cssFilter: 'brightness(1.05) saturate(0.9) contrast(0.9)' },
  { id: 'nashville', name: 'Nashville', category: 'instagram', cssFilter: 'sepia(20%) contrast(1.2) brightness(1.05) saturate(1.2)' },
  { id: 'kelvin', name: 'Kelvin', category: 'instagram', cssFilter: 'contrast(1.5) brightness(1.1) hue-rotate(15deg)' },
  { id: 'toaster', name: 'Toaster', category: 'instagram', cssFilter: 'contrast(1.3) brightness(0.9) sepia(15%)' },

  // Modern Effects
  { id: 'vivid', name: 'Vivid', category: 'modern', cssFilter: 'saturate(1.8) contrast(1.2)' },
  { id: 'soft', name: 'Soft', category: 'modern', cssFilter: 'brightness(1.1) contrast(0.8)' },
  { id: 'warm', name: 'Warm', category: 'modern', cssFilter: 'hue-rotate(15deg) saturate(1.2) brightness(1.05)' },
  { id: 'cool', name: 'Cool', category: 'modern', cssFilter: 'hue-rotate(-15deg) saturate(1.1) brightness(0.95)' },
  { id: 'fresh', name: 'Fresh', category: 'modern', cssFilter: 'saturate(1.3) contrast(1.1) brightness(1.02)' },
  { id: 'sharp', name: 'Sharp', category: 'modern', cssFilter: 'contrast(1.4) brightness(0.95)' }
];

interface Props {
  onFilterSelect: (filter: EffectFilter | null) => void;
  selectedFilter: EffectFilter | null;
}

const EffectFilters: React.FC<Props> = ({ onFilterSelect, selectedFilter }) => {
  const [activeCategory, setActiveCategory] = useState<string>('bw');

  useEffect(() => {
    const handleSelectFilter = (event: any) => {
      const filterId = event.detail?.id;
      if (filterId) {
        const filter = effectFilters.find(f => f.id === filterId);
        if (filter) {
          onFilterSelect(filter);
        }
      }
    };

    const handleAutoEnhance = () => {
      const enhanceFilter = effectFilters.find(f => f.id === 'vivid');
      if (enhanceFilter) {
        onFilterSelect(enhanceFilter);
      }
    };

    window.addEventListener('select-filter', handleSelectFilter);
    window.addEventListener('auto-enhance', handleAutoEnhance);
    return () => {
      window.removeEventListener('select-filter', handleSelectFilter);
      window.removeEventListener('auto-enhance', handleAutoEnhance);
    };
  }, [onFilterSelect]);

  const categories = [
    { key: 'bw', label: '🖤 B&W', name: 'Black & White' },
    { key: 'vintage', label: '📽️ Vintage', name: 'Vintage' },
    { key: 'creative', label: '🎭 Creative', name: 'Creative' },
    { key: 'instagram', label: '📷 Instagram', name: 'Instagram Style' },
    { key: 'modern', label: '✨ Modern', name: 'Modern' }
  ];

  const filteredEffects = effectFilters.filter(filter => filter.category === activeCategory);

  return (
    <div className="effects-panel" style={{ padding: '15px' }}>
      <div className="effects-header" style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {categories.map(category => (
            <button
              key={category.key}
              className={`category-btn ${activeCategory === category.key ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.key)}
              style={{
                padding: '6px 10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: activeCategory === category.key ? '#007bff' : '#f8f9fa',
                color: activeCategory === category.key ? 'white' : '#333',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            className="reset-btn"
            onClick={() => onFilterSelect(null)}
            style={{
              background: '#f8f9fa',
              color: '#333',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Reset Filter
          </button>
          <button 
            className="preview-btn"
            onClick={() => {
              const event = new CustomEvent('preview-effects');
              window.dispatchEvent(event);
            }}
            style={{
              background: '#28a745',
              color: 'white',
              padding: '8px 12px',
              border: '1px solid #28a745',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            👁️ Preview Effects
          </button>
        </div>
      </div>

      <div className="effects-grid">
        <div 
          className={`effect-tile ${selectedFilter === null ? 'selected' : ''}`}
          onClick={() => onFilterSelect(null)}
        >
          <div className="effect-preview original">Original</div>
          <span>Original</span>
        </div>

        {filteredEffects.map(filter => (
          <div
            key={filter.id}
            className={`effect-tile ${selectedFilter?.id === filter.id ? 'selected' : ''}`}
            onClick={() => onFilterSelect(filter)}
          >
            <div 
              className="effect-preview"
              style={{ filter: filter.cssFilter }}
            >
              Preview
            </div>
            <span>{filter.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EffectFilters;