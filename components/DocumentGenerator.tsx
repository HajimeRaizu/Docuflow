
import React, { useState, useEffect, useRef } from 'react';
import { DocumentType, GeneratedDocument, DocumentVersion, User, DocumentTypePermissionKey } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { generateDocument, LiveSession, generateDocumentTitle, estimateBudget } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { Bot, ArrowLeft, FormInput, Mic, PhoneOff, GripVertical, Eye, CheckCircle, Info, AlertTriangle, Plus, Trash2, UserPlus, ChevronDown, X } from 'lucide-react';
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

const CustomSelect: React.FC<{
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}> = ({ options, value, onChange, className = "", placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 bg-transparent flex items-center justify-between gap-2 transition-all hover:bg-gray-50 dark:hover:bg-gray-650"
      >
        <span className="truncate text-left flex-1">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto w-full">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full p-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors truncate ${value === opt.value ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold' : ''}`}
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [loadingMessage, setLoadingMessage] = useState('Drafting your document...');
  const [result, setResult] = useState(initialDoc ? initialDoc.content : '');
  const [budgetEstimate, setBudgetEstimate] = useState<any[] | undefined>(undefined);
  const [templateUrl, setTemplateUrl] = useState<string | null>(initialDoc?.templateUrl || null);
  const [templateIndex, setTemplateIndex] = useState<number>(initialDoc?.template_index || 1);

  useEffect(() => {
    const fetchTemplateUrl = async () => {
      if (!user.department || templateIndex === 0) {
        setTemplateUrl(null);
        return;
      }
      try {
        const { data } = await supabase
          .from('department_templates')
          .select('file_url')
          .eq('department', user.department)
          .eq('document_type', docType)
          .eq('template_index', templateIndex)
          .maybeSingle();

        if (data) setTemplateUrl(data.file_url);
        else setTemplateUrl(null);
      } catch (e) {
        console.error("Error fetching template URL:", e);
      }
    };
    fetchTemplateUrl();
  }, [docType, user.department, templateIndex]);

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
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(!initialDoc);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (isMobileOverlayOpen && !isDesktop) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isMobileOverlayOpen, isDesktop]);

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
    orgName: '', title: '', venue: 'North Eastern Mindanao State University – Tandag, Main Campus', date: new Date().toLocaleDateString('en-CA'), proponent: user.full_name, budget: '', source: 'STF', objectives: '',
    senderName: user.full_name, senderPosition: user.specific_role || '',
    recipientName: '', recipientPosition: '',
    recipientInstitution: 'North Eastern Mindanao State University - Main Campus',
    recipientAddress: 'Tandag City, Surigao del Sur',
    thruPerson: '', thruPosition: '',
    subject: '', details: '', resNum: '', topic: '', whereas: '', resolved: '',
    detailedInstructions: '',
    signatories: [{ name: user.full_name, position: user.specific_role || '' }]
  });


  const [showThru, setShowThru] = useState(false);
  const [showSubject, setShowSubject] = useState(false);

  const [customVenue, setCustomVenue] = useState(false);
  const [customBudget, setCustomBudget] = useState(false);
  const [customSource, setCustomSource] = useState(false);

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

  const handleSignatoryChange = (index: number, field: 'name' | 'position', value: string) => {
    const newSignatories = [...formData.signatories];
    newSignatories[index] = { ...newSignatories[index], [field]: value };
    setFormData({ ...formData, signatories: newSignatories });
  };

  const addSignatory = () => {
    setFormData({
      ...formData,
      signatories: [...formData.signatories, { name: '', position: '' }]
    });
  };

  const removeSignatory = (index: number) => {
    if (formData.signatories.length <= 1) return;
    const newSignatories = formData.signatories.filter((_, i) => i !== index);
    setFormData({ ...formData, signatories: newSignatories });
  };

  const handleGenerate = async (overrideData?: Record<string, string>) => {
    setLoading(true);
    setLoadingMessage('Drafting your document...');
    const dataToUse = { ...(overrideData || formData), showSubject, showThru };

    try {
      const { content, referenceMaterial } = await generateDocument(docType, dataToUse, user?.department);

      // Attempt Budget Estimation if applicable
      if (docType === DocumentType.ACTIVITY_PROPOSAL && dataToUse.budget) {
        setLoadingMessage('Creating table for Budgetary requirements...');
        const estimate = await estimateBudget(referenceMaterial, content, dataToUse.budget);
        if (estimate && estimate.length > 0) {
          setBudgetEstimate(estimate);
        }
      }

      setResult(content);
    } catch (error) {
      console.error("Generation failed", error);
      showToast("Failed to generate document. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const ensureUniqueTitle = async (baseTitle: string, userId: string): Promise<string> => {
    let title = baseTitle;
    let counter = 1;
    let isUnique = false;

    while (!isUnique) {
      const { data, error } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .maybeSingle();

      if (error) {
        console.error("Error checking title uniqueness:", error);
        break; // Fallback to current title if error
      }

      if (!data) {
        isUnique = true;
      } else {
        // If updating an existing doc, and it's THIS document, it's fine
        if (currentDocId && data.id === currentDocId) {
          isUnique = true;
        } else {
          title = `${baseTitle} (${counter++})`;
        }
      }
    }
    return title;
  };

  const handleSaveToStorage = async (content: string) => {
    if (!user || !user.id) {
      showToast("You must be logged in to save documents.", "warning");
      return;
    }
    setLoading(true);
    try {
      // AI generates the title based on content if it's a new document or user hasn't explicitly set a custom one
      let title = formData.title || formData.subject;

      if (!title || title.trim() === "") {
        title = await generateDocumentTitle(content, docType);
      }

      // Ensure title is unique for this user
      title = await ensureUniqueTitle(title, user.id);

      // Update form data so UI reflects the new title
      setFormData(prev => ({ ...prev, title }));

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
      const docData: any = {
        title,
        type: docType,
        content,
        status: 'Draft',
        updated_at: new Date().toISOString(),
        visibility,
        department: user.department,
        versions: updatedVersions,
        template_index: templateIndex
      };
      if (currentDocId) {
        const { error } = await supabase.from('documents').update(docData).eq('id', currentDocId);
        if (error) throw error;
        setResult(content);
        showAlert("Success", "Document updated successfully!", 'success');
      } else {
        docData.user_id = user.id;
        const { data, error } = await supabase.from('documents').insert([docData]).select().single();
        if (error) throw error;
        if (data) {
          setCurrentDocId(data.id);
          setResult(content);
          showAlert("Success", "New document created and saved!", 'success');
        }
      }
    } catch (e) {
      console.error("Failed to save document", e);
      showAlert("Error", `Failed to save document: ${(e as Error).message}`, 'danger');
    } finally {
      setLoading(false);
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
      }, user.department, docType, () => {
        // onProcessing callback
        setLoading(true);
        setResult(""); // Clear previous result to force loading view
      }, formData);
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
    <div className="p-2 md:p-6 max-w-[1600px] mx-auto h-[100dvh] flex flex-col lg:flex-row gap-0 overflow-hidden relative">
      <div
        ref={sidebarRef}
        className={`${isMobileOverlayOpen && !isDesktop ? 'fixed inset-4 z-50 flex' : 'hidden lg:flex z-10'} lg:relative flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl lg:shadow-lg border border-gray-200 dark:border-gray-700 flex-col transition-all duration-300 ease-in-out overflow-hidden`}
        style={isDesktop ? { width: sidebarWidth } : { height: 'calc(100dvh - 2rem)', maxHeight: 'calc(100dvh - 2rem)' }}
      >
        <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 relative">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold flex-1 truncate">
              Generator
              {!canEdit && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full border border-gray-300 font-normal">View Only</span>}
            </h2>
            <button className="lg:hidden p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300" onClick={() => setIsMobileOverlayOpen(false)}>
              <X className="w-5 h-5" />
            </button>
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
                <div className={`flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg ${initialDoc && !isOwner ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button onClick={() => isOwner || !initialDoc ? setVisibility('private') : null} disabled={!!initialDoc && !isOwner} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition ${visibility === 'private' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Private</button>
                  <button onClick={() => isOwner || !initialDoc ? setVisibility('department') : null} disabled={!!initialDoc && !isOwner} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition ${visibility === 'department' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Allow Collaboration</button>
                </div>
              </div>

              {docType === DocumentType.ACTIVITY_PROPOSAL && (
                <>
                  <input name="orgName" value={formData.orgName} placeholder="Organization Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <input name="title" value={formData.title} placeholder="Activity Title" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <CustomSelect
                        className={`${customVenue ? 'w-20' : 'w-full'} transition-all`}
                        value={customVenue ? "Others" : formData.venue}
                        options={[
                          { label: "North Eastern Mindanao State University – Tandag, Main Campus", value: "North Eastern Mindanao State University – Tandag, Main Campus" },
                          { label: "Others", value: "Others" }
                        ]}
                        onChange={(val) => {
                          if (val === "Others") {
                            setCustomVenue(true);
                            setFormData(prev => ({ ...prev, venue: '' }));
                          } else {
                            setCustomVenue(false);
                            setFormData(prev => ({ ...prev, venue: val }));
                          }
                        }}
                      />
                      {customVenue && (
                        <input name="venue" placeholder="Specify Venue" onChange={handleChange} className="flex-1 min-w-0 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 animate-in fade-in slide-in-from-left-1" />
                      )}
                    </div>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <input name="proponent" value={formData.proponent} placeholder="Proponent (Your Name)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <CustomSelect
                        className={`${customBudget ? 'w-20' : 'w-full'} transition-all`}
                        value={customBudget ? "Others" : (["0-5000", "5001-10000", "10001-20000", "20001-30000"].includes(formData.budget) ? formData.budget : (formData.budget === '' ? '' : "Others"))}
                        options={[
                          { label: "Select Budget Range", value: "" },
                          { label: "0-5000", value: "0-5000" },
                          { label: "5001-10000", value: "5001-10000" },
                          { label: "10001-20000", value: "10001-20000" },
                          { label: "20001-30000", value: "20001-30000" },
                          { label: "Others", value: "Others" }
                        ]}
                        onChange={(val) => {
                          if (val === "Others") {
                            setCustomBudget(true);
                            setFormData(prev => ({ ...prev, budget: '' }));
                          } else {
                            setCustomBudget(false);
                            setFormData(prev => ({ ...prev, budget: val }));
                          }
                        }}
                        placeholder="Select Budget Range"
                      />
                      {customBudget && (
                        <input name="budget" placeholder="Specify Budget" onChange={handleChange} className="flex-1 min-w-0 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 animate-in fade-in slide-in-from-left-1" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="block text-sm font-medium text-gray-400">Source of Funds</label>
                      <div className="flex gap-2">
                        <CustomSelect
                          className={`${customSource ? 'w-20' : 'w-full'} transition-all`}
                          value={customSource ? "Others" : (["Student Trust Fund", "Student Development Funds"].includes(formData.source) ? formData.source : (formData.source === '' ? '' : "Others"))}
                          options={[
                            { label: "Student Trust Fund", value: "Student Trust Fund" },
                            { label: "Student Development Funds", value: "Student Development Funds" },
                            { label: "Others", value: "Others" }
                          ]}
                          onChange={(val) => {
                            if (val === "Others") {
                              setCustomSource(true);
                              setFormData(prev => ({ ...prev, source: '' }));
                            } else {
                              setCustomSource(false);
                              setFormData(prev => ({ ...prev, source: val }));
                            }
                          }}
                        />
                        {customSource && (
                          <input name="source" placeholder="Specify Source of Funds" onChange={handleChange} className="flex-1 min-w-0 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 animate-in fade-in slide-in-from-left-1" />
                        )}
                      </div>
                    </div>
                  </div>
                  <textarea name="objectives" value={formData.objectives} placeholder="Objectives" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-24" />
                  <textarea name="detailedInstructions" value={formData.detailedInstructions} placeholder="Detailed Instructions (Optional info to guide AI generation)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-24" />

                  {/* Signatories Section for Activity Proposal */}
                  <div className="space-y-3 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-blue-500" /> Signatories
                      </h4>
                      <button
                        onClick={addSignatory}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md transition-all"
                      >
                        <Plus className="w-3 h-3" /> Add Signatory
                      </button>
                    </div>
                    <div className="space-y-3">
                      {formData.signatories.map((sig: any, index: number) => (
                        <div key={index} className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-600 shadow-sm relative group/sig">
                          <input
                            placeholder="Name"
                            value={sig.name}
                            onChange={(e) => handleSignatoryChange(index, 'name', e.target.value)}
                            className="text-sm w-full p-2 border-b dark:border-gray-600 focus:border-blue-500 outline-none bg-transparent"
                          />
                          <input
                            placeholder="Position"
                            value={sig.position}
                            onChange={(e) => handleSignatoryChange(index, 'position', e.target.value)}
                            className="text-sm w-full p-2 bg-transparent outline-none italic text-gray-500"
                          />
                          {formData.signatories.length > 1 && (
                            <button
                              onClick={() => removeSignatory(index)}
                              className="absolute top-2 right-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover/sig:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {docType === DocumentType.OFFICIAL_LETTER && (
                <>
                  <input name="senderName" value={formData.senderName} placeholder="Your Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <input name="senderPosition" value={formData.senderPosition} placeholder="Your Position" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />

                  <div className="space-y-3 p-4 bg-blue-50/20 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Recipient Details</p>
                    <input name="recipientName" value={formData.recipientName} placeholder="Recipient Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input name="recipientPosition" value={formData.recipientPosition} placeholder="Recipient Position" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input name="recipientInstitution" value={formData.recipientInstitution} placeholder="Institution" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input name="recipientAddress" value={formData.recipientAddress} placeholder="Address" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  </div>


                  <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Optional Sections</p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={showThru}
                          onChange={(e) => setShowThru(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors">Include "THRU"</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={showSubject}
                          onChange={(e) => setShowSubject(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors">Include "SUBJECT"</span>
                      </label>
                    </div>
                  </div>



                  {showThru && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <input
                        name="thruPerson"
                        value={formData.thruPerson}
                        placeholder="Thru Person (e.g. Dr. Juan Cruz)"
                        onChange={handleChange}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      />
                      <input
                        name="thruPosition"
                        value={formData.thruPosition}
                        placeholder="Thru Position (e.g. The Campus Director)"
                        onChange={handleChange}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  )}

                  {showSubject && (
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20 animate-in fade-in slide-in-from-top-1">
                      <p className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1 mb-1">
                        <Bot className="w-3 h-3" /> Auto-Generated Subject
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                        The Subject line will be automatically generated by the AI based on your details.
                      </p>
                    </div>
                  )}



                  <textarea name="details" value={formData.details} placeholder="Details..." onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-32" />

                  {/* Signatories Section for Official Letter */}
                  <div className="space-y-3 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-blue-500" /> Signatories
                      </h4>
                      <button
                        onClick={addSignatory}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md transition-all"
                      >
                        <Plus className="w-3 h-3" /> Add Signatory
                      </button>
                    </div>
                    <div className="space-y-3">
                      {formData.signatories.map((sig: any, index: number) => (
                        <div key={index} className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-600 shadow-sm relative group/sig">
                          <input
                            placeholder="Name"
                            value={sig.name}
                            onChange={(e) => handleSignatoryChange(index, 'name', e.target.value)}
                            className="text-sm w-full p-2 border-b dark:border-gray-600 focus:border-blue-500 outline-none bg-transparent"
                          />
                          <input
                            placeholder="Position"
                            value={sig.position}
                            onChange={(e) => handleSignatoryChange(index, 'position', e.target.value)}
                            className="text-sm w-full p-2 bg-transparent outline-none italic text-gray-500"
                          />
                          {formData.signatories.length > 1 && (
                            <button
                              onClick={() => removeSignatory(index)}
                              className="absolute top-2 right-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover/sig:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {docType === DocumentType.CONSTITUTION && (
                <>
                  <textarea
                    name="detailedInstructions"
                    value={formData.detailedInstructions}
                    placeholder="Detailed Instructions (What additions or specific rules should be added to the constitution?)"
                    onChange={handleChange}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 h-64"
                  />
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
                <h3 className="text-xl md:text-2xl font-bold mb-2 text-white drop-shadow-[0_0_10px_rgba(0,200,255,0.8)] tracking-wide">NEMSify AI</h3>
                <p className="text-gray-300 mb-2 max-w-xs text-center drop-shadow-md text-sm md:text-base">
                  {isLiveActive ? "Listening to your proposal details..." : "Connect to start drafting with NEMSify"}
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

      {isMobileOverlayOpen && !isDesktop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileOverlayOpen(false)}></div>
      )}

      <div className="flex-1 h-full flex flex-col min-w-0 relative">
        <button
          className={`${isMobileOverlayOpen ? 'hidden' : 'flex'} lg:hidden fixed bottom-10 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-2 border-white/20 backdrop-blur-sm transition-all active:scale-90 items-center justify-center animate-in fade-in zoom-in duration-300`}
          onClick={() => setIsMobileOverlayOpen(true)}
          title="Open Generator"
        >
          <FormInput className="w-6 h-6" />
        </button>

        {loading ? (
          <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400">
            <Bot className="w-16 h-16 mb-4 text-blue-500 animate-bounce" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">{loadingMessage}</p>
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
                initialEstimate={budgetEstimate}
                templateIndex={templateIndex}
                onTemplateChange={setTemplateIndex}
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
