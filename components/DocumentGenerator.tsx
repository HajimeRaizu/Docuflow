import React, { useState, useEffect, useRef } from 'react';
import { DocumentType } from '../types';
import { generateDocument, LiveSession } from '../services/geminiService';
import { Bot, ArrowLeft, Sparkles, FormInput, Mic, PhoneOff, MicOff } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import * as THREE from 'three';

interface DocumentGeneratorProps {
  initialType?: DocumentType;
  onBack: () => void;
}

// Shader for the visualizer sphere
const vertexShader = `
uniform float u_time;
uniform float u_frequency;
varying vec2 vUv;
varying vec3 vNormal;

// Simplex noise function (simplified)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vUv = uv;
  vNormal = normal;
  
  // Displacement based on noise + frequency
  float noiseVal = snoise(position * 2.0 + u_time * 0.5);
  float displacement = noiseVal * (u_frequency * 2.0); // Amplify by audio
  
  vec3 newPosition = position + normal * displacement * 0.5;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
uniform float u_time;
uniform float u_frequency;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  // Base color
  vec3 colorA = vec3(0.0, 0.4, 0.0); // Dark Green (NEMSU)
  vec3 colorB = vec3(1.0, 0.84, 0.0); // Gold (NEMSU)
  
  // Mix based on normal and frequency
  float mixVal = (vNormal.y + 1.0) * 0.5;
  vec3 finalColor = mix(colorA, colorB, mixVal + u_frequency);
  
  // Add pulse glow
  float glow = u_frequency * 0.5;
  
  gl_FragColor = vec4(finalColor + glow, 1.0);
}
`;

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ initialType = DocumentType.ACTIVITY_PROPOSAL, onBack }) => {
  const [docType, setDocType] = useState<DocumentType>(initialType);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [inputMode, setInputMode] = useState<'form' | 'chat'>('form');

  // Form State
  const [formData, setFormData] = useState({
    orgName: '',
    title: '',
    venue: '',
    date: '',
    proponent: '',
    budget: '',
    source: '',
    objectives: '',
    senderName: '',
    senderPosition: '',
    recipientName: '',
    subject: '',
    details: '',
    resNum: '',
    topic: '',
    whereas: '',
    resolved: ''
  });

  // Live Agent State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveSessionRef = useRef<LiveSession | null>(null);
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const frameIdRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
      }
      stopVisualizer();
    };
  }, []);
  
  // Start/Stop Visualizer when active state changes
  useEffect(() => {
      if (isLiveActive && inputMode === 'chat') {
          setTimeout(initVisualizer, 100); // Slight delay for DOM
      } else {
          stopVisualizer();
      }
  }, [isLiveActive, inputMode]);

  const initVisualizer = () => {
      if (!canvasRef.current) return;
      
      // Cleanup existing
      if (rendererRef.current) stopVisualizer();

      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;

      // Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 3;
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      canvasRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Sphere Uniforms
      const uniforms = {
          u_time: { value: 0.0 },
          u_frequency: { value: 0.0 }
      };

      // Geometry & Material
      const geometry = new THREE.IcosahedronGeometry(1.2, 4); // Detailed sphere
      const material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
          wireframe: true,
          transparent: true
      });

      const sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);
      sphereRef.current = sphere;

      // Animation Loop
      const animate = () => {
          frameIdRef.current = requestAnimationFrame(animate);
          
          const time = performance.now() * 0.001;
          uniforms.u_time.value = time;
          sphere.rotation.y = time * 0.2;
          sphere.rotation.z = time * 0.1;

          // Audio Data
          let avgFreq = 0;
          if (liveSessionRef.current) {
               // Mix Input and Output
               const session = liveSessionRef.current;
               let sum = 0;
               let count = 0;

               if (session.inputAnalyser) {
                   const data = new Uint8Array(session.inputAnalyser.frequencyBinCount);
                   session.inputAnalyser.getByteFrequencyData(data);
                   const inputAvg = data.reduce((a, b) => a + b, 0) / data.length;
                   sum += inputAvg;
                   count++;
               }
               
               if (session.outputAnalyser) {
                   const data = new Uint8Array(session.outputAnalyser.frequencyBinCount);
                   session.outputAnalyser.getByteFrequencyData(data);
                   const outputAvg = data.reduce((a, b) => a + b, 0) / data.length;
                   sum += outputAvg;
                   count++;
               }

               if (count > 0) {
                   avgFreq = sum / count; 
               }
          }
          
          // Smooth the frequency value for the shader (0.0 to 1.0 range approximate)
          const targetFreq = avgFreq / 128.0; 
          // Simple Lerp for smoothness
          uniforms.u_frequency.value += (targetFreq - uniforms.u_frequency.value) * 0.2;

          renderer.render(scene, camera);
      };
      
      animate();
  };

  const stopVisualizer = () => {
      cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current && canvasRef.current) {
          canvasRef.current.innerHTML = '';
          rendererRef.current.dispose();
      }
      rendererRef.current = null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const text = await generateDocument(docType, formData);
      setResult(text);
    } catch (e) {
      alert("Failed to generate document. Please check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const toggleLiveAgent = async () => {
    if (isLiveActive) {
      liveSessionRef.current?.disconnect();
      setIsLiveActive(false);
      liveSessionRef.current = null;
    } else {
      try {
        setIsLiveActive(true);
        liveSessionRef.current = new LiveSession((html) => {
          setResult(html);
        });
        await liveSessionRef.current.connect();
      } catch (e) {
        console.error("Failed to connect live agent", e);
        setIsLiveActive(false);
        alert("Could not access microphone or connect to AI Agent.");
      }
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-screen flex flex-col lg:flex-row gap-6 overflow-hidden">
      {/* Left Panel: Controls */}
      <div className="w-full lg:w-[450px] flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full transition-all duration-300">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">Generator</h2>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex">
              <button 
                onClick={() => setInputMode('form')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${inputMode === 'form' ? 'bg-white dark:bg-gray-600 shadow text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}
              >
                  <FormInput className="w-4 h-4" /> Form Input
              </button>
              <button 
                onClick={() => {
                    setInputMode('chat');
                    if(docType !== DocumentType.ACTIVITY_PROPOSAL) setDocType(DocumentType.ACTIVITY_PROPOSAL);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${inputMode === 'chat' ? 'bg-white dark:bg-gray-600 shadow text-purple-700 dark:text-purple-300' : 'text-gray-500'}`}
              >
                  <Mic className="w-4 h-4" /> Voice Agent
              </button>
          </div>
        </div>
        
        {inputMode === 'form' ? (
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div>
                <label className="block text-sm font-medium mb-2">Document Type</label>
                <select 
                value={docType} 
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                >
                {Object.values(DocumentType).map(t => (
                    <option key={t} value={t}>{t}</option>
                ))}
                </select>
            </div>

            {/* Dynamic Fields */}
            {docType === DocumentType.ACTIVITY_PROPOSAL && (
                <>
                <input name="orgName" placeholder="Organization Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <input name="title" placeholder="Activity Title" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                
                <div className="grid grid-cols-2 gap-2">
                    <input name="venue" placeholder="Venue" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input type="date" name="date" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </div>
                
                <input name="proponent" placeholder="Proponent (Your Name)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <div className="grid grid-cols-2 gap-2">
                    <input name="budget" placeholder="Est. Budget (e.g. 5,000)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input name="source" placeholder="Source (e.g. STF)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </div>

                <textarea name="objectives" placeholder="Objectives (List them)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-32" />
                </>
            )}

            {docType === DocumentType.OFFICIAL_LETTER && (
                <>
                <input name="senderName" placeholder="Your Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <input name="senderPosition" placeholder="Your Position" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <input name="recipientName" placeholder="Recipient Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <input name="subject" placeholder="Subject" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <textarea name="details" placeholder="Key details to include in the body..." onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-32" />
                </>
            )}

            {docType === DocumentType.RESOLUTION && (
                <>
                <input name="orgName" placeholder="Organization Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <input name="resNum" placeholder="Resolution No. (e.g. 001-2024)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <input name="topic" placeholder="Topic/Subject" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                <textarea name="whereas" placeholder="Whereas clauses (Context)..." onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-24" />
                <textarea name="resolved" placeholder="Resolved clause (Action)..." onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-24" />
                </>
            )}
            
            <button 
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {loading ? (
                <>
                    <Bot className="w-5 h-5 animate-spin" /> Generating...
                </>
                ) : (
                <><Bot className="w-5 h-5" /> Generate Document</>
                )}
            </button>
            </div>
        ) : (
            // Voice Agent Interface with Three.js Visualizer
            <div className="flex flex-col flex-1 h-full bg-black relative overflow-hidden">
                {/* Visualizer Canvas Container */}
                <div 
                  ref={canvasRef} 
                  className="absolute inset-0 w-full h-full z-0" 
                  style={{ background: 'radial-gradient(circle at center, #1a2e1a 0%, #000000 70%)' }}
                />

                {/* UI Overlay */}
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-12 pointer-events-none">
                    <h3 className="text-2xl font-bold mb-2 text-white drop-shadow-md">
                        {isLiveActive ? "Listening..." : "NEMSU AI Agent"}
                    </h3>
                    <p className="text-gray-300 mb-8 max-w-xs text-center drop-shadow-md">
                        {isLiveActive 
                            ? "Discuss your event details. I'm visualizing your voice." 
                            : "Start a call to discuss your proposal with the AI Coordinator."}
                    </p>

                    <button
                        onClick={toggleLiveAgent}
                        className={`
                            px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-xl pointer-events-auto
                            ${isLiveActive 
                                ? 'bg-red-500 hover:bg-red-600 text-white' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                        `}
                    >
                        {isLiveActive ? (
                            <><PhoneOff className="w-6 h-6" /> End Call</>
                        ) : (
                            <><Mic className="w-6 h-6" /> Start Interview</>
                        )}
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Right Panel: Editor */}
      <div className="flex-1 h-full flex flex-col">
        {loading && !result ? (
          <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400">
             <Bot className="w-16 h-16 mb-4 text-emerald-500 animate-bounce" />
             <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Drafting your document...</p>
             <p className="text-sm">This uses the 2.5 Flash model for speed.</p>
          </div>
        ) : (
          <RichTextEditor initialContent={result} />
        )}
      </div>
    </div>
  );
};