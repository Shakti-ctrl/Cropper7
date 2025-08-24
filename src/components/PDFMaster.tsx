import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker - use local worker for reliability  
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
  console.log('PDF Worker loaded locally');
}

interface SplitLine {
  id: string;
  points: { x: number; y: number }[];
  isDrawing: boolean;
}

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
  splitLines?: SplitLine[];
  originalImageData?: string;
  isOriginal?: boolean;
  parentPageId?: string;
  splitIndex?: number;
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
  
  // Image splitting functionality
  const [splitMode, setSplitMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [editHistory, setEditHistory] = useState<PDFPage[][]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [drawingPageId, setDrawingPageId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentSplitLine, setCurrentSplitLine] = useState<{ x: number; y: number }[]>([]);
  
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

  // Group Mode functionality
  const [groupMode, setGroupMode] = useState(false);
  const [showGroupTags, setShowGroupTags] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [pageGroups, setPageGroups] = useState<{[pageId: string]: string}>({});
  const [groupHistory, setGroupHistory] = useState<{pageId: string, tag: string}[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([
    '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
    '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣', '1️⃣6️⃣', '1️⃣7️⃣', '1️⃣8️⃣', '1️⃣9️⃣', '2️⃣0️⃣'
  ]);
  const [groupTagsPosition, setGroupTagsPosition] = useState({ x: 150, y: 150 });
  const [groupTagsSize, setGroupTagsSize] = useState({ width: 400, height: 300 });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showCustomNames, setShowCustomNames] = useState(false);
  const [customPDFNames, setCustomPDFNames] = useState<{[tag: string]: string}>({});
  const [customNamesPosition, setCustomNamesPosition] = useState({ x: 200, y: 200 });
  const [customNamesSize, setCustomNamesSize] = useState({ width: 500, height: 400 });

  // Circling functionality
  interface CircleShape {
    id: string;
    type: 'circle' | 'rectangle' | 'ellipse' | 'triangle' | 'polygon' | 'custom';
    points: { x: number; y: number }[];
    center?: { x: number; y: number };
    radius?: number;
    width?: number;
    height?: number;
    color: string;
    strokeWidth: number;
    isDrawing?: boolean;
  }

  const [circlingMode, setCirclingMode] = useState(false);
  const [showShapeSelector, setShowShapeSelector] = useState(false);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [pageCircles, setPageCircles] = useState<{[pageId: string]: CircleShape[]}>({});
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [currentShapePoints, setCurrentShapePoints] = useState<{ x: number; y: number }[]>([]);
  const [circleHistory, setCircleHistory] = useState<{[pageId: string]: CircleShape[]}[]>([]);
  const [shapeSelectorPosition, setShapeSelectorPosition] = useState({ x: 300, y: 150 });
  const [shapeSelectorSize, setShapeSelectorSize] = useState({ width: 450, height: 350 });
  const [selectedShapeForEdit, setSelectedShapeForEdit] = useState<{pageId: string, shapeId: string} | null>(null);
  const [availableShapes, setAvailableShapes] = useState([
    { type: 'circle', name: '⭕ Circle', icon: '⭕' },
    { type: 'rectangle', name: '⬜ Rectangle', icon: '⬜' },
    { type: 'ellipse', name: '🥚 Ellipse', icon: '🥚' },
    { type: 'triangle', name: '🔺 Triangle', icon: '🔺' },
    { type: 'polygon', name: '🔷 Polygon', icon: '🔷' },
    { type: 'custom', name: '✏️ Custom', icon: '✏️' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const floatingRefs = useRef<{[key: string]: HTMLDivElement}>({});
  const canvasRefs = useRef<{[key: string]: HTMLCanvasElement}>({});
  const groupTagsRef = useRef<HTMLDivElement>(null);
  const customNamesRef = useRef<HTMLDivElement>(null);

  // Session management functions - exact same as cropper
  const generateSessionId = () => `pdf_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Group Mode Functions
  const toggleGroupMode = () => {
    if (!groupMode) {
      setGroupMode(true);
      setShowGroupTags(true);
    } else {
      setGroupMode(false);
      setShowGroupTags(false);
      setSelectedTag(null);
    }
  };

  // Circling Mode Functions
  const toggleCirclingMode = () => {
    if (!circlingMode) {
      setCirclingMode(true);
      setShowShapeSelector(true);
    } else {
      setCirclingMode(false);
      setShowShapeSelector(false);
      setSelectedShape(null);
      setIsDrawingShape(false);
      setDrawingPageId(null);
    }
  };

  const saveCircleHistory = () => {
    setCircleHistory(prev => [...prev, { ...pageCircles }]);
  };

  const undoLastCircle = () => {
    if (circleHistory.length === 0) return;
    
    const lastState = circleHistory[circleHistory.length - 1];
    setPageCircles(lastState);
    setCircleHistory(prev => prev.slice(0, -1));
  };

  const startDrawingShape = (pageId: string, event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!circlingMode || !selectedShape) return;
    
    const canvas = canvasRefs.current[pageId];
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setDrawingPageId(pageId);
    setIsDrawingShape(true);
    setCurrentShapePoints([{ x, y }]);
    saveCircleHistory();
  };

  const continueDrawingShape = (pageId: string, event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingShape || drawingPageId !== pageId) return;
    
    const canvas = canvasRefs.current[pageId];
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (selectedShape === 'custom' || selectedShape === 'polygon') {
      setCurrentShapePoints(prev => [...prev, { x, y }]);
    } else {
      setCurrentShapePoints(prev => [prev[0], { x, y }]);
    }
  };

  const finishDrawingShape = () => {
    if (!isDrawingShape || !drawingPageId || currentShapePoints.length < 2) {
      setIsDrawingShape(false);
      setDrawingPageId(null);
      setCurrentShapePoints([]);
      return;
    }
    
    const shapeId = `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let newShape: CircleShape;

    switch (selectedShape) {
      case 'circle':
        const centerX = (currentShapePoints[0].x + currentShapePoints[1].x) / 2;
        const centerY = (currentShapePoints[0].y + currentShapePoints[1].y) / 2;
        const radius = Math.sqrt(
          Math.pow(currentShapePoints[1].x - centerX, 2) + 
          Math.pow(currentShapePoints[1].y - centerY, 2)
        );
        newShape = {
          id: shapeId,
          type: 'circle',
          points: currentShapePoints,
          center: { x: centerX, y: centerY },
          radius,
          color: '#ff0000',
          strokeWidth: 3
        };
        break;
      case 'rectangle':
        newShape = {
          id: shapeId,
          type: 'rectangle',
          points: currentShapePoints,
          width: Math.abs(currentShapePoints[1].x - currentShapePoints[0].x),
          height: Math.abs(currentShapePoints[1].y - currentShapePoints[0].y),
          color: '#00ff00',
          strokeWidth: 3
        };
        break;
      case 'ellipse':
        newShape = {
          id: shapeId,
          type: 'ellipse',
          points: currentShapePoints,
          width: Math.abs(currentShapePoints[1].x - currentShapePoints[0].x),
          height: Math.abs(currentShapePoints[1].y - currentShapePoints[0].y),
          color: '#0000ff',
          strokeWidth: 3
        };
        break;
      default:
        newShape = {
          id: shapeId,
          type: selectedShape as any,
          points: [...currentShapePoints],
          color: '#ff00ff',
          strokeWidth: 3
        };
    }
    
    setPageCircles(prev => ({
      ...prev,
      [drawingPageId]: [...(prev[drawingPageId] || []), newShape]
    }));
    
    setIsDrawingShape(false);
    setDrawingPageId(null);
    setCurrentShapePoints([]);
  };

  const deleteCircleShape = (pageId: string, shapeId: string) => {
    saveCircleHistory();
    setPageCircles(prev => ({
      ...prev,
      [pageId]: (prev[pageId] || []).filter(shape => shape.id !== shapeId)
    }));
  };

  const moveCircleShape = (pageId: string, shapeId: string, deltaX: number, deltaY: number) => {
    setPageCircles(prev => ({
      ...prev,
      [pageId]: (prev[pageId] || []).map(shape => {
        if (shape.id === shapeId) {
          return {
            ...shape,
            points: shape.points.map(point => ({
              x: point.x + deltaX,
              y: point.y + deltaY
            })),
            center: shape.center ? {
              x: shape.center.x + deltaX,
              y: shape.center.y + deltaY
            } : undefined
          };
        }
        return shape;
      })
    }));
  };

  const splitImageByCircles = async (page: PDFPage): Promise<PDFPage[]> => {
    const pageShapes = pageCircles[page.id];
    if (!pageShapes || pageShapes.length === 0) {
      return [page];
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const sourceCanvas = document.createElement('canvas');
        const sourceCtx = sourceCanvas.getContext('2d')!;
        
        sourceCanvas.width = img.naturalWidth || img.width;
        sourceCanvas.height = img.naturalHeight || img.height;
        sourceCtx.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);
        
        const splitPages: PDFPage[] = [];
        
        const displayCanvas = canvasRefs.current[page.id];
        const scaleX = displayCanvas ? sourceCanvas.width / displayCanvas.width : 1;
        const scaleY = displayCanvas ? sourceCanvas.height / displayCanvas.height : 1;
        
        pageShapes.forEach((shape, shapeIndex) => {
          // Create a temporary canvas for precise shape extraction
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCanvas.width = sourceCanvas.width;
          tempCanvas.height = sourceCanvas.height;
          
          // Create exact clipping path based on shape type with precise scaling
          tempCtx.save();
          tempCtx.beginPath();
          
          if (shape.type === 'circle' && shape.center && shape.radius) {
            tempCtx.arc(
              shape.center.x * scaleX,
              shape.center.y * scaleY,
              shape.radius * Math.min(scaleX, scaleY),
              0,
              2 * Math.PI
            );
          } else if (shape.type === 'rectangle') {
            const x1 = Math.min(shape.points[0].x, shape.points[1].x) * scaleX;
            const y1 = Math.min(shape.points[0].y, shape.points[1].y) * scaleY;
            const x2 = Math.max(shape.points[0].x, shape.points[1].x) * scaleX;
            const y2 = Math.max(shape.points[0].y, shape.points[1].y) * scaleY;
            tempCtx.rect(x1, y1, x2 - x1, y2 - y1);
          } else if (shape.type === 'ellipse') {
            const centerX = (shape.points[0].x + shape.points[1].x) / 2 * scaleX;
            const centerY = (shape.points[0].y + shape.points[1].y) / 2 * scaleY;
            const radiusX = Math.abs(shape.points[1].x - shape.points[0].x) / 2 * scaleX;
            const radiusY = Math.abs(shape.points[1].y - shape.points[0].y) / 2 * scaleY;
            tempCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          } else if (shape.type === 'triangle') {
            const x1 = (shape.points[0].x + shape.points[1].x) / 2 * scaleX;
            const y1 = shape.points[0].y * scaleY;
            const x2 = shape.points[0].x * scaleX;
            const y2 = shape.points[1].y * scaleY;
            const x3 = shape.points[1].x * scaleX;
            const y3 = shape.points[1].y * scaleY;
            tempCtx.moveTo(x1, y1);
            tempCtx.lineTo(x2, y2);
            tempCtx.lineTo(x3, y3);
            tempCtx.closePath();
          } else {
            // Custom or polygon shape with exact point mapping
            const scaledPoints = shape.points.map(p => ({
              x: p.x * scaleX,
              y: p.y * scaleY
            }));
            if (scaledPoints.length > 0) {
              tempCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
              for (let i = 1; i < scaledPoints.length; i++) {
                tempCtx.lineTo(scaledPoints[i].x, scaledPoints[i].y);
              }
              tempCtx.closePath();
            }
          }
          
          tempCtx.clip();
          
          // Draw the original image with clipping applied
          tempCtx.drawImage(sourceCanvas, 0, 0);
          tempCtx.restore();
          
          // Get the precise bounding box of the clipped content
          const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          const pixels = imageData.data;
          let minX = tempCanvas.width, maxX = 0, minY = tempCanvas.height, maxY = 0;
          
          // Find actual content bounds
          for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
              const alpha = pixels[(y * tempCanvas.width + x) * 4 + 3];
              if (alpha > 0) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
              }
            }
          }
          
          // Create final cropped image if content was found
          if (minX < maxX && minY < maxY) {
            const finalWidth = maxX - minX + 1;
            const finalHeight = maxY - minY + 1;
            const finalCanvas = document.createElement('canvas');
            const finalCtx = finalCanvas.getContext('2d')!;
            
            finalCanvas.width = finalWidth;
            finalCanvas.height = finalHeight;
            
            finalCtx.drawImage(
              tempCanvas,
              minX, minY, finalWidth, finalHeight,
              0, 0, finalWidth, finalHeight
            );
            
            const segmentImageData = finalCanvas.toDataURL('image/png', 0.95);
            
            const newPage: PDFPage = {
              ...page,
              id: `${page.id}_circle_${shapeIndex}`,
              name: `${page.name}_${shape.type}_${shapeIndex + 1}`,
              imageData: segmentImageData,
              parentPageId: page.id,
              splitIndex: shapeIndex,
              order: page.order + (shapeIndex * 0.001),
              width: finalWidth,
              height: finalHeight,
              crop: { x: 0, y: 0, width: finalWidth, height: finalHeight },
              isOriginal: false
            };
            
            splitPages.push(newPage);
          }
        });
        
        resolve(splitPages.length > 0 ? splitPages : [page]);
      };
      
      img.onerror = () => {
        console.error('Failed to load image for circle splitting');
        resolve([page]);
      };
      img.src = page.imageData;
    });
  };

  const applyCirclesToPage = async (pageId: string) => {
    saveToHistory();
    const page = pages.find(p => p.id === pageId);
    if (!page) return;
    
    const circledPages = await splitImageByCircles(page);
    
    if (circledPages.length > 1 || (circledPages.length === 1 && circledPages[0].id !== page.id)) {
      setPages(prev => {
        const otherPages = prev.filter(p => p.id !== pageId);
        const updatedPages = [...otherPages, ...circledPages];
        
        return updatedPages
          .sort((a, b) => a.order - b.order)
          .map((p, index) => ({ ...p, order: index }));
      });
    }
  };

  const applyCirclesToAllPages = async () => {
    if (!applyToAll) return;
    
    saveToHistory();
    const allCircledPages: PDFPage[] = [];
    
    for (const page of pages) {
      if (pageCircles[page.id] && pageCircles[page.id].length > 0) {
        const circledPages = await splitImageByCircles(page);
        allCircledPages.push(...circledPages);
      } else {
        allCircledPages.push(page);
      }
    }
    
    setPages(allCircledPages.sort((a, b) => a.order - b.order));
  };

  const addMoreTags = () => {
    const nextNumbers = ['2️⃣1️⃣', '2️⃣2️⃣', '2️⃣3️⃣', '2️⃣4️⃣', '2️⃣5️⃣', '2️⃣6️⃣', '2️⃣7️⃣', '2️⃣8️⃣', '2️⃣9️⃣', '3️⃣0️⃣'];
    const currentLength = availableTags.length;
    const newTags = nextNumbers.slice(0, Math.min(10, 50 - currentLength));
    setAvailableTags(prev => [...prev, ...newTags]);
  };

  const assignTagToPage = (pageId: string) => {
    if (!selectedTag || !groupMode) return;
    
    // Add to history for undo functionality
    setGroupHistory(prev => [...prev, { pageId, tag: selectedTag }]);
    
    setPageGroups(prev => ({
      ...prev,
      [pageId]: selectedTag
    }));
  };

  const removeTagFromPage = (pageId: string) => {
    setPageGroups(prev => {
      const newGroups = { ...prev };
      delete newGroups[pageId];
      return newGroups;
    });
  };

  const undoLastGrouping = () => {
    if (groupHistory.length === 0) return;
    
    const lastAction = groupHistory[groupHistory.length - 1];
    
    // Remove the last assigned tag
    setPageGroups(prev => {
      const newGroups = { ...prev };
      delete newGroups[lastAction.pageId];
      return newGroups;
    });
    
    // Remove from history
    setGroupHistory(prev => prev.slice(0, -1));
  };

  const getGroupedPages = () => {
    const groups: {[tag: string]: PDFPage[]} = {};
    pages.forEach(page => {
      const tag = pageGroups[page.id];
      if (tag) {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(page);
      }
    });
    return groups;
  };

  const getGroupCount = () => {
    return Object.keys(getGroupedPages()).length;
  };

  const handleGroupZip = () => {
    const groupCount = getGroupCount();
    if (groupCount === 0) {
      alert('No groups created. Please assign tags to pages first.');
      return;
    }
    setShowExportOptions(true);
  };

  const exportWithDefaultNames = async () => {
    setShowExportOptions(false);
    await createGroupedPDFZip(false);
  };

  const exportWithCustomNames = () => {
    setShowExportOptions(false);
    const groups = getGroupedPages();
    const defaultNames: {[tag: string]: string} = {};
    
    Object.keys(groups).forEach((tag, index) => {
      defaultNames[tag] = `Group_${index + 1}.pdf`;
    });
    
    setCustomPDFNames(defaultNames);
    setShowCustomNames(true);
  };

  const createGroupedPDFZip = async (useCustomNames: boolean = false) => {
    const groups = getGroupedPages();
    const groupKeys = Object.keys(groups);
    
    if (groupKeys.length === 0) {
      alert('No groups to export');
      return;
    }

    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'pdf', groupKeys.length);
    
    try {
      updateProcessingJob(jobId, { message: `Creating ${groupKeys.length} PDFs for groups...` });
      
      // Dynamic import of JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (let i = 0; i < groupKeys.length; i++) {
        const tag = groupKeys[i];
        const groupPages = groups[tag];
        
        updateProcessingJob(jobId, {
          progress: i,
          message: `Creating PDF for group ${tag} (${groupPages.length} pages)`
        });
        
        // Create PDF for this group
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.create();
        
        for (const page of groupPages.sort((a, b) => a.order - b.order)) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          canvas.width = page.width;
          canvas.height = page.height;
          
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          
          const imageBytes = canvas.toDataURL('image/png', 1.0);
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
        
        // Get filename
        const filename = useCustomNames && customPDFNames[tag] 
          ? customPDFNames[tag].endsWith('.pdf') ? customPDFNames[tag] : `${customPDFNames[tag]}.pdf`
          : `Group_${i + 1}.pdf`;
        
        zip.file(filename, pdfBytes);
      }
      
      updateProcessingJob(jobId, { message: 'Creating ZIP file...' });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download ZIP
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeSession.name.replace(/\s+/g, '_')}_grouped_pdfs.zip`;
      link.click();
      URL.revokeObjectURL(url);
      
      completeProcessingJob(jobId, 'completed', `✅ Created ${groupKeys.length} PDFs in ZIP file successfully!`);
      setShowCustomNames(false);
      
    } catch (error) {
      console.error('Error creating grouped PDF ZIP:', error);
      completeProcessingJob(jobId, 'error', `❌ Error creating grouped PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Drag handlers for floating windows
  const handleGroupTagsDrag = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = groupTagsPosition;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = startPos.x + (e.clientX - startX);
      const newY = startPos.y + (e.clientY - startY);
      setGroupTagsPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCustomNamesDrag = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = customNamesPosition;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = startPos.x + (e.clientX - startX);
      const newY = startPos.y + (e.clientY - startY);
      setCustomNamesPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleShapeSelectorDrag = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = shapeSelectorPosition;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = startPos.x + (e.clientX - startX);
      const newY = startPos.y + (e.clientY - startY);
      setShapeSelectorPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Image splitting functions
  const saveToHistory = () => {
    const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
    newHistory.push([...pages]);
    setEditHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  };
  
  const undo = () => {
    if (currentHistoryIndex > 0) {
      const previousState = editHistory[currentHistoryIndex - 1];
      setPages([...previousState]);
      setCurrentHistoryIndex(currentHistoryIndex - 1);
    }
  };
  
  const resetPageToOriginal = (pageId: string) => {
    setPages(prev => prev.map(page => {
      if (page.id === pageId && page.originalImageData) {
        return {
          ...page,
          imageData: page.originalImageData,
          splitLines: [],
          isOriginal: true
        };
      }
      return page;
    }));
  };
  
  const splitImageByLines = async (page: PDFPage): Promise<PDFPage[]> => {
    if (!page.splitLines || page.splitLines.length === 0) {
      return [page];
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Create a canvas to draw the original image
        const sourceCanvas = document.createElement('canvas');
        const sourceCtx = sourceCanvas.getContext('2d')!;
        
        // Set canvas to actual image dimensions
        sourceCanvas.width = img.naturalWidth || img.width;
        sourceCanvas.height = img.naturalHeight || img.height;
        sourceCtx.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);
        
        const splitPages: PDFPage[] = [];
        
        // Get the canvas element for this page to understand scaling
        const displayCanvas = canvasRefs.current[page.id];
        const scaleX = displayCanvas ? sourceCanvas.width / displayCanvas.width : 1;
        const scaleY = displayCanvas ? sourceCanvas.height / displayCanvas.height : 1;
        
        // Sort split lines by Y coordinate and scale coordinates
        const sortedLines = [...(page.splitLines || [])].map(line => ({
          ...line,
          points: line.points.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY
          }))
        })).sort((a, b) => {
          const avgYA = a.points.reduce((sum, p) => sum + p.y, 0) / a.points.length;
          const avgYB = b.points.reduce((sum, p) => sum + p.y, 0) / b.points.length;
          return avgYA - avgYB;
        });
        
        let currentY = 0;
        
        // Create segments between split lines
        for (let i = 0; i <= sortedLines.length; i++) {
          const nextY = i < sortedLines.length 
            ? Math.min(...sortedLines[i].points.map(p => p.y))
            : sourceCanvas.height;
          
          const segmentHeight = Math.max(1, Math.floor(nextY - currentY));
          
          if (segmentHeight > 5) { // Only create segment if meaningful height
            const segmentCanvas = document.createElement('canvas');
            const segmentCtx = segmentCanvas.getContext('2d')!;
            
            segmentCanvas.width = sourceCanvas.width;
            segmentCanvas.height = segmentHeight;
            
            // Copy the segment from source canvas with proper clipping
            segmentCtx.drawImage(
              sourceCanvas, 
              0, Math.floor(currentY), sourceCanvas.width, segmentHeight,
              0, 0, sourceCanvas.width, segmentHeight
            );
            
            const segmentImageData = segmentCanvas.toDataURL('image/png', 0.9);
            
            const newPage: PDFPage = {
              ...page,
              id: `${page.id}_split_${i}`,
              name: `${page.name}_part_${i + 1}`,
              imageData: segmentImageData,
              parentPageId: page.id,
              splitIndex: i,
              order: page.order + (i * 0.001), // Smaller increment for better ordering
              width: sourceCanvas.width,
              height: segmentHeight,
              crop: { x: 0, y: 0, width: sourceCanvas.width, height: segmentHeight },
              splitLines: undefined, // Remove split lines from segments
              isOriginal: false
            };
            
            splitPages.push(newPage);
          }
          
          currentY = nextY + 2; // Small gap to avoid including split line
        }
        
        resolve(splitPages.length > 0 ? splitPages : [page]);
      };
      img.onerror = () => {
        console.error('Failed to load image for splitting');
        resolve([page]);
      };
      img.src = page.imageData;
    });
  };
  
  const applySplitsToPage = async (pageId: string) => {
    saveToHistory();
    const page = pages.find(p => p.id === pageId);
    if (!page) return;
    
    const splitPages = await splitImageByLines(page);
    
    // Only proceed if we actually got split pages
    if (splitPages.length > 1 || (splitPages.length === 1 && splitPages[0].id !== page.id)) {
      setPages(prev => {
        // Remove the original page and add all split parts
        const otherPages = prev.filter(p => p.id !== pageId);
        const updatedPages = [...otherPages, ...splitPages];
        
        // Re-index pages to maintain proper order
        return updatedPages
          .sort((a, b) => a.order - b.order)
          .map((p, index) => ({ ...p, order: index }));
      });
    }
  };
  
  const applySplitsToAllPages = async () => {
    if (!applyToAll) return;
    
    saveToHistory();
    const allSplitPages: PDFPage[] = [];
    
    for (const page of pages) {
      if (page.splitLines && page.splitLines.length > 0) {
        const splitPages = await splitImageByLines(page);
        allSplitPages.push(...splitPages);
      } else {
        allSplitPages.push(page);
      }
    }
    
    setPages(allSplitPages.sort((a, b) => a.order - b.order));
  };
  
  const startDrawingSplitLine = (pageId: string, event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!splitMode) return;
    
    const canvas = canvasRefs.current[pageId];
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setDrawingPageId(pageId);
    setIsDrawing(true);
    setCurrentSplitLine([{ x, y }]);
  };
  
  const continueDrawingSplitLine = (pageId: string, event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || drawingPageId !== pageId) return;
    
    const canvas = canvasRefs.current[pageId];
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setCurrentSplitLine(prev => [...prev, { x, y }]);
  };
  
  const finishDrawingSplitLine = () => {
    if (!isDrawing || !drawingPageId || currentSplitLine.length < 2) {
      setIsDrawing(false);
      setDrawingPageId(null);
      setCurrentSplitLine([]);
      return;
    }
    
    const splitLineId = `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSplitLine: SplitLine = {
      id: splitLineId,
      points: [...currentSplitLine],
      isDrawing: false
    };
    
    setPages(prev => prev.map(page => {
      if (page.id === drawingPageId) {
        // Store original image data if not already stored
        const originalImageData = page.originalImageData || page.imageData;
        return {
          ...page,
          originalImageData,
          splitLines: [...(page.splitLines || []), newSplitLine],
          isOriginal: false
        };
      }
      return page;
    }));
    
    setIsDrawing(false);
    setDrawingPageId(null);
    setCurrentSplitLine([]);
  };
  
  const deleteSplitLine = (pageId: string, lineId: string) => {
    setPages(prev => prev.map(page => {
      if (page.id === pageId && page.splitLines) {
        const newSplitLines = page.splitLines.filter(line => line.id !== lineId);
        return {
          ...page,
          splitLines: newSplitLines,
          isOriginal: newSplitLines.length === 0
        };
      }
      return page;
    }));
  };
  
  const drawSplitLinesOnCanvas = useCallback((canvas: HTMLCanvasElement, page: PDFPage) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas but keep it transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save current state
    ctx.save();
    
    // Draw existing split lines - ALWAYS visible with better visibility
    if (page.splitLines && page.splitLines.length > 0) {
      page.splitLines.forEach((line, lineIndex) => {
        if (line.points && line.points.length > 1) {
          // Draw line with gradient for better visibility
          const gradient = ctx.createLinearGradient(
            line.points[0].x, line.points[0].y, 
            line.points[line.points.length - 1].x, line.points[line.points.length - 1].y
          );
          gradient.addColorStop(0, '#ff0000');
          gradient.addColorStop(1, '#cc0000');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 6; // Increased line width for better visibility
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          
          ctx.beginPath();
          ctx.moveTo(line.points[0].x, line.points[0].y);
          for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
          }
          ctx.stroke();
          
          // Reset shadow
          ctx.shadowBlur = 0;
          ctx.shadowColor = 'transparent';
          
          // Add numbered cut marks at start and end
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 2;
          
          // Start point
          ctx.beginPath();
          ctx.arc(line.points[0].x, line.points[0].y, 8, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // End point
          ctx.beginPath();
          ctx.arc(line.points[line.points.length - 1].x, line.points[line.points.length - 1].y, 8, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Line number label with better visibility
          const midIndex = Math.floor(line.points.length / 2);
          const midPoint = line.points[midIndex];
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 1;
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Background circle for number
          ctx.beginPath();
          ctx.arc(midPoint.x, midPoint.y - 12, 10, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Number text
          ctx.fillStyle = '#ff0000';
          ctx.fillText((lineIndex + 1).toString(), midPoint.x, midPoint.y - 12);
          
          // Draw horizontal line across entire width for clearer splitting
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(0, midPoint.y);
          ctx.lineTo(canvas.width, midPoint.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }
    
    // Draw current line being drawn with animation effect
    if (isDrawing && drawingPageId === page.id && currentSplitLine.length > 1) {
      ctx.strokeStyle = '#ff6666';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([8, 4]);
      ctx.shadowColor = 'rgba(255, 102, 102, 0.6)';
      ctx.shadowBlur = 3;
      
      ctx.beginPath();
      ctx.moveTo(currentSplitLine[0].x, currentSplitLine[0].y);
      for (let i = 1; i < currentSplitLine.length; i++) {
        ctx.lineTo(currentSplitLine[i].x, currentSplitLine[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw preview horizontal line for current drawing
      if (currentSplitLine.length > 0) {
        const avgY = currentSplitLine.reduce((sum, p) => sum + p.y, 0) / currentSplitLine.length;
        ctx.strokeStyle = 'rgba(255, 102, 102, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, avgY);
        ctx.lineTo(canvas.width, avgY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Restore state
    ctx.restore();
  }, [isDrawing, drawingPageId, currentSplitLine]);

  const drawCircleShapesOnCanvas = useCallback((canvas: HTMLCanvasElement, page: PDFPage) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pageShapes = pageCircles[page.id] || [];
    
    // Draw existing shapes
    pageShapes.forEach((shape, shapeIndex) => {
      ctx.save();
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      
      ctx.beginPath();
      
      switch (shape.type) {
        case 'circle':
          if (shape.center && shape.radius) {
            ctx.arc(shape.center.x, shape.center.y, shape.radius, 0, 2 * Math.PI);
          }
          break;
        case 'rectangle':
          if (shape.points.length >= 2) {
            const x = Math.min(shape.points[0].x, shape.points[1].x);
            const y = Math.min(shape.points[0].y, shape.points[1].y);
            const width = Math.abs(shape.points[1].x - shape.points[0].x);
            const height = Math.abs(shape.points[1].y - shape.points[0].y);
            ctx.rect(x, y, width, height);
          }
          break;
        case 'ellipse':
          if (shape.points.length >= 2) {
            const centerX = (shape.points[0].x + shape.points[1].x) / 2;
            const centerY = (shape.points[0].y + shape.points[1].y) / 2;
            const radiusX = Math.abs(shape.points[1].x - shape.points[0].x) / 2;
            const radiusY = Math.abs(shape.points[1].y - shape.points[0].y) / 2;
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          }
          break;
        case 'triangle':
          if (shape.points.length >= 2) {
            const x1 = (shape.points[0].x + shape.points[1].x) / 2;
            const y1 = shape.points[0].y;
            const x2 = shape.points[0].x;
            const y2 = shape.points[1].y;
            const x3 = shape.points[1].x;
            const y3 = shape.points[1].y;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
          }
          break;
        default:
          // Custom or polygon
          if (shape.points.length > 1) {
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) {
              ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
            if (shape.type === 'polygon') {
              ctx.closePath();
            }
          }
      }
      
      ctx.stroke();
      
      // Draw shape number
      if (shape.points.length > 0) {
        let labelX = shape.points[0].x;
        let labelY = shape.points[0].y;
        
        if (shape.center) {
          labelX = shape.center.x;
          labelY = shape.center.y;
        } else if (shape.points.length > 1) {
          labelX = (shape.points[0].x + shape.points[1].x) / 2;
          labelY = (shape.points[0].y + shape.points[1].y) / 2;
        }
        
        ctx.fillStyle = 'white';
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = 1;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.beginPath();
        ctx.arc(labelX, labelY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = shape.color;
        ctx.fillText((shapeIndex + 1).toString(), labelX, labelY);
      }
      
      // Draw resize handles if this shape is selected for resize
      if (selectedShapeForEdit && selectedShapeForEdit.pageId === page.id && selectedShapeForEdit.shapeId === shape.id) {
        if (shape.points.length >= 2) {
          let handlePoints: {x: number, y: number}[] = [];
          
          if (shape.type === 'circle' && shape.center && shape.radius) {
            // 8 points around circle
            for (let i = 0; i < 8; i++) {
              const angle = (i * Math.PI) / 4;
              handlePoints.push({
                x: shape.center.x + Math.cos(angle) * shape.radius,
                y: shape.center.y + Math.sin(angle) * shape.radius
              });
            }
          } else if (shape.type === 'rectangle' || shape.type === 'ellipse') {
            const x1 = Math.min(shape.points[0].x, shape.points[1].x);
            const y1 = Math.min(shape.points[0].y, shape.points[1].y);
            const x2 = Math.max(shape.points[0].x, shape.points[1].x);
            const y2 = Math.max(shape.points[0].y, shape.points[1].y);
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            
            handlePoints = [
              {x: x1, y: y1}, {x: centerX, y: y1}, {x: x2, y: y1},
              {x: x1, y: centerY}, {x: x2, y: centerY},
              {x: x1, y: y2}, {x: centerX, y: y2}, {x: x2, y: y2}
            ];
          } else {
            // For custom shapes, use the points themselves
            handlePoints = [...shape.points];
          }
          
          // Draw handles
          handlePoints.forEach(point => {
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });
        }
      }
      
      ctx.restore();
    });
    
    // Draw current shape being drawn
    if (isDrawingShape && drawingPageId === page.id && currentShapePoints.length > 0 && selectedShape) {
      ctx.save();
      ctx.strokeStyle = '#ff6666';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([8, 4]);
      
      ctx.beginPath();
      
      if (currentShapePoints.length >= 2) {
        switch (selectedShape) {
          case 'circle':
            const centerX = (currentShapePoints[0].x + currentShapePoints[1].x) / 2;
            const centerY = (currentShapePoints[0].y + currentShapePoints[1].y) / 2;
            const radius = Math.sqrt(
              Math.pow(currentShapePoints[1].x - centerX, 2) + 
              Math.pow(currentShapePoints[1].y - centerY, 2)
            );
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            break;
          case 'rectangle':
            const x = Math.min(currentShapePoints[0].x, currentShapePoints[1].x);
            const y = Math.min(currentShapePoints[0].y, currentShapePoints[1].y);
            const width = Math.abs(currentShapePoints[1].x - currentShapePoints[0].x);
            const height = Math.abs(currentShapePoints[1].y - currentShapePoints[0].y);
            ctx.rect(x, y, width, height);
            break;
          case 'ellipse':
            const eCenterX = (currentShapePoints[0].x + currentShapePoints[1].x) / 2;
            const eCenterY = (currentShapePoints[0].y + currentShapePoints[1].y) / 2;
            const radiusX = Math.abs(currentShapePoints[1].x - currentShapePoints[0].x) / 2;
            const radiusY = Math.abs(currentShapePoints[1].y - currentShapePoints[0].y) / 2;
            ctx.ellipse(eCenterX, eCenterY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            break;
          case 'triangle':
            const tCenterX = (currentShapePoints[0].x + currentShapePoints[1].x) / 2;
            const tY1 = currentShapePoints[0].y;
            const tX2 = currentShapePoints[0].x;
            const tY2 = currentShapePoints[1].y;
            const tX3 = currentShapePoints[1].x;
            const tY3 = currentShapePoints[1].y;
            ctx.moveTo(tCenterX, tY1);
            ctx.lineTo(tX2, tY2);
            ctx.lineTo(tX3, tY3);
            ctx.closePath();
            break;
          default:
            ctx.moveTo(currentShapePoints[0].x, currentShapePoints[0].y);
            for (let i = 1; i < currentShapePoints.length; i++) {
              ctx.lineTo(currentShapePoints[i].x, currentShapePoints[i].y);
            }
            if (selectedShape === 'polygon' && currentShapePoints.length > 2) {
              ctx.closePath();
            }
        }
      }
      
      ctx.stroke();
      ctx.restore();
    }
  }, [pageCircles, isDrawingShape, drawingPageId, currentShapePoints, selectedShape, selectedShapeForEdit]);

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
  }, [activeSessionId, activeSession]); // Remove 'pages' from dependencies

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
  }, [pages.length, activeSessionId]); // Use pages.length instead of pages, and remove saveCurrentSession
  
  // Initialize history when pages change
  useEffect(() => {
    if (editHistory.length === 0 && pages.length > 0) {
      setEditHistory([pages]);
      setCurrentHistoryIndex(0);
    }
  }, [pages, editHistory.length]);
  
  // Always redraw split lines and circle shapes for pages that have them
  useEffect(() => {
    pages.forEach(page => {
      const canvas = canvasRefs.current[page.id];
      if (canvas && (
        (page.splitLines && page.splitLines.length > 0) || 
        (isDrawing && drawingPageId === page.id) ||
        (pageCircles[page.id] && pageCircles[page.id].length > 0) ||
        (isDrawingShape && drawingPageId === page.id)
      )) {
        drawSplitLinesOnCanvas(canvas, page);
        drawCircleShapesOnCanvas(canvas, page);
      }
    });
  }, [pages, isDrawing, drawingPageId, currentSplitLine, drawSplitLinesOnCanvas, pageCircles, isDrawingShape, currentShapePoints, drawCircleShapesOnCanvas]);

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

  // Enhanced PDF upload with 100% reliability and better extraction
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

            // Enhanced PDF.js configuration with proper error handling
            const loadingTask = pdfjs.getDocument({
              data: arrayBuffer,
              useWorkerFetch: false,
              isEvalSupported: false,
              verbosity: 0
            });

            const pdf = await loadingTask.promise;
            const newPages: PDFPage[] = [];

            updateProcessingJob(jobId, { 
              total: pdf.numPages,
              message: `Extracting all ${pdf.numPages} pages from ${file.name}...`
            });

            // Process all pages with better error handling
            for (let i = 1; i <= pdf.numPages; i++) {
              updateProcessingJob(jobId, {
                progress: i - 1,
                message: `Extracting page ${i}/${pdf.numPages} - ${Math.round((i-1)/pdf.numPages * 100)}% complete`
              });

              try {
                const page = await pdf.getPage(i);
                
                // Use higher scale for better quality
                const scale = 2.0;
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) {
                  console.error(`Could not get canvas context for page ${i}`);
                  continue;
                }

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Enhanced render context with better quality settings
                const renderContext = {
                  canvasContext: context,
                  viewport: viewport,
                  canvas: canvas
                };

                // Render with timeout to prevent hanging
                const renderPromise = page.render(renderContext).promise;
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Render timeout')), 30000);
                });

                await Promise.race([renderPromise, timeoutPromise]);

                // Convert to high-quality image
                const imageData = canvas.toDataURL('image/png', 0.95);

                const pdfPage: PDFPage = {
                  id: `pdf_page_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                  name: `${file.name.replace('.pdf', '')}_page_${String(i).padStart(3, '0')}`,
                  imageData,
                  originalImageData: imageData,
                  rotation: 0,
                  crop: { x: 0, y: 0, width: viewport.width, height: viewport.height },
                  order: pages.length + newPages.length,
                  width: viewport.width,
                  height: viewport.height,
                  isOriginal: true
                };

                newPages.push(pdfPage);
                
                // Small delay to prevent UI blocking
                if (i % 5 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
                
              } catch (pageError) {
                console.error(`Error processing page ${i}:`, pageError);
                updateProcessingJob(jobId, {
                  message: `Warning: Failed to extract page ${i}, continuing with remaining pages...`
                });
                // Continue with other pages even if one fails
              }
            }

            if (newPages.length > 0) {
              setPages(prev => [...prev, ...newPages]);
              completeProcessingJob(jobId, 'completed', `✅ Successfully extracted ${newPages.length}/${pdf.numPages} pages from ${file.name}`);
              
              // Show success message
              console.log(`PDF Upload Success: Extracted ${newPages.length} pages from ${file.name}`);
            } else {
              completeProcessingJob(jobId, 'error', `❌ No pages could be extracted from ${file.name}. The PDF might be corrupted or protected.`);
            }
          } catch (pdfError) {
            console.error('Error processing PDF:', pdfError);
            let errorMessage = 'Unknown error occurred.';
            if (pdfError instanceof Error) {
              if (pdfError.message.includes('worker')) {
                errorMessage = 'PDF worker failed to load. Please refresh the page and try again.';
              } else if (pdfError.message.includes('fetch')) {
                errorMessage = 'Failed to load PDF worker. Check your internet connection.';
              } else if (pdfError.message.includes('fake worker')) {
                errorMessage = 'PDF processing system error. Please try uploading a different PDF file.';
              } else {
                errorMessage = pdfError.message;
              }
            }
            completeProcessingJob(jobId, 'error', `❌ Error processing ${file.name}: ${errorMessage}`);
          }
        } else {
          completeProcessingJob(jobId, 'error', `❌ ${file.name} is not a valid PDF file`);
        }
      }
    } catch (error) {
      console.error('Error in PDF upload:', error);
      completeProcessingJob(jobId, 'error', '❌ Error processing PDF files. Please try again.');
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

  const toggleLandscapeMode = (pageId: string) => {
    const targetPage = pages.find(page => page.id === pageId);
    if (!targetPage) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;
      const isCurrentlyLandscape = originalWidth > originalHeight;
      
      if (isCurrentlyLandscape) {
        // Already landscape, make it portrait
        canvas.width = Math.min(originalWidth, originalHeight);
        canvas.height = Math.max(originalWidth, originalHeight);
      } else {
        // Currently portrait, make it landscape
        canvas.width = Math.max(originalWidth, originalHeight);
        canvas.height = Math.min(originalWidth, originalHeight);
      }
      
      // Draw image to fit the new aspect ratio
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const scale = Math.min(canvas.width / originalWidth, canvas.height / originalHeight);
      const scaledWidth = originalWidth * scale;
      const scaledHeight = originalHeight * scale;
      const x = (canvas.width - scaledWidth) / 2;
      const y = (canvas.height - scaledHeight) / 2;
      
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      
      const newImageData = canvas.toDataURL('image/png', 0.9);
      
      setPages(prev => prev.map(page => {
        if (page.id === pageId) {
          return {
            ...page,
            imageData: newImageData,
            width: canvas.width,
            height: canvas.height,
            crop: { x: 0, y: 0, width: canvas.width, height: canvas.height }
          };
        }
        return page;
      }));
    };
    img.src = targetPage.imageData;
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
  // Export all pages to PDF
  const exportToPDF = async () => {
    if (pages.length === 0) {
      alert('No pages to export');
      return;
    }
    await exportPagesToPDF(pages, 'all_pages');
  };

  // Export selected pages to PDF
  const exportSelectedPagesToPDF = async () => {
    if (selectedPages.size === 0) {
      alert('Please select pages to export');
      return;
    }
    const selectedPageObjects = pages.filter(page => selectedPages.has(page.id));
    await exportPagesToPDF(selectedPageObjects, 'selected_pages');
  };

  // Common function to export pages to PDF
  const exportPagesToPDF = async (pagesToExport: PDFPage[], exportType: string) => {
    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'pdf', pagesToExport.length);

    try {
      const pdfDoc = await PDFDocument.create();
      const sortedPages = pagesToExport.sort((a, b) => a.order - b.order);

      updateProcessingJob(jobId, { 
        message: `Creating PDF with ${sortedPages.length} pages...` 
      });

      for (let i = 0; i < sortedPages.length; i++) {
        const page = sortedPages[i];
        updateProcessingJob(jobId, {
          progress: i,
          message: `Processing page ${i + 1}/${sortedPages.length} - ${page.name}`
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Use original dimensions for better quality
        canvas.width = page.width;
        canvas.height = page.height;

        const img = new Image();
        img.src = page.imageData;
        await new Promise((resolve) => { img.onload = resolve; });

        ctx.save();
        
        // Apply rotation if needed
        if (page.rotation !== 0) {
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((page.rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }
        
        // Draw with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Convert to PNG with high quality
        const imageBytes = canvas.toDataURL('image/png', 1.0);
        const pngImage = await pdfDoc.embedPng(imageBytes);
        
        // Create PDF page with proper dimensions
        const pdfPage = pdfDoc.addPage([canvas.width, canvas.height]);
        pdfPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height
        });
      }

      updateProcessingJob(jobId, { message: 'Finalizing PDF document...' });
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `${activeSession.name.replace(/\s+/g, '_')}_${exportType}_${timestamp}.pdf`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      URL.revokeObjectURL(url);
      completeProcessingJob(jobId, 'completed', `✅ PDF exported successfully! (${sortedPages.length} pages)`);
      
      console.log(`PDF Export Success: ${filename} with ${sortedPages.length} pages`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      completeProcessingJob(jobId, 'error', `❌ Error exporting PDF: ${errorMessage}`);
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
            onClick={() => folderInputRef.current?.click()}
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
            📁 Upload Folder
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
        flexWrap: 'nowrap',
        gap: '12px',
        overflowX: 'auto',
        minHeight: '60px'
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
              {selectedPages.size > 0 && (
                <button
                  onClick={() => {
                    selectedPages.forEach(pageId => deletePage(pageId));
                    setSelectedPages(new Set());
                  }}
                  style={{
                    background: 'rgba(244, 67, 54, 0.2)',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: '#f44336',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  🗑️ Delete Selected
                </button>
              )}
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
                onClick={() => setSplitMode(!splitMode)}
                style={{
                  background: splitMode ? 'linear-gradient(45deg, #ff4444, #cc0000)' : 'rgba(255, 100, 100, 0.2)',
                  border: '1px solid rgba(255, 100, 100, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: splitMode ? 'white' : '#ff6666',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: splitMode ? 'bold' : 'normal'
                }}
              >
                {splitMode ? '✂️ Split ON' : '✂️ Split Images'}
              </button>
              <button
                onClick={toggleGroupMode}
                style={{
                  background: groupMode ? 'linear-gradient(45deg, #9C27B0, #7B1FA2)' : 'rgba(156, 39, 176, 0.2)',
                  border: '1px solid rgba(156, 39, 176, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: groupMode ? 'white' : '#9C27B0',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: groupMode ? 'bold' : 'normal'
                }}
              >
                {groupMode ? '🏷️ Group ON' : '🏷️ Group Mode'}
              </button>
              <button
                onClick={toggleCirclingMode}
                style={{
                  background: circlingMode ? 'linear-gradient(45deg, #E91E63, #C2185B)' : 'rgba(233, 30, 99, 0.2)',
                  border: '1px solid rgba(233, 30, 99, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: circlingMode ? 'white' : '#E91E63',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: circlingMode ? 'bold' : 'normal'
                }}
              >
                {circlingMode ? '⭕ Circling ON' : '⭕ Circling'}
              </button>
              {getGroupCount() > 0 && (
                <button
                  onClick={handleGroupZip}
                  disabled={isCurrentSessionProcessing}
                  style={{
                    background: 'linear-gradient(45deg, #FF5722, #D84315)',
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
                  📦 GroupZip ({getGroupCount()} groups)
                </button>
              )}
              <button
                onClick={async () => {
                  setPreviewMode(!previewMode);
                  if (!previewMode && pages.length > 0) {
                    // Generate preview with actual split images
                    const previewWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes');
                    if (previewWindow) {
                      previewWindow.document.write(`
                        <div style="padding: 20px; text-align: center; font-family: Arial;">
                          <h2>🔄 Generating PDF Preview...</h2>
                          <p>Processing split images...</p>
                        </div>
                      `);
                      
                      // Process all pages and generate splits
                      const finalPages: PDFPage[] = [];
                      for (const page of pages) {
                        if (page.splitLines && page.splitLines.length > 0) {
                          const splitPages = await splitImageByLines(page);
                          finalPages.push(...splitPages);
                        } else {
                          finalPages.push(page);
                        }
                      }
                      
                      const sortedPages = finalPages.sort((a, b) => a.order - b.order);
                      
                      const previewHTML = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>PDF Preview - ${activeSession.name}</title>
                          <style>
                            body { 
                              margin: 0; 
                              padding: 20px; 
                              background: #f0f0f0; 
                              font-family: Arial, sans-serif;
                            }
                            .pdf-preview {
                              max-width: 600px;
                              margin: 0 auto;
                              background: white;
                              box-shadow: 0 0 20px rgba(0,0,0,0.2);
                              border-radius: 8px;
                              overflow: hidden;
                            }
                            .pdf-header {
                              background: linear-gradient(135deg, #667eea, #764ba2);
                              color: white;
                              padding: 15px 20px;
                              text-align: center;
                            }
                            .pdf-page {
                              border-bottom: 2px solid #eee;
                              padding: 20px;
                              text-align: center;
                              position: relative;
                            }
                            .pdf-page:last-child {
                              border-bottom: none;
                            }
                            .page-number {
                              position: absolute;
                              top: 10px;
                              right: 15px;
                              background: rgba(0,0,0,0.1);
                              padding: 4px 8px;
                              border-radius: 4px;
                              font-size: 12px;
                              color: #666;
                            }
                            .page-image {
                              max-width: 100%;
                              max-height: 600px;
                              object-fit: contain;
                              border: 1px solid #ddd;
                              border-radius: 4px;
                            }
                            .split-indicator {
                              background: rgba(76, 175, 80, 0.1);
                              border: 2px solid #4CAF50;
                              border-radius: 4px;
                              padding: 5px 10px;
                              margin: 10px 0;
                              font-size: 11px;
                              color: #2E7D32;
                              display: inline-block;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="pdf-preview">
                            <div class="pdf-header">
                              <h2>📄 Final PDF Preview: ${activeSession.name}</h2>
                              <p>Total Pages: ${sortedPages.length} (Including Split Parts)</p>
                            </div>
                            ${sortedPages.map((page, index) => `
                              <div class="pdf-page">
                                <div class="page-number">Page ${index + 1}</div>
                                <h4>${page.name}</h4>
                                ${page.parentPageId ? 
                                  `<div class="split-indicator">✂️ Split Part ${(page.splitIndex || 0) + 1} from original image</div>` : 
                                  ''
                                }
                                <img 
                                  src="${page.imageData}" 
                                  alt="${page.name}" 
                                  class="page-image"
                                  style="transform: rotate(${page.rotation}deg);"
                                />
                              </div>
                            `).join('')}
                          </div>
                          <div style="text-align: center; padding: 20px; color: #666;">
                            <p>This is how your PDF will look with all split images included.</p>
                            <p>You can reorder pages by dragging them in the main interface.</p>
                          </div>
                        </body>
                        </html>
                      `;
                      previewWindow.document.write(previewHTML);
                      previewWindow.document.close();
                    }
                  }
                }}
                style={{
                  background: previewMode ? 'linear-gradient(45deg, #4CAF50, #45a049)' : 'rgba(76, 175, 80, 0.2)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: previewMode ? 'white' : '#4CAF50',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: previewMode ? 'bold' : 'normal'
                }}
              >
                {previewMode ? '👁️ Preview ON' : '👁️ Preview PDF'}
              </button>
              <button
                onClick={undo}
                disabled={currentHistoryIndex <= 0}
                style={{
                  background: currentHistoryIndex <= 0 ? '#666' : 'rgba(255, 193, 7, 0.2)',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: currentHistoryIndex <= 0 ? '#999' : '#FFC107',
                  cursor: currentHistoryIndex <= 0 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  opacity: currentHistoryIndex <= 0 ? 0.5 : 1
                }}
              >
                ↶ Undo
              </button>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#00bfff',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  style={{
                    accentColor: '#00bfff',
                    cursor: 'pointer'
                  }}
                />
                Apply to All
              </label>
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
                💾 Export All Pages
              </button>
              {selectedPages.size > 0 && (
                <button
                  onClick={exportSelectedPagesToPDF}
                  disabled={isCurrentSessionProcessing}
                  style={{
                    background: 'linear-gradient(45deg, #4CAF50, #45a049)',
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
                  📄 Export Selected ({selectedPages.size})
                </button>
              )}
              <button
                onClick={async () => {
                  if (pages.length === 0) {
                    alert('No pages to create presentation');
                    return;
                  }

                  const jobId = addProcessingJob(activeSessionId, activeSession.name, 'presentation', pages.length);

                  try {
                    updateProcessingJob(jobId, { message: 'Creating presentation...' });

                    const sortedPages = pages.sort((a, b) => a.order - b.order);
                    
                    // Create HTML presentation with proper image handling
                    const presentationHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${activeSession.name} - Presentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: linear-gradient(135deg, #1e3c72, #2a5298); 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            overflow: hidden;
        }
        .presentation-container { 
            width: 100vw; 
            height: 100vh; 
            position: relative; 
        }
        .slide { 
            width: 100%; 
            height: 100%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            position: absolute;
            top: 0;
            left: 0;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        }
        .slide.active { opacity: 1; }
        .slide img { 
            max-width: 95vw; 
            max-height: 95vh; 
            object-fit: contain; 
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .controls { 
            position: fixed; 
            bottom: 30px; 
            left: 50%; 
            transform: translateX(-50%); 
            z-index: 1000; 
            display: flex; 
            gap: 15px;
            background: rgba(0,0,0,0.7);
            padding: 15px 25px;
            border-radius: 50px;
            backdrop-filter: blur(10px);
        }
        .btn { 
            background: linear-gradient(45deg, #667eea, #764ba2); 
            color: white; 
            border: none; 
            padding: 12px 20px; 
            border-radius: 25px; 
            cursor: pointer; 
            font-weight: bold;
            transition: all 0.3s ease;
            font-size: 14px;
        }
        .btn:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .slide-info { 
            position: fixed; 
            top: 30px; 
            right: 30px; 
            color: white; 
            font-size: 18px; 
            z-index: 1000;
            background: rgba(0,0,0,0.7);
            padding: 10px 20px;
            border-radius: 25px;
            backdrop-filter: blur(10px);
        }
        .slide-title {
            position: fixed;
            top: 30px;
            left: 30px;
            color: white;
            font-size: 24px;
            font-weight: bold;
            z-index: 1000;
            background: rgba(0,0,0,0.7);
            padding: 15px 25px;
            border-radius: 25px;
            backdrop-filter: blur(10px);
        }
        .progress-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.5s ease;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="presentation-container">
        <div class="slide-title" id="slideTitle">${activeSession.name}</div>
        <div class="slide-info" id="slideInfo">1 / ${sortedPages.length}</div>
        <div class="progress-bar" id="progressBar" style="width: ${100/sortedPages.length}%"></div>
        
        ${sortedPages.map((page, index) => `
        <div class="slide ${index === 0 ? 'active' : ''}" id="slide-${index}">
            <img src="${page.imageData}" alt="${page.name}" style="transform: rotate(${page.rotation}deg);" />
        </div>
        `).join('')}
        
        <div class="controls">
            <button class="btn" onclick="prevSlide()" id="prevBtn">⮜ Previous</button>
            <button class="btn" onclick="togglePlay()" id="playBtn">▶ Auto Play</button>
            <button class="btn" onclick="nextSlide()" id="nextBtn">Next ⮞</button>
            <button class="btn" onclick="toggleFullscreen()">⛶ Fullscreen</button>
        </div>
    </div>

    <script>
        let currentSlide = 0;
        let isPlaying = false;
        let playInterval;
        const totalSlides = ${sortedPages.length};
        const slideNames = ${JSON.stringify(sortedPages.map(p => p.name))};

        function showSlide(n) {
            // Hide all slides
            document.querySelectorAll('.slide').forEach(slide => {
                slide.classList.remove('active');
            });
            
            // Show current slide
            document.getElementById('slide-' + n).classList.add('active');
            
            // Update info
            document.getElementById('slideInfo').textContent = (n + 1) + ' / ' + totalSlides;
            document.getElementById('progressBar').style.width = ((n + 1) / totalSlides * 100) + '%';
            
            // Update navigation buttons
            document.getElementById('prevBtn').disabled = n === 0;
            document.getElementById('nextBtn').disabled = n === totalSlides - 1;
        }

        function nextSlide() {
            if (currentSlide < totalSlides - 1) {
                currentSlide++;
                showSlide(currentSlide);
            }
        }

        function prevSlide() {
            if (currentSlide > 0) {
                currentSlide--;
                showSlide(currentSlide);
            }
        }

        function togglePlay() {
            const playBtn = document.getElementById('playBtn');
            if (isPlaying) {
                clearInterval(playInterval);
                playBtn.textContent = '▶ Auto Play';
                isPlaying = false;
            } else {
                playInterval = setInterval(() => {
                    if (currentSlide < totalSlides - 1) {
                        nextSlide();
                    } else {
                        togglePlay(); // Stop at end
                    }
                }, 3000);
                playBtn.textContent = '⏸ Stop';
                isPlaying = true;
            }
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowRight':
                case ' ':
                    e.preventDefault();
                    nextSlide();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    prevSlide();
                    break;
                case 'f':
                case 'F11':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'p':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    currentSlide = 0;
                    showSlide(currentSlide);
                    break;
                case 'End':
                    e.preventDefault();
                    currentSlide = totalSlides - 1;
                    showSlide(currentSlide);
                    break;
            }
        });

        // Touch/swipe support
        let startX = 0;
        let startY = 0;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 50) nextSlide(); // Swipe left
                if (diffX < -50) prevSlide(); // Swipe right
            }
            
            startX = 0;
            startY = 0;
        });

        // Initialize
        showSlide(0);
    </script>
</body>
</html>`;

                    updateProcessingJob(jobId, { message: 'Generating presentation file...' });

                    const blob = new Blob([presentationHTML], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${activeSession.name.replace(/\s+/g, '_')}_presentation.html`;
                    link.click();

                    URL.revokeObjectURL(url);
                    completeProcessingJob(jobId, 'completed', 'Interactive presentation created successfully!');
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
              {applyToAll && (
                <button
                  onClick={applySplitsToAllPages}
                  style={{
                    background: 'linear-gradient(45deg, #9C27B0, #7B1FA2)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                >
                  🔄 Apply Splits to All
                </button>
              )}
              {applyToAll && Object.keys(pageCircles).some(pageId => pageCircles[pageId].length > 0) && (
                <button
                  onClick={applyCirclesToAllPages}
                  style={{
                    background: 'linear-gradient(45deg, #E91E63, #C2185B)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                >
                  ⭕ Apply Circles to All
                </button>
              )}
              <button
                onClick={async () => {
                  if (pages.length === 0) {
                    alert('No pages to share');
                    return;
                  }

                  const jobId = addProcessingJob(activeSessionId, activeSession.name, 'pdf', pages.length);

                  try {
                    updateProcessingJob(jobId, { message: 'Creating PDF for sharing...' });
                    
                    const pdfDoc = await PDFDocument.create();
                    const sortedPages = pages.sort((a, b) => a.order - b.order);

                    for (let i = 0; i < sortedPages.length; i++) {
                      const page = sortedPages[i];
                      updateProcessingJob(jobId, {
                        progress: i,
                        message: `Processing page ${i + 1}/${sortedPages.length} for sharing`
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

                    updateProcessingJob(jobId, { message: 'Preparing PDF for sharing...' });
                    const pdfBytes = await pdfDoc.save();
                    const filename = `${activeSession.name.replace(/\s+/g, '_')}.pdf`;
                    const pdfFile = new File([pdfBytes], filename, { type: 'application/pdf' });

                    if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
                      try {
                        await navigator.share({
                          title: `${activeSession.name} - PDF Master`,
                          text: `Check out my PDF with ${pages.length} pages created using PDF Master!`,
                          files: [pdfFile]
                        });
                        completeProcessingJob(jobId, 'completed', 'PDF shared successfully!');
                      } catch (shareError: any) {
                        if (shareError.name !== 'AbortError') {
                          // Share cancelled or failed - using fallback download
                          // Fallback to download
                          const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = filename;
                          link.click();
                          URL.revokeObjectURL(url);
                          completeProcessingJob(jobId, 'completed', 'PDF downloaded (sharing not supported)');
                        } else {
                          completeProcessingJob(jobId, 'completed', 'Share cancelled');
                        }
                      }
                    } else {
                      // Fallback to download if sharing not supported
                      const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = filename;
                      link.click();
                      URL.revokeObjectURL(url);
                      completeProcessingJob(jobId, 'completed', 'PDF downloaded (sharing not supported)');
                    }
                  } catch (error) {
                    console.error('Error creating PDF for sharing:', error);
                    completeProcessingJob(jobId, 'error', 'Error creating PDF for sharing');
                  }
                }}
                disabled={isCurrentSessionProcessing}
                style={{
                  background: 'linear-gradient(45deg, #007bff, #0056b3)',
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
                📤 Share PDF
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
                onClick={() => folderInputRef.current?.click()}
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
                📁 Upload Folder
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
                onClick={() => {
                  if (groupMode) {
                    assignTagToPage(page.id);
                  } else if (!rearrangeMode) {
                    togglePageSelection(page.id);
                  }
                }}
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

                {/* Group Tag Badge - Only show when group mode is active */}
                {pageGroups[page.id] && groupMode && (
                  <div style={{
                    position: "absolute",
                    top: "5px",
                    right: "5px",
                    background: "linear-gradient(45deg, #9C27B0, #7B1FA2)",
                    color: "white",
                    borderRadius: "12px",
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 200,
                    fontSize: "16px",
                    fontWeight: "bold",
                    border: "2px solid white",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                    minWidth: "35px",
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTagFromPage(page.id);
                  }}
                  title="Click to remove tag"
                >
                    {pageGroups[page.id]}
                  </div>
                )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div className="cropper-filename" style={{
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      maxWidth: '120px',
                      color: '#00bfff',
                      fontWeight: 600
                    }}>
                      {page.name}
                    </div>
                    
                    {/* Apply Shapes Button - moved to header */}
                    {pageCircles[page.id] && pageCircles[page.id].length > 0 && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await applyCirclesToPage(page.id);
                        }}
                        style={{
                          background: 'linear-gradient(45deg, #E91E63, #C2185B)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                        title="Apply Circle Shapes to Split Image"
                      >
                        ⭕ Apply
                      </button>
                    )}
                    
                    {/* Apply Splits Button - moved to header */}
                    {page.splitLines && page.splitLines.length > 0 && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await applySplitsToPage(page.id);
                        }}
                        style={{
                          background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                        title="Apply Split Lines to Split Image"
                      >
                        ✂️ Apply
                      </button>
                    )}
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
                      pointerEvents: rearrangeMode || splitMode ? 'none' : 'auto',
                      opacity: rearrangeMode ? 0.7 : 1
                    }}
                  />
                  
                  {/* Canvas for drawing split lines - always show if page has lines or in split mode */}
                  {(splitMode || (page.splitLines && page.splitLines.length > 0) || circlingMode || (pageCircles[page.id] && pageCircles[page.id].length > 0)) && (
                    <>
                      <canvas
                        ref={(el) => {
                          if (el) {
                            canvasRefs.current[page.id] = el;
                            // Set canvas size to match container
                            const container = el.parentElement;
                            if (container) {
                              el.width = container.offsetWidth;
                              el.height = container.offsetHeight;
                              // Immediately redraw existing lines and shapes after canvas setup
                              setTimeout(() => {
                                drawSplitLinesOnCanvas(el, page);
                                drawCircleShapesOnCanvas(el, page);
                              }, 0);
                            }
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          cursor: (splitMode || circlingMode) ? 'crosshair' : 'default',
                          zIndex: 250,
                          border: (splitMode || circlingMode) ? '2px dashed rgba(255, 0, 0, 0.5)' : 'none',
                          background: (splitMode || circlingMode) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          pointerEvents: (splitMode || circlingMode) ? 'auto' : 'none'
                        }}
                        onMouseDown={(e) => {
                          if (splitMode) {
                            startDrawingSplitLine(page.id, e);
                          } else if (circlingMode && selectedShape) {
                            startDrawingShape(page.id, e);
                          } else if (circlingMode && !selectedShape) {
                            // Check if clicking on existing shape to select it
                            const canvas = canvasRefs.current[page.id];
                            if (canvas) {
                              const rect = canvas.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const y = e.clientY - rect.top;
                              
                              const shapes = pageCircles[page.id] || [];
                              for (let i = shapes.length - 1; i >= 0; i--) {
                                const shape = shapes[i];
                                let isInside = false;
                                
                                if (shape.type === 'circle' && shape.center && shape.radius) {
                                  const dist = Math.sqrt(Math.pow(x - shape.center.x, 2) + Math.pow(y - shape.center.y, 2));
                                  isInside = dist <= shape.radius;
                                } else if (shape.type === 'rectangle' && shape.points.length >= 2) {
                                  const x1 = Math.min(shape.points[0].x, shape.points[1].x);
                                  const y1 = Math.min(shape.points[0].y, shape.points[1].y);
                                  const x2 = Math.max(shape.points[0].x, shape.points[1].x);
                                  const y2 = Math.max(shape.points[0].y, shape.points[1].y);
                                  isInside = x >= x1 && x <= x2 && y >= y1 && y <= y2;
                                }
                                
                                if (isInside) {
                                  setSelectedShapeForEdit({ pageId: page.id, shapeId: shape.id });
                                  break;
                                }
                              }
                            }
                          }
                        }}
                        onMouseMove={(e) => {
                          if (splitMode) continueDrawingSplitLine(page.id, e);
                          if (circlingMode && selectedShape) continueDrawingShape(page.id, e);
                        }}
                        onMouseUp={() => {
                          if (splitMode) finishDrawingSplitLine();
                          if (circlingMode && selectedShape) finishDrawingShape();
                        }}
                        onMouseLeave={() => {
                          if (splitMode) finishDrawingSplitLine();
                          if (circlingMode && selectedShape) finishDrawingShape();
                        }}
                        onClick={(e) => {
                          // Clear selection when clicking empty area
                          if (circlingMode && !selectedShape) {
                            const canvas = canvasRefs.current[page.id];
                            if (canvas) {
                              const rect = canvas.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const y = e.clientY - rect.top;
                              
                              const shapes = pageCircles[page.id] || [];
                              let clickedOnShape = false;
                              
                              for (const shape of shapes) {
                                let isInside = false;
                                
                                if (shape.type === 'circle' && shape.center && shape.radius) {
                                  const dist = Math.sqrt(Math.pow(x - shape.center.x, 2) + Math.pow(y - shape.center.y, 2));
                                  isInside = dist <= shape.radius;
                                } else if (shape.type === 'rectangle' && shape.points.length >= 2) {
                                  const x1 = Math.min(shape.points[0].x, shape.points[1].x);
                                  const y1 = Math.min(shape.points[0].y, shape.points[1].y);
                                  const x2 = Math.max(shape.points[0].x, shape.points[1].x);
                                  const y2 = Math.max(shape.points[0].y, shape.points[1].y);
                                  isInside = x >= x1 && x <= x2 && y >= y1 && y <= y2;
                                }
                                
                                if (isInside) {
                                  clickedOnShape = true;
                                  break;
                                }
                              }
                              
                              if (!clickedOnShape) {
                                setSelectedShapeForEdit(null);
                              }
                            }
                          }
                        }}
                      />
                      {/* Drawing instructions overlay - only in split or circle mode */}
                      {splitMode && (
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'rgba(255, 0, 0, 0.9)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          zIndex: 270,
                          pointerEvents: 'none'
                        }}>
                          Click & Drag to Draw Split Line
                        </div>
                      )}
                      {circlingMode && selectedShape && (
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'rgba(233, 30, 99, 0.9)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          zIndex: 270,
                          pointerEvents: 'none'
                        }}>
                          Draw {selectedShape} shape
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Split lines indicator */}
                  {page.splitLines && page.splitLines.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: 'rgba(255, 0, 0, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      zIndex: 260,
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      ✂️ {page.splitLines.length} cut{page.splitLines.length > 1 ? 's' : ''} → {page.splitLines.length + 1} parts
                    </div>
                  )}
                  
                  {/* Parent indicator for split images */}
                  {page.parentPageId && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: 'rgba(76, 175, 80, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      zIndex: 260,
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      📄 Part {(page.splitIndex || 0) + 1}
                    </div>
                  )}
                  
                  {/* Reset to Original Button */}
                  {!page.isOriginal && page.originalImageData && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetPageToOriginal(page.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: '40px',
                        left: '8px',
                        background: 'rgba(0, 255, 0, 0.8)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        zIndex: 260
                      }}
                      title="Reset to Original"
                    >
                      🔄 Original
                    </button>
                  )}
                  
                  {/* Split Line Delete Buttons */}
                  {page.splitLines && page.splitLines.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '50px',
                      left: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      zIndex: 260
                    }}>
                      {page.splitLines.map((line) => (
                        <button
                          key={line.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSplitLine(page.id, line.id);
                          }}
                          style={{
                            background: 'rgba(255, 0, 0, 0.9)',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            fontSize: '8px'
                          }}
                          title="Delete Split Line"
                        >
                          ❌
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Delete Button for Selected Shape Only */}
                  {selectedShapeForEdit && selectedShapeForEdit.pageId === page.id && (
                    <div style={{
                      position: 'absolute',
                      bottom: '90px',
                      left: '8px',
                      zIndex: 260
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCircleShape(page.id, selectedShapeForEdit.shapeId);
                          setSelectedShapeForEdit(null);
                        }}
                        style={{
                          background: 'rgba(244, 67, 54, 0.9)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                        title="Delete Selected Shape"
                      >
                        🗑️ Delete Shape
                      </button>
                    </div>
                  )}

                  {/* Circle shapes indicator */}
                  {pageCircles[page.id] && pageCircles[page.id].length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '30px',
                      left: '8px',
                      background: 'rgba(233, 30, 99, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      zIndex: 260,
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      ⭕ {pageCircles[page.id].length} shape{pageCircles[page.id].length > 1 ? 's' : ''}
                    </div>
                  )}

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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLandscapeMode(page.id);
                          }}
                          style={{
                            background: 'rgba(76, 175, 80, 0.8)',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '11px'
                          }}
                          title="Toggle Landscape/Portrait Mode"
                        >
                          🖼️
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
                            padding: "6px 10px",
                            borderRadius: "50%",
                            cursor: "pointer",
                            fontSize: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "40px",
                            height: "40px",
                            boxShadow: "0 3px 8px rgba(0,0,0,0.4)"
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
        ref={folderInputRef}
        type="file"
        multiple
        accept="image/*"
        {...({ webkitdirectory: "" } as any)}
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFloatingPages(prev => ({
                      ...prev,
                      [pageId]: {
                        ...prev[pageId],
                        position: { x: 0, y: 0 },
                        size: { width: window.innerWidth, height: window.innerHeight }
                      }
                    }));
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '0',
                    width: '20px',
                    height: '20px'
                  }}
                  title="Maximize to full screen"
                >
                  ⛶
                </button>
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

            {/* Resize Arrow */}
            <div
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '20px',
                height: '20px',
                background: '#28a745',
                cursor: 'nw-resize',
                borderTopLeftRadius: '4px',
                zIndex: 1002
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const startSize = data.size;

                const handleMouseMove = (e: MouseEvent) => {
                  const newWidth = Math.max(300, startSize.width + (e.clientX - startX));
                  const newHeight = Math.max(200, startSize.height + (e.clientY - startY));
                  
                  setFloatingPages(prev => ({
                    ...prev,
                    [pageId]: {
                      ...prev[pageId],
                      size: { width: newWidth, height: newHeight }
                    }
                  }));
                };

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '0',
                height: '0',
                borderLeft: '8px solid transparent',
                borderBottom: '8px solid white'
              }} />
            </div>
          </div>
        )
      )}

      {/* Group Tags Floating Window */}
      {showGroupTags && (
        <div
          ref={groupTagsRef}
          style={{
            position: 'fixed',
            left: groupTagsPosition.x,
            top: groupTagsPosition.y,
            width: groupTagsSize.width,
            height: groupTagsSize.height,
            background: 'white',
            border: '2px solid #9C27B0',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            resize: 'both',
            minWidth: '350px',
            minHeight: '250px'
          }}
        >
          {/* Draggable Header */}
          <div 
            style={{
              background: 'linear-gradient(45deg, #9C27B0, #7B1FA2)',
              color: 'white',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'move',
              borderRadius: '10px 10px 0 0'
            }}
            onMouseDown={handleGroupTagsDrag}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              🏷️ Group Tags {selectedTag && `- Selected: ${selectedTag}`}
            </span>
            <button
              onClick={() => setShowGroupTags(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0',
                width: '24px',
                height: '24px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ 
            flex: 1, 
            padding: '16px',
            overflow: 'auto',
            background: '#f9f9f9'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {availableTags.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  style={{
                    background: selectedTag === tag 
                      ? 'linear-gradient(45deg, #4CAF50, #45a049)' 
                      : 'linear-gradient(45deg, #E0E0E0, #BDBDBD)',
                    border: selectedTag === tag ? '3px solid #2E7D32' : '2px solid #999',
                    borderRadius: '8px',
                    padding: '12px 8px',
                    cursor: 'pointer',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: selectedTag === tag ? 'white' : '#333',
                    transition: 'all 0.2s ease',
                    minHeight: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: selectedTag === tag ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: selectedTag === tag ? '0 4px 12px rgba(76, 175, 80, 0.4)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  title={`Tag: ${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={addMoreTags}
                disabled={availableTags.length >= 50}
                style={{
                  background: availableTags.length >= 50 
                    ? 'linear-gradient(45deg, #666, #555)' 
                    : 'linear-gradient(45deg, #2196F3, #1976D2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: 'white',
                  cursor: availableTags.length >= 50 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  flex: 1,
                  opacity: availableTags.length >= 50 ? 0.5 : 1
                }}
              >
                {availableTags.length >= 50 ? '🚫 Maximum tags reached' : '➕ Add More Tags'}
              </button>
              
              <button
                onClick={undoLastGrouping}
                disabled={groupHistory.length === 0}
                style={{
                  background: groupHistory.length === 0
                    ? 'linear-gradient(45deg, #666, #555)'
                    : 'linear-gradient(45deg, #f44336, #d32f2f)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: 'white',
                  cursor: groupHistory.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  opacity: groupHistory.length === 0 ? 0.5 : 1
                }}
                title={groupHistory.length === 0 ? 'No grouping to undo' : 'Undo last grouping'}
              >
                ↶ Undo
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              padding: '12px',
              background: 'rgba(156, 39, 176, 0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#7B1FA2',
              lineHeight: '1.4'
            }}>
              <strong>📝 How to use:</strong><br/>
              1. Select a tag by clicking on it<br/>
              2. Click on images to assign the selected tag<br/>
              3. Use "Undo" button to remove the last assigned tag<br/>
              4. Create different groups with different tags<br/>
              5. Use GroupZip to export separate PDFs for each group
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {showExportOptions && (
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
          zIndex: 2500
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 80, 0.9))',
            border: '2px solid rgba(156, 39, 176, 0.5)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ color: '#9C27B0', textAlign: 'center', marginBottom: '24px' }}>
              📦 Choose Export Option
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={exportWithDefaultNames}
                style={{
                  background: 'linear-gradient(45deg, #4CAF50, #45a049)',
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
                🎯 Use Default Names (Group_1.pdf, Group_2.pdf...)
              </button>

              <button
                onClick={exportWithCustomNames}
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
                ✏️ Give Custom Names to PDFs
              </button>

              <button
                onClick={() => setShowExportOptions(false)}
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

      {/* Custom Names Floating Window */}
      {showCustomNames && (
        <div
          ref={customNamesRef}
          style={{
            position: 'fixed',
            left: customNamesPosition.x,
            top: customNamesPosition.y,
            width: customNamesSize.width,
            height: customNamesSize.height,
            background: 'white',
            border: '2px solid #FF9800',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            resize: 'both',
            minWidth: '450px',
            minHeight: '350px'
          }}
        >
          {/* Draggable Header */}
          <div 
            style={{
              background: 'linear-gradient(45deg, #FF9800, #F57C00)',
              color: 'white',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'move',
              borderRadius: '10px 10px 0 0'
            }}
            onMouseDown={handleCustomNamesDrag}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              ✏️ Custom PDF Names
            </span>
            <button
              onClick={() => setShowCustomNames(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0',
                width: '24px',
                height: '24px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ 
            flex: 1, 
            padding: '16px',
            overflow: 'auto',
            background: '#f9f9f9',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ flex: 1, marginBottom: '16px' }}>
              {Object.entries(customPDFNames).map(([tag, name], index) => (
                <div key={tag} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'white',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: '1px solid #ddd'
                }}>
                  <div style={{
                    background: 'linear-gradient(45deg, #9C27B0, #7B1FA2)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    minWidth: '50px',
                    textAlign: 'center'
                  }}>
                    {tag}
                  </div>
                  
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setCustomPDFNames(prev => ({
                      ...prev,
                      [tag]: e.target.value
                    }))}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="Enter PDF name"
                  />
                  
                  <button
                    onClick={() => {
                      const input = document.querySelector(`input[value="${name}"]`) as HTMLInputElement;
                      if (input) {
                        input.focus();
                        input.select();
                      }
                    }}
                    style={{
                      background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Edit name"
                  >
                    ✏️
                  </button>
                </div>
              ))}
            </div>

            {/* Final Export Button */}
            <button
              onClick={() => createGroupedPDFZip(true)}
              disabled={isCurrentSessionProcessing}
              style={{
                background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 24px',
                color: 'white',
                cursor: isCurrentSessionProcessing ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
                opacity: isCurrentSessionProcessing ? 0.7 : 1
              }}
            >
              📦 Final ZIP Export
            </button>
          </div>
        </div>
      )}

      {/* Shape Selector Floating Window */}
      {showShapeSelector && (
        <div
          style={{
            position: 'fixed',
            left: shapeSelectorPosition.x,
            top: shapeSelectorPosition.y,
            width: shapeSelectorSize.width,
            height: shapeSelectorSize.height,
            background: 'white',
            border: '2px solid #E91E63',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            resize: 'both',
            minWidth: '400px',
            minHeight: '300px'
          }}
        >
          {/* Draggable Header */}
          <div 
            style={{
              background: 'linear-gradient(45deg, #E91E63, #C2185B)',
              color: 'white',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'move',
              borderRadius: '10px 10px 0 0'
            }}
            onMouseDown={handleShapeSelectorDrag}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              ⭕ Shape Selector {selectedShape && `- Selected: ${availableShapes.find(s => s.type === selectedShape)?.name}`}
            </span>
            <button
              onClick={() => setShowShapeSelector(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0',
                width: '24px',
                height: '24px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ 
            flex: 1, 
            padding: '16px',
            overflow: 'auto',
            background: '#f9f9f9'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {availableShapes.map((shape, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedShape(shape.type === selectedShape ? null : shape.type)}
                  style={{
                    background: selectedShape === shape.type 
                      ? 'linear-gradient(45deg, #E91E63, #C2185B)' 
                      : 'linear-gradient(45deg, #E0E0E0, #BDBDBD)',
                    border: selectedShape === shape.type ? '3px solid #AD1457' : '2px solid #999',
                    borderRadius: '8px',
                    padding: '16px 12px',
                    cursor: 'pointer',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: selectedShape === shape.type ? 'white' : '#333',
                    transition: 'all 0.2s ease',
                    minHeight: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transform: selectedShape === shape.type ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: selectedShape === shape.type ? '0 4px 12px rgba(233, 30, 99, 0.4)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  title={shape.name}
                >
                  <div style={{ fontSize: '28px' }}>{shape.icon}</div>
                  <div style={{ fontSize: '12px', textAlign: 'center' }}>{shape.name.split(' ')[1]}</div>
                </button>
              ))}
            </div>

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={undoLastCircle}
                disabled={circleHistory.length === 0}
                style={{
                  background: circleHistory.length === 0
                    ? 'linear-gradient(45deg, #666, #555)'
                    : 'linear-gradient(45deg, #f44336, #d32f2f)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: 'white',
                  cursor: circleHistory.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  opacity: circleHistory.length === 0 ? 0.5 : 1,
                  flex: 1
                }}
                title={circleHistory.length === 0 ? 'No shapes to undo' : 'Undo last shape drawing'}
              >
                ↶ Undo
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              padding: '12px',
              background: 'rgba(233, 30, 99, 0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#C2185B',
              lineHeight: '1.4'
            }}>
              <strong>📝 How to use Circling:</strong><br/>
              1. Select a shape from the options above<br/>
              2. Click and drag on images to draw the selected shape<br/>
              3. Each shape will have 8 resize handles when selected<br/>
              4. Use "Apply Shapes" button to split image by drawn shapes<br/>
              5. Shapes can be deleted using the 🗑️ button<br/>
              6. Use "Apply to All" checkbox to apply to all pages
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
