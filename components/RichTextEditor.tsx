import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Save, Download, Printer, Mic, MicOff, Maximize2, Minimize2
} from 'lucide-react';
import { SuperDocEditor } from '@superdoc-dev/react';
import '@superdoc-dev/react/style.css';

interface RichTextEditorProps {
  initialContent: string;
  title?: string;
  onToggleVoice?: () => void;
  isVoiceActive?: boolean;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  templateUrl?: string | null;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  title = "Document",
  onToggleVoice,
  isVoiceActive,
  onSave,
  readOnly = false,
  templateUrl
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const editorInstanceRef = useRef<any>(null);
  const [docBlob, setDocBlob] = useState<Blob | null>(null);
  const [isTemplateLoaded, setIsTemplateLoaded] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const lastProcessedRef = useRef<string>("");

  // Silence Vue mounting warning as requested by user
  useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].includes('There is already an app instance mounted')) {
        return;
      }
      originalWarn(...args);
    };
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  // Load Template if available
  useEffect(() => {
    let isMounted = true;
    const currentProcessId = `${templateUrl}-${initialContent}`;

    const loadTemplate = async () => {
      if (!templateUrl) {
        if (isMounted) setIsTemplateLoaded(true);
        return;
      }

      // If we've already processed this specific combination, don't redo it
      // This prevents the "repeatedly refreshing" bug when saving
      if (lastProcessedRef.current === currentProcessId) {
        return;
      }

      try {
        console.log("Fetching template from:", templateUrl);
        const response = await fetch(templateUrl);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch template (Status ${response.status}): ${errorText.substring(0, 100)}`);
        }

        const blob = await response.blob();
        console.log("Template blob fetched successfully, size:", blob.size, "type:", blob.type);

        // Extract and modify header/footer if DOCX
        if (templateUrl.toLowerCase().endsWith('.docx') || blob.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          try {
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(blob);

            // Clear the document content (word/document.xml)
            const documentFile = zip.file('word/document.xml');
            if (documentFile) {
              const documentXml = await documentFile.async('string');

              // Use initialContent or a simple fallback paragraph
              const AIGeneratedContent = initialContent || `<w:p><w:r><w:t></w:t></w:r></w:p>`;

              // Replace the content but keep the structure
              const cleanedXml = documentXml.replace(
                /(<w:body>)([\s\S]*?)(<w:sectPr[\s\S]*?<\/w:sectPr>)([\s\S]*?)(<\/w:body>)/,
                `$1${AIGeneratedContent}$3$5`
              );

              zip.file('word/document.xml', cleanedXml);

              // Generate the modified blob
              const modifiedBlob = await zip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              });

              if (isMounted) {
                setDocBlob(modifiedBlob);
                lastProcessedRef.current = currentProcessId;
              }
            }
          } catch (zipError) {
            console.error("Failed to parse or modify DOCX template:", zipError);
            if (isMounted) {
              setDocBlob(blob);
              lastProcessedRef.current = currentProcessId;
            }
          }
        } else {
          if (isMounted) {
            setDocBlob(blob);
            lastProcessedRef.current = currentProcessId;
          }
        }
      } catch (error) {
        console.error("Template loading sequence failed:", error);
      } finally {
        if (isMounted) setIsTemplateLoaded(true);
      }
    };
    loadTemplate();
    return () => { isMounted = false; };
  }, [templateUrl, initialContent]);

  // Extract and clean OOXML body from a DOCX blob
  const extractOOXMLBody = async (blob: Blob) => {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const documentFile = zip.file('word/document.xml');

    if (documentFile) {
      const documentXml = await documentFile.async('string');
      // Extract the contents inside <w:body>
      const bodyRegex = /<w:body[^>]*>([\s\S]*?)<\/w:body>/;
      const bodyMatch = documentXml.match(bodyRegex);

      if (bodyMatch) {
        let innerContent = bodyMatch[1];
        // Filter out section properties (<w:sectPr>) 
        innerContent = innerContent.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, '');
        innerContent = innerContent.replace(/<w:sectPr\b[^>]*\/>/g, '');
        return innerContent;
      }
      throw new Error("Could not find <w:body> element in document.xml");
    }
    throw new Error("word/document.xml not found in exported DOCX");
  };

  const handleSave = async (silent = false) => {
    const superdoc = editorInstanceRef.current;
    if (onSave && superdoc) {
      try {
        const blob = await superdoc.export({ triggerDownload: false });
        if (!blob) throw new Error("Failed to export document");

        const innerContent = await extractOOXMLBody(blob);
        console.log("Saving OOXML body content (length):", innerContent.length);
        onSave(innerContent);
        return blob; // Return blob for use in export
      } catch (error) {
        console.error("Save Error:", error);
        if (!silent) alert("Failed to save document.");
      }
    }
    return null;
  };

  const handleExportDOCX = async () => {
    try {
      // Always save before export
      const blob = await handleSave(true);
      const downloadBlob = blob || (editorInstanceRef.current && await editorInstanceRef.current.export({ triggerDownload: false }));

      if (downloadBlob) {
        const url = URL.createObjectURL(downloadBlob);
        const link = document.createElement('a');
        link.href = url;
        // Explicitly ensure .docx extension and clean title
        const safeTitle = title.trim().replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_') || 'Document';
        link.download = `${safeTitle}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export Error:", error);
    }
  };

  // Handle editor load
  const handleEditorLoad = (event: any) => {
    editorInstanceRef.current = event.superdoc;
  };

  // Memoize configuration to prevent unnecessary re-mounts
  const editorModules = useMemo(() => ({
    toolbar: {
      excludeItems: [
        'documentMode',
        'rejectTrackedChangeOnSelection',
        'acceptTrackedChangeBySelection',
        'image',
        'link'
      ]
    },
  }), []);

  const editorModules2 = useMemo(() => {
    return Object.freeze({
      toolbar: Object.freeze({
        responsiveToContainer: true
      })
    });
  }, []);

  return (
    <div className={`flex flex-col h-full bg-gray-300 dark:bg-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm transition-all ${isMaximized ? 'fixed inset-0 z-50' : 'relative'}`}>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-1">
          {!readOnly && (
            <button onClick={() => handleSave()} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-2 text-sm font-medium">
              <Save className="w-4 h-4" /> <span>Save</span>
            </button>
          )}
          <button onClick={handleExportDOCX} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-2 text-sm font-medium">
            <Download className="w-4 h-4" /> <span>DOCX</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onToggleVoice && !readOnly && (
            <button
              onClick={onToggleVoice}
              className={`p-2 rounded-lg transition ${isVoiceActive ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
            >
              {isVoiceActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition text-gray-600 dark:text-gray-300"
          >
            {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* SuperDoc Editor Area */}
      <div className="flex-1 overflow-y-auto print-container flex flex-col items-center">
        {isTemplateLoaded ? (
          <SuperDocEditor
            key={templateUrl || 'no-template'}
            className="w-full justify-center flex items-center flex-col"
            document={docBlob || undefined}
            readOnly={readOnly}
            editable={!readOnly}
            documentMode={readOnly ? 'viewing' : 'editing'}
            role={readOnly ? 'reviewer' : 'editor'}
            pagination={false}
            onReady={handleEditorLoad}
            hideToolbar={readOnly}
            modules={editorModules}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500">Loading template...</div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-1 text-xs text-gray-500 flex justify-between">
        <span>Official Template: {templateUrl ? 'LOADED' : 'NONE'}</span>
        <span>A4 DOCX Mode</span>
      </div>
    </div>
  );
};