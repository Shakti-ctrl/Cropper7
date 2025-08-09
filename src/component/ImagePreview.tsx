
import React, { useEffect, useRef, useCallback } from 'react';

interface Props {
  src: string;
  alt: string;
  selectedFilter?: any;
  adjustmentValues?: any;
  watermarkText?: string;
  borderWidth?: number;
  borderColor?: string;
  style?: React.CSSProperties;
  className?: string;
}

const ImagePreview: React.FC<Props> = ({
  src,
  alt,
  selectedFilter,
  adjustmentValues,
  watermarkText,
  borderWidth = 0,
  borderColor = '#000000',
  style,
  className
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const applyEffects = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    
    if (!image || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match image
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Build filter string
    const filters = [];
    
    // Apply selected filter
    if (selectedFilter) {
      filters.push(selectedFilter.cssFilter);
    }

    // Apply adjustments
    if (adjustmentValues) {
      if (adjustmentValues.brightness !== 0) {
        filters.push(`brightness(${1 + adjustmentValues.brightness / 100})`);
      }
      if (adjustmentValues.contrast !== 0) {
        filters.push(`contrast(${1 + adjustmentValues.contrast / 100})`);
      }
      if (adjustmentValues.saturation !== 0) {
        filters.push(`saturate(${1 + adjustmentValues.saturation / 100})`);
      }
      if (adjustmentValues.hue !== 0) {
        filters.push(`hue-rotate(${adjustmentValues.hue}deg)`);
      }
      if (adjustmentValues.blur !== 0) {
        filters.push(`blur(${adjustmentValues.blur}px)`);
      }
      if (adjustmentValues.sharpen !== 0) {
        filters.push(`contrast(${1 + adjustmentValues.sharpen / 50})`);
      }
    }

    // Apply filters
    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    // Draw image with effects
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Reset filter for overlays
    ctx.filter = 'none';

    // Add border
    if (borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(borderWidth / 2, borderWidth / 2, canvas.width - borderWidth, canvas.height - borderWidth);
    }

    // Add watermark
    if (watermarkText && watermarkText.trim()) {
      const fontSize = Math.max(canvas.width / 20, 16);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      
      const textWidth = ctx.measureText(watermarkText).width;
      const x = canvas.width - textWidth - 20;
      const y = canvas.height - 20;
      
      ctx.strokeText(watermarkText, x, y);
      ctx.fillText(watermarkText, x, y);
    }
  }, [selectedFilter, adjustmentValues, watermarkText, borderWidth, borderColor]);

  useEffect(() => {
    const image = imageRef.current;
    if (image && image.complete) {
      applyEffects();
    }
  }, [applyEffects]);

  const handleImageLoad = () => {
    applyEffects();
  };

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        onLoad={handleImageLoad}
        style={{ display: 'none' }}
      />
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

export default ImagePreview;
