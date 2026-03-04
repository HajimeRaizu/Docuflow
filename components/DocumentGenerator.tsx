
import React, { useState, useEffect, useRef } from 'react';
import { DocumentType, GeneratedDocument, DocumentVersion, User, DocumentTypePermissionKey } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { generateDocument, LiveSession } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { Bot, ArrowLeft, FormInput, Mic, PhoneOff, GripVertical, Eye, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useNotification } from './NotificationProvider';
import { RichTextEditor } from './RichTextEditor';
import * as THREE from 'three';
// @ts-ignore
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// @ts-ignore
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// @ts-ignore
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// @ts-ignore
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

interface DocumentGeneratorProps {
  user: User;
  initialType?: DocumentType;
  initialDoc?: GeneratedDocument;
  onBack: () => void;
}

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float u_time;
uniform float u_frequency;
varying vec2 vUv;

void main() {
  // Voice Memo / Siri style multi-line wave
  float x = vUv.x;
  float y = vUv.y * 2.0 - 1.0; // Center Y at 0
  
  vec3 finalColor = vec3(0.0);
  
  // Create 5 distinct wavy lines
  for(float i = 0.0; i < 5.0; i++) {
    float offset = i * 0.5;
    float speed = 2.0 + i * 0.5;
    float freq = 4.0 + i;
    float amp = (0.1 + i * 0.05) * (1.0 + u_frequency * 2.0); // Audio reactive amplitude
    
    // Wave formula
    float wave = sin(x * freq + u_time * speed + offset) * amp;
    
    // Line thickness
    float dist = abs(y - wave);
    float thickness = 0.02 * (1.0 - i * 0.15); // Lines get thinner
    float line = smoothstep(thickness, 0.0, dist);
    
    // Gradient colors (Blue to Cyan)
    vec3 col = mix(vec3(0.1, 0.2, 0.8), vec3(0.0, 0.9, 1.0), i / 4.0);
    finalColor += col * line;
  }
  
  // Fade out at edges
  float alpha = smoothstep(0.0, 0.2, x) * smoothstep(1.0, 0.8, x);
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ user, initialType = DocumentType.ACTIVITY_PROPOSAL, initialDoc, onBack }) => {
  const { showToast, confirm: confirmAction } = useNotification();
  const [docType, setDocType] = useState<DocumentType>(initialDoc ? initialDoc.type : initialType);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(initialDoc ? initialDoc.content : '');
  const [templateUrl, setTemplateUrl] = useState<string | null>(initialDoc?.templateUrl || null);

  useEffect(() => {
    const fetchTemplateUrl = async () => {
      if (!user.department) return;
      try {
        const { data } = await supabase
          .from('department_templates')
          .select('file_url')
          .eq('department', user.department)
          .eq('document_type', docType)
          .maybeSingle();

        if (data) setTemplateUrl(data.file_url);
        else setTemplateUrl(null);
      } catch (e) {
        console.error("Error fetching template URL:", e);
      }
    };
    fetchTemplateUrl();
  }, [docType, user.department]);

  useEffect(() => {
    const fetchOrgName = async () => {
      if (!user.department) return;
      try {
        const { data } = await supabase
          .from('department_settings')
          .select('organization_name')
          .eq('department', user.department)
          .maybeSingle();
        if (data?.organization_name) {
          setFormData(prev => ({ ...prev, orgName: data.organization_name }));
        }
      } catch (e) {
        console.error("Error fetching organization name:", e);
      }
    };
    fetchOrgName();
  }, [user.department]);

  const [inputMode, setInputMode] = useState<'form' | 'chat'>('form');
  const [visibility, setVisibility] = useState<'private' | 'department'>(initialDoc?.visibility || 'private');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'info' | 'warning' | 'success';
    showCancel: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
    showCancel: false,
    onConfirm: () => setModalState(prev => ({ ...prev, isOpen: false }))
  });

  const showAlert = (title: string, message: string, variant: 'danger' | 'info' | 'warning' | 'success' = 'info') => {
    setModalState({
      isOpen: true,
      title,
      message,
      variant,
      showCancel: false,
      onConfirm: () => setModalState(prev => ({ ...prev, isOpen: false }))
    });
  };

  const [currentDocId, setCurrentDocId] = useState<string | null>(initialDoc ? initialDoc.id : null);
  const isOwner = initialDoc?.user_id === user.id;
  const isSharedWithDept = initialDoc?.visibility === 'department' && initialDoc?.department === user.department;
  const hasTypePermission = user.user_type === 'admin' || user.user_type === 'super_admin' ||
    (user.permissions && user.permissions[DocumentTypePermissionKey[docType]] === 'edit');
  const canEdit = hasTypePermission && (!initialDoc || isOwner || isSharedWithDept);

  const [formData, setFormData] = useState({
    orgName: '', title: '', venue: 'North Eastern Mindanao State University – Tandag, Main Campus', date: '', proponent: user.full_name, budget: '', source: 'STF', objectives: '',
    senderName: user.full_name, senderPosition: user.specific_role || '', recipientName: '', subject: '', details: '', resNum: '', topic: '', whereas: '', resolved: '',
    detailedInstructions: ''
  });

  const [customVenue, setCustomVenue] = useState(false);
  const [customBudget, setCustomBudget] = useState(false);

  useEffect(() => {
    if (initialDoc) {
      setFormData(prev => ({ ...prev, title: initialDoc.title || '' }));
    }
  }, [initialDoc]);

  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (sidebarRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const newWidth = e.clientX - sidebarRect.left;
        if (newWidth > 300 && newWidth < 800) setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) liveSessionRef.current.disconnect();
      stopVisualizer();
    };
  }, []);

  useEffect(() => {
    if (isLiveActive && inputMode === 'chat') {
      setTimeout(initVisualizer, 100);
    } else {
      stopVisualizer();
    }
  }, [isLiveActive, inputMode]);

  const initVisualizer = () => {
    if (!canvasRef.current) return;
    if (rendererRef.current) stopVisualizer();

    const width = canvasRef.current.clientWidth;
    const height = canvasRef.current.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, -0.5, 1.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Simple Render Pass (No Bloom)
    const renderScene = new RenderPass(scene, camera);
    const outputPass = new OutputPass();

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(outputPass);
    composerRef.current = composer;

    const uniforms = { u_time: { value: 0.0 }, u_frequency: { value: 0.0 } };
    const geometry = new THREE.PlaneGeometry(3.0, 2.0, 1, 1); // Simple flat plane
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const animate = () => {
      if (!rendererRef.current) return;
      frameIdRef.current = requestAnimationFrame(animate);
      const time = performance.now() * 0.001;
      uniforms.u_time.value = time;
      mesh.rotation.z = Math.sin(time * 0.2) * 0.05;

      let avgFreq = 0;
      if (liveSessionRef.current) {
        const session = liveSessionRef.current;
        let sum = 0, count = 0;
        if (session.inputAnalyser) {
          const data = new Uint8Array(session.inputAnalyser.frequencyBinCount);
          session.inputAnalyser.getByteFrequencyData(data);
          const subArray = data.slice(0, data.length / 2);
          sum += subArray.reduce((a, b) => a + b, 0) / subArray.length;
          count++;
        }
        if (session.outputAnalyser) {
          const data = new Uint8Array(session.outputAnalyser.frequencyBinCount);
          session.outputAnalyser.getByteFrequencyData(data);
          sum += (data.reduce((a, b) => a + b, 0) / data.length) * 1.5;
          count++;
        }
        if (count > 0) avgFreq = sum / count;
      }

      // Update frequency
      const targetFreq = Math.min(avgFreq / 100.0, 1.2);
      uniforms.u_frequency.value += (targetFreq - uniforms.u_frequency.value) * 0.15;

      composer.render();
    };
    animate();
  };

  const stopVisualizer = () => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = 0;
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.forceContextLoss();
      if (canvasRef.current && rendererRef.current.domElement) {
        if (canvasRef.current.contains(rendererRef.current.domElement)) {
          canvasRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      rendererRef.current = null;
    }
    if (composerRef.current) composerRef.current = null;
    if (canvasRef.current) canvasRef.current.innerHTML = '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async (overrideData?: Record<string, string>) => {
    setLoading(true);
    const dataToUse = overrideData || formData;
    try {
      const generatedContent = await generateDocument(docType, dataToUse, user?.department);
      setResult(generatedContent);
    } catch (error) {
      console.error("Generation failed", error);
      showToast("Failed to generate document. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToStorage = async (content: string) => {
    if (!user || !user.id) {
      showToast("You must be logged in to save documents.", "warning");
      return;
    }
    try {
      let title = formData.title || formData.subject || `${docType} - ${new Date().toLocaleDateString()}`;
      if (initialDoc && !isOwner && !isSharedWithDept) {
        const hasTypePermission = user.user_type === 'admin' || user.user_type === 'super_admin' ||
          (user.permissions && user.permissions[DocumentTypePermissionKey[docType]] === 'edit');
        if (!hasTypePermission) {
          showAlert("Permission Denied", "You do not have permission to edit this document type.", 'danger');
          return;
        }
      }
      let currentVersions = initialDoc?.versions || [];
      if (initialDoc && currentVersions.length === 0) {
        const originalVersion: DocumentVersion = {
          id: `original-${initialDoc.id}`,
          content: initialDoc.content,
          savedAt: initialDoc.createdAt || new Date(),
          versionNumber: 1,
          modifiedBy: { id: initialDoc.user_id || 'unknown', name: (initialDoc.user_id === user.id) ? user.full_name : "Original Author" }
        };
        currentVersions = [originalVersion];
      }
      const newVersion: DocumentVersion = {
        id: Date.now().toString(), content, savedAt: new Date(), versionNumber: currentVersions.length + 1,
        modifiedBy: { id: user.id, name: user.full_name }
      };
      const updatedVersions = [...currentVersions, newVersion];
      const docData: any = { title, type: docType, content, status: 'Draft', updated_at: new Date().toISOString(), visibility, department: user.department, versions: updatedVersions };
      if (currentDocId) {
        const { error } = await supabase.from('documents').update(docData).eq('id', currentDocId);
        if (error) throw error;
        showAlert("Success", "Document updated successfully!", 'success');
      } else {
        docData.user_id = user.id;
        const { data, error } = await supabase.from('documents').insert([docData]).select().single();
        if (error) throw error;
        if (data) {
          setCurrentDocId(data.id);
          showAlert("Success", "New document created and saved!", 'success');
        }
      }
    } catch (e) {
      console.error("Failed to save document", e);
      showAlert("Error", `Failed to save document: ${(e as Error).message}`, 'danger');
    }
  };

  const toggleLiveAgent = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
        liveSessionRef.current = null;
      }
      setIsLiveActive(false);
    } else {
      const session = new LiveSession((gatheredData) => {
        if (gatheredData && typeof gatheredData === 'object') setFormData(prev => ({ ...prev, ...gatheredData }));
        if (liveSessionRef.current) {
          liveSessionRef.current.disconnect();
          liveSessionRef.current = null;
        }
        setIsLiveActive(false);
        handleGenerate(gatheredData);
      }, user.department, docType);
      liveSessionRef.current = session;
      try {
        await session.connect();
        setIsLiveActive(true);
      } catch (e) {
        console.error("Failed to connect live agent:", e);
        setIsLiveActive(false);
        liveSessionRef.current = null;
        showAlert("Connection Error", `Failed to connect to Voice Agent: ${(e as Error).message}`, 'danger');
      }
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-[1600px] mx-auto h-[100dvh] flex flex-col lg:flex-row gap-4 lg:gap-0 overflow-hidden">
      <div
        ref={sidebarRef}
        className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[40vh] lg:h-full transition-all duration-300 ease-in-out"
        style={{ width: isDesktop ? sidebarWidth : '100%', marginBottom: isDesktop ? 0 : '1rem' }}
      >
        <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">
              Generator
              {!canEdit && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full border border-gray-300 font-normal">View Only</span>}
            </h2>
          </div>
          {canEdit && (
            <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex">
              <button
                onClick={() => setInputMode('form')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${inputMode === 'form' ? 'bg-white dark:bg-gray-600 shadow text-blue-700 dark:text-blue-300' : 'text-gray-500'}`}
              >
                <FormInput className="w-4 h-4" /> Manual Drafting
              </button>
              <button
                onClick={() => {
                  setInputMode('chat');
                  if (docType !== DocumentType.ACTIVITY_PROPOSAL) setDocType(DocumentType.ACTIVITY_PROPOSAL);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${inputMode === 'chat' ? 'bg-white dark:bg-gray-600 shadow text-blue-700 dark:text-blue-300' : 'text-gray-500'}`}
              >
                <Mic className="w-4 h-4" /> Voice Agent
              </button>
            </div>
          )}
        </div>

        {!canEdit ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full text-gray-500">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
              <Eye className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-medium">View Only Mode</p>
            <p className="text-sm mt-2 max-w-[200px]">You are viewing a shared document. Editing controls are disabled.</p>
          </div>
        ) : (
          inputMode === 'form' ? (
            <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Document Type</label>
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600 font-bold text-blue-600 dark:text-blue-400">
                  {docType}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Visibility {initialDoc && !isOwner && <span className="text-xs font-normal text-gray-500">(Owner only)</span>}</label>
                <div className={`flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg ${initialDoc && !isOwner ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button onClick={() => isOwner || !initialDoc ? setVisibility('private') : null} disabled={!!initialDoc && !isOwner} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${visibility === 'private' ? 'bg-white dark:bg-gray-600 shadow text-blue-600' : 'text-gray-500'}`}>Private</button>
                  <button onClick={() => isOwner || !initialDoc ? setVisibility('department') : null} disabled={!!initialDoc && !isOwner} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${visibility === 'department' ? 'bg-white dark:bg-gray-600 shadow text-blue-600' : 'text-gray-500'}`}>Allow Collaboration</button>
                </div>
              </div>
              {docType === DocumentType.ACTIVITY_PROPOSAL && (
                <>
                  <input name="orgName" value={formData.orgName} placeholder="Organization Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <input name="title" value={formData.title} placeholder="Activity Title" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <select
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                        value={customVenue ? "Others" : formData.venue}
                        onChange={(e) => {
                          if (e.target.value === "Others") {
                            setCustomVenue(true);
                            setFormData(prev => ({ ...prev, venue: '' }));
                          } else {
                            setCustomVenue(false);
                            setFormData(prev => ({ ...prev, venue: e.target.value }));
                          }
                        }}
                      >
                        <option value="North Eastern Mindanao State University – Tandag, Main Campus">North Eastern Mindanao State University – Tandag, Main Campus</option>
                        <option value="Others">Others</option>
                      </select>
                      {customVenue && (
                        <input name="venue" placeholder="Specify Venue" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 animate-in fade-in slide-in-from-top-1" />
                      )}
                    </div>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <input name="proponent" value={formData.proponent} placeholder="Proponent (Your Name)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <select
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                        value={customBudget ? "Others" : (["0-5000", "5001-10000", "10001-20000", "20001-30000"].includes(formData.budget) ? formData.budget : (formData.budget === '' ? '' : "Others"))}
                        onChange={(e) => {
                          if (e.target.value === "Others") {
                            setCustomBudget(true);
                            setFormData(prev => ({ ...prev, budget: '' }));
                          } else {
                            setCustomBudget(false);
                            setFormData(prev => ({ ...prev, budget: e.target.value }));
                          }
                        }}
                      >
                        <option value="">Select Budget Range</option>
                        <option value="0-5000">0-5000</option>
                        <option value="5001-10000">5001-10000</option>
                        <option value="10001-20000">10001-20000</option>
                        <option value="20001-30000">20001-30000</option>
                        <option value="Others">Others</option>
                      </select>
                      {customBudget && (
                        <input name="budget" placeholder="Specify Budget" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 animate-in fade-in slide-in-from-top-1" />
                      )}
                    </div>
                    <select name="source" value={formData.source} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                      <option value="STF">STF</option>
                      <option value="GAA">GAA</option>
                    </select>
                  </div>
                  <textarea name="objectives" value={formData.objectives} placeholder="Objectives" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-24" />
                  <textarea name="detailedInstructions" value={formData.detailedInstructions} placeholder="Detailed Instructions (Optional info to guide AI generation)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-24" />
                </>
              )}
              {docType === DocumentType.OFFICIAL_LETTER && (
                <>
                  <input name="senderName" value={formData.senderName} placeholder="Your Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <input name="senderPosition" value={formData.senderPosition} placeholder="Your Position" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <input name="recipientName" value={formData.recipientName} placeholder="Recipient Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <input name="subject" value={formData.subject} placeholder="Subject" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <textarea name="details" value={formData.details} placeholder="Details..." onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-32" />
                </>
              )}
              <button onClick={() => handleGenerate()} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Bot className="w-5 h-5 animate-spin" /> Generating...</> : <><Bot className="w-5 h-5" /> Generate Document</>}
              </button>
            </div>
          ) : (
            <div key="voice-agent-container" className="flex flex-col flex-1 h-full bg-black relative overflow-hidden rounded-b-xl lg:rounded-b-none lg:rounded-br-none">
              <div ref={canvasRef} className="absolute inset-0 w-full h-full z-0" style={{ background: 'radial-gradient(circle at center, #050510 0%, #000000 70%)' }} />
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-12 pointer-events-none">
                <h3 className="text-xl md:text-2xl font-bold mb-2 text-white drop-shadow-[0_0_10px_rgba(0,200,255,0.8)] tracking-wide">SmartDraft AI</h3>
                <p className="text-gray-300 mb-2 max-w-xs text-center drop-shadow-md text-sm md:text-base">
                  {isLiveActive ? "Listening to your proposal details..." : "Connect to start drafting with SmartDraft"}
                </p>
                <p className="text-[10px] md:text-xs text-gray-500 mb-8 max-w-[250px] text-center italic opacity-80">
                  The performance of the voice agent may depend on a stable internet connection
                </p>
                <button
                  onClick={toggleLiveAgent}
                  className={`px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-base md:text-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-2xl pointer-events-auto border-2 ${isLiveActive ? 'bg-red-500/20 border-red-500 text-red-100 hover:bg-red-500 hover:text-white backdrop-blur-sm' : 'bg-blue-600/20 border-blue-500 text-blue-100 hover:bg-blue-500 hover:text-white backdrop-blur-sm'}`}
                >
                  {isLiveActive ? <><PhoneOff className="w-5 h-5 md:w-6 md:h-6" /> End Session</> : <><Mic className="w-5 h-5 md:w-6 md:h-6" /> Start drafting</>}
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <div className="hidden lg:flex w-5 cursor-col-resize items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0 text-gray-400 hover:text-blue-500 select-none" onMouseDown={() => setIsResizing(true)}>
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1 h-[60vh] lg:h-full flex flex-col min-w-0">
        {loading && !result ? (
          <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400">
            <Bot className="w-16 h-16 mb-4 text-blue-500 animate-bounce" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Drafting your document...</p>
            <p className="text-sm">Please wait while AI generates the content.</p>
          </div>
        ) : (
          <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden relative">
              <RichTextEditor
                initialContent={result}
                templateUrl={templateUrl}
                title={formData.title || formData.subject || "Document"}
                onToggleVoice={toggleLiveAgent}
                isVoiceActive={isLiveActive}
                onSave={handleSaveToStorage}
                readOnly={!canEdit}
                documentType={docType}
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        variant={modalState.variant}
        showCancel={false}
        confirmLabel="OK"
      />
    </div>
  );
};
