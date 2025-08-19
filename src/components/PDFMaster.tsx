import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Loader2, MoveLeft, MoveRight, Merge, SendToBack, Scaling, BookType, Image, FileArchive } from 'lucide-react';

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
  type: 'pdf' | 'presentation' | 'upload' | 'merge' | 'organize' | 'resize' | 'edit' | 'optimize';
  status: 'processing' | 'completed' | 'error';
  progress: number;
  total: number;
  message: string;
  timestamp: number;
}

interface pdfItemType {
  id: number;
  file: File;
}

enum Direction {
  Top,
  Right,
  Bottom,
  Left
}

interface PDFMasterProps {
  isVisible: boolean;
  onClose: () => void;
}

// PDF Toolkit functions
const renderPdfPage = async (file: File, canvasRef: React.RefObject<HTMLCanvasElement>, pageNumber: number) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
  } catch (error) {
    console.error('Error rendering PDF page:', error);
  }
};

const downloadFile = (buffer: ArrayBuffer, mimeType: string, filename: string = 'document') => {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export const PDFMaster: React.FC<PDFMasterProps> = ({ isVisible, onClose }) => {
  // Tab-based session management
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

  // Global processing queue
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [globalProcessingCount, setGlobalProcessingCount] = useState(0);

  // Current session data
  const activeSession = sessions.find(session => session.id === activeSessionId) || sessions[0];
  const [pages, setPages] = useState<PDFPage[]>(activeSession.pages);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());

  // PDF Toolkit specific states
  const [currentTool, setCurrentTool] = useState<string>('home');
  const [uploaded, setUploaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [originalDoc, setOriginalDoc] = useState<PDFDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [marginValue, setMarginValue] = useState<number>(0);
  const [isMultiple, setIsMultiple] = useState<boolean>(false);
  const [mergePdfItems, setMergePdfItems] = useState<pdfItemType[]>([]);

  // UI states
  const [floatingPages, setFloatingPages] = useState<{[key: string]: {visible: boolean, position: {x: number, y: number}, size: {width: number, height: number}}}>({});
  const [zoomedPages, setZoomedPages] = useState<Set<string>>(new Set());
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [showRearrangeOptions, setShowRearrangeOptions] = useState(false);
  const [rearrangeInput, setRearrangeInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const mergePdfInputRef = useRef<HTMLInputElement>(null);
  const organizePdfInputRef = useRef<HTMLInputElement>(null);
  const resizePdfInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floatingRefs = useRef<{[key: string]: HTMLDivElement}>({});

  // Check if current session has any processing jobs
  const currentSessionJobs = processingJobs.filter(job => job.sessionId === activeSessionId);
  const isCurrentSessionProcessing = currentSessionJobs.some(job => job.status === 'processing');
  const globalProcessingStatus = processingJobs.find(job => job.status === 'processing')?.message || '';

  // Tool definitions from PDF Toolkit
  const tools = [
    {
      title: "Merge PDF",
      content: "Drag and rotate PDFs in the order you want with the easiest PDF merger available.",
      pageName: "mergePdf",
      icon: <Merge color={"white"} size={30} />
    },
    {
      title: "Organize PDF", 
      content: "Sort, rotate, convert to image, insert images as pdf-page and remove pages.",
      pageName: "organizePdf",
      icon: <SendToBack color={"white"} size={30} />
    },
    {
      title: "Resize PDF",
      content: "Resize page to different dimensions, add or remove margins.",
      pageName: "resizePdf", 
      icon: <Scaling color={"white"} size={30} />
    },
    {
      title: "Edit PDF",
      content: "Edit PDF by adding text, shapes, comments and highlights. Your secure and simple tool to edit PDF.",
      pageName: "editPdf",
      icon: <BookType color={"white"} size={30} />
    },
    {
      title: "PDF to Image",
      content: "Convert PDF page into a image.",
      pageName: "pdfToImage",
      icon: <Image color={"white"} size={30} />
    },
    {
      title: "Image to PDF", 
      content: "Convert images to PDF in seconds.",
      pageName: "imageToPdf",
      icon: <FileArchive color={"white"} size={30} />
    }
  ];

  // Session management functions
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

  const addProcessingJob = (sessionId: string, sessionName: string, type: ProcessingJob['type'], total: number): string => {
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
    setTimeout(() => {
      setProcessingJobs(prev => prev.filter(job => job.id !== jobId));
    }, 5000);
  };

  // PDF Toolkit Upload Functions
  const checkFileFormat = useCallback((files: FileList, allowedTypes: string) => {
    const file = Array.from(files).find((file) => {
      return !(allowedTypes.includes(file.type));
    });
    if (file) {
      alert("One of the files have invalid format");
    }
    return file === undefined;
  }, []);

  // Convert image file to PDFPage
  const imageToPage = async (file: File, order: number): Promise<PDFPage | null> => {
    try {
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`File ${file.name} too large, skipping`);
        return null;
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new window.Image();
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

  // Handle file uploads for different tools
  const handleMergePdfUpload = useCallback(async (files: File[]) => {
    if (!checkFileFormat(new FileList(), "application/pdf")) return;

    let items: pdfItemType[] = [];
    files.forEach((file, index) => {
      items.push({ id: index + 1, file });
    });
    setUploaded(true);
    setMergePdfItems(items);
    setCurrentTool('mergePdf');
  }, [checkFileFormat]);

  const handleOrganizePdfUpload = useCallback(async (files: File[]) => {
    setUploaded(true);
    setCurrentTool('organizePdf');
    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'organize', files.length);

    let count = 0;
    let items: pdfItemType[] = [];

    try {
      for (const file of files) {
        updateProcessingJob(jobId, {
          progress: count,
          message: `Processing ${file.name}...`
        });

        if (file.type === "application/pdf") {
          const res = await fetch(URL.createObjectURL(file));
          const arrayBuffer = await res.arrayBuffer();
          const srcDoc = await PDFDocument.load(arrayBuffer);

          for (const pageIndex of srcDoc.getPageIndices()) {
            const tempPdf = await PDFDocument.create();
            const copiedPage = await tempPdf.copyPages(srcDoc, [pageIndex]);
            tempPdf.addPage(copiedPage[0]);
            const buffer = await tempPdf.save();
            const newFile = new File([buffer], `Page-${pageIndex + 1} ${file.name}`, { type: "application/pdf" });
            items.push({ file: newFile, id: count++ });
          }
        } else {
          // Handle image files
          const tempImage = document.createElement("img");
          tempImage.src = URL.createObjectURL(file);
          const canvas = document.createElement("canvas");

          await new Promise((resolve) => {
            tempImage.onload = () => {
              canvas.width = tempImage.naturalWidth;
              canvas.height = tempImage.naturalHeight;
              resolve("done");
            };
          });

          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(tempImage, 0, 0, canvas.width, canvas.height);
          const imageUrl = canvas.toDataURL("image/png", 1);
          const pdfDoc = await PDFDocument.create();
          const embeddedImg = await pdfDoc.embedPng(imageUrl);
          const page = pdfDoc.addPage();
          page.setSize(embeddedImg.width, embeddedImg.height);
          page.drawImage(embeddedImg, { x: 0, y: 0 });
          const buffer = await pdfDoc.save();
          const newFile = new File([buffer], `${file.name}`, { type: "application/pdf" });
          items.push({ file: newFile, id: count++ });
        }
      }

      setMergePdfItems(items);
      completeProcessingJob(jobId, 'completed', `Successfully organized ${items.length} items`);
    } catch (err) {
      console.error(err);
      completeProcessingJob(jobId, 'error', 'Error organizing PDF files');
    }
  }, [activeSessionId, activeSession.name]);

  const handleResizePdfUpload = useCallback(async (files: File[]) => {
    if (!checkFileFormat(new FileList(), "application/pdf")) return;

    setUploaded(true);
    setCurrentTool('resizePdf');
    const file = files[0];

    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'resize', 1);

    try {
      await renderPdfPage(file, canvasRef, currentPage);
      setLoading(false);

      const url = URL.createObjectURL(file);
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer);
      const tempSrc = await PDFDocument.load(arrayBuffer);
      setOriginalDoc(tempSrc);
      setPdfDoc(srcDoc);

      completeProcessingJob(jobId, 'completed', 'PDF loaded successfully for resizing');
    } catch (error) {
      console.error('Error loading PDF for resize:', error);
      completeProcessingJob(jobId, 'error', 'Error loading PDF');
    }
  }, [currentPage, activeSessionId, activeSession.name, checkFileFormat]);

  // Image to PDF conversion (existing functionality preserved)
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setCurrentTool('imageToPdf');
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
      setUploaded(true);
      completeProcessingJob(jobId, 'completed', `Successfully processed ${newPages.length} images`);
    } catch (error) {
      console.error('Error uploading images:', error);
      completeProcessingJob(jobId, 'error', 'Error processing files');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  // Resize PDF functions
  const resetFile = useCallback(async () => {
    if (originalDoc) {
      setLoading(true);
      const buffer = await originalDoc.save();
      const newDoc = await PDFDocument.load(buffer);
      setPdfDoc(newDoc);
      const newFile = new File([buffer], "file", { type: "application/pdf" });
      renderPdfPage(newFile, canvasRef, currentPage).then(() => {
        setLoading(false);
      });
    }
  }, [currentPage, originalDoc]);

  const changeMargin = useCallback(async (direction: Direction) => {
    if (pdfDoc) {
      setLoading(true);
      let index;
      const pages = pdfDoc.getPages();
      const start = isMultiple ? 0 : currentPage - 1;
      const end = isMultiple ? pages.length : currentPage;

      for (index = start; index < end; index++) {
        const page = pages[index];
        switch (direction) {
          case Direction.Top: page.translateContent(0, -marginValue); break;
          case Direction.Right: page.translateContent(-marginValue, 0); break;
          case Direction.Bottom: page.translateContent(0, marginValue); break;
          case Direction.Left: page.translateContent(marginValue, 0); break;
        }
      }

      const buffer = await pdfDoc.save();
      const newFile = new File([buffer], "final", { type: "application/pdf" });
      const url = URL.createObjectURL(newFile);
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const newDoc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(newDoc);
      renderPdfPage(newFile, canvasRef, currentPage).then(() => {
        setLoading(false);
      });
    }
  }, [currentPage, isMultiple, marginValue, pdfDoc]);

  const convertToPortrait = useCallback(async () => {
    if (pdfDoc) {
      setLoading(true);
      let index;
      const pages = pdfDoc.getPages();
      const start = isMultiple ? 0 : currentPage - 1;
      const end = isMultiple ? pages.length : currentPage;

      for (index = start; index < end; index++) {
        const page = pages[index];
        const { width: w, height: h } = page.getSize();
        if (w >= h) {
          page.setSize(h, h * 1.5);
          const scale = h / w;
          page.scaleContent(scale, scale);
          const contentHeight = scale * h;
          const marginHeight = (h * 1.5) - contentHeight;
          page.translateContent(0, marginHeight / 2);
        }
      }

      const buffer = await pdfDoc.save();
      const newDoc = await PDFDocument.load(buffer);
      setPdfDoc(newDoc);
      const newFile = new File([buffer], "final", { type: "application/pdf" });
      renderPdfPage(newFile, canvasRef, currentPage).then(() => {
        setLoading(false);
      });
    }
  }, [currentPage, isMultiple, pdfDoc]);

  const convertToLandscape = useCallback(async () => {
    if (pdfDoc) {
      setLoading(true);
      let index;
      const pages = pdfDoc.getPages();
      const start = isMultiple ? 0 : currentPage - 1;
      const end = isMultiple ? pages.length : currentPage;

      for (index = start; index < end; index++) {
        const page = pages[index];
        const { width: w, height: h } = page.getSize();
        if (h >= w) {
          page.setWidth(h);
          const marginWidth = h - w;
          page.translateContent(marginWidth / 2, 0);
        }
      }

      const buffer = await pdfDoc!.save();
      const newDoc = await PDFDocument.load(buffer);
      const newFile = new File([buffer], "final", { type: "application/pdf" });
      setPdfDoc(newDoc);
      renderPdfPage(newFile, canvasRef, currentPage).then(() => {
        setLoading(false);
      });
    }
  }, [currentPage, isMultiple, pdfDoc]);

  const navigatePages = useCallback(async (value: number) => {
    try {
      const length = pdfDoc!.getPages().length;
      if (value >= 1 && value <= length) {
        setCurrentPage(value);
        setLoading(true);
        const buffer = await pdfDoc!.save();
        const newFile = new File([buffer], "final", { type: "application/pdf" });
        await renderPdfPage(newFile, canvasRef, value);
        setLoading(false);
      }
    } catch (e) {
      console.error('Error navigating pages:', e);
    }
  }, [pdfDoc]);

  // Merge PDF function
  const mergePdfs = useCallback(async () => {
    if (mergePdfItems.length === 0) return;

    const jobId = addProcessingJob(activeSessionId, activeSession.name, 'merge', mergePdfItems.length);

    try {
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < mergePdfItems.length; i++) {
        const item = mergePdfItems[i];
        updateProcessingJob(jobId, {
          progress: i,
          message: `Merging ${item.file.name}...`
        });

        const arrayBuffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      downloadFile(mergedPdfBytes, 'application/pdf', 'merged_document');
      completeProcessingJob(jobId, 'completed', 'PDFs merged successfully!');
    } catch (error) {
      console.error('Error merging PDFs:', error);
      completeProcessingJob(jobId, 'error', 'Error merging PDFs');
    }
  }, [mergePdfItems, activeSessionId, activeSession.name]);

  // Page manipulation functions (preserved from original)
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

  // Export functions (preserved)
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

        const img = new window.Image();
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
      downloadFile(pdfBytes, 'application/pdf', activeSession.name);
      completeProcessingJob(jobId, 'completed', 'PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      completeProcessingJob(jobId, 'error', 'Error exporting PDF');
    }
  };

  // Floating functionality (preserved)
  const toggleFloating = (pageId: string) => {
    setFloatingPages(prev => {
      const isCurrentlyFloating = prev[pageId]?.visible || false;
      if (isCurrentlyFloating) {
        return { ...prev, [pageId]: { ...prev[pageId], visible: false } };
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

  useEffect(() => {
    if (pages.length > 0) {
      saveCurrentSession();
    }
  }, [pages, saveCurrentSession]);

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
            📄 PDF Master - Enhanced Toolkit
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {currentTool === 'home' && (
            <>
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
                onClick={() => setCurrentTool('home')}
                style={{
                  background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🏠 Tools Home
              </button>
            </>
          )}

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

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {currentTool === 'home' ? (
          // PDF Toolkit Home - Tool Selection
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%'
          }}>
            <h2 style={{ color: '#00bfff', marginBottom: '32px', fontSize: '32px' }}>
              Choose Your PDF Tool
            </h2>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '20px',
              maxWidth: '1200px'
            }}>
              {tools.map((tool, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (tool.pageName === 'mergePdf') {
                      mergePdfInputRef.current?.click();
                    } else if (tool.pageName === 'organizePdf') {
                      organizePdfInputRef.current?.click();
                    } else if (tool.pageName === 'resizePdf') {
                      resizePdfInputRef.current?.click();
                    } else if (tool.pageName === 'imageToPdf') {
                      fileInputRef.current?.click();
                    } else {
                      setCurrentTool(tool.pageName);
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.8), rgba(0, 40, 80, 0.6))',
                    border: '2px solid rgba(0, 255, 255, 0.3)',
                    borderRadius: '16px',
                    padding: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    width: '280px',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 255, 255, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ marginBottom: '16px' }}>
                    {tool.icon}
                  </div>
                  <h3 style={{ color: '#00bfff', margin: '0 0 12px 0', fontSize: '18px' }}>
                    {tool.title}
                  </h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: 0, fontSize: '14px', lineHeight: '1.4' }}>
                    {tool.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : currentTool === 'mergePdf' ? (
          // Merge PDF Tool
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#00bfff', fontSize: '28px', marginBottom: '8px' }}>Merge PDF</h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Drag and rotate PDFs in the order you want with the easiest PDF merger available.
              </p>
            </div>

            {mergePdfItems.length > 0 ? (
              <div>
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <Button 
                    onClick={mergePdfs}
                    style={{
                      background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                      padding: '12px 24px',
                      fontSize: '16px'
                    }}
                  >
                    🔗 Merge PDFs ({mergePdfItems.length} files)
                  </Button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {mergePdfItems.map((item, index) => (
                    <div key={item.id} style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#00bfff', fontSize: '24px', marginBottom: '8px' }}>📄</div>
                      <p style={{ color: 'white', fontSize: '14px', margin: 0 }}>
                        {index + 1}. {item.file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                border: '2px dashed rgba(0, 255, 255, 0.3)',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer'
              }}
              onClick={() => mergePdfInputRef.current?.click()}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                <p style={{ color: '#00bfff', fontSize: '18px', margin: 0 }}>
                  Click to upload PDF files for merging
                </p>
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Button 
                onClick={() => setCurrentTool('home')}
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                ← Back to Tools
              </Button>
            </div>
          </div>
        ) : currentTool === 'organizePdf' ? (
          // Organize PDF Tool
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#00bfff', fontSize: '28px', marginBottom: '8px' }}>Organize PDF</h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Sort, rotate, convert to image, insert images as pdf-page and remove pages.
              </p>
            </div>

            {mergePdfItems.length > 0 ? (
              <div>
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <Button 
                    onClick={mergePdfs}
                    style={{
                      background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                      padding: '12px 24px',
                      fontSize: '16px'
                    }}
                  >
                    📋 Organize & Combine ({mergePdfItems.length} items)
                  </Button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {mergePdfItems.map((item, index) => (
                    <div key={item.id} style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#00bfff', fontSize: '24px', marginBottom: '8px' }}>
                        {item.file.type === 'application/pdf' ? '📄' : '🖼️'}
                      </div>
                      <p style={{ color: 'white', fontSize: '14px', margin: 0 }}>
                        {index + 1}. {item.file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                border: '2px dashed rgba(0, 255, 255, 0.3)',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer'
              }}
              onClick={() => organizePdfInputRef.current?.click()}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                <p style={{ color: '#00bfff', fontSize: '18px', margin: 0 }}>
                  Click to upload PDFs and images for organizing
                </p>
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Button 
                onClick={() => setCurrentTool('home')}
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                ← Back to Tools
              </Button>
            </div>
          </div>
        ) : currentTool === 'resizePdf' ? (
          // Resize PDF Tool
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#00bfff', fontSize: '28px', marginBottom: '8px' }}>Resize PDF</h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Resize page to different dimensions, add or remove margins.
              </p>
            </div>

            {uploaded && pdfDoc ? (
              <div>
                {/* PDF Preview Canvas */}
                <div style={{ 
                  textAlign: 'center',
                  marginBottom: '20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  position: 'relative'
                }}>
                  <canvas 
                    ref={canvasRef} 
                    style={{ 
                      border: '2px solid rgba(0, 255, 255, 0.3)', 
                      borderRadius: '8px',
                      maxWidth: '100%',
                      height: 'auto'
                    }}
                  />
                  {loading && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <Loader2 style={{ color: '#00bfff', animation: 'spin 1s linear infinite' }} size={32} />
                    </div>
                  )}
                </div>

                {/* Page Navigation */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <button
                    onClick={() => navigatePages(currentPage - 1)}
                    style={{
                      background: 'rgba(0, 255, 255, 0.2)',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '6px',
                      padding: '8px',
                      color: '#00bfff',
                      cursor: 'pointer'
                    }}
                  >
                    <MoveLeft size={20} />
                  </button>

                  <input
                    type="number"
                    value={currentPage}
                    min={1}
                    max={pdfDoc.getPages().length}
                    onChange={(e) => navigatePages(Number(e.target.value))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '6px',
                      padding: '8px',
                      color: '#00bfff',
                      textAlign: 'center',
                      width: '80px'
                    }}
                  />

                  <button
                    onClick={() => navigatePages(currentPage + 1)}
                    style={{
                      background: 'rgba(0, 255, 255, 0.2)',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '6px',
                      padding: '8px',
                      color: '#00bfff',
                      cursor: 'pointer'
                    }}
                  >
                    <MoveRight size={20} />
                  </button>
                </div>

                {/* Control Buttons */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <Button 
                    onClick={async () => {
                      if (pdfDoc) {
                        const buffer = await pdfDoc.save();
                        downloadFile(buffer, 'application/pdf', 'resized_document');
                      }
                    }}
                    style={{ background: 'linear-gradient(45deg, #4CAF50, #45a049)' }}
                  >
                    💾 Download
                  </Button>
                  <Button 
                    onClick={resetFile}
                    style={{ background: 'linear-gradient(45deg, #f44336, #d32f2f)' }}
                  >
                    🔄 Reset
                  </Button>
                </div>

                {/* Resize Options */}
                <Accordion type="single" collapsible style={{ marginBottom: '20px' }}>
                  <AccordionItem value="item-1">
                    <AccordionTrigger style={{ color: '#00bfff' }}>
                      PDF Page Resize
                    </AccordionTrigger>
                    <AccordionContent>
                      <div style={{ marginBottom: '16px' }}>
                        <RadioGroup 
                          value={isMultiple ? "all" : "current"}
                          onValueChange={(value: string) => setIsMultiple(value === "all")}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RadioGroupItem value="current" id="r1" />
                            <Label htmlFor="r1" style={{ color: 'white' }}>Current Page</Label>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RadioGroupItem value="all" id="r2" />
                            <Label htmlFor="r2" style={{ color: 'white' }}>All Pages</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          onClick={convertToPortrait}
                          style={{
                            background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px 20px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          📱 Portrait
                        </button>
                        <button
                          onClick={convertToLandscape}
                          style={{
                            background: 'linear-gradient(45deg, #2196F3, #1976D2)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px 20px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          🖥️ Landscape
                        </button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger style={{ color: '#00bfff' }}>
                      Margin Adjustment
                    </AccordionTrigger>
                    <AccordionContent>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                        <input
                          type="number"
                          value={marginValue}
                          onChange={(e) => setMarginValue(Number(e.target.value))}
                          placeholder="Margin value"
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(0, 255, 255, 0.3)',
                            borderRadius: '6px',
                            padding: '8px',
                            color: '#00bfff',
                            width: '120px'
                          }}
                        />

                        <RadioGroup 
                          value={isMultiple ? "all" : "current"}
                          onValueChange={(value: string) => setIsMultiple(value === "all")}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RadioGroupItem value="current" id="m1" />
                            <Label htmlFor="m1" style={{ color: 'white' }}>Current</Label>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RadioGroupItem value="all" id="m2" />
                            <Label htmlFor="m2" style={{ color: 'white' }}>All</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => changeMargin(Direction.Top)}
                          style={{
                            background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ⬆️ Top
                        </button>
                        <button
                          onClick={() => changeMargin(Direction.Right)}
                          style={{
                            background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ➡️ Right
                        </button>
                        <button
                          onClick={() => changeMargin(Direction.Bottom)}
                          style={{
                            background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ⬇️ Bottom
                        </button>
                        <button
                          onClick={() => changeMargin(Direction.Left)}
                          style={{
                            background: 'linear-gradient(45deg, #FF9800, #F57C00)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ⬅️ Left
                        </button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            ) : (
              <div style={{
                border: '2px dashed rgba(0, 255, 255, 0.3)',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer'
              }}
              onClick={() => resizePdfInputRef.current?.click()}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                <p style={{ color: '#00bfff', fontSize: '18px', margin: 0 }}>
                  Click to upload a PDF file for resizing
                </p>
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Button 
                onClick={() => setCurrentTool('home')}
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                ← Back to Tools
              </Button>
            </div>
          </div>
        ) : currentTool === 'imageToPdf' ? (
          // Image to PDF Tool (Existing functionality preserved)
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#00bfff', fontSize: '28px', marginBottom: '8px' }}>Image to PDF</h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Convert images to PDF in seconds with full editing capabilities.
              </p>
            </div>

            {pages.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '400px',
                color: '#00bfff',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>📄</div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '24px' }}>Convert Images to PDF</h3>
                <p style={{ margin: '0 0 32px 0', fontSize: '16px', opacity: 0.8, maxWidth: '500px' }}>
                  Upload images to create a PDF document. You can rotate, crop, reorder, and manipulate pages with full control.
                </p>
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
              </div>
            ) : (
              <div>
                {/* Toolbar */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.8), rgba(0, 40, 80, 0.6))',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#00bfff', fontSize: '14px' }}>
                      📊 {pages.length} pages
                    </span>
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
                  </div>
                </div>

                {/* Pages Grid */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  alignItems: 'flex-start'
                }}>
                  {pages.map((page, index) => (
                    <div
                      key={page.id}
                      style={{
                        position: 'relative',
                        width: '250px',
                        border: '2px solid rgba(0, 255, 255, 0.3)',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.3), rgba(0, 40, 80, 0.2))',
                        boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Page Header */}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(0, 40, 80, 0.9), rgba(0, 20, 40, 0.95))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(0, 255, 255, 0.2)'
                      }}>
                        <div style={{
                          color: '#00bfff',
                          fontWeight: 600,
                          fontSize: '12px',
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {page.name}
                        </div>
                        <button
                          onClick={() => deletePage(page.id)}
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
                          ×
                        </button>
                      </div>

                      {/* Image Container */}
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
                            transition: 'transform 0.3s ease'
                          }}
                        />

                        {/* Control Buttons */}
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          display: 'flex',
                          gap: '4px'
                        }}>
                          <button
                            onClick={() => rotatePage(page.id, 'left')}
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
                            onClick={() => rotatePage(page.id, 'right')}
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

                        {/* Position Controls */}
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          left: '8px',
                          display: 'flex',
                          gap: '4px'
                        }}>
                          <button
                            onClick={() => movePageUp(index)}
                            disabled={index === 0}
                            style={{
                              background: index === 0 ? '#666' : 'rgba(0,0,0,0.7)',
                              border: 'none',
                              borderRadius: '4px',
                              color: 'white',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              padding: '4px',
                              fontSize: '10px',
                              opacity: index === 0 ? 0.5 : 1
                            }}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => movePageDown(index)}
                            disabled={index === pages.length - 1}
                            style={{
                              background: index === pages.length - 1 ? '#666' : 'rgba(0,0,0,0.7)',
                              border: 'none',
                              borderRadius: '4px',
                              color: 'white',
                              cursor: index === pages.length - 1 ? 'not-allowed' : 'pointer',
                              padding: '4px',
                              fontSize: '10px',
                              opacity: index === pages.length - 1 ? 0.5 : 1
                            }}
                          >
                            ↓
                          </button>
                        </div>

                        {/* Floating and Zoom Buttons */}
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          display: 'flex',
                          gap: '4px'
                        }}>
                          <button
                            onClick={() => toggleFloating(page.id)}
                            style={{
                              background: floatingPages[page.id]?.visible ? "#f44336" : "#2196F3",
                              color: "white",
                              border: "none",
                              padding: "4px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px"
                            }}
                          >
                            🎈
                          </button>
                          <button
                            onClick={() => toggleZoom(page.id)}
                            style={{
                              background: zoomedPages.has(page.id) ? "#FFEB3B" : "#9C27B0",
                              color: zoomedPages.has(page.id) ? "#333" : "white",
                              border: "none",
                              padding: "4px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "10px"
                            }}
                          >
                            🔍
                          </button>
                        </div>

                        {/* Page Number Badge */}
                        <div style={{
                          position: "absolute",
                          top: "8px",
                          left: "8px",
                          background: "#333",
                          color: "white",
                          borderRadius: "50%",
                          width: "24px",
                          height: "24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: "bold",
                          border: "2px solid white"
                        }}>
                          {index + 1}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Button 
                onClick={() => setCurrentTool('home')}
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                ← Back to Tools
              </Button>
            </div>
          </div>
        ) : (
          // Other tools placeholder
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2 style={{ color: '#00bfff', marginBottom: '16px' }}>
              {tools.find(t => t.pageName === currentTool)?.title || 'Tool'}
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '24px' }}>
              {tools.find(t => t.pageName === currentTool)?.content || 'Coming soon...'}
            </p>
            <Button 
              onClick={() => setCurrentTool('home')}
              style={{ background: 'rgba(255, 255, 255, 0.1)' }}
            >
              ← Back to Tools
            </Button>
          </div>
        )}
      </div>

      {/* Global Processing Status Bar */}
      {(globalProcessingCount > 0 || processingJobs.length > 0) && (
        <div style={{
          background: 'rgba(0,0,0,0.9)',
          color: 'white',
          padding: '12px 24px',
          fontSize: '14px',
          borderTop: '1px solid rgba(0, 255, 255, 0.2)',
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
            </div>
          )}
        </div>
      )}

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
        ref={mergePdfInputRef}
        type="file"
        multiple
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            handleMergePdfUpload(files);
          }
        }}
      />
      <input
        ref={organizePdfInputRef}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg,image/jpg,image/tiff,image/heic,image/svg+xml"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            handleOrganizePdfUpload(files);
          }
        }}
      />
      <input
        ref={resizePdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            handleResizePdfUpload(files);
          }
        }}
      />

      {/* Floating Pages Windows (preserved) */}
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
              onMouseDown={(e) => {
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
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                Floating Page {pages.findIndex(p => p.id === pageId) + 1}
              </span>
              <button
                onClick={() => setFloatingPages(prev => ({
                  ...prev,
                  [pageId]: { ...prev[pageId], visible: false }
                }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '16px'
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