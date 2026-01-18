
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateFlow } from './geminiService';
import { FlowiseFlow, BlueprintPlan } from './types';
import { FlowVisualizer } from './components/FlowVisualizer';
import { 
  PaperAirplaneIcon, 
  Squares2X2Icon,
  DocumentArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon as ChevronRightIconLarge,
  PencilSquareIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  FolderIcon,
  TrashIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  CircleStackIcon,
  ChatBubbleBottomCenterTextIcon,
  PlusIcon,
  MicrophoneIcon,
  MagnifyingGlassIcon,
  BookOpenIcon,
  CheckCircleIcon,
  SignalIcon,
  ClockIcon,
  XMarkIcon,
  StopIcon
} from '@heroicons/react/24/outline';

const SmartMarkdown = ({ content, role }: { content: string, role: string }) => {
  return (
    <div className={`prose prose-invert prose-sm max-w-none selection-enabled ${role === 'assistant' ? 'text-zinc-200' : 'text-black'}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};

const BLUEPRINT_GALLERY = [
  { id: 'rag', title: 'Enterprise RAG', icon: <CircleStackIcon className="w-3.5 h-3.5" />, prompt: 'Architect an enterprise RAG system with Pinecone and OpenAI.' },
  { id: 'sql', title: 'Cognitive SQL', icon: <CpuChipIcon className="w-3.5 h-3.5" />, prompt: 'Create a SQL agent that translates natural language to queries.' },
  { id: 'support', title: 'Support Bot', icon: <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" />, prompt: 'Build a support chatbot with memory and routing.' },
  { id: 'vision', title: 'Vision Agent', icon: <SparklesIcon className="w-3.5 h-3.5" />, prompt: 'Create a vision-capable agent for image analysis.' }
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  plan?: BlueprintPlan;
  isBuildSuccess?: boolean;
}

interface VaultItem {
  id: string;
  title: string;
  flow: FlowiseFlow;
  timestamp: number;
}

export default function App() {
  const [isLanding, setIsLanding] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [vault, setVault] = useState<VaultItem[]>(() => {
    const saved = localStorage.getItem('flowsketch_vault');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [synthesisStep, setSynthesisStep] = useState(0);
  const [currentFlow, setCurrentFlow] = useState<FlowiseFlow | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarView, setSidebarView] = useState<'chat' | 'vault'>('chat');
  const [vizActions, setVizActions] = useState<{ zoomIn: () => void, zoomOut: () => void, autoFit: () => void } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [useCaseIndex, setUseCaseIndex] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLanding) {
      const interval = setInterval(() => {
        setUseCaseIndex(prev => (prev + 1) % BLUEPRINT_GALLERY.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isLanding]);

  useEffect(() => { localStorage.setItem('flowsketch_vault', JSON.stringify(vault)); }, [vault]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setIsDeploying(false);
      setSynthesisStep(0);
    }
  };

  const startNewSession = () => {
    setIsLanding(true);
    setMessages([]);
    setCurrentFlow(null);
    setInput('');
    setLoading(false);
    setIsDeploying(false);
    setSynthesisStep(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const parsed = JSON.parse(jsonContent);
        setIsLanding(false);
        if (parsed.nodes && parsed.edges) {
          setCurrentFlow(parsed);
          setActiveTab('preview');
          setMessages([{ role: 'assistant', content: "### Flow Restored\nLoaded architecture from uploaded file.", isBuildSuccess: true }]);
        } else {
          handleSend(`[UPLOADED DATA]\n\n${jsonContent}\n\nPlease analyze this and architect a workflow.`);
        }
      } catch (err) {
        alert("Invalid JSON file provided.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const saveToVault = (flow: FlowiseFlow, description: string) => {
    const newItem: VaultItem = {
      id: Date.now().toString(),
      title: flow.name || description.slice(0, 30) + '...',
      flow,
      timestamp: Date.now()
    };
    setVault(prev => [newItem, ...prev]);
  };

  const restoreFromVault = (item: VaultItem) => {
    setIsLanding(false);
    setCurrentFlow(item.flow);
    setMessages([{ role: 'assistant', content: `### Restoration Complete\nLoading architecture: **${item.title}**`, isBuildSuccess: true }]);
    setActiveTab('preview');
    setSidebarView('chat');
  };

  const handleSend = async (msgText?: string, buildMode: boolean = false) => {
    const text = msgText || input;
    if (!buildMode && !text.trim()) return;
    if (loading) return;

    abortControllerRef.current = new AbortController();
    if (isLanding) setIsLanding(false);

    if (buildMode) { 
      setIsDeploying(true); 
      setSynthesisStep(1);
      setActiveTab('preview'); 
      const timer1 = setTimeout(() => setSynthesisStep(2), 600);
      const timer2 = setTimeout(() => setSynthesisStep(3), 1200);
      const timer3 = setTimeout(() => setSynthesisStep(4), 1800);
    }

    setInput('');
    if (!buildMode) {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
    }
    
    setLoading(true);

    try {
      const promptContext = buildMode ? (messages[messages.length - 1]?.content || text) : text;
      const res = await generateFlow({ description: promptContext }, buildMode ? 'build' : 'plan', abortControllerRef.current.signal);
      
      if (res.success) {
        if (buildMode) setSynthesisStep(5);
        setMessages(prev => [...prev, { role: 'assistant', content: res.explanation, plan: res.plan, isBuildSuccess: buildMode }]);
        if (buildMode && res.flowJson) {
          setCurrentFlow(res.flowJson);
          saveToVault(res.flowJson, promptContext);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: res.explanation }]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `### 🛑 Generation Halted\nThe architect was interrupted.` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `### ⚠️ Fault Detected\n${err.message}` }]);
      }
    } finally {
      setLoading(false);
      setIsDeploying(false);
      abortControllerRef.current = null;
    }
  };

  const SynthesisStep = ({ index, label, activeStep }: { index: number, label: string, activeStep: number }) => {
    const isDone = activeStep > index;
    const isActive = activeStep === index;
    const isPending = activeStep < index;
    return (
      <div className={`flex items-center gap-4 transition-all duration-500 ${isPending ? 'opacity-20 grayscale' : 'opacity-100'}`}>
        <div className="relative">
          {isDone ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : isActive ? <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /> : <div className="w-5 h-5 border-2 border-zinc-800 rounded-full" />}
        </div>
        <span className={`text-sm font-mono tracking-tight ${isActive ? 'text-white font-bold' : 'text-zinc-500'}`}>{label}</span>
      </div>
    );
  };

  if (isLanding) {
    return (
      <div className="h-screen w-full bg-[#050508] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }} />
        
        <div className="w-full max-w-2xl space-y-12 relative z-10 message-appear">
          <div className="text-center space-y-6">
            <div className="relative inline-block">
              <h1 className="text-9xl font-cursive rainbow-text tracking-normal drop-shadow-[0_15px_45px_rgba(45,212,191,0.15)] mb-2">FlowSketch</h1>
            </div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Synthesis Studio</p>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 via-indigo-500/20 to-teal-500/20 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-[#0d0d12]/95 backdrop-blur-3xl border border-white/5 rounded-[3.5rem] shadow-2xl p-5 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 ml-4">
                   <MagnifyingGlassIcon className="w-7 h-7 text-zinc-600" />
                   <span className="text-[15px] font-round font-bold text-zinc-500 hidden sm:inline tracking-tight">Analyze</span>
                </div>
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Architect a custom workflow..." 
                  className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-700 px-2 text-2xl font-round"
                />
                <div className="flex items-center gap-1 pr-2">
                  <button className="p-3 text-zinc-600 hover:text-zinc-400 transition-colors">
                    <MicrophoneIcon className="w-6 h-6" />
                  </button>
                  <button onClick={() => handleSend()} className="p-4 bg-white text-black rounded-[1.75rem] hover:bg-zinc-100 transition-all shadow-xl hover:scale-105 active:scale-95">
                    <PaperAirplaneIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-4 pb-2">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 rounded-2xl text-[11px] font-round font-bold text-zinc-400 hover:text-zinc-200 transition-all">
                  <PlusIcon className="w-4 h-4" />
                  Reference Files
                </button>
                <div className="h-5 w-px bg-zinc-800 mx-3" />
                <div className="use-case-container flex-1">
                  {BLUEPRINT_GALLERY.map((bp, i) => (
                    <button 
                      key={bp.id} 
                      onClick={() => handleSend(bp.prompt)}
                      className={`use-case-item px-5 py-2 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 rounded-2xl transition-all duration-700 ease-in-out ${i === useCaseIndex ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400/80">
                        {bp.icon}
                        {bp.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-12">
           <button className="flex items-center gap-3 px-8 py-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:border-zinc-700 transition-all shadow-lg">
             <BookOpenIcon className="w-5 h-5" />
             Technical Documentation
           </button>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020203] text-zinc-100 font-sans overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
      {sidebarVisible && (
        <aside className="w-[440px] flex flex-col bg-[#0a0a0d] border-r border-zinc-800/60 shadow-2xl relative z-30">
          <header className="p-6 border-b border-zinc-800/50 flex flex-col gap-4 bg-[#0d0d12]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shadow-lg">
                  <Squares2X2Icon className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="relative inline-block overflow-visible">
                  <h1 className="text-2xl font-cursive rainbow-text tracking-tight pr-4">FlowSketch</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startNewSession()} className="p-2 border border-zinc-800 rounded-lg hover:border-zinc-500 transition-all text-zinc-500 hover:text-white" title="Return to Portal"><ArrowPathIcon className="w-4 h-4" /></button>
                <button onClick={() => setSidebarView(sidebarView === 'chat' ? 'vault' : 'chat')} className={`p-2 border transition-all rounded-lg ${sidebarView === 'vault' ? 'bg-zinc-100 text-black border-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-500'}`}>{sidebarView === 'chat' ? <FolderIcon className="w-4 h-4" /> : <ChatBubbleLeftRightIcon className="w-4 h-4" />}</button>
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-6 space-y-10 no-scrollbar">
            {sidebarView === 'chat' ? (
              <>{messages.map((m, i) => (
                <div key={i} className={`flex flex-col gap-2 message-appear ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-7 rounded-[32px] text-[13px] border shadow-2xl max-w-full selection-enabled ${m.role === 'user' ? 'bg-zinc-100 text-black border-white' : 'bg-[#12121a] border-zinc-800/50 text-zinc-100'}`}>
                    <SmartMarkdown content={m.content} role={m.role} />
                    {!m.isBuildSuccess && i === messages.length - 1 && m.role === 'assistant' && (
                      <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                        <div className="p-6 bg-orange-500/5 border border-orange-500/10 rounded-3xl group">
                          <p className="text-[10px] font-black uppercase text-orange-500 tracking-[0.2em] mb-3 flex items-center gap-2"><SparklesIcon className="w-4 h-4 animate-pulse" /> Plan Validated</p>
                          <p className="text-[12px] text-zinc-400 mb-6 leading-relaxed">Architecture manifest ready. Synthesize production build?</p>
                          <button onClick={() => handleSend("", true)} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-orange-900/20 transition-all active:scale-95"><RocketLaunchIcon className="w-5 h-5" /> Confirm & Build</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}</>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <ClockIcon className="w-4 h-4 text-zinc-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Architectural Vault</span>
                </div>
                {vault.length === 0 ? <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl"><p className="text-zinc-600 text-xs font-mono">Vault empty...</p></div> : vault.map(v => (
                  <div key={v.id} onClick={() => restoreFromVault(v)} className="p-6 bg-[#0d0d12] border border-zinc-800/50 rounded-3xl cursor-pointer hover:border-indigo-500 hover:bg-zinc-900 transition-all flex justify-between items-center group relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-200 block truncate pr-4">{v.title}</span>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">{v.flow.nodes.length} Components</span>
                        <span className="text-[8px] text-zinc-700 uppercase font-black">{new Date(v.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setVault(prev => prev.filter(it => it.id !== v.id)); }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-opacity p-2 hover:bg-white/5 rounded-xl"><TrashIcon className="w-5 h-5" /></button>
                  </div>
                ))}
              </div>
            )}
            {loading && (
              <div className="flex flex-col gap-4 p-6 bg-zinc-900/50 rounded-3xl border border-zinc-800/50 animate-pulse">
                <div className="flex items-center gap-4">
                  <ArrowPathIcon className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Architecting...</span>
                </div>
                <button onClick={stopGeneration} className="w-full py-2.5 bg-zinc-800 hover:bg-red-900/20 text-zinc-500 hover:text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-zinc-700/50 transition-all"><StopIcon className="w-4 h-4" /> Terminate Session</button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <footer className="p-6 border-t border-zinc-800/50 bg-[#0d0d12]">
            <div className="relative">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Consult architect..." className="w-full bg-[#15151e] border border-zinc-800 rounded-3xl py-6 pl-14 pr-14 text-sm focus:border-indigo-500 outline-none transition-all selection-enabled font-round" />
              <button onClick={() => fileInputRef.current?.click()} className="absolute left-4 top-5 text-zinc-500 hover:text-zinc-300 transition-colors" title="Import Schema"><DocumentArrowUpIcon className="w-6 h-6" /></button>
              <button onClick={() => handleSend()} className="absolute right-3 top-3 p-4 bg-zinc-100 text-black rounded-2xl hover:bg-white transition-all shadow-xl"><PaperAirplaneIcon className="w-5 h-5" /></button>
            </div>
          </footer>
        </aside>
      )}
      <main className="flex-1 flex flex-col relative bg-[#020203] overflow-hidden">
        <button onClick={() => setSidebarVisible(!sidebarVisible)} className="absolute left-6 top-1/2 -translate-y-1/2 z-40 p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white shadow-2xl transition-all">{sidebarVisible ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIconLarge className="w-5 h-5" />}</button>
        <nav className="px-12 py-10 border-b border-zinc-800/30 flex justify-between items-center bg-[#020203]/80 backdrop-blur-3xl z-20 shrink-0">
          <div className="flex gap-6 items-center">
            <div className="flex bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800/50 shadow-inner">
              <button onClick={() => setActiveTab('preview')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}>Visualizer</button>
              <button onClick={() => setActiveTab('code')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'code' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}>Schema</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentFlow && (
              <>
                <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(currentFlow, null, 2)); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }} className={`flex items-center gap-2 px-8 py-3.5 border text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all ${copySuccess ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white'}`}><ClipboardDocumentCheckIcon className="w-5 h-5" /> {copySuccess ? 'Copied' : 'Copy JSON'}</button>
                <button onClick={() => { const blob = new Blob([JSON.stringify(currentFlow, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${currentFlow.name || 'flow'}.json`; a.click(); }} className="flex items-center gap-2 px-10 py-3.5 bg-zinc-100 text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white transition-all shadow-xl hover:scale-105 active:scale-95"><ArrowDownTrayIcon className="w-5 h-5" /> Download Build</button>
              </>
            )}
          </div>
        </nav>
        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'preview' ? (
            <>{currentFlow && !isDeploying ? <FlowVisualizer flow={currentFlow} onInitActions={setVizActions} /> : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#020203]">
                {isDeploying ? (
                  <div className="w-full max-w-md p-10 bg-[#0d0d12] border border-white/5 rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] message-appear relative group">
                    <header className="flex items-center justify-between mb-10 pb-6 border-b border-white/5">
                      <div className="flex items-center gap-3"><SignalIcon className="w-5 h-5 text-orange-500 animate-pulse" /><span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">Synthesis Engine Active</span></div>
                      <button onClick={stopGeneration} className="p-2 hover:bg-white/5 rounded-full text-zinc-600 hover:text-red-400 transition-all" title="Abort Kernel Synthesis"><XMarkIcon className="w-5 h-5" /></button>
                    </header>
                    <div className="space-y-6">
                      <SynthesisStep index={1} label="Initializing Kernel Synthesis" activeStep={synthesisStep} />
                      <SynthesisStep index={2} label="Analyzing Domain Requirements" activeStep={synthesisStep} />
                      <SynthesisStep index={3} label="Resolving Component Dependencies" activeStep={synthesisStep} />
                      <SynthesisStep index={4} label="Streaming Flow Construction" activeStep={synthesisStep} />
                      <SynthesisStep index={5} label="Finalizing Spatial Layout" activeStep={synthesisStep} />
                    </div>
                    <div className="mt-12 p-5 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex flex-col gap-4">
                       <div className="flex items-center gap-3"><ArrowPathIcon className="w-4 h-4 text-orange-500 animate-spin" /><span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Compiling Manifest...</span></div>
                       <button onClick={stopGeneration} className="w-full py-3 bg-red-900/10 hover:bg-red-900/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-red-500/20 transition-all">Cancel Synthesis</button>
                    </div>
                  </div>
                ) : <div className="opacity-[0.015] text-center space-y-10 group hover:opacity-[0.04] transition-opacity duration-1000"><Squares2X2Icon className="w-72 h-72 mx-auto" /><p className="text-[24px] font-black uppercase tracking-[2.5em]">Architect Grid</p></div>}
              </div>
            )}</>
          ) : (
            <div className="schema-container h-full bg-[#050508] p-12 selection-enabled no-scrollbar font-mono text-[13px] text-emerald-400/80 leading-relaxed shadow-inner">
              <pre className="pb-32">{currentFlow ? JSON.stringify(currentFlow, null, 2) : "// Blueprint validation required..."}</pre>
            </div>
          )}
          {currentFlow && activeTab === 'preview' && (
            <div className="absolute left-1/2 bottom-12 -translate-x-1/2 flex gap-4 bg-zinc-900/90 p-4 rounded-[40px] border border-zinc-800 shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] backdrop-blur-3xl z-40">
              <div className="flex gap-1 border-r border-zinc-800 pr-4">
                <button onClick={() => vizActions?.zoomOut()} className="p-4 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-2xl transition-all"><MagnifyingGlassMinusIcon className="w-6 h-6" /></button>
                <button onClick={() => vizActions?.zoomIn()} className="p-4 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-2xl transition-all"><MagnifyingGlassPlusIcon className="w-6 h-6" /></button>
              </div>
              <button onClick={() => vizActions?.autoFit()} className="px-12 py-2 text-[11px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-2xl transition-all">Recenter Grid</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
