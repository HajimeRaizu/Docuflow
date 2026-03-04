import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Save, Download, Printer, Mic, MicOff, Maximize2, Minimize2, CheckCircle, AlertCircle,
  Database, Search, X, Loader, Tag
} from 'lucide-react';
import { useNotification } from './NotificationProvider';
import { SuperDocEditor } from '@superdoc-dev/react';
import { supabase } from '../services/supabaseClient';
import '@superdoc-dev/react/style.css';

import { UserRole, DocumentType } from '../types';

interface RichTextEditorProps {
  initialContent: string;
  title?: string;
  onToggleVoice?: () => void;
  isVoiceActive?: boolean;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  templateUrl?: string | null;
  documentType?: DocumentType;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  title = "Document",
  onToggleVoice,
  isVoiceActive,
  onSave,
  readOnly = false,
  templateUrl,
  documentType
}) => {
  const { showToast } = useNotification();
  const [isMaximized, setIsMaximized] = useState(false);
  const editorInstanceRef = useRef<any>(null);
  const [docBlob, setDocBlob] = useState<Blob | null>(null);
  const [isTemplateLoaded, setIsTemplateLoaded] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const lastProcessedRef = useRef<string>("");

  const [isPriceListOpen, setIsPriceListOpen] = useState(false);
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingPriceItems, setIsLoadingPriceItems] = useState(false);
  const [priceListStep, setPriceListStep] = useState<1 | 2>(1); // 1: Select, 2: Quantities
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

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
        showToast("Document saved successfully!", "success");
        onSave(innerContent);
        return blob; // Return blob for use in export
      } catch (error) {
        console.error("Save Error:", error);
        if (!silent) showToast("Failed to save document.", "error");
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

  const fetchPriceList = async () => {
    setIsLoadingPriceItems(true);
    try {
      const { data, error } = await supabase
        .from('price_list_items')
        .select('*')
        .order('description', { ascending: true });

      if (error) throw error;
      setPriceListItems(data || []);
    } catch (err) {
      console.error("Error fetching price list:", err);
      showToast("Failed to load price list items.", "error");
    } finally {
      setIsLoadingPriceItems(false);
    }
  };

  useEffect(() => {
    if (isPriceListOpen && priceListItems.length === 0) {
      fetchPriceList();
    }
  }, [isPriceListOpen]);

  // Handle Table Insertion
  const handleInsertPriceTable = async () => {
    const superdoc = editorInstanceRef.current;
    if (!superdoc || selectedItemIds.size === 0) return;

    try {
      const currentBlob = await superdoc.export({ triggerDownload: false });
      if (!currentBlob) throw new Error("Failed to export latest document state");
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(currentBlob);
      const documentFile = zip.file('word/document.xml');

      if (!documentFile) return;

      const documentXml = await documentFile.async('string');

      // Selected Items from the full list
      const selectedItems = priceListItems.filter(item => selectedItemIds.has(item.id));

      // Build OOXML Table
      let tableRows = `
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Particulars</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Unit</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Quantity</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Unit Cost</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Total Cost</w:t></w:r></w:p></w:tc>
        </w:tr>
      `;

      let grandTotal = 0;

      selectedItems.forEach(item => {
        const qty = itemQuantities[item.id] || 0;
        const total = qty * (item.price || 0);
        grandTotal += total;

        tableRows += `
          <w:tr>
            <w:tc><w:p><w:r><w:t>${item.description}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${item.unit || ''}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${qty}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>₱${(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
          </w:tr>
        `;
      });

      // Total Row
      tableRows += `
        <w:tr>
          <w:tc><w:tcPr><w:gridSpan w:val="4"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>GRAND TOTAL</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
        </w:tr>
      `;

      const ooxmlTable = `
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
              <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
            </w:tblBorders>
          </w:tblPr>
          ${tableRows}
        </w:tbl>
        <w:p/>
      `;

      // 2. Insert or Replace existing table
      // Look for a table that contains the "Particulars" header
      const priceTableRegex = /<w:tbl>(?:(?!<\/w:tbl>)[\s\S])*?Particulars(?:(?!<\/w:tbl>)[\s\S])*?<\/w:tbl>/;

      let newXml;
      if (priceTableRegex.test(documentXml)) {
        console.log("Existing price table found. Updating...");
        newXml = documentXml.replace(priceTableRegex, ooxmlTable);
      } else {
        console.log("No price table found. Appending to body...");
        newXml = documentXml.replace('</w:body>', `${ooxmlTable}</w:body>`);
      }

      zip.file('word/document.xml', newXml);

      const modifiedBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      setDocBlob(modifiedBlob);
      setEditorKey(prev => prev + 1); // Force editor reload
      setIsPriceListOpen(false);
      showToast("Price list updated successfully!", "success");

      // Reset Modal Step but KEEP selection/quantities for persistence
      setPriceListStep(1);

    } catch (err) {
      console.error("Table insertion failed:", err);
      showToast("Failed to insert table.", "error");
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return priceListItems;
    const lowerQuery = searchQuery.toLowerCase();
    return priceListItems.filter(item =>
      item.description?.toLowerCase().includes(lowerQuery) ||
      item.procurement_object?.toLowerCase().includes(lowerQuery) ||
      item.budget_object?.toLowerCase().includes(lowerQuery)
    );
  }, [priceListItems, searchQuery]);

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
          {!readOnly && documentType === DocumentType.ACTIVITY_PROPOSAL && (
            <button
              onClick={() => setIsPriceListOpen(true)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition flex items-center gap-2 text-sm font-medium"
            >
              <Database className="w-4 h-4" /> <span>Show Price List</span>
            </button>
          )}
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

      {/* Price List Modal */}
      {isPriceListOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                  <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Price List Reference</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Basis PMPP Price List Search</p>
                </div>
              </div>
              <button
                onClick={() => setIsPriceListOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by description, object, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            {/* Items List - Table Layout */}
            <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              {isLoadingPriceItems ? (
                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
                  <Loader className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                  <p className="text-gray-500 font-medium italic">Loading price list...</p>
                </div>
              ) : priceListStep === 1 ? (
                /* STEP 1: SELECT ITEMS */
                filteredItems.length > 0 ? (
                  <div className="min-w-full inline-block align-middle">
                    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th scope="col" className="w-10 px-4 py-3"></th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                            <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                          {filteredItems.map((item) => (
                            <tr
                              key={item.id}
                              className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group cursor-pointer ${selectedItemIds.has(item.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                              onClick={() => {
                                const newSelection = new Set(selectedItemIds);
                                if (newSelection.has(item.id)) newSelection.delete(item.id);
                                else newSelection.add(item.id);
                                setSelectedItemIds(newSelection);
                              }}
                            >
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedItemIds.has(item.id)}
                                  onChange={() => { }} // Handled by tr click
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                              </td>
                              <td className="px-4 py-3 whitespace-normal">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</span>
                                {item.budget_object && (
                                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                    <Tag className="w-2.5 h-2.5" /> {item.budget_object}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">{item.unit || '—'}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                  {item.price ? `₱${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <Database className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">No items found matching "{searchQuery}"</p>
                  </div>
                )
              ) : (
                /* STEP 2: QUANTITIES */
                <div className="space-y-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-indigo-800 dark:text-indigo-300 text-sm">
                    Enter the quantity for each selected item. The total cost will be calculated automatically.
                  </div>
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-indigo-950/20">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Item Description</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Unit Cost</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                        {priceListItems.filter(item => selectedItemIds.has(item.id)).map(item => (
                          <tr key={item.id}>
                            <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-xs">{item.description}</td>
                            <td className="px-4 py-4 w-32">
                              <input
                                type="number"
                                min="1"
                                value={itemQuantities[item.id] || ''}
                                placeholder="0"
                                onChange={(e) => setItemQuantities(prev => ({
                                  ...prev,
                                  [item.id]: parseInt(e.target.value) || 0
                                }))}
                                className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500 text-right">₱{(item.price || 0).toLocaleString()}</td>
                            <td className="px-4 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 text-right">
                              ₱{((itemQuantities[item.id] || 0) * (item.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50/30 dark:bg-indigo-900/10">
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-sm font-bold text-gray-900 dark:text-white text-right uppercase">Estimated Grand Total</td>
                          <td className="px-4 py-4 text-lg font-black text-indigo-700 dark:text-indigo-300 text-right">
                            ₱{priceListItems
                              .filter(item => selectedItemIds.has(item.id))
                              .reduce((sum, item) => sum + ((itemQuantities[item.id] || 0) * (item.price || 0)), 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
              <div>
                {priceListStep === 1 && (
                  <span className="text-xs text-gray-500 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                    {selectedItemIds.size} Items Selected
                  </span>
                )}
                {priceListStep === 2 && (
                  <button
                    onClick={() => setPriceListStep(1)}
                    className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline underline-offset-4"
                  >
                    ← Back to Selection
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsPriceListOpen(false)}
                  className="px-5 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  Cancel
                </button>
                {priceListStep === 1 ? (
                  <button
                    disabled={selectedItemIds.size === 0}
                    onClick={() => setPriceListStep(2)}
                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-950/20 disabled:opacity-50 disabled:grayscale disabled:scale-100"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    disabled={Object.values(itemQuantities).every(q => (q as number) <= 0)}
                    onClick={handleInsertPriceTable}
                    className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-200 dark:shadow-green-950/20 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Insert Table
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};