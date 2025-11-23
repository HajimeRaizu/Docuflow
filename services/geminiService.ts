import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { DocumentType, BudgetLineItem, ChatMessage } from "../types";

// Robust API Key Retrieval
// Checks standard process.env (Next.js/CRA/Node) and import.meta.env (Vite)
const getApiKey = () => {
  try {
    // 1. Check process.env (Standard Node/Vercel/Next.js)
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.API_KEY) return process.env.API_KEY;
      if (process.env.NEXT_PUBLIC_API_KEY) return process.env.NEXT_PUBLIC_API_KEY;
      if (process.env.REACT_APP_API_KEY) return process.env.REACT_APP_API_KEY;
    }
    
    // 2. Check import.meta.env (Vite)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
      // @ts-ignore
      if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    }
    
    return '';
  } catch (e) {
    console.warn("Error reading environment variables", e);
    return '';
  }
};

const API_KEY = getApiKey();

// Initialize API Client
// Note: GoogleGenAI instance is created lazily in functions to handle potential missing keys gracefully during initialization
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates document content based on type and user input.
 */
export const generateDocument = async (
  type: DocumentType,
  formData: Record<string, any>
): Promise<string> => {
  const currentKey = getApiKey();
  if (!currentKey) throw new Error("API Key missing. Please set API_KEY, NEXT_PUBLIC_API_KEY, or VITE_API_KEY in your Vercel Environment Variables.");

  // Re-initialize to ensure we have the latest key if it loaded late
  const genAI = new GoogleGenAI({ apiKey: currentKey });
  
  const model = 'gemini-2.5-flash';
  
  let prompt = "";
  
  switch (type) {
    case DocumentType.ACTIVITY_PROPOSAL:
      prompt = `
      Create a formal University Activity Proposal for North Eastern Mindanao State University (NEMSU).
      OUTPUT STRICTLY SEMANTIC HTML.
      
      **LAYOUT INSTRUCTIONS:**
      1. **TITLE**: "ACTIVITY PROPOSAL" (Centered, Bold, Uppercase, Font-size: 14pt).
      
      2. **METADATA TABLE**:
      Create a table exactly like the template: width 100%, border-collapse collapse, border 1px solid black.
      Rows must include:
      - **Title**: ${formData.title}
      - **Participants**: [Target Audience/Participants]
      - **Venue**: ${formData.venue}
      - **Date**: ${formData.date}
      - **Proponent**: ${formData.proponent || 'Student Name'} (${formData.senderPosition || 'Position'})
      - **Budget**: ${formData.budget || 'P 0.00'}
      - **Source**: ${formData.source || 'STF / IGP / Org Fund'}
      
      3. **BODY SECTIONS** (Use <h3> for headers, uppercase):
      - **RATIONALE**: Write 2 paragraphs explaining the necessity of this event based on: ${formData.objectives}.
      - **OBJECTIVES**: Provide a numbered list of 3-4 specific objectives.
      - **OUTCOMES**: Provide a numbered list of expected outcomes.
      
      4. **BUDGETARY REQUIREMENTS**:
      Create a table with columns: Particulars, Unit, Quantity, Unit Cost, Total Cost.
      Add mock rows based on a typical event of this type.
      
      5. **SIGNATORIES SECTION** (Crucial - maintain hierarchy):
      Use a grid or table for layout (no borders for this part).
      - **Prepared by**: ${formData.proponent || '_________________'} (Left)
      - **Noted**: Adviser (Left), Dept. Chair (Right)
      - **Approved as to Appropriation**: Budget Officer (Left)
      - **Approved as to Funds**: Accountant (Right)
      - **Recommending Approval**: Dean (Center)
      - **Approved**: Campus Director (Center Bottom)

      Do NOT include the Logo/Header (it is pre-printed).
      Ensure all generic tables have style="border-collapse: collapse; width: 100%; border: 1px solid black;" and cells have style="border: 1px solid black; padding: 5px;".
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

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.4, // Lower temperature for more structured/consistent output
        systemInstruction: "You are an expert academic administrator. Output HTML only. Ensure tables have visible borders (1px solid black) where appropriate."
      }
    });
    return response.text || "Error generating text.";
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("Failed to generate document.");
  }
};

/**
 * Suggests a price for a budget item.
 */
export const suggestItemCost = async (itemDescription: string): Promise<string> => {
  const currentKey = getApiKey();
  if (!currentKey) return "0";
  const genAI = new GoogleGenAI({ apiKey: currentKey });

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Estimate the average market unit price in Philippine Peso (PHP) for: "${itemDescription}". Return ONLY the number, no currency symbol or text. If unknown, return 0.`,
    });
    return response.text?.trim() || "0";
  } catch (error) {
    return "0";
  }
};

/**
 * Analyzes a budget and generates a narrative justification.
 */
export const generateBudgetJustification = async (items: BudgetLineItem[]): Promise<string> => {
  const currentKey = getApiKey();
  if (!currentKey) return "Unable to generate justification.";
  const genAI = new GoogleGenAI({ apiKey: currentKey });

  const itemsList = items.map(i => `${i.item}: ${i.quantity} x ${i.unitPrice} PHP`).join('\n');

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-3-pro-preview', // Using Pro for better reasoning
      contents: `Analyze the following budget items and write a 'Budget Narrative Justification' paragraph suitable for a student council proposal. Explain why these expenses are necessary for a successful event.\n\nItems:\n${itemsList}`,
    });
    return response.text || "";
  } catch (error) {
    return "Error generating justification.";
  }
};

/**
 * Generates a student meal plan.
 */
export const generateMealPlan = async (preferences: string): Promise<string> => {
  const currentKey = getApiKey();
  if (!currentKey) return "Unable to generate plan.";
  const genAI = new GoogleGenAI({ apiKey: currentKey });

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Create a healthy, budget-friendly 1-day meal plan for a busy university student. Preferences: ${preferences}. return as a Markdown table with Breakfast, Lunch, Dinner, Snack, and Estimated Cost (PHP).`,
    });
    return response.text || "";
  } catch (error) {
    return "Error generating meal plan.";
  }
};

// ==========================================
// LIVE API IMPLEMENTATION FOR VOICE AGENT
// ==========================================

const proposalTool: FunctionDeclaration = {
  name: 'generate_proposal_document',
  description: 'Generates the final activity proposal document after gathering all details.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      htmlContent: {
        type: Type.STRING,
        description: 'The full HTML content of the proposal, strictly following the NEMSU template.',
      },
    },
    required: ['htmlContent'],
  },
};

export class LiveSession {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  public inputContext: AudioContext | null = null;
  public outputContext: AudioContext | null = null;
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private audioSourceNodes = new Set<AudioBufferSourceNode>();
  private onDocumentGenerated: (html: string) => void;

  constructor(onDocumentGenerated: (html: string) => void) {
    const currentKey = getApiKey();
    if (!currentKey) {
        console.error("API Key is missing for LiveSession! Please set API_KEY in env.");
        alert("API Key is missing. The Voice Agent will not connect.");
    }
    this.ai = new GoogleGenAI({ apiKey: currentKey });
    this.onDocumentGenerated = onDocumentGenerated;
  }

  async connect() {
    // Initialize AudioContexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    // Input: Try to request 16kHz for consistency with Gemini
    this.inputContext = new AudioContextClass({ sampleRate: 16000 });
    
    // Output: Let the browser decide the sample rate to avoid playback speed issues
    this.outputContext = new AudioContextClass(); 
    
    // Create Analysers
    this.inputAnalyser = this.inputContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    
    this.outputAnalyser = this.outputContext.createAnalyser();
    this.outputAnalyser.fftSize = 256;

    // CRITICAL: Ensure output context is running (resume if suspended)
    if (this.outputContext.state === 'suspended') {
      await this.outputContext.resume();
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const config = {
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => console.log("Connection opened"),
        onmessage: this.onMessage.bind(this),
        onclose: () => console.log('Session closed'),
        onerror: (e: any) => console.error('Session error', e),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: `You are a friendly and enthusiastic NEMSU Activity Coordinator.
        Your goal is to interview the student to gather details for an Activity Proposal.
        
        CRITICAL: The user has just connected. YOU MUST SPEAK FIRST.
        Immediately say: "Hello! I'm your NEMSU AI Coordinator. I'm here to help you draft your activity proposal. What is the title of your activity?"

        Then ask one question at a time to gather these details:
        1. Date of activity
        2. Venue
        3. Objectives (Briefly)
        4. Target Participants
        5. Estimated Budget
        
        Keep it conversational. If the user gives a short answer, encourage them politely.
        
        Once you have ALL the details, say "Great! I have everything I need. I'm generating your proposal now." and IMMEDIATELY call the 'generate_proposal_document' tool with the full HTML.
        
        The HTML for the tool must follow this STRICT TEMPLATE:
       - **TITLE**: "ACTIVITY PROPOSAL" (Centered, Bold, Uppercase).
       - **METADATA TABLE**: Width 100%, border 1px solid black. Rows: Title, Participants, Venue, Date, Proponent, Budget, Source.
       - **BODY**: Rationale (write based on objectives), Objectives (numbered list), Outcomes (numbered list).
       - **BUDGET TABLE**: Columns: Particulars, Unit, Quantity, Unit Cost, Total Cost. (Fill with reasonable estimates based on the activity).
       - **SIGNATORIES**: 
          - Prepared by: [Proponent Name]
          - Noted: Adviser, Dept Chair
          - Approved as to Appropriation: Budget Officer
          - Approved as to Funds: Accountant
          - Recommending Approval: Dean
          - Approved: Campus Director
       - DO NOT include the logo/header.
       - Ensure all generic tables have style="border-collapse: collapse; width: 100%; border: 1px solid black;" and cells have style="border: 1px solid black; padding: 5px;".
        `,
        tools: [{ functionDeclarations: [proposalTool] }],
      },
    };

    // @ts-ignore 
    this.sessionPromise = this.ai.live.connect(config);
    
    // Wait for connection to completely resolve
    const session = await this.sessionPromise;
    
    // Start Audio Stream after connection is ready
    this.startAudioInput();

    // TRIGGER THE MODEL: Send a silent audio frame to wake it up.
    // This is more reliable than text triggers for getting an initial audio response.
    try {
        const silentFrame = new Float32Array(512).fill(0); // Brief silence
        const blob = this.createBlob(silentFrame);
        session.sendRealtimeInput({ media: blob });
    } catch (e) {
        console.warn("Failed to send wake-up frame", e);
    }
  }

  private startAudioInput() {
    if (!this.inputContext || !this.stream) return;

    this.source = this.inputContext.createMediaStreamSource(this.stream);
    this.source.connect(this.inputAnalyser!); 
    
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createBlob(inputData);
      
      this.sessionPromise?.then((session: any) => {
         try {
            session.sendRealtimeInput({ media: pcmBlob });
         } catch(e) {
            // Ignore send errors if session closed
         }
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  private async onMessage(message: LiveServerMessage) {
    // Check for interruption
    const interrupted = message.serverContent?.interrupted;
    if (interrupted) {
      this.audioSourceNodes.forEach(node => {
        try { node.stop(); } catch(e) {}
      });
      this.audioSourceNodes.clear();
      this.nextStartTime = 0;
      return;
    }

    // Handle Audio
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      this.playAudio(audioData);
    }

    // Handle Tool Call
    const toolCall = message.toolCall;
    if (toolCall) {
       for (const call of toolCall.functionCalls) {
           if (call.name === 'generate_proposal_document') {
               const html = (call.args as any).htmlContent;
               this.onDocumentGenerated(html);
               
               // Send success response
               this.sessionPromise?.then((session: any) => {
                   session.sendToolResponse({
                       functionResponses: {
                           id: call.id,
                           name: call.name,
                           response: { result: 'Document generated successfully.' }
                       }
                   });
               });
           }
       }
    }
  }

  private createBlob(data: Float32Array) {
     const l = data.length;
     const int16 = new Int16Array(l);
     for (let i = 0; i < l; i++) {
       // Clamp values to -1.0 to 1.0 before scaling to avoid distortion
       const val = Math.max(-1, Math.min(1, data[i]));
       int16[i] = val * 32768;
     }
     
     // Manual base64 encoding
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
     
     try {
        // Decode base64
        const binaryString = atob(base64);
        const len = binaryString.length;
        let bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // IMPORTANT: Ensure bytes.length is even for Int16Array
        if (bytes.length % 2 !== 0) {
            const newBytes = new Uint8Array(bytes.length + 1);
            newBytes.set(bytes);
            bytes = newBytes;
        }
        
        // Convert PCM to AudioBuffer
        const dataInt16 = new Int16Array(bytes.buffer);
        
        // Use the Gemini native rate (24000) for the buffer
        // The AudioContext (which might be 44.1k or 48k) will handle resampling on playback
        const buffer = this.outputContext.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for(let i=0; i<dataInt16.length; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }

        // Play
        this.nextStartTime = Math.max(this.nextStartTime, this.outputContext.currentTime);
        const source = this.outputContext.createBufferSource();
        source.buffer = buffer;
        
        // Connect source -> Analyser -> Destination
        source.connect(this.outputAnalyser);
        this.outputAnalyser.connect(this.outputContext.destination);
        
        source.onended = () => {
          this.audioSourceNodes.delete(source);
        };
        this.audioSourceNodes.add(source);

        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;
     } catch(e) {
         console.error("Error playing audio chunk", e);
     }
  }

  disconnect() {
    this.sessionPromise?.then((session: any) => session.close());
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    this.inputContext?.close();
    this.outputContext?.close();
    this.audioSourceNodes.forEach(node => {
        try { node.stop(); } catch(e) {}
    });
    this.audioSourceNodes.clear();
  }
}