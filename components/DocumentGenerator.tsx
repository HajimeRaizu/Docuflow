
import React, { useState, useEffect, useRef } from 'react';
import { DocumentType, GeneratedDocument, DocumentVersion, User, DocumentTypePermissionKey } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { generateDocument, LiveSession } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { Bot, ArrowLeft, FormInput, Mic, PhoneOff, GripVertical, Eye } from 'lucide-react';
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

// MOCK DATA FOR DEMO PURPOSES
const MOCK_GENERATED_DOC = `
<div style="font-family: 'Times New Roman', serif;">
  <p style="text-align: center; font-weight: bold; font-size: 14pt;">ACTIVITY PROPOSAL</p>
  <br>
  <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
    <tr><td style="border: 1px solid black; padding: 5px;"><strong>Title of Activity</strong></td><td style="border: 1px solid black; padding: 5px;">CITE Days 2024</td></tr>
    <tr><td style="border: 1px solid black; padding: 5px;"><strong>Target Participants</strong></td><td style="border: 1px solid black; padding: 5px;">All CITE Students and Faculty</td></tr>
    <tr><td style="border: 1px solid black; padding: 5px;"><strong>Venue</strong></td><td style="border: 1px solid black; padding: 5px;">NEMSU Gymnasium</td></tr>
    <tr><td style="border: 1px solid black; padding: 5px;"><strong>Date</strong></td><td style="border: 1px solid black; padding: 5px;">October 24-25, 2024</td></tr>
    <tr><td style="border: 1px solid black; padding: 5px;"><strong>Proponent</strong></td><td style="border: 1px solid black; padding: 5px;">Student Council</td></tr>
    <tr><td style="border: 1px solid black; padding: 5px;"><strong>Total Budget</strong></td><td style="border: 1px solid black; padding: 5px;">PHP 15,000.00</td></tr>
    <tr><td style="border: 1px solid black; padding: 5px;"><strong>Source of Fund</strong></td><td style="border: 1px solid black; padding: 5px;">Org Funds</td></tr>
  </table>
  <br>
  <h3>I. RATIONALE</h3>
  <p>The College of Information Technology Education (CITE) Days is an annual event designed to foster camaraderie and sportsmanship among students. This activity serves as a platform for students to showcase their skills in various technical and non-technical competitions. It aligns with the university's mission to provide holistic development for its student body.</p>
  <br>
  <h3>II. OBJECTIVES</h3>
  <ol>
    <li>To promote unity among CITE students.</li>
    <li>To develop leadership and teamwork skills.</li>
    <li>To provide a venue for showcasing talents.</li>
  </ol>
  <br>
  <h3>III. OUTCOMES</h3>
  <ol>
    <li>Improved student engagement and morale.</li>
    <li>Successful execution of technical and sports competitions.</li>
    <li>Strengthened bond between faculty and students.</li>
  </ol>
  <br>
  <h3>IV. BUDGETARY REQUIREMENTS</h3>
  <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
    <tr style="background-color: #f0f0f0;">
        <th style="border: 1px solid black; padding: 5px;">Particulars</th>
        <th style="border: 1px solid black; padding: 5px;">Unit</th>
        <th style="border: 1px solid black; padding: 5px;">Quantity</th>
        <th style="border: 1px solid black; padding: 5px;">Unit Cost</th>
        <th style="border: 1px solid black; padding: 5px;">Total Cost</th>
    </tr>
    <tr>
        <td style="border: 1px solid black; padding: 5px;">Snacks</td>
        <td style="border: 1px solid black; padding: 5px;">Packs</td>
        <td style="border: 1px solid black; padding: 5px;">100</td>
        <td style="border: 1px solid black; padding: 5px;">50.00</td>
        <td style="border: 1px solid black; padding: 5px;">5,000.00</td>
    </tr>
    <tr>
        <td style="border: 1px solid black; padding: 5px;">Decorations</td>
        <td style="border: 1px solid black; padding: 5px;">Lot</td>
        <td style="border: 1px solid black; padding: 5px;">1</td>
        <td style="border: 1px solid black; padding: 5px;">5,000.00</td>
        <td style="border: 1px solid black; padding: 5px;">5,000.00</td>
    </tr>
     <tr>
        <td style="border: 1px solid black; padding: 5px;">Prizes/Awards</td>
        <td style="border: 1px solid black; padding: 5px;">Lot</td>
        <td style="border: 1px solid black; padding: 5px;">1</td>
        <td style="border: 1px solid black; padding: 5px;">5,000.00</td>
        <td style="border: 1px solid black; padding: 5px;">5,000.00</td>
    </tr>
  </table>
  <br>
  <h3>V. SIGNATORIES</h3>
  <table style="width: 100%; border: none; margin-top: 20px;">
    <tr>
        <td style="border: none; width: 50%; padding-top: 30px;">Prepared by:<br><br><strong>JIM SHENDRICK</strong><br>Student Leader</td>
        <td style="border: none; width: 50%; padding-top: 30px;">Noted by:<br><br><strong>ADVISER NAME</strong><br>Org Adviser</td>
    </tr>
    <tr>
        <td style="border: none; width: 50%; padding-top: 30px;">Approved as to Appropriation:<br><br><strong>BUDGET OFFICER</strong></td>
        <td style="border: none; width: 50%; padding-top: 30px;">Approved as to Funds:<br><br><strong>ACCOUNTANT</strong></td>
    </tr>
    <tr>
        <td colspan="2" style="border: none; text-align: center; padding-top: 30px;">Recommending Approval:<br><br><strong>DEAN NAME</strong><br>Dean, CITE</td>
    </tr>
    <tr>
        <td colspan="2" style="border: none; text-align: center; padding-top: 40px;">Approved:<br><br><strong>CAMPUS DIRECTOR</strong></td>
    </tr>
  </table>
</div>
`;

// --- SHADERS ---

const vertexShader = `
uniform float u_time;
uniform float u_frequency;
varying vec2 vUv;
varying vec3 vNormal;
varying float vDisplacement;

// Simplex 3D Noise 
// (Simplified for performance)
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
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
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
  
  // Dynamic noise moving with time
  float noise = snoise(position * 3.0 + vec3(u_time * 0.8));
  
  // Amplify displacement with frequency
  // Use higher frequency multiplier for spikes
  float spike = max(0.0, noise);
  vDisplacement = spike * (0.2 + u_frequency * 1.5);
  
  // Displace along normal
  vec3 newPosition = position + normal * vDisplacement;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
uniform float u_time;
uniform float u_frequency;
varying vec3 vNormal;
varying float vDisplacement;

void main() {
  // Core colors - Deep Blue to Neon Cyan
  vec3 colorBase = vec3(0.05, 0.1, 0.4); 
  vec3 colorHigh = vec3(0.2, 0.8, 1.0);
  
  // Mix based on displacement (higher spikes = lighter)
  float t = smoothstep(0.0, 0.8, vDisplacement);
  vec3 finalColor = mix(colorBase, colorHigh, t);
  
  // Audio reactivity for Glow
  // We boost the intensity well above 1.0 to trigger the Bloom effect
  float glowIntensity = 1.5 + (u_frequency * 4.0);
  finalColor *= glowIntensity;

  // Add a pulsing core effect
  float pulse = sin(u_time * 2.0) * 0.5 + 0.5;
  vec3 pulseColor = vec3(0.5, 0.0, 0.8) * pulse * u_frequency;
  
  finalColor += pulseColor;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;



export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ user, initialType = DocumentType.ACTIVITY_PROPOSAL, initialDoc, onBack }) => {
  const [docType, setDocType] = useState<DocumentType>(initialDoc ? initialDoc.type : initialType);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(initialDoc ? initialDoc.content : '');
  const [templateUrl, setTemplateUrl] = useState<string | null>(initialDoc?.templateUrl || null); // New State

  // Fetch Template URL when DocType changes or on mount
  useEffect(() => {
    const fetchTemplateUrl = async () => {
      if (!user.department) return;

      try {
        const { data } = await supabase
          .from('department_templates')
          .select('file_url')
          .eq('department', user.department)
          .eq('document_type', docType)
          .single();

        if (data) setTemplateUrl(data.file_url);
        else setTemplateUrl(null);
      } catch (e) {
        console.error("Error fetching template URL:", e);
      }
    };

    fetchTemplateUrl();
  }, [docType, user.department]);
  const [inputMode, setInputMode] = useState<'form' | 'chat'>('form');
  const [visibility, setVisibility] = useState<'private' | 'department'>(initialDoc?.visibility || 'private');

  // Sidebar Resize State
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

  // Modal State
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
      showCancel: false, // Alerts don't need cancel
      onConfirm: () => setModalState(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Document Tracking for Versioning
  const [currentDocId, setCurrentDocId] = useState<string | null>(initialDoc ? initialDoc.id : null);

  // Permissions Check
  const isOwner = initialDoc?.user_id === user.id;
  const isSharedWithDept = initialDoc?.visibility === 'department' && initialDoc?.department === user.department;

  // Check if user has specific permission for this document type
  // If user is Admin/SuperAdmin, they might have global edit access (optional, but good practice)
  const hasTypePermission = user.user_type === 'admin' || user.user_type === 'super_admin' ||
    (user.permissions && user.permissions[DocumentTypePermissionKey[docType]] === 'edit');

  // Can Edit if:
  // 1. New Document (no initialDoc)
  // 2. Owner
  // 3. Shared with Dept AND User has 'edit' permission for this specific DocType
  const canEdit = !initialDoc || isOwner || (isSharedWithDept && hasTypePermission);

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

  // Load initial document data into form if editing
  useEffect(() => {
    if (initialDoc) {
      setFormData(prev => ({
        ...prev,
        title: initialDoc.title || '',
        // If we had more structured data saved, we would populate it here.
        // For now, we only have generic content and title from the DB for re-opening.
      }));
    }
  }, [initialDoc]);

  // Live Agent State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveSessionRef = useRef<LiveSession | null>(null);

  // Visualizer Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const frameIdRef = useRef<number>(0);

  // Handle Resize and Desktop Check
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (sidebarRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const newWidth = e.clientX - sidebarRect.left;

        // Min 300px, Max 800px constraint
        if (newWidth > 300 && newWidth < 800) {
          setSidebarWidth(newWidth);
        }
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

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    // Add a dark background color to make bloom pop, or keep transparent
    // scene.background = new THREE.Color(0x050510); 

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.z = 2.5;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false }); // Antialias false for post-processing performance
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Post Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,  // strength
      0.4,  // radius
      0.1   // threshold
    );

    const outputPass = new OutputPass();

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    composerRef.current = composer;

    // 4. Object (The AI Orb)
    const uniforms = {
      u_time: { value: 0.0 },
      u_frequency: { value: 0.0 }
    };

    const geometry = new THREE.IcosahedronGeometry(1.0, 15); // High subdivision for smooth spikes
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      wireframe: true, // Wireframe often looks techy with bloom
      transparent: true,
      side: THREE.DoubleSide
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Inner Core (Solid glow)
    const coreGeo = new THREE.IcosahedronGeometry(0.8, 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x001133 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // 5. Animation Loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      const time = performance.now() * 0.001;
      uniforms.u_time.value = time;

      sphere.rotation.y = time * 0.1;
      sphere.rotation.z = time * 0.05;

      // Audio Data Integration
      let avgFreq = 0;
      if (liveSessionRef.current) {
        // Mix Input and Output
        const session = liveSessionRef.current;
        let sum = 0;
        let count = 0;

        if (session.inputAnalyser) {
          const data = new Uint8Array(session.inputAnalyser.frequencyBinCount);
          session.inputAnalyser.getByteFrequencyData(data);
          // Focus on lower frequencies for visual impact
          const subArray = data.slice(0, data.length / 2);
          const inputAvg = subArray.reduce((a, b) => a + b, 0) / subArray.length;
          sum += inputAvg;
          count++;
        }

        if (session.outputAnalyser) {
          const data = new Uint8Array(session.outputAnalyser.frequencyBinCount);
          session.outputAnalyser.getByteFrequencyData(data);
          const outputAvg = data.reduce((a, b) => a + b, 0) / data.length;
          sum += outputAvg * 1.5; // Boost output visual
          count++;
        }

        if (count > 0) {
          avgFreq = sum / count;
        }
      }

      // Normalize (0.0 to 1.0 approx)
      const targetFreq = Math.min(avgFreq / 100.0, 1.2);

      // Smooth Lerp
      uniforms.u_frequency.value += (targetFreq - uniforms.u_frequency.value) * 0.15;

      // Adjust Bloom strength dynamically based on loudness
      bloomPass.strength = 1.2 + uniforms.u_frequency.value * 2.0;
      bloomPass.radius = 0.4 + uniforms.u_frequency.value * 0.2;

      composer.render();
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
    composerRef.current = null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const generatedContent = await generateDocument(docType, formData);
      setResult(generatedContent);
    } catch (error) {
      console.error("Generation failed", error);
      alert("Failed to generate document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToStorage = async (content: string) => {
    if (!user || !user.id) {
      alert("You must be logged in to save documents.");
      return;
    }

    try {
      // Determine a title based on available data or defaults
      let title = "Untitled Document";
      if (formData.title) title = formData.title;
      else if (formData.subject) title = formData.subject;
      else if (docType) title = `${docType} - ${new Date().toLocaleDateString()}`;

      // Enforce Permission Check
      // This check is now redundant due to the `canEdit` variable, but kept for safety
      // if (initialDoc && !isOwner && !isSharedWithDept) {
      //   showAlert("Permission Denied", "You do not have permission to edit this document.", 'danger');
      //   return;
      // }

      // Allow edit if Owner OR (Shared AND Same Department)
      // New documents (no initialDoc) are always allowed (owner will be creator)
      // Allow edit if Owner OR (Shared AND Same Department)
      // New documents (no initialDoc) are always allowed (owner will be creator)
      if (initialDoc && !isOwner && !isSharedWithDept) {
        // Double check permission on save just in case
        const hasTypePermission = user.user_type === 'admin' || user.user_type === 'super_admin' ||
          (user.permissions && user.permissions[DocumentTypePermissionKey[docType]] === 'edit');

        if (!hasTypePermission) {
          showAlert("Permission Denied", "You do not have permission to edit this document type.", 'danger');
          return;
        }
      }

      // Prepare Versions

      // Prepare Versions
      // Prepare Versions
      let currentVersions = initialDoc?.versions || [];

      // BACKFILL: If updating an existing doc that has NO versions yet
      if (initialDoc && currentVersions.length === 0) {
        // Create an "Original" version representing the state before this edit
        const originalVersion: DocumentVersion = {
          id: `original-${initialDoc.id}`,
          content: initialDoc.content, // The content when loaded
          savedAt: initialDoc.createdAt || new Date(),
          versionNumber: 1,
          modifiedBy: {
            id: initialDoc.user_id || 'unknown',
            name: (initialDoc.user_id === user.id) ? user.full_name : "Original Author"
          }
        };
        currentVersions = [originalVersion];
      }

      const newVersion: DocumentVersion = {
        id: Date.now().toString(),
        content: content,
        savedAt: new Date(),
        versionNumber: currentVersions.length + 1,
        modifiedBy: {
          id: user.id,
          name: user.full_name
        }
      };
      const updatedVersions = [...currentVersions, newVersion];

      // Base Data
      const docData: any = {
        title: title,
        type: docType,
        content: content,
        status: 'Draft',
        updated_at: new Date().toISOString(),
        visibility: visibility,
        department: user.department,
        versions: updatedVersions
      };

      if (currentDocId) {
        // Update - Do NOT overwrite user_id (Owner)
        const { error } = await supabase
          .from('documents')
          .update(docData)
          .eq('id', currentDocId);

        if (error) throw error;
        showAlert("Success", "Document updated successfully!", 'success');
      } else {
        // Insert - Set user_id (Owner)
        docData.user_id = user.id;

        const { data, error } = await supabase
          .from('documents')
          .insert([docData])
          .select()
          .single();

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
      // Disconnect
      if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
        liveSessionRef.current = null;
      }
      setIsLiveActive(false);
    } else {
      // Connect

      const session = new LiveSession((html) => {
        // Callback when document is generated by voice
        setResult(html);
        setLoading(false);
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
      {/* Left Panel - Resizable on Desktop */}
      <div
        ref={sidebarRef}
        className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[40vh] lg:h-full transition-all duration-300 ease-in-out"
        style={{
          width: isDesktop ? sidebarWidth : '100%',
          marginBottom: isDesktop ? 0 : '1rem'
        }}
      >
        <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">
              Generator
              {!canEdit && (
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full border border-gray-300 font-normal">View Only</span>
              )}
            </h2>
          </div>

          {/* Only show Tabs if NOT Read Only */}
          {canEdit && (
            <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex">
              <button
                onClick={() => setInputMode('form')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${inputMode === 'form' ? 'bg-white dark:bg-gray-600 shadow text-blue-700 dark:text-blue-300' : 'text-gray-500'}`}
              >
                <FormInput className="w-4 h-4" /> Form Input
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

        {/* Sidebar Content */}
        {!canEdit ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full text-gray-500">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
              <Eye className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-medium">View Only Mode</p>
            <p className="text-sm mt-2 max-w-[200px]">
              You are viewing a shared document. Editing controls are disabled.
            </p>
          </div>
        ) : (
          inputMode === 'form' ? (
            <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6">
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

              <div>
                <label className="block text-sm font-medium mb-2">Visibility {initialDoc && !isOwner && <span className="text-xs font-normal text-gray-500">(Owner only)</span>}</label>
                <div className={`flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg ${initialDoc && !isOwner ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button
                    onClick={() => isOwner || !initialDoc ? setVisibility('private') : null}
                    disabled={!!initialDoc && !isOwner}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${visibility === 'private' ? 'bg-white dark:bg-gray-600 shadow text-blue-600' : 'text-gray-500'}`}
                  >
                    Private
                  </button>
                  <button
                    onClick={() => isOwner || !initialDoc ? setVisibility('department') : null}
                    disabled={!!initialDoc && !isOwner}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${visibility === 'department' ? 'bg-white dark:bg-gray-600 shadow text-blue-600' : 'text-gray-500'}`}
                  >
                    Share with {user.department}
                  </button>
                </div>
              </div>

              {/* Dynamic Fields */}
              {docType === DocumentType.ACTIVITY_PROPOSAL && (
                <>
                  <input name="orgName" placeholder="Organization Name" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <input name="title" placeholder="Activity Title" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input name="venue" placeholder="Venue" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    <input type="date" name="date" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  </div>

                  <input name="proponent" placeholder="Proponent (Your Name)" onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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



              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="flex flex-col flex-1 h-full bg-black relative overflow-hidden rounded-b-xl lg:rounded-b-none lg:rounded-br-none">
              {/* Visualizer Canvas Container */}
              <div
                ref={canvasRef}
                className="absolute inset-0 w-full h-full z-0"
                style={{ background: 'radial-gradient(circle at center, #050510 0%, #000000 70%)' }}
              />

              {/* UI Overlay */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-12 pointer-events-none">
                <h3 className="text-xl md:text-2xl font-bold mb-2 text-white drop-shadow-[0_0_10px_rgba(0,200,255,0.8)] tracking-wide">
                  {isLiveActive ? "NEMSU AI COORDINATOR" : "NEMSU AI AGENT"}
                </h3>
                <p className="text-gray-300 mb-8 max-w-xs text-center drop-shadow-md text-sm md:text-base">
                  {isLiveActive
                    ? "Listening to your proposal details..."
                    : "Connect to start the interview process."}
                </p>

                <button
                  onClick={toggleLiveAgent}
                  className={`
                            px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-base md:text-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-2xl pointer-events-auto border-2
                            ${isLiveActive
                      ? 'bg-red-500/20 border-red-500 text-red-100 hover:bg-red-500 hover:text-white backdrop-blur-sm'
                      : 'bg-blue-600/20 border-blue-500 text-blue-100 hover:bg-blue-500 hover:text-white backdrop-blur-sm'}
                        `}
                >
                  {isLiveActive ? (
                    <><PhoneOff className="w-5 h-5 md:w-6 md:h-6" /> End Session</>
                  ) : (
                    <><Mic className="w-5 h-5 md:w-6 md:h-6" /> Start Interview</>
                  )}
                </button>
              </div>
            </div>
          )
        )}
      </div>
      {/* Resize Handle (Desktop Only) */}
      <div
        className="hidden lg:flex w-5 cursor-col-resize items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0 text-gray-400 hover:text-blue-500 select-none"
        onMouseDown={() => setIsResizing(true)}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Right Panel */}
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
                title={formData.title || formData.subject || "Document"}
                onToggleVoice={toggleLiveAgent}
                isVoiceActive={isLiveActive}
                onSave={handleSaveToStorage}
                readOnly={!canEdit}
              />
            </div>
          </div>
        )}
      </div>

      {/* Alert Modal */}
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
