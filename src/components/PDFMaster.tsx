import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFPage {
  id: string;
  imageData: string;
  originalImage?: HTMLImageElement;
  rotation: number;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  order: number;
}

interface PDFSession {
  name: string;
  pages: PDFPage[];
  createdAt: Date;
  modifiedAt: Date;
}

interface PDFMasterProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PDFMaster: React.FC<PDFMasterProps> = ({ isVisible, onClose }) => {
  const [sessionName, setSessionName] = useState('PDF Project');
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<'grid' | 'single'>('grid');
  const [showFloatingPreview, setShowFloatingPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState<PDFPage | null>(null);
  const [floatingPosition, setFloatingPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  // Save session to localStorage
  const saveSession = useCallback(() => {
    const session: PDFSession = {
      name: sessionName,
      pages,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    localStorage.setItem('pdfMasterSession', JSON.stringify(session));
  }, [sessionName, pages]);

  // Load session from localStorage
  const loadSession = useCallback(() => {
    const saved = localStorage.getItem('pdfMasterSession');
    if (saved) {
      try {
        const session: PDFSession = JSON.parse(saved);
        setSessionName(session.name);
        setPages(session.pages);
      } catch (error) {
        console.error('Failed to load session:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadSession();
    }
  }, [isVisible, loadSession]);

  useEffect(() => {
    if (pages.length > 0) {
      saveSession();
    }
  }, [pages, sessionName, saveSession]);

  // Convert image file to PDFPage
  const imageToPage = async (file: File, order: number): Promise<PDFPage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            id: `${Date.now()}_${Math.random()}`,
            imageData: e.target?.result as string,
            originalImage: img,
            rotation: 0,
            crop: { x: 0, y: 0, width: img.width, height: img.height },
            order
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle image files upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    const newPages: PDFPage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const page = await imageToPage(file, pages.length + newPages.length);
        newPages.push(page);
      }
    }

    setPages(prev => [...prev, ...newPages]);
    setIsProcessing(false);
  };

  // Handle PDF upload and extraction
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const newPages: PDFPage[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        }).promise;

        const imageData = canvas.toDataURL('image/png');
        const img = new Image();
        img.src = imageData;

        newPages.push({
          id: `pdf_${Date.now()}_${pageNum}`,
          imageData,
          originalImage: img,
          rotation: 0,
          crop: { x: 0, y: 0, width: canvas.width, height: canvas.height },
          order: pages.length + newPages.length
        });
      }

      setPages(prev => [...prev, ...newPages]);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Failed to process PDF file. Please try again.');
    }
    setIsProcessing(false);
  };

  // Page manipulation functions
  const rotatePage = (pageId: string, direction: 'left' | 'right') => {
    setPages(prev => prev.map(page => {
      if (page.id === pageId) {
        const rotation = direction === 'right' 
          ? (page.rotation + 90) % 360 
          : (page.rotation - 90 + 360) % 360;
        return { ...page, rotation };
      }
      return page;
    }));
  };

  const deletePage = (pageId: string) => {
    setPages(prev => prev.filter(page => page.id !== pageId));
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageId);
      return newSet;
    });
  };

  const reversePagesOrder = () => {
    setPages(prev => {
      const reversed = [...prev].reverse();
      return reversed.map((page, index) => ({ ...page, order: index }));
    });
  };

  const reorderPages = (fromIndex: number, toIndex: number) => {
    setPages(prev => {
      const newPages = [...prev];
      const [movedPage] = newPages.splice(fromIndex, 1);
      newPages.splice(toIndex, 0, movedPage);
      return newPages.map((page, index) => ({ ...page, order: index }));
    });
  };

  // Export to PDF
  const exportToPDF = async () => {
    if (pages.length === 0) {
      alert('No pages to export');
      return;
    }

    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const page of pages.sort((a, b) => a.order - b.order)) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        if (page.originalImage) {
          canvas.width = page.crop.width;
          canvas.height = page.crop.height;

          ctx.save();
          
          // Apply rotation
          if (page.rotation !== 0) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((page.rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
          }

          // Draw cropped image
          ctx.drawImage(
            page.originalImage,
            page.crop.x, page.crop.y, page.crop.width, page.crop.height,
            0, 0, canvas.width, canvas.height
          );
          
          ctx.restore();

          const imageBytes = canvas.toDataURL('image/png');
          const pngImage = await pdfDoc.embedPng(imageBytes);
          const pdfPage = pdfDoc.addPage([canvas.width, canvas.height]);
          pdfPage.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sessionName.replace(/\s+/g, '_')}.pdf`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
    setIsProcessing(false);
  };

  // Preview functions
  const openPreview = (page: PDFPage) => {
    setPreviewPage(page);
    setShowFloatingPreview(true);
  };

  const closePreview = () => {
    setShowFloatingPreview(false);
    setPreviewPage(null);
  };

  // Selection functions
  const togglePageSelection = (pageId: string) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const selectAllPages = () => {
    setSelectedPages(new Set(pages.map(page => page.id)));
  };

  const clearSelection = () => {
    setSelectedPages(new Set());
  };

  if (!isVisible) return null;

  return (
    <div className="pdf-master" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            📄 PDF Master
          </h1>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              fontSize: '14px',
              minWidth: '200px'
            }}
            placeholder="Session name..."
          />
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            style={{
              background: 'linear-gradient(45deg, #4CAF50, #45a049)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'white',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: isProcessing ? 0.7 : 1
            }}
          >
            📁 Upload Images
          </button>
          
          <button
            onClick={() => pdfInputRef.current?.click()}
            disabled={isProcessing}
            style={{
              background: 'linear-gradient(45deg, #FF9800, #F57C00)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'white',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: isProcessing ? 0.7 : 1
            }}
          >
            📄 Upload PDF
          </button>
          
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(45deg, #f44336, #d32f2f)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={reversePagesOrder}
            disabled={pages.length === 0}
            style={{
              background: 'linear-gradient(45deg, #9C27B0, #7B1FA2)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'white',
              cursor: pages.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: pages.length === 0 ? 0.5 : 1
            }}
          >
            🔄 Reverse Order
          </button>
          
          <button
            onClick={selectAllPages}
            disabled={pages.length === 0}
            style={{
              background: 'linear-gradient(45deg, #2196F3, #1976D2)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'white',
              cursor: pages.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: pages.length === 0 ? 0.5 : 1
            }}
          >
            ✅ Select All
          </button>
          
          <button
            onClick={clearSelection}
            disabled={selectedPages.size === 0}
            style={{
              background: 'linear-gradient(45deg, #607D8B, #455A64)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'white',
              cursor: selectedPages.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: selectedPages.size === 0 ? 0.5 : 1
            }}
          >
            ❌ Clear Selection
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: 'white', fontSize: '14px' }}>
            {pages.length} pages • {selectedPages.size} selected
          </span>
          
          <button
            onClick={() => setCurrentView(currentView === 'grid' ? 'single' : 'grid')}
            style={{
              background: 'linear-gradient(45deg, #795548, #5D4037)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {currentView === 'grid' ? '📄 Single View' : '⊞ Grid View'}
          </button>
          
          <button
            onClick={exportToPDF}
            disabled={pages.length === 0 || isProcessing}
            style={{
              background: 'linear-gradient(45deg, #E91E63, #C2185B)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'white',
              cursor: pages.length === 0 || isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: pages.length === 0 || isProcessing ? 0.5 : 1
            }}
          >
            {isProcessing ? '⏳ Processing...' : '💾 Export PDF'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        height: 'calc(100vh - 120px)',
        overflow: 'auto',
        padding: '24px'
      }}>
        {pages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📄</div>
            <h2 style={{ margin: '0 0 8px 0' }}>No Pages Yet</h2>
            <p style={{ margin: 0, opacity: 0.8 }}>
              Upload images or PDF files to get started
            </p>
          </div>
        ) : (
          <div style={{
            display: currentView === 'grid' ? 'grid' : 'flex',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
            flexDirection: currentView === 'single' ? 'column' : undefined
          }}>
            {pages.map((page, index) => (
              <div
                key={page.id}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '12px',
                  border: selectedPages.has(page.id) ? '2px solid #4CAF50' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => togglePageSelection(page.id)}
              >
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '3/4',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <img
                    src={page.imageData}
                    alt={`Page ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: `rotate(${page.rotation}deg)`
                    }}
                  />
                  {selectedPages.has(page.id) && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: '#4CAF50',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      ✓
                    </div>
                  )}
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
                    Page {index + 1}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(page.id, 'left');
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                      title="Rotate Left"
                    >
                      ↶
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(page.id, 'right');
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                      title="Rotate Right"
                    >
                      ↷
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(page);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                      title="Preview"
                    >
                      👁
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePage(page.id);
                      }}
                      style={{
                        background: 'rgba(255,0,0,0.3)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Preview */}
      {showFloatingPreview && previewPage && (
        <div
          ref={floatingRef}
          style={{
            position: 'fixed',
            left: `${floatingPosition.x}px`,
            top: `${floatingPosition.y}px`,
            width: '400px',
            height: '500px',
            background: 'rgba(0,0,0,0.9)',
            borderRadius: '12px',
            border: '2px solid rgba(255,255,255,0.3)',
            zIndex: 10001,
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={(e) => {
            setIsDragging(true);
            const rect = floatingRef.current?.getBoundingClientRect();
            if (rect) {
              setFloatingPosition({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              });
            }
          }}
        >
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.2)'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold' }}>
              Page Preview
            </span>
            <button
              onClick={closePreview}
              style={{
                background: 'rgba(255,0,0,0.3)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
          
          <div style={{
            padding: '16px',
            height: 'calc(100% - 60px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src={previewPage.imageData}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `rotate(${previewPage.rotation}deg)`,
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handlePDFUpload}
      />
    </div>
  );
};