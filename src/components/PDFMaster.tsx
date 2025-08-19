import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFPage {
  id: string;
  name: string;
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
  width: number;
  height: number;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  // Convert image file to PDFPage (using same pattern as cropper)
  const imageToPage = async (file: File, order: number): Promise<PDFPage | null> => {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const img = new Image();
            img.onload = () => {
              resolve({
                id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                imageData: e.target?.result as string,
                originalImage: img,
                rotation: 0,
                crop: { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
                order,
                width: img.naturalWidth,
                height: img.naturalHeight
              });
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error processing image:', error);
      return null;
    }
  };

  // Handle image files upload (using same error handling as cropper)
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus(`Processing ${files.length} files...`);
    
    try {
      const newPages: PDFPage[] = [];
      let processed = 0;

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          setProcessingStatus(`Processing ${file.name} (${processed + 1}/${files.length})`);
          const page = await imageToPage(file, pages.length + newPages.length);
          if (page) {
            newPages.push(page);
          }
          processed++;
        }
      }

      setPages(prev => [...prev, ...newPages]);
      setProcessingStatus(`Successfully processed ${newPages.length} images`);
      
      // Clear status after 2 seconds
      setTimeout(() => setProcessingStatus(''), 2000);
    } catch (error) {
      console.error('Error uploading images:', error);
      setProcessingStatus('Error processing files');
      setTimeout(() => setProcessingStatus(''), 3000);
    } finally {
      setIsProcessing(false);
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Handle PDF upload and extract pages
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Extracting pages from PDF...');
    
    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          
          const newPages: PDFPage[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            setProcessingStatus(`Extracting page ${i}/${pdf.numPages} from ${file.name}`);
            
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ 
              canvasContext: context, 
              viewport,
              canvas
            }).promise;
            
            const imageData = canvas.toDataURL('image/png');
            
            const pdfPage: PDFPage = {
              id: `pdf_page_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
              name: `${file.name.replace('.pdf', '')}_page_${i}`,
              imageData,
              rotation: 0,
              crop: { x: 0, y: 0, width: viewport.width, height: viewport.height },
              order: pages.length + newPages.length,
              width: viewport.width,
              height: viewport.height
            };
            
            newPages.push(pdfPage);
          }
          
          setPages(prev => [...prev, ...newPages]);
          setProcessingStatus(`Successfully extracted ${newPages.length} pages from PDF`);
        }
      }
      
      setTimeout(() => setProcessingStatus(''), 2000);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setProcessingStatus('Error processing PDF file');
      setTimeout(() => setProcessingStatus(''), 3000);
    } finally {
      setIsProcessing(false);
      if (event.target) {
        event.target.value = '';
      }
    }
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

  // Export to PDF
  const exportToPDF = async () => {
    if (pages.length === 0) {
      alert('No pages to export');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Creating PDF...');
    
    try {
      const pdfDoc = await PDFDocument.create();

      for (const page of pages.sort((a, b) => a.order - b.order)) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
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

        // Create image from imageData
        const img = new Image();
        img.src = page.imageData;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sessionName.replace(/\s+/g, '_')}.pdf`;
      link.click();
      
      URL.revokeObjectURL(url);
      setProcessingStatus('PDF exported successfully!');
      setTimeout(() => setProcessingStatus(''), 2000);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setProcessingStatus('Error exporting PDF');
      setTimeout(() => setProcessingStatus(''), 3000);
    } finally {
      setIsProcessing(false);
    }
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
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
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
          {pages.length > 0 && (
            <>
              <span style={{ color: 'white', fontSize: '14px' }}>
                📊 {pages.length} pages
              </span>
              {selectedPages.size > 0 && (
                <span style={{ color: '#4CAF50', fontSize: '14px' }}>
                  ✓ {selectedPages.size} selected
                </span>
              )}
              <button
                onClick={selectAllPages}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear
              </button>
              <button
                onClick={reversePagesOrder}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔄 Reverse Order
              </button>
              <button
                onClick={exportToPDF}
                disabled={isProcessing}
                style={{
                  background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  opacity: isProcessing ? 0.7 : 1
                }}
              >
                💾 Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {(isProcessing || processingStatus) && (
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '12px 24px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          {isProcessing && '⏳ '}
          {processingStatus || 'Processing...'}
        </div>
      )}

      {/* Main Content */}
      <div style={{
        flex: 1,
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
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>📄</div>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '28px' }}>Welcome to PDF Master</h2>
            <p style={{ margin: '0 0 32px 0', fontSize: '16px', opacity: 0.8, maxWidth: '500px' }}>
              Upload images to create a PDF document or upload an existing PDF to edit its pages. 
              You can rotate, crop, reorder, and manipulate pages with full control.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}
              >
                📁 Upload Images
              </button>
              <button
                onClick={() => pdfInputRef.current?.click()}
                style={{
                  background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}
              >
                📄 Upload PDF
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {pages.map((page, index) => (
              <div
                key={page.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  border: selectedPages.has(page.id) ? '3px solid #4CAF50' : 'none',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => togglePageSelection(page.id)}
              >
                <div style={{
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '141.4%', // A4 aspect ratio
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <img
                    src={page.imageData}
                    alt={page.name || `Page ${index + 1}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transform: `rotate(${page.rotation}deg)`
                    }}
                  />
                  
                  {/* Page controls */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    display: 'flex',
                    gap: '4px'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(page.id, 'left');
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '4px',
                        fontSize: '12px'
                      }}
                      title="Rotate Left"
                    >
                      ↺
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(page.id, 'right');
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '4px',
                        fontSize: '12px'
                      }}
                      title="Rotate Right"
                    >
                      ↻
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePage(page.id);
                      }}
                      style={{
                        background: 'rgba(255,0,0,0.7)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '4px',
                        fontSize: '12px'
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {/* Page number */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px'
                  }}>
                    {index + 1}
                  </div>
                </div>
                
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#666',
                  textAlign: 'center',
                  wordBreak: 'break-word'
                }}>
                  {page.name || `Page ${index + 1}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handlePDFUpload}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept="image/*"
        {...({webkitdirectory: '', directory: ''} as any)}
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
    </div>
  );
};