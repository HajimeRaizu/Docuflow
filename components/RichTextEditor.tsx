import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface RichTextEditorProps {
  initialContent: string;
  onToggleVoice?: () => void;
  isVoiceActive?: boolean;
}

declare const tinymce: any;

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  initialContent, 
  onToggleVoice, 
  isVoiceActive 
}) => {
  const editorRef = useRef<string>('');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a unique ID for the editor
  if (!editorRef.current) {
    editorRef.current = `tinymce-${Math.random().toString(36).substring(2, 9)}`;
  }
  const editorId = editorRef.current;

  // Effect to update content if it changes externally (e.g. from AI generation)
  useEffect(() => {
    if (isEditorReady && tinymce.get(editorId) && initialContent) {
      const editor = tinymce.get(editorId);
      // Only set content if it's significantly different and editor isn't focused/dirty to avoid cursor jumps
      // However, for initial generation we want to overwrite
      const currentContent = editor.getContent();
      if (currentContent !== initialContent && !editor.isDirty()) {
        editor.setContent(initialContent);
      }
    }
  }, [initialContent, isEditorReady, editorId]);

  useEffect(() => {
    // Check for standards mode
    if (document.compatMode === 'BackCompat') {
       console.error("Document is in Quirks Mode. TinyMCE requires Standards Mode.");
       setError("Browser is in Quirks Mode. Please ensure <!DOCTYPE html> is the first line of index.html.");
       return;
    }

    const initEditor = () => {
      if (typeof tinymce === 'undefined') {
        setTimeout(initEditor, 100);
        return;
      }

      // Safe destroy existing instance
      if (tinymce.get(editorId)) {
        tinymce.remove(`#${editorId}`);
      }

      try {
        tinymce.init({
          selector: `#${editorId}`,
          height: '100%',
          menubar: true,
          promotion: false,
          branding: false,
          statusbar: true,
          resize: false, 
          plugins: [
            'preview', 'importcss', 'searchreplace', 'autolink', 'autosave', 'save', 
            'directionality', 'code', 'visualblocks', 'visualchars', 'fullscreen', 
            'image', 'link', 'media', 'template', 'codesample', 'table', 'charmap', 
            'pagebreak', 'nonbreaking', 'anchor', 'insertdatetime', 'advlist', 'lists', 
            'wordcount', 'help', 'quickbars', 'emoticons', 'accordion'
          ],
          toolbar: 
            'undo redo | fontfamily fontsize | bold italic underline strikethrough | ' +
            'alignleft aligncenter alignright alignjustify | ' +
            'outdent indent |  numlist bullist | forecolor backcolor | ' +
            'table pagebreak | ' +
            'customVoice customExport | fullscreen preview',
          
          setup: (editor: any) => {
            editor.on('init', () => {
              setIsEditorReady(true);
              if (initialContent) {
                editor.setContent(initialContent);
              }
            });

            editor.ui.registry.addButton('customVoice', {
              icon: isVoiceActive ? 'stop' : 'microphone',
              tooltip: 'Toggle Voice Agent',
              text: isVoiceActive ? 'Stop Voice' : 'Voice Agent',
              onAction: () => {
                 if(onToggleVoice) onToggleVoice();
              }
            });

            editor.ui.registry.addButton('customExport', {
              icon: 'export',
              tooltip: 'Export to PDF',
              text: 'Export PDF',
              onAction: () => {
                 handleExportPDF(editor.getContent());
              }
            });
          },

          content_style: `
            html {
              background-color: #f3f4f6;
              padding: 20px 0;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            
            body {
              background-color: white;
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              width: 210mm;
              min-height: 297mm;
              margin: 0;
              padding: 25.4mm;
              box-sizing: border-box;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              
              /* Visual Page Break Gradient */
              background-image: linear-gradient(to bottom, 
                  #ffffff 0%, 
                  #ffffff calc(297mm - 1px), 
                  #d1d5db calc(297mm - 1px), 
                  #d1d5db 297mm,
                  #f3f4f6 297mm, 
                  #f3f4f6 calc(297mm + 10mm), 
                  #d1d5db calc(297mm + 10mm), 
                  #d1d5db calc(297mm + 10mm + 1px),
                  #ffffff calc(297mm + 10mm + 1px)
              );
              background-size: 100% calc(297mm + 10mm); 
              background-repeat: repeat-y;
            }

            @media print {
              html { background: none; padding: 0; }
              body { 
                 width: auto; 
                 margin: 0; 
                 padding: 0; 
                 background: none; 
                 box-shadow: none; 
              }
              .page-break { page-break-before: always; }
            }
            
            table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            td, th { border: 1px solid black; padding: 4px 8px; }
            p { margin-bottom: 0.5em; line-height: 1.5; }
          `
        });
      } catch (e) {
        console.error("TinyMCE Init Error:", e);
        setError("Failed to initialize editor.");
      }
    };

    // Small delay to ensure DOM is fully ready
    const timer = setTimeout(initEditor, 50);

    return () => {
      clearTimeout(timer);
      if (tinymce.get(editorId)) {
        tinymce.remove(`#${editorId}`);
      }
    };
  }, [isVoiceActive, editorId]); 

  const handleExportPDF = (content: string) => {
    const printWindow = window.open('', '', 'width=900,height=1200');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Export Document</title>
          <style>
            @media print {
              @page { size: A4; margin: 20mm; }
              body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 0; }
              table { width: 100%; border-collapse: collapse; }
              td, th { border: 1px solid black; padding: 4px; }
              img { max-width: 100%; }
            }
            body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 210mm; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            td, th { border: 1px solid black; padding: 4px; }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = () => { 
                setTimeout(() => { 
                    window.print(); 
                    window.close(); 
                }, 800); 
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="h-full w-full relative bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white dark:bg-gray-800 p-6 text-center text-red-500">
           <p>{error}</p>
        </div>
      ) : !isEditorReady && (
         <div className="absolute inset-0 flex items-center justify-center z-10 bg-white dark:bg-gray-800">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-sm text-gray-500">Initializing Editor...</span>
            </div>
         </div>
      )}
      <textarea id={editorId} className="hidden" />
    </div>
  );
};