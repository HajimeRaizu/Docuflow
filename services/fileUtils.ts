
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set worker source for PDF.js
// In Vite, this often needs to be copied to public or imported specifically.
// For simplicity in this environment, we'll try the CDN approach or standard import if configured.
// If this fails, we might need to adjust based on the build system.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const parseFile = async (file: File): Promise<string> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            return await parsePdf(file);
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileName.endsWith('.docx')
        ) {
            return await parseDocx(file);
        } else {
            // Default to text
            return await file.text();
        }
    } catch (error) {
        console.error(`Error parsing file ${file.name}:`, error);
        throw new Error(`Failed to parse file: ${(error as Error).message}`);
    }
};

const parsePdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            // @ts-ignore
            .map((item) => item.str)
            .join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText;
};

const parseDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    // We use convertToHtml to preserve tables, lists, and headings
    // This provides much better context for the AI than raw text
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value || "";
};
