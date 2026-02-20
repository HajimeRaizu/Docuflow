import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
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

    // Helper to get AI Configuration from LocalStorage
    private getAISettings() {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('nemsu_ai_settings');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error("Failed to parse AI settings", e);
                }
            }
        }
        return { tone: 'Formal', length: 'Standard' };
    }

    private async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            if (retries > 0 && (error?.status === 429 || error?.message?.includes('429'))) {
                console.warn(`Gemini API rate limited (429). Retrying in ${delay}ms... (${retries} attempts left)`);
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

    public async generateDocument(
        type: DocumentType,
        formData: Record<string, any>,
        userDepartment?: string
    ): Promise<string> {
        const ai = this.getAI();
        const aiSettings = this.getAISettings();

        const systemInstruction = `You are an expert academic administrator. Output HTML only. Ensure tables have visible borders (1px solid black) where appropriate.

        CRITICAL INSTRUCTION:
        1. Review the REFERENCE MATERIAL (if any provided in the prompt). 
        2. Identify the document from the reference that is most relevant to the user request.
        3. Use the content and structure of that selected document as your primary guide/template.

        STRUCTURAL MANDATES:
        - **Signatories**: If the document is an "Activity Proposal" or similar, you MUST append a "Signatories" section at the bottom.
          - Format this as a **2-column or 3-column HTML Table** with \`border: none\` to ensure proper alignment.
          - **Left Align**: "Prepared by" (Proponent)
          - **Center/Right Align**: "Noted by" (Adviser, Chair), "Recommending Approval" (Dean), "Approved" (Campus Director/Chancellor).
          - Do NOT list them in a single vertical column; mimic the wide layout of official documents.
        `;

        let searchContext = "";
        // TWO-STEP RAG: Step 1 - Analyze intent to get an optimized search query
        try {
            const analysisPrompt = `Analyze this document request and provide a single, keyword-rich search query to find relevant reference materials in a database.
            Document Type: ${type}
            Details: ${JSON.stringify(formData)}
            
            Output ONLY the search query string. No other text.`;

            const analysisResult = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
            });
            // @ts-ignore
            searchContext = analysisResult.text?.trim() || analysisResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            console.log("Extracted Search Query:", searchContext);
        } catch (e) {
            console.warn("Failed to extract search context, falling back to basic metadata.", e);
            searchContext = `${type} ${formData.title || formData.subject || ''}`;
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
                searchContext = `Official Letter regarding ${formData.subject || 'General Topic'}`;
                prompt = `Write the BODY of a formal official letter.
                DO NOT include the University Header, Logo, or Address at the top.
                
                From: ${formData.senderName} (${formData.senderPosition})
                To: ${formData.recipientName}
                Subject: ${formData.subject}
                Details: ${formData.details}
                
                Return pure HTML. Start with the Date, then the Recipient Block, then the Salutation. Use <p> for paragraphs and <br> for spacing.`;
                break;
            default:
                searchContext = `${type} document details`;
                prompt = `Generate the body content for a document of type ${type} with details: ${JSON.stringify(formData)}. Return in HTML format. Do not include letterhead/logos.`;
        }

        let referenceMaterial = "";
        if (userDepartment) {
            const similarDatasets = await this.searchSimilarDatasets(userDepartment, searchContext, type);

            if (similarDatasets && similarDatasets.length > 0) {
                referenceMaterial = similarDatasets.map((d: any) => `
                --- REFERENCE DOCUMENT ---
                CONTEXT: ${d.detailed_context || 'No specific context'}
                CONTENT:
                ${d.file_content || d.content || ''}
                --------------------------
                `).join('\n\n');
            } else {
                const { data: tmplData } = await supabase
                    .from('department_templates')
                    .select('content')
                    .eq('department', userDepartment)
                    .eq('document_type', type)
                    .limit(1);
                if (tmplData && tmplData.length > 0) {
                    referenceMaterial = tmplData[0].content;
                }
            }
        }

        const fullPrompt = `
        ${prompt}

        ${styleInstruction}

        REFERENCE MATERIAL:
        ${referenceMaterial || "No specific reference material found. Use standard templates."}
        `;

        return this.withRetry(async () => {
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: [{
                        role: "user",
                        parts: [{ text: fullPrompt }]
                    }],
                    config: {
                        systemInstruction: systemInstruction,
                    }
                });

                // @ts-ignore
                return response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } catch (error) {
                console.error("AI Generation Error Detailed:", error);
                throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }

    public async generateDatasetContext(content: string): Promise<string> {
        return this.withRetry(async () => {
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
                    model: "gemini-3-flash-preview",
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }]
                });
                // @ts-ignore
                return response.text || "";
            } catch (error) {
                console.error("Context Generation Error:", error);
                return "Auto-generated context failed. Content snippet: " + content.substring(0, 100) + "...";
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

export class LiveSession {
    public isConnected = false;
    public inputAnalyser: AnalyserNode | null = null;
    public outputAnalyser: AnalyserNode | null = null;
    private audioContext: AudioContext | null = null;
    private chatSession: any = null;
    private recognition: any = null;
    private onDocumentGenerated: (html: string) => void;
    private department?: string;
    private documentType?: DocumentType;

    constructor(onDocumentGenerated: (html: string) => void, department?: string, documentType?: DocumentType) {
        this.onDocumentGenerated = onDocumentGenerated;
        this.department = department;
        this.documentType = documentType;
    }

    async connect() {
        if (this.isConnected) return;

        try {
            // 1. Setup Audio Context for Visualizer
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.inputAnalyser = this.audioContext.createAnalyser();
            this.outputAnalyser = this.audioContext.createAnalyser();

            // Setup mic input for visualizer
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.inputAnalyser);

            // 2. Initialize Gemini Chat Session using the working pattern
            // @ts-ignore
            this.chatSession = geminiService['getAI']().chats.create({
                model: "gemini-3-flash-preview",
                config: {
                    systemInstruction: "You are the Voice Agent for Docuflow. You help users generate academic documents. " +
                        "When a user provides details for a document, first acknowledge their request. " +
                        "Then, create the document in HTML format. " +
                        "Identify yourself as Gemini Pulse."
                }
            });

            this.isConnected = true;
            console.log("Voice Agent connected.");

            // 3. Setup Speech Recognition
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = true;
                this.recognition.interimResults = false;
                this.recognition.lang = 'en-US';

                this.recognition.onresult = (event: any) => {
                    const transcript = event.results[event.results.length - 1][0].transcript;
                    console.log("Voice Input:", transcript);
                    this.sendMessage(transcript);
                };

                this.recognition.onerror = (event: any) => {
                    console.error("Speech Recognition Error:", event.error);
                };

                this.recognition.start();
            } else {
                console.warn("Speech Recognition not supported in this browser.");
            }
        } catch (e) {
            console.error("LiveSession connection failed:", e);
            throw e;
        }
    }

    async sendMessage(message: string): Promise<string> {
        if (!this.chatSession) throw new Error("Session not connected.");

        try {
            // TWO-STEP RAG for Chat: Detect if the user wants to generate/edit a document
            if (this.department && this.documentType &&
                (message.toLowerCase().includes('generate') || message.toLowerCase().includes('make') || message.toLowerCase().includes('create'))) {

                console.log("RAG Triggered in Voice Session. Searching for context...");
                const searchResults = await geminiService.searchSimilarDatasets(this.department, message, this.documentType);

                if (searchResults && searchResults.length > 0) {
                    const refContent = searchResults.map((d: any) => d.file_content || d.content).join("\n\n");
                    // Inject context as a system-like message or hint
                    // @ts-ignore
                    await this.chatSession.sendMessage(`SYSTEM NOTE: The following reference documents were found in the database. Use their structure and style as a guide if the user asks to generate a document: \n\n${refContent}`);
                }
            }

            const result = await this.chatSession.sendMessage(message);
            // @ts-ignore
            const text = result.response?.text?.() || result.text || "";

            // If the response contains HTML that looks like a document, trigger the callback
            if (text.includes('<div') || text.includes('<table')) {
                this.onDocumentGenerated(text);
            }

            return text;
        } catch (e) {
            console.error("Error in chat session:", e);
            throw e;
        }
    }

    disconnect() {
        this.isConnected = false;
        if (this.audioContext) {
            this.audioContext.close();
        }
        if (this.recognition) {
            this.recognition.stop();
        }
        this.chatSession = null;
    }
}
