
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Undo, Redo, Save, Eye, FileText, Mic, MicOff, Scissors, Download, Printer
} from 'lucide-react';

interface RichTextEditorProps {
  initialContent: string;
  title?: string; // For filename
  onToggleVoice?: () => void;
  isVoiceActive?: boolean;
  onSave?: (content: string) => void; // Handler for persistence
  readOnly?: boolean;
  templateUrl?: string | null; // New Prop
}

// A4 Dimensions in Pixels (approx at 96 DPI)
const PAGE_HEIGHT = 1123;
const PAGE_WIDTH = 794;
const PAGE_MARGIN = 96; // 1 inch approx

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  title = "Document",
  onToggleVoice,
  isVoiceActive,
  onSave,
  readOnly = false,
  templateUrl
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT);

  // Update content when initialContent (generated text) changes
  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
      checkHeight();
    }
  }, [initialContent]);

  // Monitor Content Height
  useEffect(() => {
    if (!editorRef.current) return;
    const observer = new ResizeObserver(() => checkHeight());
    observer.observe(editorRef.current);
    return () => observer.disconnect();
  }, []);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((contentHeight + 100) / PAGE_HEIGHT));
  }, [contentHeight]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    if (readOnly) return;
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    checkHeight();
  };

  const checkHeight = () => {
    if (editorRef.current) {
      setContentHeight(editorRef.current.scrollHeight);
    }
  }

  const handleSaveClick = () => {
    if (editorRef.current && onSave && !readOnly) {
      onSave(editorRef.current.innerHTML);
    }
  };

  const handleExportDOCX = async () => {
    // If a custom template URL exists, prioritize downloading that (User requested "use actual template")
    // NOTE: True merging of HTML content INTO a DOCX client-side requires heavy libraries (docxtemplater/pizzip).
    // For now, we will offer the Original Template file if available, 
    // OR continue with the HTML-based DOC export if no template.

    if (templateUrl) {
      // Download the original template file
      try {
        const response = await fetch(templateUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // Extract filename or default
        const ext = templateUrl.split('.').pop()?.split('?')[0] || 'docx';
        link.download = `${title.replace(/\s+/g, '_')}_OfficialTemplate.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Also offer to download the CONTENT separately so they can copy-paste?
        // Or just notify?
        // alert("Official Template downloaded. Please copy-paste the generated content into it.");
        return;
      } catch (e) {
        console.error("Failed to download template:", e);
        // Fallback to normal export
      }
    }

    // Standard HTML-to-DOC export (Fallback or default)
    const headerContent = document.getElementById('doc-header-content')?.innerHTML || '';
    const footerContent = document.getElementById('doc-footer-content')?.innerHTML || '';
    const bodyContent = editorRef.current?.innerHTML || '';

    // Construct a Word-compatible HTML structure
    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid black; padding: 5px; }
          .no-border td { border: none !important; }
        </style>
      </head>
      <body>
        <div class="header" style="text-align: center; margin-bottom: 20px;">${headerContent}</div>
        ${bodyContent}
        <div class="footer" style="margin-top: 50px; border-top: 1px solid #ccc; font-size: 8pt;">${footerContent}</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', preHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}.doc`; // .doc opens more reliably in Word as HTML than .docx without conversion lib
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const editorContent = editorRef.current?.innerHTML || '';
    const headerContent = document.getElementById('doc-header-content')?.innerHTML || '';
    const footerContent = document.getElementById('doc-footer-content')?.innerHTML || '';

    const printWindow = window.open('', '', 'width=900,height=1200');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              @page { 
                size: A4; 
                margin: 0; /* Important: Removes browser headers/footers */
              }
              body { 
                margin: 20mm; /* Add margins back via body */
                font-family: 'Times New Roman', Times, serif;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                color: black;
                background: white;
              }
              
              /* Print Layout Structure selected by ID to avoid duplication issues if any */
              table { width: 100%; border-collapse: collapse; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              
              .print-header {
                width: 100%;
                text-align: center;
                margin-bottom: 20px;
                /* Ensure invalid images don't break layout */
              }
              
              .print-footer {
                width: 100%;
                margin-top: 20px;
              }

              .print-content {
                font-size: 12pt;
                line-height: 1.5;
                text-align: justify;
                padding-top: 10px;
                padding-bottom: 10px;
              }
              
              /* Ensure tables look right */
              .print-content table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
              .print-content th, .print-content td { border: 1px solid black; padding: 4px 8px; vertical-align: top; text-align: left; }
              
              /* Signatories / No Border Tables */
              .print-content table.no-border, .print-content table.no-border td { border: none !important; }
              
              /* Prevent breaking inside tables/signatories */
              table, tr, td, .keep-together { page-break-inside: avoid; break-inside: avoid; }

              /* Manual Page Breaks */
              .page-break {
                page-break-before: always;
                break-before: page;
                display: block;
                height: 0;
                border: none;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <td>
                  <div class="print-header">
                     ${headerContent}
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="print-content">
                    ${editorContent}
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <div class="print-footer">
                     ${footerContent}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
          <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const ToolbarButton = ({ icon: Icon, cmd, arg, title }: any) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        execCommand(cmd, arg);
      }}
      disabled={readOnly}
      className={`p-1.5 md:p-2 rounded transition ${readOnly ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
      title={title}
    >
      <Icon className="w-4 h-4 md:w-5 md:h-5" />
    </button>
  );

  const DocumentHeaderContent = () => (
    <div id="doc-header-content" className="flex flex-col items-center justify-center pt-4 text-center font-serif">
      <div className="flex items-center justify-center mb-2">
        <img
          src="https://ui-avatars.com/api/?name=NEMSU&background=0D8ABC&color=fff&size=128&length=1"
          alt="NEMSU Logo"
          className="w-12 h-12 md:w-16 md:h-16 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'; // Hide if fails
          }}
        />
      </div>
      <p className="text-[9pt] md:text-[10pt] leading-tight">Republic of the Philippines</p>
      <h1 className="text-[10pt] md:text-[12pt] font-bold uppercase text-blue-900 tracking-wide leading-tight">
        North Eastern Mindanao State University
      </h1>
      <div className="w-[85%] border-b-2 border-blue-900/80 mt-2 mx-auto"></div>
    </div>
  );

  const DocumentFooterContent = () => (
    <div id="doc-footer-content" className="flex flex-col justify-end pt-4 pb-2 px-8">
      <div className="border-t border-blue-900/50 w-full mb-2"></div>
      <div className="flex items-end justify-between text-[8pt] font-sans text-gray-600">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>NEMSU Main Campus, Tandag City</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📞</span>
            <span>+63 999 663 4946</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🌐</span>
            <span className="text-blue-800 underline">www.nemsu.edu.ph</span>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="h-8 w-8 border border-gray-300 flex flex-col items-center justify-center bg-gray-50">
            <span className="text-[5px] font-bold">ISO</span>
            <span className="text-[5px]">9001</span>
          </div>
          <div className="h-8 w-8 border border-gray-300 flex flex-col items-center justify-center bg-gray-50">
            <span className="text-[5px] font-bold">UKAS</span>
            <span className="text-[5px]">✔</span>
          </div>
        </div>
      </div>
      <div className="text-center text-[7pt] text-gray-400 mt-1">
        System Generated by NEMSU AI DocuFlow
      </div>
    </div>
  );

  const containerClasses = isMaximized
    ? "fixed inset-0 z-[100] flex flex-col bg-gray-100 dark:bg-gray-900 h-screen w-screen animate-zoom-in-center origin-center"
    : "flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700 shadow-inner relative animate-restore-in";

  return (
    <div className={containerClasses}>
      <style>{`
        .document-editor table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
        .document-editor th, .document-editor td { border: 1px solid black; padding: 4px 8px; vertical-align: top; }
        .document-editor .no-border, .document-editor .no-border td { border: none !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Page Break Guide Line */
        /* Page Break Guide Line - Visual Gap */
        .page-guide {
          position: absolute;
          left: 0;
          right: 0;
          height: 24px;
          background: #e5e7eb; /* Gray gap */
          border-top: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); /* Inner shadow for depth */
          pointer-events: none;
          z-index: 5; /* Sit on top of text slightly to show it's a break */
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .page-guide::after {
          content: '— Page Break —';
          font-size: 10px;
          color: #6b7280;
          background: #e5e7eb;
          padding: 0 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: bold;
        }

        /* Prevent tables, images, headings from splitting across pages */
        .document-editor table,
        .document-editor tr,
        .document-editor td,
        .document-editor th,
        .document-editor img {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Force manual page breaks if user inserts <div class="page-break"></div> */
        .page-break {
          page-break-before: always;
          break-before: page;
          height: 0;
          border-top: 2px dashed #aaa;
          margin: 40px 0;
        }
      `}</style>

      {/* Toolbar */}
      {!readOnly && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 p-2 flex items-center gap-1 flex-wrap shadow-sm z-10 shrink-0 justify-start">
          <ToolbarButton icon={Undo} cmd="undo" title="Undo" />
          <ToolbarButton icon={Redo} cmd="redo" title="Redo" />
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2 hidden sm:block" />
          <ToolbarButton icon={Bold} cmd="bold" title="Bold" />
          <ToolbarButton icon={Italic} cmd="italic" title="Italic" />
          <ToolbarButton icon={Underline} cmd="underline" title="Underline" />
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2 hidden sm:block" />
          <ToolbarButton icon={AlignLeft} cmd="justifyLeft" title="Align Left" />
          <ToolbarButton icon={AlignCenter} cmd="justifyCenter" title="Align Center" />
          <ToolbarButton icon={AlignRight} cmd="justifyRight" title="Align Right" />
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2 hidden sm:block" />
          <ToolbarButton icon={List} cmd="insertUnorderedList" title="Bullet List" />
          <ToolbarButton icon={ListOrdered} cmd="insertOrderedList" title="Numbered List" />
          <ToolbarButton icon={Scissors} cmd="insertHTML" arg='<div class="page-break"></div>' title="Insert Page Break" />
          <div className="flex-1 min-w-[10px]" />

          {/* Actions */}
          <button onClick={handleSaveClick} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-2 text-sm font-medium" title="Save to My Documents">
            <Save className="w-4 h-4" /> <span className="hidden lg:inline">Save</span>
          </button>

          <button onClick={handleExportDOCX} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-2 text-sm font-medium" title="Download as Word Doc">
            <Download className="w-4 h-4" /> <span className="hidden lg:inline">.doc</span>
          </button>

          <button onClick={handlePrint} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-2 text-sm font-medium" title="Print / Save as PDF">
            <Printer className="w-4 h-4" /> <span className="hidden lg:inline">Print</span>
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2 hidden sm:block" />

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className={`p-2 rounded transition flex items-center gap-2 text-sm font-medium ${isMaximized ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
          >
            <Eye className="w-4 h-4" /> <span className="hidden lg:inline">View</span>
          </button>
        </div>
      )}

      {/* View Only Toolbar (Simplified) */}
      {readOnly && (
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 p-2 flex items-center gap-1 flex-wrap shadow-sm z-10 shrink-0 justify-end">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-4">View Only Mode</span>
          <button onClick={handleExportDOCX} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-2 text-sm font-medium" title="Download as Word Doc">
            <Download className="w-4 h-4" /> <span className="hidden lg:inline">.doc</span>
          </button>
          <button onClick={handlePrint} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-2 text-sm font-medium" title="Print / Save as PDF">
            <Printer className="w-4 h-4" /> <span className="hidden lg:inline">Print</span>
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className={`p-2 rounded transition flex items-center gap-2 text-sm font-medium ${isMaximized ? 'bg-blue-100 text-blue-700' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
          >
            <Eye className="w-4 h-4" /> <span className="hidden lg:inline">View</span>
          </button>
        </div>
      )}

      {/* Editor Workspace - Allows horizontal scroll for the A4 paper */}
      <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900/50 flex flex-col items-center p-4 md:p-8 custom-scrollbar">

        {/* The Paper */}
        <div
          className="bg-white text-black shadow-lg relative flex flex-col transition-all shrink-0"
          style={{
            width: PAGE_WIDTH,
            minHeight: Math.max(PAGE_HEIGHT, contentHeight + 200) // Ensure it grows
          }}
        >
          {/* Visual Page Break Guides */}
          {Array.from({ length: totalPages }).map((_, i) => i > 0 && (
            <div key={i} className="page-guide" style={{ top: i * PAGE_HEIGHT }} />
          ))}

          <DocumentHeaderContent />

          <div
            ref={editorRef}
            contentEditable={!readOnly}
            onInput={checkHeight}
            onKeyUp={checkHeight}
            className={`outline-none document-editor flex-1 ${readOnly ? 'cursor-default' : 'cursor-text'}`}
            style={{
              width: '100%',
              paddingLeft: PAGE_MARGIN,
              paddingRight: PAGE_MARGIN,
              paddingTop: 20,
              paddingBottom: 40,
              fontSize: '12pt',
              lineHeight: '1.5',
            }}
          />

          <DocumentFooterContent />
        </div>

        <div className="h-20" />
      </div>

      {/* Footer Info Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-1 text-xs text-gray-500 flex justify-between shrink-0 z-20">
        <span>Height: {contentHeight}px • Est. Pages: {totalPages}</span>
        <span className="hidden sm:inline">A4 Layout</span>
      </div>

      {/* Voice Agent Button */}
      {isMaximized && onToggleVoice && !readOnly && (
        <button
          onClick={onToggleVoice}
          className={`fixed bottom-8 right-8 z-[60] p-4 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center justify-center ${isVoiceActive ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          {isVoiceActive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
      )}
    </div>
  );
};
