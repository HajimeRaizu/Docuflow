import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Save, Download, Printer, Mic, MicOff, Maximize2, Minimize2, CheckCircle, AlertCircle,
  Database, Search, X, Loader, Tag, Plus
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
  initialEstimate?: any[];
  templateIndex?: number;
  onTemplateChange?: (index: number) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  title = "Document",
  onToggleVoice,
  isVoiceActive,
  onSave,
  readOnly = false,
  templateUrl,
  documentType,
  initialEstimate,
  templateIndex = 0,
  onTemplateChange
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
  const [manualEntries, setManualEntries] = useState<any[]>([]);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [newManualItem, setNewManualItem] = useState({ description: '', unit: '', quantity: 1, price: 0 });


  // Load Template if available
  useEffect(() => {
    let isMounted = true;
    const currentProcessId = `${templateUrl}-${initialContent}`;

    const loadTemplate = async () => {
      // If we've already processed this specific combination, don't redo it
      if (lastProcessedRef.current === currentProcessId) {
        return;
      }

      try {
        if (!templateUrl) {
          // No Template index 0 - Simply clear the blob and don't attempt loading
          if (isMounted) {
            setDocBlob(null);
            lastProcessedRef.current = currentProcessId;
          }
          return;
        }

        let blobValue: Blob;

        const response = await fetch(templateUrl);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch template (Status ${response.status}): ${errorText.substring(0, 100)}`);
        }
        blobValue = await response.blob();

        // Extract and modify header/footer if DOCX
        if (templateUrl.toLowerCase().endsWith('.docx') || blobValue.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          try {
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(blobValue);

            // Clear the document content (word/document.xml)
            const documentFile = zip.file('word/document.xml');
            if (documentFile) {
              const documentXml = await documentFile.async('string');

              // Use initialContent or a simple fallback paragraph
              const AIGeneratedContent = initialContent || `<w:p><w:r><w:t></w:t></w:r></w:p>`;

              // Replace the content but keep the structure
              let cleanedXml = documentXml.replace(
                /(<w:body>)([\s\S]*?)(<w:sectPr[\s\S]*?<\/w:sectPr>)([\s\S]*?)(<\/w:body>)/,
                `$1${AIGeneratedContent}$3$5`
              );

              // Force Arial 12 (sz val=24) globally in the document XML
              cleanedXml = cleanedXml.replace(/<w:rFonts\b[^>]*\/>/g, '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>');
              cleanedXml = cleanedXml.replace(/<w:sz\b[^>]*\/>/g, '<w:sz w:val="24"/>');
              cleanedXml = cleanedXml.replace(/<w:szCs\b[^>]*\/>/g, '<w:szCs w:val="24"/>');

              zip.file('word/document.xml', cleanedXml);

              // Also try to modify styles.xml if it exists to set the default
              const stylesFile = zip.file('word/styles.xml');
              if (stylesFile) {
                let stylesXml = await stylesFile.async('string');
                stylesXml = stylesXml.replace(/<w:rFonts\b[^>]*\/>/g, '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>');
                stylesXml = stylesXml.replace(/<w:sz\b[^>]*\/>/g, '<w:sz w:val="24"/>');
                stylesXml = stylesXml.replace(/<w:szCs\b[^>]*\/>/g, '<w:szCs w:val="24"/>');
                zip.file('word/styles.xml', stylesXml);
              }

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
            if (isMounted) {
              setDocBlob(blobValue);
              lastProcessedRef.current = currentProcessId;
            }
          }
        } else {
          if (isMounted) {
            setDocBlob(blobValue);
            lastProcessedRef.current = currentProcessId;
          }
        }
      } catch (error) {
        // Raw error will surface naturally if unhandled, or we ignore as per "no debug" request
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
        'copyFormat',
        'linkedStyles',
        'clearFormatting',
        'documentMode',
        'rejectTrackedChangeOnSelection',
        'acceptTrackedChangeBySelection',
        'image',
        'link',
      ]
    },
  }), []);

  const syncItemsFromDoc = async (itemsList: any[]) => {
    const superdoc = editorInstanceRef.current;
    if (!superdoc) return;

    try {
      const currentBlob = await superdoc.export({ triggerDownload: false });
      if (!currentBlob) return;

      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(currentBlob);
      const documentFile = zip.file('word/document.xml');
      if (!documentFile) return;

      const documentXml = await documentFile.async('string');
      // Look for a table that contains the "Particulars" header
      const priceTableRegex = /<w:tbl>(?:(?!<\/w:tbl>)[\s\S])*?Particulars(?:(?!<\/w:tbl>)[\s\S])*?<\/w:tbl>/;
      const match = documentXml.match(priceTableRegex);

      if (match) {
        const tableXml = match[0];
        const rowRegex = /<w:tr[^>]*>[\s\S]*?<\/w:tr>/g;
        const rows = tableXml.match(rowRegex) || [];

        const newSelectedIds = new Set<string>();
        const newQuantities: Record<string, number> = {};
        const newManualEntries: any[] = [];

        // Helper to extract text from cell
        const extractText = (xml: string) => {
          const textMatch = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
          return textMatch ? textMatch.map(t => t.replace(/<[^>]*>/g, '')).join('') : '';
        };

        // Skip header (0), and process rows until "Total Estimated Expenses"
        for (let i = 1; i < rows.length; i++) {
          const rowXml = rows[i];
          if (rowXml.includes('Total Estimated Expenses')) continue;

          // Extract cells
          const cellRegex = /<w:tc[^>]*>[\s\S]*?<\/w:tc>/g;
          const cells = rowXml.match(cellRegex) || [];
          if (cells.length < 3) continue;

          const description = extractText(cells[0]).trim();
          if (!description || description === 'Particulars') continue;

          const unit = extractText(cells[1]).trim();
          const qtyText = extractText(cells[2]).trim();
          const qty = parseInt(qtyText) || 0;

          // Match with price list - prioritize exact description match
          const matchedItem = itemsList.find(item => item.item_name?.trim() === description);
          if (matchedItem) {
            newSelectedIds.add(matchedItem.id);
            newQuantities[matchedItem.id] = qty;
          } else {
            // Check if it has a price in the 4th cell
            const priceText = extractText(cells[3]).replace(/[^0-9.]/g, '');
            const price = parseFloat(priceText) || 0;
            newManualEntries.push({ description, unit, quantity: qty, price });
          }
        }

        setSelectedItemIds(newSelectedIds);
        setItemQuantities(newQuantities);
        setManualEntries(newManualEntries);
      }
    } catch (err) {
      console.error("Sync from doc failed:", err);
    }
  };

  const handleAddManualItem = () => {
    if (!newManualItem.description) {
      showToast("Particulars are required", "error");
      return;
    }
    setManualEntries(prev => [...prev, { ...newManualItem }]);
    setNewManualItem({ description: '', unit: '', quantity: 1, price: 0 });
    setIsAddingManual(false);
    showToast("Item added to list", "success");
  };

  const updateManualEntry = (index: number, field: string, value: any) => {
    setManualEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeManualEntry = (index: number) => {
    setManualEntries(prev => prev.filter((_, i) => i !== index));
    showToast("Item removed", "success");
  };

  const fetchPriceList = async () => {
    setIsLoadingPriceItems(true);
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .order('item_name', { ascending: true });

      if (error) throw error;
      const items = data || [];
      setPriceListItems(items);

      // Auto-sync after fetching items
      await syncItemsFromDoc(items);
    } catch (err) {
      console.error("Error fetching price list:", err);
      showToast("Failed to load price list items.", "error");
    } finally {
      setIsLoadingPriceItems(false);
    }
  };

  useEffect(() => {
    if (isPriceListOpen) {
      if (priceListItems.length === 0) {
        fetchPriceList();
      } else {
        syncItemsFromDoc(priceListItems);
      }
    }
  }, [isPriceListOpen]);

  // Handle AI Initial Estimate Injection
  useEffect(() => {
    if (initialEstimate && initialEstimate.length > 0) {

      const processEstimates = async () => {
        let itemsList = priceListItems;
        // Fetch price list if it isn't loaded yet
        if (itemsList.length === 0) {
          try {
            const { data } = await supabase
              .from('price_list')
              .select('*')
              .order('item_name');
            if (data) Object.freeze(data);
            itemsList = data || [];
            if (data) setPriceListItems(data);
          } catch (e) {
            console.error(e);
          }
        }

        const newSelectedIds = new Set<string>();
        const newQuantities: Record<string, number> = {};
        const newManualEntries: any[] = [];

        initialEstimate.forEach((estItem) => {
          // Attempt string match against DB
          const dbMatch = itemsList.find(item =>
            item.item_name?.toLowerCase() === estItem.item_name?.toLowerCase()
          );

          if (dbMatch) {
            newSelectedIds.add(dbMatch.id);
            newQuantities[dbMatch.id] = (newQuantities[dbMatch.id] || 0) + (estItem.quantity || 1);
          } else {
            // Unrecognized item goes to manual entries
            newManualEntries.push({
              description: estItem.item_name || 'Unnamed Item',
              unit: estItem.unit || '',
              quantity: estItem.quantity || 1,
              price: estItem.price || 0
            });
          }
        });

        // Update state to reflect the AI's selection
        setSelectedItemIds(newSelectedIds);
        setItemQuantities(newQuantities);
        setManualEntries(newManualEntries);

        // Auto-open modal to step 2 (Quantities/Totals) so the user can verify the AI's math
        setIsPriceListOpen(true);
        setPriceListStep(2);
      };

      processEstimates();
    }
  }, [initialEstimate]);

  // Handle Table Insertion
  const handleInsertPriceTable = async () => {
    const superdoc = editorInstanceRef.current;
    if (!superdoc || (selectedItemIds.size === 0 && manualEntries.length === 0)) return;

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
            <w:tc><w:p><w:r><w:t>${item.item_name}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${item.unit || ''}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${qty}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>₱${(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
          </w:tr>
        `;
      });

      // Add Manual Entries
      manualEntries.forEach(entry => {
        const total = entry.quantity * entry.price;
        grandTotal += total;

        tableRows += `
          <w:tr>
            <w:tc><w:p><w:r><w:t>${entry.description}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${entry.unit || ''}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${entry.quantity}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>₱${entry.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
          </w:tr>
        `;
      });

      // Total Row
      tableRows += `
        <w:tr>
          <w:tc><w:tcPr><w:gridSpan w:val="4"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Total Estimated Expenses</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</w:t></w:r></w:p></w:tc>
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
        newXml = documentXml.replace(priceTableRegex, ooxmlTable);
      } else {
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
      item.item_name?.toLowerCase().includes(lowerQuery) ||
      item.category?.toLowerCase().includes(lowerQuery)
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
          {!readOnly && (documentType === DocumentType.ACTIVITY_PROPOSAL || documentType === DocumentType.OFFICIAL_LETTER || documentType === DocumentType.CONSTITUTION) && (
            <>
              <button
                onClick={() => setIsPriceListOpen(true)}
                className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition flex items-center gap-2 text-sm font-medium"
              >
                <Database className="w-4 h-4" /> <span>Show Price List</span>
              </button>

              <select
                value={templateIndex}
                onChange={(e) => onTemplateChange && onTemplateChange(Number(e.target.value))}
                className="p-1 px-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
                title="Select Document Template"
              >
                <option value={0}>No Template</option>
                <option value={1}>Template 1</option>
                <option value={2}>Template 2</option>
              </select>

              <span className="text-[11px] text-gray-400 dark:text-gray-500 italic ml-2">
                Please make sure to save draft before trying out other features
              </span>
            </>
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
        <style>
          {`
            .superdoc-toolbar-container {
              position: sticky;
              top: 0;
              z-index: 30;
              background: #D1D5DB;
            }

            .superdoc-document-editor, 
            .superdoc-document-editor * {
              font-family: Arial, sans-serif !important;
              font-size: 12pt !important;
            }
          `}
        </style>
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

            {/* Search Bar & Add Button */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:text-white"
                    autoFocus
                  />
                </div>
                {priceListStep === 1 && (
                  <button
                    onClick={() => setIsAddingManual(!isAddingManual)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isAddingManual ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {isAddingManual ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{isAddingManual ? 'Cancel' : 'New Item'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Manual Entry Form */}
            {isAddingManual && priceListStep === 1 && (
              <div className="px-6 py-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-top duration-200">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Particulars</label>
                    <input
                      type="text"
                      placeholder="e.g. Custom Office Chair"
                      value={newManualItem.description}
                      onChange={(e) => setNewManualItem({ ...newManualItem, description: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-gray-700 border border-indigo-100 dark:border-indigo-800 rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Unit</label>
                    <input
                      type="text"
                      placeholder="e.g. piece"
                      value={newManualItem.unit}
                      onChange={(e) => setNewManualItem({ ...newManualItem, unit: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-gray-700 border border-indigo-100 dark:border-indigo-800 rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={newManualItem.quantity}
                      onChange={(e) => setNewManualItem({ ...newManualItem, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 bg-white dark:bg-gray-700 border border-indigo-100 dark:border-indigo-800 rounded-lg text-sm text-center"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Unit Cost</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={newManualItem.price || ''}
                      onChange={(e) => setNewManualItem({ ...newManualItem, price: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white dark:bg-gray-700 border border-indigo-100 dark:border-indigo-800 rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <button
                      onClick={handleAddManualItem}
                      className="w-full p-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center"
                      title="Add Item"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items List - Table Layout */}
            <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              {isLoadingPriceItems ? (
                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
                  <Loader className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                  <p className="text-gray-500 font-medium italic">Loading price list...</p>
                </div>
              ) : priceListStep === 1 ? (
                /* STEP 1: SELECT ITEMS */
                <div className="space-y-4">
                  {/* Manual Entries List in Selection Step */}
                  {manualEntries.length > 0 && (
                    <div className="border border-indigo-100 dark:border-indigo-900/30 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-4 py-2 bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/30 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Manual Entries (Session Only)</span>
                      </div>
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                        <tbody className="bg-white dark:bg-gray-800">
                          {manualEntries.map((entry, idx) => (
                            <tr key={`manual-${idx}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={entry.description}
                                  onChange={(e) => updateManualEntry(idx, 'description', e.target.value)}
                                  className="w-full p-1.5 text-sm bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 outline-none dark:text-white"
                                />
                              </td>
                              <td className="px-2 py-2 w-20">
                                <input
                                  type="text"
                                  value={entry.unit}
                                  onChange={(e) => updateManualEntry(idx, 'unit', e.target.value)}
                                  className="w-full p-1.5 text-xs text-center bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 outline-none uppercase text-gray-500 dark:text-gray-400"
                                />
                              </td>
                              <td className="px-2 py-2 w-20">
                                <input
                                  type="number"
                                  value={entry.quantity}
                                  onChange={(e) => updateManualEntry(idx, 'quantity', parseInt(e.target.value) || 0)}
                                  className="w-full p-1.5 text-sm text-center bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 outline-none font-bold"
                                />
                              </td>
                              <td className="px-2 py-2 w-32">
                                <input
                                  type="number"
                                  value={entry.price}
                                  onChange={(e) => updateManualEntry(idx, 'price', parseFloat(e.target.value) || 0)}
                                  className="w-full p-1.5 text-sm text-right bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 outline-none font-bold text-indigo-600 dark:text-indigo-400"
                                />
                              </td>
                              <td className="px-2 py-2 w-10 text-right">
                                <button
                                  onClick={() => removeManualEntry(idx)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredItems.length > 0 ? (
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
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{item.item_name}</span>
                                  {item.category && (
                                    <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                      <Tag className="w-2.5 h-2.5" /> {item.category}
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
                  )}
                </div>
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
                            <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-xs">{item.item_name}</td>
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
                            ₱{(
                              priceListItems
                                .filter(item => selectedItemIds.has(item.id))
                                .reduce((sum, item) => sum + ((itemQuantities[item.id] || 0) * (item.price || 0)), 0) +
                              manualEntries.reduce((sum, entry) => sum + (entry.quantity * entry.price), 0)
                            ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                    disabled={(selectedItemIds.size > 0 && Object.values(itemQuantities).every(q => (q as number) <= 0)) && manualEntries.length === 0}
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