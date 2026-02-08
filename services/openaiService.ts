
import OpenAI from "openai";
import { DocumentType } from "../types";
import { supabase } from "./supabaseClient";

// FALLBACK KEY FOR TESTING PURPOSES ONLY
// In production, this should be removed and strictly managed via Environment Variables.
const FALLBACK_KEY = "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";

// Robust API Key Retrieval
const getApiKey = () => {
    try {
        let key = '';
        if (typeof process !== 'undefined' && process.env) {
            if (process.env.API_KEY) key = process.env.API_KEY;
            else if (process.env.NEXT_PUBLIC_API_KEY) key = process.env.NEXT_PUBLIC_API_KEY;
            else if (process.env.REACT_APP_API_KEY) key = process.env.REACT_APP_API_KEY;
        }
        // @ts-ignore
        if (!key && typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
            // @ts-ignore
            if (import.meta.env.API_KEY) key = import.meta.env.API_KEY;
        }
        if (!key) {
            console.log("Using Fallback API Key.");
            return FALLBACK_KEY;
        }
        return key;
    } catch (e) {
        console.warn("Error reading environment variables", e);
        return FALLBACK_KEY;
    }
};


// Helper to get AI Configuration from LocalStorage
const getAISettings = () => {
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
};

/**
 * Generates document content based on type and user input via Chat Completions.
 */
export const generateDocument = async (
    type: DocumentType,
    formData: Record<string, any>
): Promise<string> => {
    const aiSettings = getAISettings();
    const model = "gpt-4o-mini"; // Standard model for text generation tasks

    let prompt = "";
    const styleInstruction = `
    STYLE & TONE INSTRUCTIONS:
    - **Tone**: ${aiSettings.tone} (Ensure the language reflects this tone).
    - **Length/Verbosity**: ${aiSettings.length} (Adjust paragraph length and detail accordingly).
  `;

    switch (type) {
        case DocumentType.ACTIVITY_PROPOSAL:
            prompt = `
            Please generate an ACTIVITY PROPOSAL using the provided details:
            ${JSON.stringify(formData, null, 2)}

            IMPORTANT:
            - Look at the REFERENCE MATERIAL provided in the system prompt.
            - If you find an "Activity Proposal" or similar document there, CLONE its structure, headers, and style exactly.
            - If no reference is found, use a standard professional format.
            - FILL in the content with the formData variables.
            `;
            break;
        case DocumentType.OFFICIAL_LETTER:
            prompt = `Write the BODY of a formal official letter.
      DO NOT include the University Header, Logo, or Address at the top.
      
      From: ${formData.senderName} (${formData.senderPosition})
      To: ${formData.recipientName}
      Subject: ${formData.subject}
      Details: ${formData.details}
      
      Return pure HTML. Start with the Date, then the Recipient Block, then the Salutation. Use <p> for paragraphs and <br> for spacing.`;
            break;
        case DocumentType.RESOLUTION:
            prompt = `Draft the BODY of a formal Resolution for ${formData.orgName}.
      DO NOT include the University Header or Logo.
      
      Resolution Number: ${formData.resNum}
      Topic: ${formData.topic}
      Whereas Clauses: ${formData.whereas}
      Resolved Clause: ${formData.resolved}
      
      Return pure HTML. Start with "Resolution No. ${formData.resNum}". Use <h3> for the Title, <p> for clauses, and <b> for "WHEREAS" and "RESOLVED" keywords.`;
            break;
        default:
            prompt = `Generate the body content for a document of type ${type} with details: ${JSON.stringify(formData)}. Return in HTML format. Do not include letterhead/logos.`;
    }

    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing. Please set API_KEY in your environment variables.");

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    // Fetch Knowledge Base
    const { data: datasetData } = await supabase.from('dataset_sections').select('content');
    const referenceMaterial = datasetData?.map(d => d.content).join('\n\n') || "";

    const systemPrompt = `You are an expert academic administrator. Output HTML only. Ensure tables have visible borders (1px solid black) where appropriate.

    CRITICAL INSTRUCTION:
    1. Review the REFERENCE MATERIAL below. 
    2. Identify the document that is most relevant to the user request (e.g., if user asks for "Field Trip", find the Field Trip form).
    3. Use the content and structure of that selected document as your primary guide/template.

    STRUCTURAL MANDATES:
    - **Signatories**: If the document is an "Activity Proposal" or similar, you MUST append a "Signatories" section at the bottom.
      - Format this as a **2-column or 3-column HTML Table** with \`border: none\` to ensure proper alignment.
      - **Left Align**: "Prepared by" (Proponent)
      - **Center/Right Align**: "Noted by" (Adviser, Chair), "Recommending Approval" (Dean), "Approved" (Campus Director/Chancellor).
      - Do NOT list them in a single vertical column; mimic the wide layout of official documents.

    REFERENCE MATERIAL:
    ${referenceMaterial}

    ${styleInstruction}`;

    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.4,
        });

        return response.choices[0]?.message?.content || "Error generating text.";
    } catch (error) {
        console.error("AI Generation Error Detailed:", error);
        throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};



// ==========================================
// LIVE API IMPLEMENTATION FOR VOICE AGENT (OpenAI Realtime API)
// ==========================================

export class LiveSession {
    public inputContext: AudioContext | null = null;
    public outputContext: AudioContext | null = null;
    public inputAnalyser: AnalyserNode | null = null;
    public outputAnalyser: AnalyserNode | null = null;
    private stream: MediaStream | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private nextStartTime = 0;
    private socket: WebSocket | null = null;
    private onDocumentGenerated: (html: string) => void;
    private isConnected = false;
    private currentToolArguments = ""; // Accumulate streaming arguments

    // Use requested model
    private MODEL_NAME = "gpt-realtime-mini-2025-12-15";

    constructor(onDocumentGenerated: (html: string) => void) {
        this.onDocumentGenerated = onDocumentGenerated;
    }

    async connect() {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error("API Key is missing for LiveSession!");
        }

        // 1. Get User Media FIRST
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Voice features require a secure context (HTTPS) and microphone access.");
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
        } catch (e) {
            console.error("Microphone access failed:", e);
            throw new Error("Microphone not found or permission denied. Please allow microphone access.");
        }

        // 2. Initialize AudioContexts
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        // OpenAI prefers 24kHz for optimal quality with Realtime API
        this.inputContext = new AudioContextClass({ sampleRate: 24000 });
        this.outputContext = new AudioContextClass({ sampleRate: 24000 });

        this.inputAnalyser = this.inputContext.createAnalyser();
        this.inputAnalyser.fftSize = 256;
        this.outputAnalyser = this.outputContext.createAnalyser();
        this.outputAnalyser.fftSize = 256;

        if (this.outputContext.state === 'suspended') {
            await this.outputContext.resume();
        }

        // 3. Connect WebSocket
        const url = `wss://api.openai.com/v1/realtime?model=${this.MODEL_NAME}`;

        // Fetch Knowledge Base for Voice Context
        let referenceMaterial = "";
        try {
            const { data: datasetData } = await supabase.from('dataset_sections').select('content');
            referenceMaterial = datasetData?.map(d => d.content).join('\n\n') || "";
        } catch (err) {
            console.error("Failed to load reference material for voice session", err);
        }

        // Use subprotocol for insecure API key passing (Note: Only for prototyping)
        this.socket = new WebSocket(url, [
            "realtime",
            `openai-insecure-api-key.${apiKey}`,
            "openai-beta.realtime-v1"
        ]);

        return new Promise<void>((resolve, reject) => {
            if (!this.socket) return reject("Socket not created");

            this.socket.onopen = () => {
                console.log("Connected to OpenAI Realtime API");
                this.isConnected = true;

                // Configure Session
                this.send({
                    type: "session.update",
                    session: {
                        modalities: ["audio", "text"],
                        instructions: `You are a friendly and enthusiastic NEMSU Activity Coordinator.
              Your goal is to interview the student to gather details for an Activity Proposal.
              
              CRITICAL: YOU MUST SPEAK FIRST.
              Immediately say: "Hello! I'm your NEMSU AI Coordinator. I'm here to help you draft your activity proposal. What is the title of your activity?"
              
              Then ask one question at a time to gather these details:
              1. Date of activity
              2. Venue
              3. Objectives (Briefly)
              4. Target Participants
              5. Estimated Budget
              
              Keep it conversational. If the user gives a short answer, encourage them politely.

              STRUCTURAL MANDATES FOR GENERATION:
              - **Signatories**: You MUST append a "Signatories" section at the bottom.
                - Format this as a **2-column or 3-column HTML Table** with \`border: none\` to ensure proper alignment.
                - **Left Align**: "Prepared by" (Proponent)
                - **Center/Right Align**: "Noted by" (Adviser, Chair), "Recommending Approval" (Dean), "Approved" (Campus Director/Chancellor).
                - Do NOT list them in a single vertical column.

              REFERENCE MATERIAL:
              ${referenceMaterial}
              
              Once you have ALL the details, say "Great! I have everything I need. I'm generating your proposal now." and IMMEDIATELY call the 'generate_proposal_document' tool with the full HTML.
              IMPORTANT: When calling the tool, ensure the 'htmlContent' argument is a valid JSON string. Escape all newlines as \\n and quotes as \\". Do not print raw newlines in the JSON string.
              `,
                        voice: "alloy", // or 'shimmer', 'echo'
                        input_audio_format: "pcm16",
                        output_audio_format: "pcm16",
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.6, // Increased threshold for noise
                            prefix_padding_ms: 300,
                            silence_duration_ms: 500, // Wait to confirm end of speech
                        },
                        tools: [{
                            type: "function",
                            name: "generate_proposal_document",
                            description: "Generates the final activity proposal document after gathering all details.",
                            parameters: {
                                type: "object",
                                properties: {
                                    htmlContent: {
                                        type: "string",
                                        description: "The full HTML content of the proposal. MUST CLONE the structure/headers of the 'Activity Proposal' found in REFERENCE MATERIAL. Includes Signatories table."
                                    }
                                },
                                required: ["htmlContent"]
                            }
                        }],
                        tool_choice: "auto",
                    }
                });

                // Start Audio Input
                this.startAudioInput();
                resolve();
            };

            this.socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.onMessage(message);
            };

            this.socket.onerror = (error) => {
                console.error("WebSocket Error:", error);
                // reject(error); // Only reject if not connected yet
                if (!this.isConnected) reject(error);
            };

            this.socket.onclose = () => {
                console.log("WebSocket Disconnected");
                this.isConnected = false;
            };
        });
    }

    private send(data: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    private startAudioInput() {
        if (!this.inputContext || !this.stream) return;

        this.source = this.inputContext.createMediaStreamSource(this.stream);
        this.source.connect(this.inputAnalyser!);

        // Use ScriptProcessor for raw PCM access
        this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (e) => {
            if (!this.isConnected) return;
            const inputData = e.inputBuffer.getChannelData(0);

            // Convert float32 to pcm16 base64
            const base64Audio = this.floatTo16BitPCM(inputData);

            this.send({
                type: "input_audio_buffer.append",
                audio: base64Audio
            });
        };

        this.source.connect(this.processor);
        this.processor.connect(this.inputContext.destination);
    }

    private onMessage(message: any) {
        switch (message.type) {
            case "response.audio.delta":
                // Play audio chunk
                if (message.delta) {
                    this.playAudio(message.delta);
                }
                break;

            case "response.function_call_arguments.delta":
                // Accumulate arguments
                if (message.delta) {
                    this.currentToolArguments += message.delta;
                }
                break;

            case "response.function_call_arguments.done":
                // Tool Call Completed
                // If arguments are present in the done event, use them as fallback or primary
                // But delta accumulation is safer for large payloads.
                // We'll pass the message but use this.currentToolArguments if populated.
                this.handleToolCall(message);
                this.currentToolArguments = ""; // Reset after handling
                break;

            case "response.output_item.done":
                // Cleanup or handle end of turn if needed
                // Sometimes used to clear buffers
                break;

            case "error":
                console.error("Realtime API Error:", message.error);
                break;
        }
    }

    private handleToolCall(message: any) {
        if (message.name === 'generate_proposal_document') {
            try {
                // Use accumulated arguments if available, otherwise use message.arguments
                // The .done event usually provides the full string, but let's be robust.
                const rawArgs = this.currentToolArguments || message.arguments;
                // console.log("Parsing Tool Args:", rawArgs); // Debug log (too verbose)

                if (!rawArgs) {
                    console.error("No arguments found for tool call");
                    return;
                }

                // Robust Parsing
                const args = this.parseRobustJSON(rawArgs);

                if (args && args.htmlContent) {
                    this.onDocumentGenerated(args.htmlContent);

                    // Acknowledge the tool call to keep the session healthy
                    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                        this.send({
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: message.call_id,
                                output: JSON.stringify({ result: "Document generated and displayed." })
                            }
                        });
                        this.send({ type: "response.create" });
                    }
                } else {
                    console.error("Missing htmlContent in tool arguments", args);
                }

            } catch (e) {
                console.error("Failed to parse tool args. Raw args:", this.currentToolArguments || message.arguments);
                console.error("Parse Error:", e);
            }
        }
    }

    private parseRobustJSON(str: string): any {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn("Standard JSON parse failed. Attempting to repair...");
            try {
                // Common LLM error: Literal newlines inside the string value.
                // We'll try to strip control characters that are likely causing issues.
                // Replace raw control characters (except standard json whitespace if outside string) is hard.
                // Simple heuristic: JSON from LLM for this tool is usually { "htmlContent": "..." }
                // We will attempt to replace literal newlines with escaped newlines strictly for the content.

                // 1. Remove "ignorable" control characters that aren't structural
                // This strips implicit newlines/tabs that might be inside the string
                const sanitized = str.replace(/[\n\r\t]/g, " ");
                return JSON.parse(sanitized);
            } catch (e2) {
                console.error("JSON Repair failed.", e2);
                throw e; // Rethrow original or new error
            }
        }
    }

    private floatTo16BitPCM(input: Float32Array): string {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        let binary = '';
        const bytes = new Uint8Array(output.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private async playAudio(base64: string) {
        if (!this.outputContext || !this.outputAnalyser) return;

        if (this.outputContext.state === 'suspended') {
            await this.outputContext.resume();
        }

        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768.0;
        }

        const buffer = this.outputContext.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);

        const source = this.outputContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.outputAnalyser);
        this.outputAnalyser.connect(this.outputContext.destination);

        const now = this.outputContext.currentTime;
        // Schedule for next available time
        this.nextStartTime = Math.max(now, this.nextStartTime);
        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;
    }

    disconnect() {
        this.isConnected = false;
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.processor?.disconnect();
        this.source?.disconnect();
        this.stream?.getTracks().forEach(t => t.stop());
        this.inputContext?.close();
        this.outputContext?.close();
    }
}
