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
  pages: PDFPage[];
  createdAt: number;
  modifiedAt: number;
}

interface ProcessingJob {
  id: string;
  sessionId: string;
  sessionName: string;
  type: 'pdf' | 'presentation' | 'upload';
  status: 'processing' | 'completed' | 'error';
  progress: number;
  total: number;
  message: string;
  timestamp: number;
}

interface PDFMasterProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PDFMaster: React.FC<PDFMasterProps> = ({ isVisible, onClose }) => {
  // Tab-based session management - exactly like cropper
  const [sessions, setSessions] = useState<PDFSession[]>([{
    id: 'pdf-session-1',
    name: 'PDF Session 1',
    pages: [],
    createdAt: Date.now(),
    modifiedAt: Date.now()
  }]);
  const [activeSessionId, setActiveSessionId] = useState('pdf-session-1');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');

  // Global processing queue for all sessions
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [globalProcessingCount, setGlobalProcessingCount] = useState(0);

  // Current session data
  const activeSession = sessions.find(session => session.id === activeSessionId) || sessions[0];
  const [pages, setPages] = useState<PDFPage[]>(activeSession.pages);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  
  // Check if current session has any processing jobs
  const currentSessionJobs = processingJobs.filter(job => job.sessionId === activeSessionId);
  const isCurrentSessionProcessing = currentSessionJobs.some(job => job.status === 'processing');
  const globalProcessingStatus = processingJobs.find(job => job.status === 'processing')?.message || '';

  // Exact same floating and zoom functionality as cropper
  const [floatingPages, setFloatingPages] = useState<{[key: string]: {visible: boolean, position: {x: number, y: number}, size: {width: number, height: number}}}>({});
  const [zoomedPages, setZoomedPages] = useState<Set<string>>(new Set());
  const [rearrangeMode, setRearrangeMode] = useState(false);

  // Rearrange options - exact same as cropper
  const [showRearrangeOptions, setShowRearrangeOptions] = useState(false);
  const [rearrangeInput, setRearrangeInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const floatingRefs = useRef<{[key: string]: HTMLDivElement}>({});

  // Session management functions - exact same as cropper
  const generateSessionId = () => `pdf_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const saveCurrentSession = useCallback(() => {
    if (!activeSession) return;

    try {
      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? { ...session, pages, modifiedAt: Date.now() }
          : session
      ));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [activeSessionId, pages, activeSession]);

  const switchToSession = (sessionId: string) => {
    saveCurrentSession();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      setPages(session.pages);
      setSelectedPages(new Set());
      setFloatingPages({});
      setZoomedPages(new Set());
      setRearrangeMode(false);
    }
  };

  const addProcessingJob = (sessionId: string, sessionName: string, type: 'pdf' | 'presentation' | 'upload', total: number): string => {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newJob: ProcessingJob = {
      id: jobId,
      sessionId,
      sessionName,
      type,
      status: 'processing',
      progress: 0,
      total,
      message: `Starting ${type} processing...`,
      timestamp: Date.now()
    };
    setProcessingJobs(prev => [...prev, newJob]);
    setGlobalProcessingCount(prev => prev + 1);
    return jobId;
  };

  const updateProcessingJob = (jobId: string, updates: Partial<ProcessingJob>) => {
    setProcessingJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, ...updates } : job
    ));
  };

  const completeProcessingJob = (jobId: string, status: 'completed' | 'error', message: string) => {
    setProcessingJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, status, message } : job
    ));
    setGlobalProcessingCount(prev => Math.max(0, prev - 1));
    // Auto-remove completed/error jobs after 5 seconds
    setTimeout(() => {
      setProcessingJobs(prev => prev.filter(job => job.id !== jobId));
    }, 5000);
  };

  const addNewSession = () => {
    const newSessionId = generateSessionId();
    const newSession: PDFSession = {
      id: newSessionId,
      name: `PDF Session ${sessions.length + 1}`,
      pages: [],
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };

    setSessions(prev => [...prev, newSession]);
    switchToSession(newSessionId);
  };

  const closeSession = (sessionId: string) => {
    if (sessions.length === 1) return; // Don't close last session

    setSessions(prev => prev.filter(s => s.id !== sessionId));

    if (sessionId === activeSessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      if (remainingSessions.length > 0) {
        switchToSession(remainingSessions[0].id);
      }
    }
  };

  const startEditingTab = (sessionId: string, currentName: string) => {
    setEditingTabId(sessionId);
    setEditingTabName(currentName);
  };

  const finishEditingTab = () => {
    if (editingTabId && editingTabName.trim()) {
      setSessions(prev => prev.map(session =>
        session.id === editingTabId
          ? { ...session, name: editingTabName.trim() }
          : session
      ));
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const cancelEditingTab = () => {
    setEditingTabId(null);
    setEditingTabName('');
  };

  useEffect(() => {
    if (pages.length > 0) {
      saveCurrentSession();
    }
  }, [pages, saveCurrentSession]);

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

    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'upload', files.length);

    try {
      const newPages: PDFPage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          updateProcessingJob(jobId, {
            progress: i,
            message: `Processing ${file.name} (${i + 1}/${files.length})`
          });
          const page = await imageToPage(file, pages.length + newPages.length);
          if (page) {
            newPages.push(page);
          }
        }
      }

      setPages(prev => [...prev, ...newPages]);
      completeProcessingJob(jobId, 'completed', `Successfully processed ${newPages.length} images`);
    } catch (error) {
      console.error('Error uploading images:', error);
      completeProcessingJob(jobId, 'error', 'Error processing files');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  // Fixed PDF upload with proper error handling
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'upload', 1);

    try {
      for (const file of files) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            updateProcessingJob(jobId, { message: `Loading PDF: ${file.name}` });
            const arrayBuffer = await file.arrayBuffer();

            // Configure PDF.js to use local worker
            const loadingTask = pdfjs.getDocument({
              data: arrayBuffer,
              useWorkerFetch: false,
              isEvalSupported: false,
              useSystemFonts: true
            });

            const pdf = await loadingTask.promise;
            const newPages: PDFPage[] = [];

            updateProcessingJob(jobId, { 
              total: pdf.numPages,
              message: `Extracting ${pdf.numPages} pages...`
            });

            for (let i = 1; i <= pdf.numPages; i++) {
              updateProcessingJob(jobId, {
                progress: i - 1,
                message: `Extracting page ${i}/${pdf.numPages}`
              });

              try {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) {
                  console.error('Could not get canvas context');
                  continue;
                }

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                  canvasContext: context,
                  viewport: viewport,
                  canvas: canvas
                };

                await page.render(renderContext).promise;

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
              } catch (pageError) {
                console.error(`Error processing page ${i}:`, pageError);
                updateProcessingJob(jobId, {
                  message: `Error processing page ${i}, continuing...`
                });
              }
            }

            if (newPages.length > 0) {
              setPages(prev => [...prev, ...newPages]);
              completeProcessingJob(jobId, 'completed', `Successfully extracted ${newPages.length} pages from ${file.name}`);
            } else {
              completeProcessingJob(jobId, 'error', `No pages could be extracted from ${file.name}`);
            }
          } catch (pdfError) {
            console.error('Error processing PDF:', pdfError);
            completeProcessingJob(jobId, 'error', `Error processing ${file.name}: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in PDF upload:', error);
      completeProcessingJob(jobId, 'error', 'Error processing PDF files');
    } finally {
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

  // Enhanced directional movement - up, down, left, right
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

  const movePageLeft = (index: number) => {
    // Move to beginning of row or previous position
    if (index > 0) {
      movePageUp(index);
    }
  };

  const movePageRight = (index: number) => {
    // Move to end of row or next position
    if (index < pages.length - 1) {
      movePageDown(index);
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

    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'pdf', pages.length);

    try {
      const pdfDoc = await PDFDocument.create();
      const sortedPages = pages.sort((a, b) => a.order - b.order);

      for (let i = 0; i < sortedPages.length; i++) {
        const page = sortedPages[i];
        updateProcessingJob(jobId, {
          progress: i,
          message: `Processing page ${i + 1}/${sortedPages.length}`
        });

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

      updateProcessingJob(jobId, { message: 'Finalizing PDF...' });
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeSession.name.replace(/\s+/g, '_')}.pdf`;
      link.click();

      URL.revokeObjectURL(url);
      completeProcessingJob(jobId, 'completed', 'PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      completeProcessingJob(jobId, 'error', 'Error exporting PDF');
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
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isCurrentSessionProcessing}
            style={{
              background: 'linear-gradient(45deg, #4CAF50, #45a049)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'white',
              cursor: isCurrentSessionProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: isCurrentSessionProcessing ? 0.7 : 1
            }}
          >
            📁 Upload Images
          </button>

          <button
            onClick={() => {
              // Create folder upload input
              const folderInput = document.createElement('input');
              folderInput.type = 'file';
              folderInput.webkitdirectory = true;
              folderInput.multiple = true;
              folderInput.accept = 'image/*';
              folderInput.style.display = 'none';
              
              folderInput.onchange = (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files) {
                  // Convert FileList to File array and trigger handleImageUpload
                  const event = {
                    target: {
                      files: target.files,
                      value: ''
                    }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleImageUpload(event);
                }
                document.body.removeChild(folderInput);
              };
              
              document.body.appendChild(folderInput);
              folderInput.click();
            }}
            disabled={isCurrentSessionProcessing}
            style={{
              background: 'linear-gradient(45deg, #9C27B0, #7B1FA2)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'white',
              cursor: isCurrentSessionProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: isCurrentSessionProcessing ? 0.7 : 1
            }}
          >
            📂 Upload Folder
          </button>

          <button
            onClick={() => pdfInputRef.current?.click()}
            disabled={isCurrentSessionProcessing}
            style={{
              background: 'linear-gradient(45deg, #FF9800, #F57C00)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'white',
              cursor: isCurrentSessionProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: isCurrentSessionProcessing ? 0.7 : 1
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

      {/* Tab System - EXACTLY like cropper */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.8), rgba(0, 40, 80, 0.6))',
        borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto'
      }}>
        {sessions.map(session => (
          <div
            key={session.id}
            style={{
              padding: '8px 10px',
              background: session.id === activeSessionId ? '#444' : '#222',
              color: 'white',
              borderRadius: '3px',
              whiteSpace: 'nowrap'
            }}
          >
            {editingTabId === session.id ? (
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishEditingTab();
                    if (e.key === 'Escape') cancelEditingTab();
                  }}
                  onBlur={finishEditingTab}
                  autoFocus
                  style={{
                    background: '#555',
                    border: '1px solid #777',
                    color: 'white',
                    padding: '2px 5px',
                    fontSize: '12px',
                    width: '120px'
                  }}
                />
                <button
                  onClick={finishEditingTab}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4CAF50',
                    fontSize: '10px'
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={cancelEditingTab}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f44336',
                    fontSize: '10px'
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <span
                  onClick={() => switchToSession(session.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {session.name}
                </span>
                <button
                  onClick={() => startEditingTab(session.id, session.name)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                  title="Edit tab name"
                >
                  ✏️
                </button>
                {sessions.length > 1 && (
                  <button
                    onClick={() => closeSession(session.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <button
          onClick={addNewSession}
          style={{
            background: '#333',
            border: '1px solid #555',
            color: '#4CAF50',
            borderRadius: '3px',
            padding: '6px 8px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          + Add
        </button>
      </div>

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
                disabled={isCurrentSessionProcessing}
                style={{
                  background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: isCurrentSessionProcessing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  opacity: isCurrentSessionProcessing ? 0.7 : 1
                }}
              >
                💾 Export PDF
              </button>
              <button
                onClick={async () => {
                  if (pages.length === 0) {
                    alert('No pages to create presentation');
                    return;
                  }

                  const jobId = addProcessingJob(activeSessionId, activeSession.name, 'presentation', pages.length);

                  try {
                    updateProcessingJob(jobId, { message: 'Creating presentation...' });

                    // Create HTML presentation
                    const presentationHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>${activeSession.name} - Presentation</title>
                      <style>
                        body { margin: 0; padding: 0; background: #000; font-family: Arial, sans-serif; }
                        .slide { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; }
                        .slide img { max-width: 90vw; max-height: 90vh; object-fit: contain; }
                        .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; display: flex; gap: 10px; }
                        .btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
                        .slide-number { position: fixed; top: 20px; right: 20px; color: white; font-size: 18px; z-index: 1000; }
                        .hidden { display: none; }
                      </style>
                    </head>
                    <body>
                      <div class="slide-number" id="slideNumber">1 / ${pages.length}</div>
                      ${pages.map((page, index) => `
                        <div class="slide ${index > 0 ? 'hidden' : ''}" id="slide-${index}">
                          <img src="${page.imageData}" alt="${page.name}" style="transform: rotate(${page.rotation}deg);" />
                        </div>
                      `).join('')}
                      <div class="controls">
                        <button class="btn" onclick="prevSlide()">← Previous</button>
                        <button class="btn" onclick="nextSlide()">Next →</button>
                        <button class="btn" onclick="toggleFullscreen()">Fullscreen</button>
                      </div>
                      <script>
                        let currentSlide = 0;
                        const totalSlides = ${pages.length};

                        function showSlide(n) {
                          document.querySelectorAll('.slide').forEach(slide => slide.classList.add('hidden'));
                          document.getElementById('slide-' + n).classList.remove('hidden');
                          document.getElementById('slideNumber').textContent = (n + 1) + ' / ' + totalSlides;
                        }

                        function nextSlide() {
                          currentSlide = (currentSlide + 1) % totalSlides;
                          showSlide(currentSlide);
                        }

                        function prevSlide() {
                          currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
                          showSlide(currentSlide);
                        }

                        function toggleFullscreen() {
                          if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen();
                          } else {
                            document.exitFullscreen();
                          }
                        }

                        document.addEventListener('keydown', (e) => {
                          if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
                          if (e.key === 'ArrowLeft') prevSlide();
                          if (e.key === 'Escape') document.exitFullscreen();
                        });
                      </script>
                    </body>
                    </html>`;

                    updateProcessingJob(jobId, { message: 'Generating download...' });

                    const blob = new Blob([presentationHTML], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${activeSession.name.replace(/\s+/g, '_')}_presentation.html`;
                    link.click();

                    URL.revokeObjectURL(url);
                    completeProcessingJob(jobId, 'completed', 'Presentation created successfully!');
                  } catch (error) {
                    console.error('Error creating presentation:', error);
                    completeProcessingJob(jobId, 'error', 'Error creating presentation');
                  }
                }}
                disabled={isCurrentSessionProcessing}
                style={{
                  background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: isCurrentSessionProcessing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  opacity: isCurrentSessionProcessing ? 0.7 : 1
                }}
              >
                🎥 Create Presentation
              </button>
              <button
                onClick={async () => {
                  if (pages.length === 0) {
                    alert('No pages to share');
                    return;
                  }

                  try {
                    // Create actual PDF like in cropper's share functionality
                    const pdfDoc = await PDFDocument.create();
                    const sortedPages = pages.sort((a, b) => a.order - b.order);

                    for (let i = 0; i < sortedPages.length; i++) {
                      const page = sortedPages[i];

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
                    const filename = `${activeSession.name.replace(/\s+/g, '_')}_enhanced_${new Date().toISOString().slice(0, 10)}.pdf`;
                    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

                    if (navigator.share && navigator.canShare({ files: [new File([pdfBlob], filename, { type: 'application/pdf' })] })) {
                      try {
                        await navigator.share({
                          title: '🎨 Enhanced PDF from PDF Master',
                          text: `Check out my enhanced PDF with ${pages.length} pages!`,
                          files: [new File([pdfBlob], filename, { type: 'application/pdf' })]
                        });
                        alert('📄 PDF shared successfully!');
                      } catch (shareError: any) {
                        if (shareError.name !== 'AbortError') {
                          console.log('Share failed:', shareError);
                          alert(`📄 PDF generated successfully! You can share this PDF of ${pages.length} enhanced pages.`);
                        }
                      }
                    } else {
                      // Just show message - no auto download, exactly like cropper
                      alert(`📄 PDF generated successfully! You can share this PDF of ${pages.length} enhanced pages.`);
                    }
                  } catch (error) {
                    console.error('Error creating PDF for sharing:', error);
                    alert('Error creating PDF for sharing');
                  }
                }}
                style={{
                  background: 'linear-gradient(45deg, #007bff, #0056b3)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                📲 Share Enhanced PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Processing Status Bar */}
      {(globalProcessingCount > 0 || processingJobs.length > 0) && (
        <div style={{
          background: 'rgba(0,0,0,0.9)',
          color: 'white',
          padding: '12px 24px',
          fontSize: '14px',
          borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
          maxHeight: '150px',
          overflowY: 'auto'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: processingJobs.length > 0 ? '8px' : '0'
          }}>
            <span style={{ fontWeight: 'bold' }}>
              🔄 Processing Jobs ({globalProcessingCount} active)
            </span>
            {globalProcessingStatus && (
              <span style={{ color: '#00bfff', fontSize: '12px' }}>
                {globalProcessingStatus}
              </span>
            )}
          </div>
          
          {/* Jobs List */}
          {processingJobs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {processingJobs.slice(0, 5).map(job => (
                <div key={job.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.1)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  <span>
                    <span style={{ color: job.sessionId === activeSessionId ? '#4CAF50' : '#00bfff' }}>
                      {job.sessionName}
                    </span>
                    {' - '}
                    <span style={{ textTransform: 'capitalize' }}>{job.type}</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {job.status === 'processing' && (
                      <span style={{ color: '#FFC107' }}>
                        {job.progress}/{job.total}
                      </span>
                    )}
                    <span style={{
                      color: job.status === 'completed' ? '#4CAF50' : 
                             job.status === 'error' ? '#f44336' : '#FFC107'
                    }}>
                      {job.status === 'processing' ? '⏳' : 
                       job.status === 'completed' ? '✅' : '❌'}
                    </span>
                  </div>
                </div>
              ))}
              {processingJobs.length > 5 && (
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>
                  ... and {processingJobs.length - 5} more jobs
                </div>
              )}
            </div>
          )}
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
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                onClick={() => {
                  const folderInput = document.createElement('input');
                  folderInput.type = 'file';
                  folderInput.webkitdirectory = true;
                  folderInput.multiple = true;
                  folderInput.accept = 'image/*';
                  folderInput.style.display = 'none';
                  
                  folderInput.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files) {
                      const event = {
                        target: {
                          files: target.files,
                          value: ''
                        }
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleImageUpload(event);
                    }
                    document.body.removeChild(folderInput);
                  };
                  
                  document.body.appendChild(folderInput);
                  folderInput.click();
                }}
                style={{
                  background: 'linear-gradient(45deg, #9C27B0, #7B1FA2)',
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
                📂 Upload Folder
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

                  {/* ALL DIRECTIONAL Rearrange buttons - up, down, left, right */}
                  {rearrangeMode && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gridTemplateRows: 'repeat(3, 1fr)',
                      gap: '8px',
                      zIndex: 300
                    }}>
                      {/* Top Row */}
                      <div></div>
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
                          width: "40px",
                          height: "40px",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          fontSize: "20px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          opacity: index === 0 ? 0.5 : 1
                        }}
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <div></div>

                      {/* Middle Row */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePageLeft(index);
                        }}
                        disabled={index === 0}
                        style={{
                          background: index === 0 ? "#666" : "linear-gradient(135deg, #FF9800, #F57C00)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          fontSize: "20px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          opacity: index === 0 ? 0.5 : 1
                        }}
                        title="Move Left"
                      >
                        ←
                      </button>
                      <div style={{
                        background: "rgba(0,0,0,0.5)",
                        borderRadius: "50%",
                        width: "40px",
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: "bold"
                      }}>
                        {index + 1}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePageRight(index);
                        }}
                        disabled={index === pages.length - 1}
                        style={{
                          background: index === pages.length - 1 ? "#666" : "linear-gradient(135deg, #FF9800, #F57C00)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          cursor: index === pages.length - 1 ? "not-allowed" : "pointer",
                          fontSize: "20px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          opacity: index === pages.length - 1 ? 0.5 : 1
                        }}
                        title="Move Right"
                      >
                        →
                      </button>

                      {/* Bottom Row */}
                      <div></div>
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
                          width: "40px",
                          height: "40px",
                          cursor: index === pages.length - 1 ? "not-allowed" : "pointer",
                          fontSize: "20px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          opacity: index === pages.length - 1 ? 0.5 : 1
                        }}
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <div></div>
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
                            color: "white",
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
              background: '#f9f9f9',
              position: 'relative'
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
                    padding: '10px',
                    position: 'relative'
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

                    {/* Resize Arrows - exactly like cropper */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gridTemplateRows: 'repeat(3, 1fr)',
                      gap: '12px',
                      pointerEvents: 'auto'
                    }}>
                      {/* Top Row */}
                      <div></div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFloatingPages(prev => ({
                            ...prev,
                            [pageId]: {
                              ...prev[pageId],
                              size: {
                                width: prev[pageId].size.width,
                                height: Math.max(200, prev[pageId].size.height - 20)
                              }
                            }
                          }));
                        }}
                        style={{
                          background: "linear-gradient(135deg, #FF5722, #E64A19)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          cursor: "pointer",
                          fontSize: "18px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                        }}
                        title="Resize Up"
                      >
                        ↑
                      </button>
                      <div></div>

                      {/* Middle Row */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFloatingPages(prev => ({
                            ...prev,
                            [pageId]: {
                              ...prev[pageId],
                              size: {
                                width: Math.max(300, prev[pageId].size.width - 20),
                                height: prev[pageId].size.height
                              }
                            }
                          }));
                        }}
                        style={{
                          background: "linear-gradient(135deg, #FF5722, #E64A19)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          cursor: "pointer",
                          fontSize: "18px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                        }}
                        title="Resize Left"
                      >
                        ←
                      </button>
                      <div style={{
                        background: "rgba(0,0,0,0.5)",
                        borderRadius: "50%",
                        width: "40px",
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: "bold"
                      }}>
                        ↔↕
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFloatingPages(prev => ({
                            ...prev,
                            [pageId]: {
                              ...prev[pageId],
                              size: {
                                width: prev[pageId].size.width + 20,
                                height: prev[pageId].size.height
                              }
                            }
                          }));
                        }}
                        style={{
                          background: "linear-gradient(135deg, #FF5722, #E64A19)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          cursor: "pointer",
                          fontSize: "18px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                        }}
                        title="Resize Right"
                      >
                        →
                      </button>

                      {/* Bottom Row */}
                      <div></div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFloatingPages(prev => ({
                            ...prev,
                            [pageId]: {
                              ...prev[pageId],
                              size: {
                                width: prev[pageId].size.width,
                                height: prev[pageId].size.height + 20
                              }
                            }
                          }));
                        }}
                        style={{
                          background: "linear-gradient(135deg, #FF5722, #E64A19)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          cursor: "pointer",
                          fontSize: "18px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                        }}
                        title="Resize Down"
                      >
                        ↓
                      </button>
                      <div></div>
                    </div>
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