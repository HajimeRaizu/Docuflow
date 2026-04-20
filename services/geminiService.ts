import { GoogleGenAI, GenerateContentResponse, Chat, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { DocumentType } from "../types";
import { supabase } from "./supabaseClient";

class GeminiService {
    private ai: GoogleGenAI | null = null;
    private apiKey: string = '';

    constructor() {
        this.apiKey = this.getApiKey();
        if (this.apiKey) {
            this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        }
    }

    private getApiKey(): string {
        let key = '';
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            if (import.meta.env.VITE_GEMINI_API_KEY) key = import.meta.env.VITE_GEMINI_API_KEY;
            // @ts-ignore
            else if (import.meta.env.GEMINI_API_KEY) key = import.meta.env.GEMINI_API_KEY;
        }

        if (!key) {
            console.error("Gemini API Key is missing! Please set VITE_GEMINI_API_KEY in .env");
        }
        return key;
    }

    private getAI(): GoogleGenAI {
        if (!this.ai) {
            this.apiKey = this.getApiKey();
            if (!this.apiKey) throw new Error("API Key missing.");
            this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        }
        return this.ai;
    }

    // Defaults for AI generation
    private readonly defaultSettings = { tone: 'Formal', length: 'Standard' };


    private async withRetry<T>(fn: (isFallback?: boolean) => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await fn(false);
        } catch (error: any) {
            const is503 = error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('Service Unavailable');
            const is429 = error?.status === 429 || error?.message?.includes('429');
            const isHighDemand = error?.message?.includes('high demand') || error?.message?.includes('overloaded');

            if (retries > 0 && (is429 || is503 || isHighDemand)) {
                if (is503 || isHighDemand) {
                    console.warn(`Gemini API unavailable or high demand. Trying fallback model 'gemini-3-flash-preview'...`);
                    try {
                        return await fn(true);
                    } catch (fallbackError) {
                        console.error("Fallback model also failed:", fallbackError);
                    }
                }

                console.warn(`Gemini API error (Status: ${error?.status}). Retrying in ${delay}ms... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    public async generateEmbedding(text: string): Promise<number[]> {
        return this.withRetry(async () => {
            const ai = this.getAI();
            const result = await ai.models.embedContent({
                model: "gemini-embedding-001", // Reverting to a more standard embedding model
                contents: [{
                    parts: [{ text: text }]
                }],
            });

            // The new SDK (v1.x) might return result.embeddings[0] or result.embedding
            // @ts-ignore
            const embedding = result.embedding || (result.embeddings && result.embeddings[0]);

            if (!embedding || !embedding.values) {
                console.error("Unexpected Embedding Result Structure:", JSON.stringify(result));
                throw new Error("Failed to extract embedding values from response.");
            }

            return embedding.values;
        });
    }

    public async searchSimilarDatasets(
        department: string,
        query: string,
        documentType: DocumentType,
        limit = 3
    ) {
        try {
            const embedding = await this.generateEmbedding(query);

            const { data, error } = await supabase.rpc('match_datasets', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: limit,
                filter_department: department,
                filter_type: documentType
            });

            if (error) {
                console.error("Vector Search Error:", error);
                const { data: fallbackData } = await supabase
                    .from('department_datasets')
                    .select('file_content, detailed_context')
                    .eq('department', department)
                    .eq('document_type', documentType)
                    .limit(limit);

                return fallbackData?.map(d => ({
                    ...d,
                    content: d.file_content
                })) || [];
            }

            return data;
        } catch (err) {
            console.error("Search Error:", err);
            return [];
        }
    }

    private convertHtmlToOOXML(htmlContent: string): string {
        // Map HTML tags to OOXML
        let ooxml = htmlContent;

        // Replace HTML paragraphs with OOXML paragraphs
        ooxml = ooxml.replace(/<p(?:\s[^>]*)?>/gi, '<w:p><w:r><w:t>');
        ooxml = ooxml.replace(/<\/p>/gi, '</w:t></w:r></w:p>');

        // Replace HTML bold/strong with OOXML bold
        ooxml = ooxml.replace(/<(?:strong|b)(?:\s[^>]*)?>/gi, '<w:r><w:rPr><w:b/></w:rPr><w:t>');
        ooxml = ooxml.replace(/<\/(?:strong|b)>/gi, '</w:t></w:r>');

        // Replace HTML italics/em with OOXML italics
        ooxml = ooxml.replace(/<(?:em|i)(?:\s[^>]*)?>/gi, '<w:r><w:rPr><w:i/></w:rPr><w:t>');
        ooxml = ooxml.replace(/<\/(?:em|i)>/gi, '</w:t></w:r>');

        // Replace HTML unordered lists
        ooxml = ooxml.replace(/<ul(?:\s[^>]*)?>/gi, '');
        ooxml = ooxml.replace(/<\/ul>/gi, '');
        ooxml = ooxml.replace(/<li(?:\s[^>]*)?>/gi, '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>• </w:t></w:r><w:r><w:t>');
        ooxml = ooxml.replace(/<\/li>/gi, '</w:t></w:r></w:p>');

        // Replace HTML ordered lists
        let listCounter = 1;
        ooxml = ooxml.replace(/<ol(?:\s[^>]*)?>/gi, () => {
            listCounter = 1;
            return '';
        });
        ooxml = ooxml.replace(/<\/ol>/gi, '');
        ooxml = ooxml.replace(/<li(?:\s[^>]*)?>/gi, () => {
            const currentNum = listCounter++;
            return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>${currentNum}. </w:t></w:r><w:r><w:t>`;
        });

        // Add Arial font styling to all text runs
        ooxml = ooxml.replace(/<w:r>/gi, '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/></w:rPr>');

        // Handle line breaks
        ooxml = ooxml.replace(/<br\s*\/?>/gi, '</w:t></w:r></w:p><w:p><w:r><w:t>');

        // Clean up empty runs
        ooxml = ooxml.replace(/<w:r><w:rPr>[^<]*<\/w:rPr><w:t><\/w:t><\/w:r>/g, '');

        // Ensure proper spacing between paragraphs
        ooxml = ooxml.replace(/<\/w:p>\s*<w:p>/g, '</w:p><w:p>');

        return ooxml;
    }

    public async generateDocument(
        type: DocumentType,
        formData: Record<string, any>,
        userDepartment?: string
    ): Promise<{ content: string; referenceMaterial: string }> {
        const ai = this.getAI();
        const aiSettings = this.defaultSettings;



        const systemInstruction = `You are an expert academic administrator. Output Office Open XML (OOXML) format only, representing the inner content of a <w:body> tag for a Word document.

        CRITICAL INSTRUCTION:
        1. Output ONLY valid WordprocessingML (OOXML) elements (e.g., <w:p>, <w:tbl>, <w:r>, <w:t>, etc.).
        2. DO NOT include the <w:document> or root <w:body> wrapper tags, output only the inner child elements.
        3. DO NOT output HTML or Markdown. DO NOT wrap the output in any markdown code blocks (like \`\`\`xml).
        4. Review the REFERENCE MATERIAL (if any provided in the prompt). 
        5. Identify the document from the reference that is most relevant to the user request.
        6. STRICTLY CLONE the structure, headers, and formatting of that selected document. This is your MANDATORY template.

        STRUCTURAL MANDATES:
        - **Font Styling**: You MUST use Arial 12 for ALL text.
          - Apply this using <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/></w:rPr> within text runs.
        - **Headers**: Section headers (e.g., "OBJECTIVES", "DESCRIPTION OF THE ACTIVITY"). Use bold text in a standard paragraph and MUST NOT be bulleted or numbered or lettered (<w:rPr><w:b/></w:rPr>).
        - **Numbering**: For numbered or lettered lists beneath a header (e.g., specific objectives), ALWAYS ensure the numbering or lettering resets to 1 or A for each new section/heading. Do NOT continue numbering from a previous list.
        - **Signatories**: ${type === DocumentType.CONSTITUTION ? "DO NOT APPEND a signatories section for Constitution & By-Laws." : `You MUST append a "Signatories" section at the bottom.
          - Use the "signatories" array from the formData if provided. Each signatory has a 'name' and 'position'.
          - DO NOT USE TABLES (<w:tbl>) for signatories.
          - Format them as simple, left-aligned paragraphs (<w:p>).
          - For each signatory, output the name on one line and the position on the line immediately below it.
          - Add a blank line (<w:p><w:r><w:t/></w:r></w:p>) between different signatories.`}

        - **Budget Table**: When creating a table for budgetary requirements:
          - The text for the overall total MUST be "Total Estimated Expenses" (do NOT use "GRAND TOTAL", "Grand Total", etc.).
          - The "Total Estimated Expenses" label MUST NOT be right-aligned. Keep it left-aligned or default (do NOT use <w:jc w:val="right"/> for this specific label).
        - 
        `;

        let searchContext = "";
        // TWO-STEP RAG: Step 1 - Analyze intent to get an optimized search query
        try {
            const analysisPrompt = `Analyze this document request and provide a single, keyword-rich search query to find relevant reference materials in a database.
            Document Type: ${type}
            Details: ${JSON.stringify(formData)}
            
            Output ONLY the search query string. No other text.`;

            const analysisResult = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
            });
            // @ts-ignore
            searchContext = analysisResult.text?.trim() || analysisResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        } catch (e) {
            console.warn("Failed to extract search context, falling back to basic metadata.", e);
            searchContext = `${type} ${formData.title || formData.subject || formData.detailedInstructions || ''}`;
        }

        let prompt = "";
        const styleInstruction = `
        STYLE & TONE INSTRUCTIONS:
        - **Tone**: ${aiSettings.tone} (Ensure the language reflects this tone).
        - **Length/Verbosity**: ${aiSettings.length} (Adjust paragraph length and detail accordingly).
        `;

        switch (type) {
            case DocumentType.ACTIVITY_PROPOSAL:
                searchContext = `Activity Proposal for ${formData.title || 'General Event'}`;
                prompt = `
                Please generate an ACTIVITY PROPOSAL using the provided details:
                ${JSON.stringify(formData, null, 2)}

                IMPORTANT:
                - Look at the REFERENCE MATERIAL provided below.
                - If you find an "Activity Proposal" or similar document there, CLONE its structure, headers, and style exactly.
                - If no reference is found, use a standard professional format.
                - FILL in the content with the formData variables.
                `;
                break;
            case DocumentType.OFFICIAL_LETTER:
                searchContext = `Official Letter regarding ${formData.details.substring(0, 50)}`;
                prompt = `Write the BODY of a formal official letter.
                DO NOT include the University Header, Logo, or Address at the top.
                
                Date to use: ${formData.date || 'Current Date'}
                From: ${formData.senderName} (${formData.senderPosition})
                To: ${formData.recipientName}
                Recipient Position: ${formData.recipientPosition}
                Recipient Institution: ${formData.recipientInstitution}
                Recipient Address: ${formData.recipientAddress}
                ${formData.showThru && formData.thruPerson ? `Thru: ${formData.thruPerson} (${formData.thruPosition})` : ''}
                
                ${formData.showSubject ? 'You MUST generate a professional SUBJECT line based on the details provided.' : 'DO NOT include a SUBJECT line.'}
                
                Details: ${formData.details}
                Signatories: ${JSON.stringify(formData.signatories)}
                
                STRICT FORMATTING RULES FOR OFFICIAL LETTER:
                1. DO NOT use any indentations (<w:ind>) for paragraphs. Every line must be left-aligned.
                2. Start with the Date.
                3. Follow with the Recipient Block (Name, Position, Institution, Address).
                4. Follow with the Thru block (if provided and showThru is true).
                5. Follow with the Subject line (if showSubject is true, prefixed with "SUBJECT: ").
                6. Follow with the Salutation (e.g., "Dear Sir/Madam:").
                7. End with the Signatories section as defined in basic instructions.

                
                Return pure OOXML format. Use proper <w:p> for paragraphs.`;
                break;

            case DocumentType.CONSTITUTION:
                searchContext = `Constitution and By-Laws for ${userDepartment || 'Organization'}`;
                prompt = `You are tasked with drafting or updating a CONSTITUTION & BY-LAWS document.
                
                IMPORTANT:
                - Look at the REFERENCE MATERIAL provided below (especially the UPLOADED TEMPLATE).
                - Use the UPLOADED TEMPLATE as the primary structural, stylistic, and formatting guide.
                - Incorporate context and content from the SIMILAR DATABASE DOCUMENTS in the REFERENCE MATERIAL if they are relevant to the user request.
                - User Instructions: ${formData.detailedInstructions || 'Prepare the document based on the template and any relevant references.'}
                - Ensure all articles, sections, and provisions align with the university's standards as seen in the references.
                - The UPLOADED TEMPLATE contains the standard preamble and general structure; ensure your generation respects this hierarchy.
                `;
                break;
            default:
                searchContext = `${type} document details`;
                prompt = `Generate the body content for a document of type ${type} with details: ${JSON.stringify(formData)}. Return in pure OOXML format. Do not include letterhead/logos.`;
        }

        let referenceMaterial = "";
        if (userDepartment) {
            // 1. Fetch Similar Datasets
            const similarDatasets = await this.searchSimilarDatasets(userDepartment, searchContext, type);
            if (similarDatasets && similarDatasets.length > 0) {
                referenceMaterial += similarDatasets.map((d: any) => `
                --- SIMILAR DATABASE DOCUMENT ---
                CONTEXT: ${d.detailed_context || 'No specific context'}
                CONTENT:
                ${d.file_content || d.content || ''}
                --------------------------
                `).join('\n\n');
            }

            // 2. Fetch Blank Template Content (always include as base structural reference)
            const { data: tmplData } = await supabase
                .from('department_templates')
                .select('content')
                .eq('department', userDepartment)
                .eq('document_type', type)
                .limit(1);

            if (tmplData && tmplData.length > 0 && tmplData[0].content) {
                let templateContent = tmplData[0].content;

                // Detect if the content is HTML (has <p> but no <w:p>)
                const isHtml = templateContent.includes('<p>') && !templateContent.includes('<w:p>');
                const isOoxml = templateContent.includes('<w:p>');

                if (isHtml && !isOoxml) {
                    console.log(`Converting HTML template to OOXML for ${type}`);
                    templateContent = this.convertHtmlToOOXML(templateContent);
                }

                referenceMaterial += `
    --- UPLOADED TEMPLATE ---
    CONTENT:
    ${templateContent}
    --------------------------
    `;
            }

            console.log(referenceMaterial);
        }

        const fullPrompt = `
        ${prompt}

        ${styleInstruction}

        REFERENCE MATERIAL:
        ${referenceMaterial || "No specific reference material found. Use standard templates."}
        `;

        return this.withRetry(async (isFallback) => {
            const modelName = isFallback ? "gemini-3-flash-preview" : "gemini-2.5-flash";
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [{
                        role: "user",
                        parts: [{ text: fullPrompt }]
                    }],
                    config: {
                        systemInstruction: systemInstruction,
                    }
                });

                // @ts-ignore
                const generatedText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || "";

                // Clean and enforce rules on the generated text
                const cleanedText = this.enforceOOXMLRules(generatedText, type);

                console.log(cleanedText);
                return {
                    content: cleanedText,
                    referenceMaterial: referenceMaterial || ""
                };
            } catch (error) {
                console.error(`AI Generation Error (${modelName}):`, error);
                throw error;
            }
        });
    }

    private enforceOOXMLRules(content: string, type?: DocumentType): string {

        if (!content) return content;

        // 1 & 3: Strip markdown blocks and HTML wrappers
        let cleaned = content.replace(/^```(xml)?/mi, '').replace(/```$/m, '').trim();

        // 2: Strip outer <w:document> / <w:body> wrappers if the AI included them
        const bodyMatch = cleaned.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
        if (bodyMatch) {
            cleaned = bodyMatch[1].trim();
        } else {
            cleaned = cleaned.replace(/<\/?w:document[^>]*>/g, '').trim();
        }

        // 4 & NEW: Enforce headers to not be bulleted/numbered, reset numbering after headers, and justify text
        let currentGlobalNumId = 1000;
        let numIdMap = new Map<string, number>();

        cleaned = cleaned.replace(/<w:p(?:\s[^>]*>|>)[\s\S]*?<\/w:p>/g, (pMatch) => {
            const textMatch = pMatch.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
            const textContent = textMatch ? textMatch.map(t => t.replace(/<[^>]*>/g, '')).join('').trim() : '';

            const isAllUppercase = textContent && textContent === textContent.toUpperCase() && textContent.length > 3 && textContent.length < 100;
            const isKnownHeader = ["OBJECTIVES", "DESCRIPTION", "RATIONALE", "BUDGET", "SIGNATORIES", "ARTICLE", "SECTION"].some(h => textContent.toUpperCase().includes(h));
            const isHeader = isAllUppercase || isKnownHeader;

            if (isHeader) {
                // Clear the numId tracking so the next list gets new IDs (restarting at 1)
                numIdMap.clear();

                // Remove numbering from headers
                if (pMatch.includes('<w:numPr>')) {
                    pMatch = pMatch.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/g, '');
                }

                // Remove any accidental right/both alignment on headers (ensure left/standard)
                if (pMatch.includes('<w:jc')) {
                    pMatch = pMatch.replace(/<w:jc\s+w:val="[^"]*"[^>]*\/>/g, '<w:jc w:val="left"/>');
                }

                return pMatch;
            }

            // For non-headers:

            // Apply text justification (w:val="both")
            if (!pMatch.includes('<w:jc') && pMatch.includes('<w:pPr>')) {
                // Inject justification into existing pPr
                pMatch = pMatch.replace(/<w:pPr>/, '<w:pPr><w:jc w:val="both"/>');
            } else if (pMatch.includes('<w:jc')) {
                // Change existing justification to both (unless it's explicitly centered/right for something else, but user asked for justified texts)
                // Let's replace left/right with both, keep center if intended (often used for titles, though titles are headers)
                if (!pMatch.includes('w:val="center"')) {
                    pMatch = pMatch.replace(/<w:jc\s+w:val="[^"]*"([^>]*)>/g, '<w:jc w:val="both"$1>');
                }
            } else {
                // No pPr exists, inject it
                pMatch = pMatch.replace(/<w:p([^>]*)>/, '<w:p$1><w:pPr><w:jc w:val="both"/></w:pPr>');
            }

            // Remap list numbering so it restarts after a header
            if (pMatch.includes('<w:numPr>')) {
                pMatch = pMatch.replace(/<w:numId\s+w:val="(\d+)"([^>]*)>/g, (match, val, rest) => {
                    if (!numIdMap.has(val)) {
                        numIdMap.set(val, currentGlobalNumId++);
                    }
                    return `<w:numId w:val="${numIdMap.get(val)}"${rest}>`;
                });
            }

            return pMatch;
        });

        // 6. Remove indentations for Official Letter if detected
        if (type === DocumentType.OFFICIAL_LETTER) {
            cleaned = cleaned.replace(/<w:ind[^>]*\/>/g, '');
        }

        return cleaned;
    }



    public async generateDatasetContext(content: string): Promise<string> {
        return this.withRetry(async (isFallback) => {
            const modelName = isFallback ? "gemini-3-flash-preview" : "gemini-2.5-flash";
            const ai = this.getAI();
            const prompt = `
            Analyze the following document content and provide a detailed, keyword-rich description suitable for Retrieval Augmented Generation (RAG).
            
            Focus on:
            1. Document Type (e.g., Activity Proposal, Constitution)
            2. Main Subject/Title
            3. Key Entities (Signatories, Departments)
            4. Purpose of the document
            
            Keep it concise but comprehensive (max 1 paragraph).
            
            DOCUMENT CONTENT (Truncated):
            ${content.substring(0, 15000)} 
            `;

            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }]
                });
                // @ts-ignore
                return response.text || "";
            } catch (error) {
                console.error(`Context Generation Error (${modelName}):`, error);
                throw error;
            }
        });
    }

    public async generateDocumentTitle(content: string, type: DocumentType): Promise<string> {
        return this.withRetry(async (isFallback) => {
            const modelName = isFallback ? "gemini-3-flash-preview" : "gemini-2.5-flash";
            const ai = this.getAI();
            const prompt = `
            Analyze the following document content and provide a very concise, professional title (max 6-8 words).
            Document Type: ${type}
            
            Output ONLY the title string. No other text, quotes, or formatting.
            
            CONTENT SNIPPET:
            ${content.substring(0, 5000)}
            `;

            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }]
                });
                // @ts-ignore
                return response.text?.trim() || (response.candidates?.[0]?.content?.parts?.[0]?.text?.trim()) || "Untitled Document";
            } catch (error) {
                console.error(`Title Generation Error (${modelName}):`, error);
                throw error;
            }
        });
    }

    public async estimateBudget(referenceMaterial: string, generatedDocument: string, budget: string): Promise<any[]> {
        // Fetch price list from database to pass to AI
        let priceListContext = "No specific price list available. Generate standard estimates and invent reasonable items.";
        try {
            const { data } = await supabase.from('price_list').select('item_name, unit, price');
            if (data && data.length > 0) {
                priceListContext = "AVAILABLE PRICE LIST ITEMS:\n" + data.map(i => `- ${i.item_name} (${i.unit}) : ₱${i.price}`).join("\n");
            }
        } catch (e) {
            console.warn("Failed to fetch price list for estimation context", e);
        }

        return this.withRetry(async (isFallback) => {
            const modelName = isFallback ? "gemini-3-flash-preview" : "gemini-2.5-flash";
            const ai = this.getAI();
            const prompt = `
            Analyze the following generated document and the reference material it was based on to create a budget estimate.
            
            The user has requested an estimated budget of roughly: ${budget}.
            Your task is to identify the logical items (materials, services, venue, food, etc.) needed to fulfill this activity.
            
            Provide a realistic estimate matching the total budget limit constraint provided above.
            
            IMPORTANT:
            Please strongly prefer using items from the following AVAILABLE PRICE LIST ITEMS if they match the logical needs of the document. Use their exact names, units, and prices. If an item is needed but not in the list, you may invent a reasonable one.
            
            ${priceListContext}

            OUTPUT FORMAT:
            You MUST output a raw JSON array of objects and NOTHING ELSE. No markdown formatting (\`\`\`json), no introductory text.
            Each object must strictly match this schema:
            {
              "item_name": "string (name of item)",
              "unit": "string (e.g. pcs, pax, set)",
              "quantity": number (integer),
              "price": number (unit price)
            }
            
            --- REFERENCE MATERIAL ---
            ${referenceMaterial.substring(0, 5000)}
            
            --- GENERATED DOCUMENT ---
            ${generatedDocument.substring(0, 5000)}
            `;

            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }]
                });

                // @ts-ignore
                let rawText = response.text?.trim() || (response.candidates?.[0]?.content?.parts?.[0]?.text?.trim()) || "[]";

                // Strip markdown blocks if the AI accidentally adds them
                rawText = rawText.replace(/^```json/mi, '').replace(/```$/m, '').trim();

                let parsed;
                try {
                    parsed = JSON.parse(rawText);
                } catch (jsonErr) {
                    console.error("Failed to parse estimate out of AI response:", rawText);
                    parsed = [];
                }

                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                console.error(`Budget Estimation Error (${modelName}):`, error);
                throw error;
            }
        });
    }
}

export const geminiService = new GeminiService();

// Export standalone functions for backward compatibility if needed, 
// using the singleton instance.
export const generateEmbedding = (text: string) => geminiService.generateEmbedding(text);
export const generateDocument = (type: DocumentType, formData: Record<string, any>, userDepartment?: string) => geminiService.generateDocument(type, formData, userDepartment);
export const generateDatasetContext = (content: string) => geminiService.generateDatasetContext(content);
export const generateDocumentTitle = (content: string, type: DocumentType) => geminiService.generateDocumentTitle(content, type);
export const estimateBudget = (referenceMaterial: string, generatedDocument: string, budget: string) => geminiService.estimateBudget(referenceMaterial, generatedDocument, budget);

const activityProposalTool: FunctionDeclaration = {
    name: 'submit_activity_proposal',
    description: 'Submits gathered details for an Activity Proposal. Call this ONLY when all necessary details have been collected.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            gatheredData: {
                type: Type.OBJECT,
                description: 'A JSON object with keys: "orgName", "title", "venue", "date", "objectives", "budget", "source", "signatories" (array of {name, position}).',
            },
        },
        required: ['gatheredData'],
    },
};

const officialLetterTool: FunctionDeclaration = {
    name: 'submit_official_letter',
    description: 'Submits gathered details for an Official Letter. Call this ONLY when all necessary details have been collected.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            gatheredData: {
                type: Type.OBJECT,
                description: 'A JSON object with keys: "senderName", "senderPosition", "recipientName", "recipientPosition", "recipientInstitution", "recipientAddress", "thruPerson", "thruPosition", "date", "details", "signatories" (array of {name, position}), "showSubject" (boolean), "showThru" (boolean).',
            },
        },
        required: ['gatheredData'],
    },
};



const constitutionTool: FunctionDeclaration = {
    name: 'submit_constitution',
    description: 'Submits gathered details for a Constitution & By-Laws document. Call this ONLY when all necessary details have been collected.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            gatheredData: {
                type: Type.OBJECT,
                description: 'A JSON object with keys: "detailedInstructions".',
            },
        },
        required: ['gatheredData'],
    },
};

export class LiveSession {
    public isConnected = false;
    public inputContext: AudioContext | null = null;
    public outputContext: AudioContext | null = null;
    public inputAnalyser: AnalyserNode | null = null;
    public outputAnalyser: AnalyserNode | null = null;

    private sessionPromise: Promise<any> | null = null;
    private stream: MediaStream | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private nextStartTime = 0;
    private audioSourceNodes = new Set<AudioBufferSourceNode>();
    private onDocumentGenerated: (gatheredData: Record<string, any>) => void;
    private onProcessing?: () => void;
    private department?: string;
    private documentType?: DocumentType;
    private initialData?: Record<string, any>;

    // VAD (Voice Activity Detection) State
    private isSpeaking = false;
    private silenceStart = 0;
    private readonly SILENCE_THRESHOLD_MS = 1500;
    private readonly DB_THRESHOLD = -45; // Adjust if mic is too sensitive/quiet

    // Graceful Disconnect State
    private pendingToolData: Record<string, any> | null = null;
    private finalizeTimeout: NodeJS.Timeout | null = null;

    private triggerFinalization() {
        if (this.finalizeTimeout) clearTimeout(this.finalizeTimeout);
        this.finalizeTimeout = setTimeout(() => {
            if (this.audioSourceNodes.size === 0 && this.pendingToolData) {
                const data = this.pendingToolData;
                this.pendingToolData = null;
                this.onDocumentGenerated(data);
            }
        }, 1500); // Give 1.5s grace period for trailing chunks
    }

    constructor(
        onDocumentGenerated: (gatheredData: Record<string, any>) => void,
        department?: string,
        documentType?: DocumentType,
        onProcessing?: () => void,
        initialData?: Record<string, any>
    ) {
        this.onDocumentGenerated = onDocumentGenerated;
        this.department = department;
        this.documentType = documentType;
        this.onProcessing = onProcessing;
        this.initialData = initialData;
    }

    async connect() {
        if (this.isConnected) return;

        // 1. Get User Media FIRST to ensure permission and device existence
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Voice features require a secure context (HTTPS) and microphone access.");
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            console.error("Microphone access failed:", e);
            throw new Error("Microphone not found or permission denied. Please allow microphone access.");
        }

        // Fetch Reference Material for RAG BEFORE connecting
        let referenceContent = "";
        if (this.department && this.documentType) {
            try {
                // 1. Fetch Similar Datasets
                const searchResults = await geminiService.searchSimilarDatasets(this.department, `${this.documentType} template`, this.documentType, 3);
                if (searchResults && searchResults.length > 0) {
                    referenceContent += searchResults.map((d: any) => `
--- SIMILAR DATABASE DOCUMENT ---
CONTEXT: ${d.detailed_context}
CONTENT:
${d.file_content || d.content}
--------------------------
`).join("\n\n");
                }

                // 2. Fetch Blank Template Content
                const { data: tmplData } = await supabase
                    .from('department_templates')
                    .select('content')
                    .eq('department', this.department)
                    .eq('document_type', this.documentType)
                    .limit(1);

                if (tmplData && tmplData.length > 0 && tmplData[0].content) {
                    referenceContent += `
--- UPLOADED TEMPLATE ---
CONTENT:
${tmplData[0].content}
--------------------------
`;
                }
            } catch (e) {
                console.warn("Failed to fetch RAG context for voice session:", e);
            }
        }

        // 2. Initialize AudioContexts only after permissions are granted
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

        // Input: Force 16kHz sample rate as required by Gemini Live
        this.inputContext = new AudioContextClass({ sampleRate: 16000 });
        this.outputContext = new AudioContextClass(); // Playback rate

        this.inputAnalyser = this.inputContext.createAnalyser();
        this.inputAnalyser.fftSize = 256;
        this.outputAnalyser = this.outputContext.createAnalyser();
        this.outputAnalyser.fftSize = 256;

        if (this.outputContext.state === 'suspended') {
            await this.outputContext.resume();
        }

        // Determine required fields based on document type
        let requiredFields = "the necessary details";
        let expectedKeys = "";

        if (this.documentType === DocumentType.ACTIVITY_PROPOSAL) {
            requiredFields = `
1. Name of Organization/Proponent
2. Activity Title
3. Venue 
4. Date
5. Specific Objectives
6. Estimated Budget
7. Source of Funds`;
            expectedKeys = `JSON keys to use: "orgName", "title", "venue", "date", "objectives", "budget", "source"`;
        } else if (this.documentType === DocumentType.OFFICIAL_LETTER) {
            requiredFields = `
1. From (Sender Name and Position)
2. To (Recipient Name, Position, Institution, Address)
3. Thru (Optional - Person and Position. Set showThru=true if the user wants to include this)
4. Subject (Optional - Set showSubject=true if the user wants the AI to generate a subject line)
5. Date (When the letter is being sent)
6. Key details to include in the body
7. Signatories (Names and Positions of people who will sign the letter)`;
            expectedKeys = `JSON keys to use: "senderName", "senderPosition", "recipientName", "recipientPosition", "recipientInstitution", "recipientAddress", "thruPerson", "thruPosition", "date", "details", "signatories" (array of {name, position}), "showSubject" (boolean), "showThru" (boolean)`;
        } else if (this.documentType === DocumentType.CONSTITUTION) {


            requiredFields = `
1. Detailed Instructions (What additions or specific rules should be added to the constitution?)`;
            expectedKeys = `JSON keys to use: "detailedInstructions"`;
        }

        // Select the tool based on document type
        let selectedTool = activityProposalTool; // Default
        if (this.documentType === DocumentType.OFFICIAL_LETTER) selectedTool = officialLetterTool;
        else if (this.documentType === DocumentType.CONSTITUTION) selectedTool = constitutionTool;

        // Process initial data to tell the AI what we already know
        let knownInfoStr = "No initial information provided.";
        if (this.initialData) {
            const usefulFields = Object.entries(this.initialData)
                .filter(([_, v]) => v && v.toString().trim() !== "" && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0)))
                .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
            if (usefulFields.length > 0) {
                knownInfoStr = usefulFields.join("\n");
            }
        }

        const systemInstructionText = `
## ROLE & CONVERSATIONAL GOAL
You are a professional academic assistant for the "Docuflow" system. Your goal is to guide the user through drafting a **${this.documentType}** via voice interaction.

### 1. GREETING & CONTEXT
- Greet the user professionally and acknowledge the type of document they are creating.
- Review the "INITIAL INFORMATION" below. Acknowledge what we already have so you don't ask for it again.

### 2. INFORMATION GATHERING
- You MUST collect the following **REQUIRED FIELDS**:
${requiredFields}

- ${expectedKeys}

- Ask for missing details one or two at a time. Keep it conversational and helpful.
- If the user provides a vague answer, ask for clarification to ensure high-quality document generation.

### 3. TOOL CALLING
- Once you have gathered **ALL** required details, call the **${selectedTool.name}** tool immediately.
- Tell the user: "Thank you. I have all the details now. I am generating your ${this.documentType} draft."

---

## INITIAL INFORMATION (Already known)
${knownInfoStr}

---

## DOCUMENT GENERATION RULES (For the final output)
You are an expert academic administrator. Output Office Open XML (OOXML) format only, representing the inner content of a <w:body> tag for a Word document.

### CRITICAL OUTPUT RULES:
1. Output ONLY valid WordprocessingML (OOXML) elements (e.g., <w:p>, <w:tbl>, <w:r>, <w:t>, etc.).
2. DO NOT include the <w:document> or root <w:body> wrapper tags.
3. DO NOT output HTML or Markdown. DO NOT wrap in code blocks.

### TEMPLATE VS RAG SEPARATION RULE:
You will receive "UPLOADED TEMPLATE" and "SIMILAR DATABASE DOCUMENTS".
- **TEMPLATE**: HIGHEST PRIORITY for structure, headers, tables, and layout.
- **RAG**: Use ONLY for wording ideas and context. NEVER copy structure/layout from RAG.

### STRUCTURAL MANDATES:
- **Font**: Arial 12 ONLY (<w:sz w:val="24"/>)
- **Headers**: Bold (<w:b/>), NOT numbered or bulleted.
- **Numbering**: MUST reset per section.
- **Signatories**: ${this.documentType === DocumentType.CONSTITUTION ? "DO NOT include signatories." : "Append a Signatories section using formData.signatories (one line name, line below position)."}
- **Budget**: Use label "Total Estimated Expenses" (Left-aligned).
`;

        const ai = geminiService['getAI']();

        const config = {
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    this.isConnected = true;
                },
                onmessage: this.onMessage.bind(this),
                onclose: () => {
                    this.isConnected = false;
                },
                onerror: (e: any) => {
                    this.isConnected = false;
                    console.error('WebSocket Session error', e);
                },
            },
            config: {
                generationConfig: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                },
                systemInstruction: {
                    parts: [{ text: systemInstructionText }],
                },
                tools: [{ functionDeclarations: [selectedTool] }],
            },
        };

        try {
            // @ts-ignore
            this.sessionPromise = ai.live.connect(config);
            const session = await this.sessionPromise;

            this.isConnected = true;
            this.startAudioInput();

            // TRIGGER: Send a silent audio frame to wake it up
            try {
                const silentFrame = new Float32Array(512).fill(0);
                const blob = this.createBlob(silentFrame);
                session.sendRealtimeInput({ media: blob });
            } catch (e) {
                console.warn("Failed to send wake-up frame", e);
            }
        } catch (e) {
            console.error("LiveSession WebSocket connection failed:", e);
            this.disconnect();
            throw e;
        }
    }

    private startAudioInput() {
        if (!this.inputContext || !this.stream) return;

        this.source = this.inputContext.createMediaStreamSource(this.stream);
        this.source.connect(this.inputAnalyser!);

        // ScriptProcessor is deprecated but widely supported for raw PCM access
        this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (e) => {
            if (!this.isConnected) return;
            const inputData = e.inputBuffer.getChannelData(0);

            // --- VAD (Voice Activity Detection) Logic ---
            let sumSquares = 0;
            for (let i = 0; i < inputData.length; i++) {
                sumSquares += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sumSquares / inputData.length);
            const decibels = 20 * Math.log10(rms || 0.00001);

            if (decibels > this.DB_THRESHOLD) {
                // User is currently speaking
                this.isSpeaking = true;
                this.silenceStart = 0;
            } else if (this.isSpeaking) {
                // User was speaking, now silent
                if (this.silenceStart === 0) {
                    this.silenceStart = Date.now();
                } else if (Date.now() - this.silenceStart > this.SILENCE_THRESHOLD_MS) {
                    // Silence threshold reached
                    this.isSpeaking = false;
                    this.silenceStart = 0;

                    // Fire exact turnComplete payload expected by Gemini Live API
                    if (this.sessionPromise && this.isConnected) {
                        this.sessionPromise.then((session: any) => {
                            try {
                                session.send({ clientContent: { turnComplete: true } });
                            } catch (err) { }
                        }).catch(() => { });
                    }
                }
            }
            // -------------------------------------------

            const pcmBlob = this.createBlob(inputData);

            if (this.sessionPromise && this.isConnected) {
                this.sessionPromise.then((session: any) => {
                    if (!this.isConnected) return;
                    try {
                        // Check if session and websocket are actually open
                        if (session?.ws?.readyState === 1 || (session && !session.ws)) {
                            session.sendRealtimeInput({ media: pcmBlob });
                        } else {
                            this.isConnected = false;
                        }
                    } catch (err) {
                        this.isConnected = false;
                    }
                }).catch(() => { });
            }
        };

        this.source.connect(this.processor);
        this.processor.connect(this.inputContext.destination);
    }

    private async onMessage(message: LiveServerMessage) {
        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
            this.audioSourceNodes.forEach(node => {
                try { node.stop(); } catch (e) { }
            });
            this.audioSourceNodes.clear();
            this.nextStartTime = 0;
            return;
        }

        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            await this.playAudio(audioData);
            // RESET the finalization timer because AI is still speaking/sending audio
            if (this.pendingToolData) {
                this.triggerFinalization();
            }
        }

        const toolCall = message.toolCall;
        if (toolCall) {
            for (const call of toolCall.functionCalls) {
                if (['submit_activity_proposal', 'submit_official_letter', 'submit_constitution'].includes(call.name)) {

                    // Immediate feedback to UI
                    if (this.onProcessing) this.onProcessing();

                    const gatheredData = (call.args as any).gatheredData;

                    // Respond to tool call FIRST to prevent blocking / closed socket errors
                    if (this.sessionPromise && this.isConnected) {
                        try {
                            const session = await this.sessionPromise;
                            session.sendToolResponse({
                                functionResponses: {
                                    id: call.id,
                                    name: call.name,
                                    response: { result: 'Data submitted successfully. Generating document.' }
                                }
                            });
                        } catch (e) {
                            console.warn("Could not send tool response:", e);
                        }
                    }

                    // Queue the finalization to await audio completion instead of instant UI disconnect
                    if (gatheredData) {
                        this.pendingToolData = gatheredData;
                        this.triggerFinalization();
                    } else {
                        console.warn("Tool called but gatheredData is missing.");
                    }
                }
            }
        }
    }

    private convertHtmlToOOXML(htmlContent: string): string {
        // Map HTML tags to OOXML
        let ooxml = htmlContent;

        // Replace HTML paragraphs with OOXML paragraphs
        ooxml = ooxml.replace(/<p(?:\s[^>]*)?>/gi, '<w:p><w:r><w:t>');
        ooxml = ooxml.replace(/<\/p>/gi, '</w:t></w:r></w:p>');

        // Replace HTML bold/strong with OOXML bold
        ooxml = ooxml.replace(/<(?:strong|b)(?:\s[^>]*)?>/gi, '<w:r><w:rPr><w:b/></w:rPr><w:t>');
        ooxml = ooxml.replace(/<\/(?:strong|b)>/gi, '</w:t></w:r>');

        // Replace HTML italics/em with OOXML italics
        ooxml = ooxml.replace(/<(?:em|i)(?:\s[^>]*)?>/gi, '<w:r><w:rPr><w:i/></w:rPr><w:t>');
        ooxml = ooxml.replace(/<\/(?:em|i)>/gi, '</w:t></w:r>');

        // Replace HTML unordered lists
        ooxml = ooxml.replace(/<ul(?:\s[^>]*)?>/gi, '');
        ooxml = ooxml.replace(/<\/ul>/gi, '');
        ooxml = ooxml.replace(/<li(?:\s[^>]*)?>/gi, '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>• </w:t></w:r><w:r><w:t>');
        ooxml = ooxml.replace(/<\/li>/gi, '</w:t></w:r></w:p>');

        // Replace HTML ordered lists
        let listCounter = 1;
        ooxml = ooxml.replace(/<ol(?:\s[^>]*)?>/gi, () => {
            listCounter = 1;
            return '';
        });
        ooxml = ooxml.replace(/<\/ol>/gi, '');
        ooxml = ooxml.replace(/<li(?:\s[^>]*)?>/gi, () => {
            const currentNum = listCounter++;
            return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>${currentNum}. </w:t></w:r><w:r><w:t>`;
        });

        // Add Arial font styling to all text runs
        ooxml = ooxml.replace(/<w:r>/gi, '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/></w:rPr>');

        // Handle line breaks
        ooxml = ooxml.replace(/<br\s*\/?>/gi, '</w:t></w:r></w:p><w:p><w:r><w:t>');

        // Clean up empty runs
        ooxml = ooxml.replace(/<w:r><w:rPr>[^<]*<\/w:rPr><w:t><\/w:t><\/w:r>/g, '');

        // Ensure proper spacing between paragraphs
        ooxml = ooxml.replace(/<\/w:p>\s*<w:p>/g, '</w:p><w:p>');

        return ooxml;
    }

    private createBlob(data: Float32Array) {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            const val = Math.max(-1, Math.min(1, data[i]));
            int16[i] = val * 32768;
        }

        let binary = '';
        const bytes = new Uint8Array(int16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        return {
            data: base64,
            mimeType: 'audio/pcm;rate=16000'
        };
    }

    private async playAudio(base64: string) {
        if (!this.outputContext || !this.outputAnalyser) return;

        if (this.outputContext.state === 'suspended') {
            await this.outputContext.resume();
        }

        try {
            const binaryString = atob(base64);
            const len = binaryString.length;
            let bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            if (bytes.length % 2 !== 0) {
                const newBytes = new Uint8Array(bytes.length + 1);
                newBytes.set(bytes);
                bytes = newBytes;
            }

            const dataInt16 = new Int16Array(bytes.buffer);
            // Gemini native output rate is 24000
            const buffer = this.outputContext.createBuffer(1, dataInt16.length, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < dataInt16.length; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
            }

            this.nextStartTime = Math.max(this.nextStartTime, this.outputContext.currentTime);
            const source = this.outputContext.createBufferSource();
            source.buffer = buffer;

            source.connect(this.outputAnalyser);
            this.outputAnalyser.connect(this.outputContext.destination);

            source.onended = () => {
                this.audioSourceNodes.delete(source);
                if (this.pendingToolData) {
                    this.triggerFinalization();
                }
            };
            this.audioSourceNodes.add(source);

            source.start(this.nextStartTime);
            this.nextStartTime += buffer.duration;
        } catch (e) {
            console.error("Error playing audio chunk", e);
        }
    }

    disconnect() {
        this.isConnected = false;
        if (this.finalizeTimeout) {
            clearTimeout(this.finalizeTimeout);
            this.finalizeTimeout = null;
        }

        if (this.sessionPromise) {
            this.sessionPromise.then((session: any) => {
                try {
                    session.close();
                } catch (e) {
                    console.warn("Error closing session:", e);
                }
            }).catch(() => { });
            this.sessionPromise = null;
        }

        try {
            if (this.processor) {
                this.processor.onaudioprocess = null;
                this.processor.disconnect();
            }
        } catch (e) { }
        this.source?.disconnect();
        this.stream?.getTracks().forEach(t => t.stop());

        if (this.inputContext && this.inputContext.state !== 'closed') {
            this.inputContext.close().catch(e => console.warn(e));
        }
        if (this.outputContext && this.outputContext.state !== 'closed') {
            this.outputContext.close().catch(e => console.warn(e));
        }

        this.audioSourceNodes.forEach(node => {
            try { node.stop(); } catch (e) { }
        });
        this.audioSourceNodes.clear();
    }
}
