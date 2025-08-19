
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker - use local worker to avoid CDN issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

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
  id: string;
  name: string;
  pageCount: number;
  createdAt: number;
  modifiedAt: number;
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
  
  // Exact same floating and zoom functionality as cropper
  const [floatingPages, setFloatingPages] = useState<{[key: string]: {visible: boolean, position: {x: number, y: number}, size: {width: number, height: number}}}>({});
  const [zoomedPages, setZoomedPages] = useState<Set<string>>(new Set());
  const [rearrangeMode, setRearrangeMode] = useState(false);

  // Session management - exact same as cropper
  const [sessions, setSessions] = useState<PDFSession[]>([]);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);

  // Rearrange options - exact same as cropper
  const [showRearrangeOptions, setShowRearrangeOptions] = useState(false);
  const [rearrangeInput, setRearrangeInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const floatingRefs = useRef<{[key: string]: HTMLDivElement}>({});

  // Session management functions - exact same as cropper
  const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const saveCurrentSession = useCallback(() => {
    if (pages.length === 0) return;
    
    try {
      const sessionData: PDFSession = {
        id: currentSessionId || generateSessionId(),
        name: sessionName,
        pageCount: pages.length,
        createdAt: currentSessionId ? sessions.find(s => s.id === currentSessionId)?.createdAt || Date.now() : Date.now(),
        modifiedAt: Date.now()
      };

      // Update sessions list
      setSessions(prev => {
        const existing = prev.find(s => s.id === sessionData.id);
        if (existing) {
          return prev.map(s => s.id === sessionData.id ? sessionData : s);
        } else {
          return [sessionData, ...prev];
        }
      });

      // Save to localStorage with size management
      try {
        const sessionsToSave = sessions.filter(s => s.id !== sessionData.id);
        sessionsToSave.unshift(sessionData);
        
        // Keep only last 10 sessions to prevent quota issues
        const limitedSessions = sessionsToSave.slice(0, 10);
        localStorage.setItem('pdfMasterSessions', JSON.stringify(limitedSessions));
      } catch (storageError) {
        console.warn('Storage full, clearing old sessions');
        localStorage.removeItem('pdfMasterSessions');
        localStorage.setItem('pdfMasterSessions', JSON.stringify([sessionData]));
      }

      if (!currentSessionId) {
        setCurrentSessionId(sessionData.id);
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [sessionName, pages, currentSessionId, sessions]);

  const loadSessions = useCallback(() => {
    try {
      const saved = localStorage.getItem('pdfMasterSessions');
      if (saved) {
        const parsedSessions = JSON.parse(saved);
        setSessions(parsedSessions);
      }
    } catch (error) {
      console.warn('Could not load sessions');
      setSessions([]);
    }
  }, []);

  const createNewSession = () => {
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    setSessionName('New PDF Project');
    setPages([]);
    setSelectedPages(new Set());
    setFloatingPages({});
    setZoomedPages(new Set());
    setRearrangeMode(false);
    setShowSessionManager(false);
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem('pdfMasterSessions', JSON.stringify(updatedSessions));
    
    if (currentSessionId === sessionId) {
      createNewSession();
    }
  };

  const duplicateSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const newSessionId = generateSessionId();
      const duplicatedSession: PDFSession = {
        ...session,
        id: newSessionId,
        name: `${session.name} (Copy)`,
        createdAt: Date.now(),
        modifiedAt: Date.now()
      };
      
      setSessions(prev => [duplicatedSession, ...prev]);
      const updatedSessions = [duplicatedSession, ...sessions];
      localStorage.setItem('pdfMasterSessions', JSON.stringify(updatedSessions.slice(0, 10)));
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadSessions();
      if (!currentSessionId) {
        const newId = generateSessionId();
        setCurrentSessionId(newId);
      }
    }
  }, [isVisible, loadSessions, currentSessionId]);

  useEffect(() => {
    if (pages.length > 0) {
      saveCurrentSession();
    }
  }, [pages, sessionName, saveCurrentSession]);

  // Convert image file to PDFPage - same as cropper logic
  const imageToPage = async (file: File, order: number): Promise<PDFPage | null> => {
    try {
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`File ${file.name} too large, skipping`);
        return null;
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const maxDimension = 1500;
            let { naturalWidth: width, naturalHeight: height } = img;
            
            if (width > maxDimension || height > maxDimension) {
              const scale = maxDimension / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }

            resolve({
              id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: file.name,
              imageData: e.target?.result as string,
              originalImage: img,
              rotation: 0,
              crop: { x: 0, y: 0, width, height },
              order,
              width,
              height
            });
          };
          img.onerror = () => reject(new Error(`Failed to load: ${file.name}`));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error(`Failed to read: ${file.name}`));
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error processing image:', error);
      return null;
    }
  };

  // Handle image upload - exactly like cropper
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus(`Processing ${files.length} files...`);
    
    try {
      const newPages: PDFPage[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          setProcessingStatus(`Processing ${file.name} (${i + 1}/${files.length})`);
          const page = await imageToPage(file, pages.length + newPages.length);
          if (page) {
            newPages.push(page);
          }
        }
      }

      setPages(prev => [...prev, ...newPages]);
      setProcessingStatus(`Successfully processed ${newPages.length} images`);
      setTimeout(() => setProcessingStatus(''), 2000);
    } catch (error) {
      console.error('Error uploading images:', error);
      setProcessingStatus('Error processing files');
      setTimeout(() => setProcessingStatus(''), 3000);
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  // Handle PDF upload with better error handling
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Processing PDF...');
    
    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          
          const newPages: PDFPage[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            setProcessingStatus(`Extracting page ${i}/${pdf.numPages}`);
            
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Fix the TypeScript error by providing canvas in render parameters
            await page.render({ 
              canvasContext: context, 
              viewport,
              canvas 
            }).promise;
            
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
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
          setProcessingStatus(`Successfully extracted ${newPages.length} pages`);
        }
      }
      
      setTimeout(() => setProcessingStatus(''), 2000);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setProcessingStatus('Error processing PDF file');
      setTimeout(() => setProcessingStatus(''), 3000);
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  // Page manipulation - same as cropper
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

  const movePageUp = (index: number) => {
    if (index > 0) {
      setPages(prev => {
        const newPages = [...prev];
        [newPages[index], newPages[index - 1]] = [newPages[index - 1], newPages[index]];
        return newPages.map((page, i) => ({ ...page, order: i }));
      });
    }
  };

  const movePageDown = (index: number) => {
    if (index < pages.length - 1) {
      setPages(prev => {
        const newPages = [...prev];
        [newPages[index], newPages[index + 1]] = [newPages[index + 1], newPages[index]];
        return newPages.map((page, i) => ({ ...page, order: i }));
      });
    }
  };

  const reversePagesOrder = () => {
    setPages(prev => {
      const reversed = [...prev].reverse();
      return reversed.map((page, index) => ({ ...page, order: index }));
    });
  };

  // Advanced rearrange functionality - exact same as cropper
  const handleRearrangeClick = () => {
    if (!rearrangeMode) {
      setShowRearrangeOptions(true);
    } else {
      setRearrangeMode(false);
      setShowRearrangeOptions(false);
    }
  };

  const startArrowRearrange = () => {
    setRearrangeMode(true);
    setShowRearrangeOptions(false);
  };

  const startInputRearrange = () => {
    const currentOrder = pages.map((_, index) => index + 1).join(',');
    setRearrangeInput(currentOrder);
    setShowRearrangeOptions(false);
  };

  const applyInputRearrange = () => {
    try {
      const newOrder = rearrangeInput.split(',').map(num => parseInt(num.trim()) - 1);
      
      if (newOrder.length !== pages.length) {
        alert(`Please provide exactly ${pages.length} positions`);
        return;
      }

      const validPositions = newOrder.every(pos => pos >= 0 && pos < pages.length);
      const uniquePositions = new Set(newOrder).size === newOrder.length;

      if (!validPositions || !uniquePositions) {
        alert('Invalid positions. Please use each number from 1 to ' + pages.length + ' exactly once.');
        return;
      }

      const reorderedPages = newOrder.map(oldIndex => pages[oldIndex]);
      setPages(reorderedPages.map((page, index) => ({ ...page, order: index })));
      setRearrangeInput('');
    } catch (error) {
      alert('Invalid input format. Please use comma-separated numbers.');
    }
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

        const img = new Image();
        img.src = page.imageData;
        await new Promise((resolve) => { img.onload = resolve; });

        ctx.save();
        if (page.rotation !== 0) {
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((page.rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }
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

  // Selection functions - same as cropper
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

  // Floating functionality - EXACT same as cropper
  const toggleFloating = (pageId: string) => {
    setFloatingPages(prev => {
      const isCurrentlyFloating = prev[pageId]?.visible || false;
      
      if (isCurrentlyFloating) {
        return {
          ...prev,
          [pageId]: { ...prev[pageId], visible: false }
        };
      } else {
        return {
          ...prev,
          [pageId]: {
            visible: true,
            position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
            size: { width: 400, height: 500 }
          }
        };
      }
    });
  };

  const closeFloatingPage = (pageId: string) => {
    setFloatingPages(prev => ({
      ...prev,
      [pageId]: { ...prev[pageId], visible: false }
    }));
  };

  const toggleZoom = (pageId: string) => {
    setZoomedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  // Drag functionality for floating windows
  const handleMouseDown = (pageId: string, e: React.MouseEvent) => {
    const floatingEl = floatingRefs.current[pageId];
    if (!floatingEl) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = floatingEl.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      
      setFloatingPages(prev => ({
        ...prev,
        [pageId]: {
          ...prev[pageId],
          position: { x: Math.max(0, newX), y: Math.max(0, newY) }
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
      {/* Header - same as cropper style */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.8), rgba(0, 40, 80, 0.6))',
        backdropFilter: 'blur(10px)',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ color: '#00bfff', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            📄 PDF Master
          </h1>
          {isEditingSessionName ? (
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onBlur={() => setIsEditingSessionName(false)}
              onKeyPress={(e) => e.key === 'Enter' && setIsEditingSessionName(false)}
              autoFocus
              style={{
                background: 'rgba(0, 255, 255, 0.1)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#00bfff',
                fontSize: '14px',
                minWidth: '200px'
              }}
            />
          ) : (
            <div
              onClick={() => setIsEditingSessionName(true)}
              style={{
                background: 'rgba(0, 255, 255, 0.1)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#00bfff',
                fontSize: '14px',
                minWidth: '200px',
                cursor: 'pointer'
              }}
            >
              {sessionName}
            </div>
          )}
          <button
            onClick={() => setShowSessionManager(!showSessionManager)}
            style={{
              background: 'rgba(0, 255, 255, 0.2)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#00bfff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📋 Sessions ({sessions.length})
          </button>
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

      {/* Session Manager - exact same as cropper */}
      {showSessionManager && (
        <div style={{
          background: 'rgba(0, 20, 40, 0.95)',
          borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
          padding: '16px 24px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ color: '#00bfff', margin: 0 }}>Session Manager</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={createNewSession}
                style={{
                  background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ➕ New Session
              </button>
              <button
                onClick={() => setShowSessionManager(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sessions.map(session => (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: session.id === currentSessionId ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  border: session.id === currentSessionId ? '1px solid #00bfff' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '8px 12px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#00bfff', fontWeight: 'bold', fontSize: '14px' }}>
                    {session.name}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                    {session.pageCount} pages • Modified: {new Date(session.modifiedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => duplicateSession(session.id)}
                    style={{
                      background: 'rgba(33, 150, 243, 0.8)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => deleteSession(session.id)}
                    style={{
                      background: 'rgba(244, 67, 54, 0.8)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', padding: '20px' }}>
                No sessions saved yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rearrange Options Modal - exact same as cropper */}
      {showRearrangeOptions && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 80, 0.9))',
            border: '2px solid rgba(0, 255, 255, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ color: '#00bfff', textAlign: 'center', marginBottom: '24px' }}>
              Choose Rearrange Method
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={startArrowRearrange}
                style={{
                  background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                🔄 Rearrange with Arrow Buttons
              </button>
              
              <button
                onClick={startInputRearrange}
                style={{
                  background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                ⌨️ Rearrange with Input Numbers
              </button>
              
              <button
                onClick={() => setShowRearrangeOptions(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Rearrange Modal - exact same as cropper */}
      {rearrangeInput !== '' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 80, 0.9))',
            border: '2px solid rgba(0, 255, 255, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%'
          }}>
            <h3 style={{ color: '#00bfff', textAlign: 'center', marginBottom: '16px' }}>
              Rearrange Pages by Position
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', marginBottom: '24px', fontSize: '14px' }}>
              Enter the new order using comma-separated numbers (1 to {pages.length}):
            </p>
            
            <input
              type="text"
              value={rearrangeInput}
              onChange={(e) => setRearrangeInput(e.target.value)}
              placeholder={`Example: ${pages.map((_, i) => i + 1).join(',')}`}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                color: '#00bfff',
                fontSize: '14px',
                marginBottom: '20px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={applyInputRearrange}
                style={{
                  background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Apply Rearrangement
              </button>
              <button
                onClick={() => setRearrangeInput('')}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar - same as cropper */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.8), rgba(0, 40, 80, 0.6))',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(0, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {pages.length > 0 && (
            <>
              <span style={{ color: '#00bfff', fontSize: '14px' }}>
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
                  background: 'rgba(0, 255, 255, 0.2)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#00bfff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                style={{
                  background: 'rgba(0, 255, 255, 0.2)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#00bfff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear
              </button>
              <button
                onClick={handleRearrangeClick}
                style={{
                  background: rearrangeMode ? 'linear-gradient(45deg, #4CAF50, #45a049)' : 'rgba(0, 255, 255, 0.2)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: rearrangeMode ? 'white' : '#00bfff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: rearrangeMode ? 'bold' : 'normal'
                }}
              >
                {rearrangeMode ? '✓ Rearrange ON' : '🔄 Rearrange'}
              </button>
              <button
                onClick={reversePagesOrder}
                style={{
                  background: 'rgba(0, 255, 255, 0.2)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#00bfff',
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
            color: '#00bfff',
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
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'flex-start'
          }}>
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="cropper"
                style={{
                  position: 'relative',
                  width: '250px',
                  cursor: rearrangeMode ? 'default' : 'pointer',
                  border: selectedPages.has(page.id) ? '3px solid #4CAF50' : '2px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.3), rgba(0, 40, 80, 0.2))',
                  boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  overflow: 'hidden'
                }}
                onClick={() => !rearrangeMode && togglePageSelection(page.id)}
              >
                {/* Serial Number Badge - same as cropper */}
                <div style={{
                  position: "absolute",
                  top: "5px",
                  left: "5px",
                  background: rearrangeMode ? "#2196F3" : "#333",
                  color: "white",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 200,
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "2px solid white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                }}>
                  {index + 1}
                </div>

                {/* Header - same as cropper */}
                <div className="cropper-header" style={{
                  background: 'linear-gradient(135deg, rgba(0, 40, 80, 0.9), rgba(0, 20, 40, 0.95))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 4px',
                  borderRadius: '8px 8px 0 0',
                  borderBottom: '1px solid rgba(0, 255, 255, 0.2)'
                }}>
                  <div className="cropper-filename" style={{
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    maxWidth: '180px',
                    color: '#00bfff',
                    fontWeight: 600
                  }}>
                    {page.name}
                  </div>
                  <div className="cropper-body" style={{
                    display: 'flex',
                    gap: '6px',
                    margin: '4px 0'
                  }}>
                    <button 
                      className="circle-button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePage(page.id);
                      }}
                      style={{
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      X
                    </button>
                  </div>
                </div>

                {/* Image container */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '141.4%',
                  background: '#f5f5f5',
                  overflow: 'hidden'
                }}>
                  <img
                    src={page.imageData}
                    alt={page.name}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transform: `rotate(${page.rotation}deg) ${zoomedPages.has(page.id) ? 'scale(1.2)' : 'scale(1)'}`,
                      transition: 'transform 0.3s ease',
                      pointerEvents: rearrangeMode ? 'none' : 'auto',
                      opacity: rearrangeMode ? 0.7 : 1
                    }}
                  />
                  
                  {/* Rearrange buttons - EXACT same as cropper */}
                  {rearrangeMode && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      right: '10px',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      zIndex: 300
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePageUp(index);
                        }}
                        disabled={index === 0}
                        style={{
                          background: index === 0 ? "#666" : "linear-gradient(135deg, #2196F3, #1976D2)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "35px",
                          height: "35px",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          fontSize: "16px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          transition: "all 0.2s ease",
                          opacity: index === 0 ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (index !== 0) e.currentTarget.style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = "scale(0.95)";
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = "scale(1.1)";
                        }}
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePageDown(index);
                        }}
                        disabled={index === pages.length - 1}
                        style={{
                          background: index === pages.length - 1 ? "#666" : "linear-gradient(135deg, #2196F3, #1976D2)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "35px",
                          height: "35px",
                          cursor: index === pages.length - 1 ? "not-allowed" : "pointer",
                          fontSize: "16px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          transition: "all 0.2s ease",
                          opacity: index === pages.length - 1 ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (index !== pages.length - 1) e.currentTarget.style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = "scale(0.95)";
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = "scale(1.1)";
                        }}
                        title="Move Down"
                      >
                        ↓
                      </button>
                    </div>
                  )}

                  {/* Control buttons - same position as cropper */}
                  {!rearrangeMode && (
                    <>
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
                        >
                          ↻
                        </button>
                      </div>

                      {/* Floating and zoom buttons - EXACT same as cropper */}
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        zIndex: 10,
                        display: 'flex',
                        gap: '5px'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFloating(page.id);
                          }}
                          style={{
                            background: floatingPages[page.id]?.visible ? "#f44336" : "#2196F3",
                            border: "none",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "50%",
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
                          }}
                          title={floatingPages[page.id]?.visible ? "Close floating view" : "Open floating view"}
                        >
                          🎈
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleZoom(page.id);
                          }}
                          style={{
                            background: zoomedPages.has(page.id) ? "#FFEB3B" : "#9C27B0",
                            color: zoomedPages.has(page.id) ? "#333" : "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "50%",
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
                          }}
                          title={zoomedPages.has(page.id) ? "Disable zoom" : "Enable zoom"}
                        >
                          🔍
                        </button>
                      </div>
                    </>
                  )}
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

      {/* Floating Pages Windows - EXACT same functionality as cropper */}
      {Object.entries(floatingPages).map(([pageId, data]) =>
        data.visible && (
          <div
            key={`floating-${pageId}`}
            ref={(el) => {
              if (el) floatingRefs.current[pageId] = el;
            }}
            style={{
              position: 'fixed',
              left: data.position.x,
              top: data.position.y,
              width: data.size.width,
              height: data.size.height,
              background: 'white',
              border: '2px solid #28a745',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              resize: 'both',
              minWidth: '300px',
              minHeight: '200px'
            }}
          >
            {/* Draggable Header */}
            <div 
              style={{
                background: '#28a745',
                color: 'white',
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'move'
              }}
              onMouseDown={(e) => handleMouseDown(pageId, e)}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                Floating Page {pages.findIndex(p => p.id === pageId) + 1}
              </span>
              <button
                onClick={() => closeFloatingPage(pageId)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0',
                  width: '20px',
                  height: '20px'
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ 
              flex: 1, 
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column',
              background: '#f9f9f9'
            }}>
              {(() => {
                const page = pages.find(p => p.id === pageId);
                if (!page) return <div>Page not found</div>;
                
                return (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px'
                  }}>
                    <img
                      src={page.imageData}
                      alt={page.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `rotate(${page.rotation}deg) ${zoomedPages.has(pageId) ? 'scale(1.3)' : 'scale(1)'}`,
                        transition: 'transform 0.3s ease',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                  </div>
                );
              })()}
              
              {/* Control buttons - same as cropper */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-around', 
                padding: '8px', 
                background: '#f0f0f0',
                borderTop: '1px solid #ddd'
              }}>
                <button
                  onClick={() => {
                    const page = pages.find(p => p.id === pageId);
                    if (page) rotatePage(page.id, 'left');
                  }}
                  style={{
                    background: "#007bff",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  ↺ Rotate Left
                </button>
                <button
                  onClick={() => {
                    const page = pages.find(p => p.id === pageId);
                    if (page) rotatePage(page.id, 'right');
                  }}
                  style={{
                    background: "#007bff",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  ↻ Rotate Right
                </button>
                <button
                  onClick={() => toggleZoom(pageId)}
                  style={{
                    background: zoomedPages.has(pageId) ? "#FFEB3B" : "#9C27B0",
                    color: zoomedPages.has(pageId) ? "#333" : "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  🔍 {zoomedPages.has(pageId) ? "Zoom Out" : "Zoom In"}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
