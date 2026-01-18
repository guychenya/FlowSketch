
import React, { useState, useEffect, useRef } from 'react';
import { FlowiseFlow, FlowiseNode, FlowiseEdge } from '../types';
import { 
  RectangleStackIcon,
  CircleStackIcon,
  PaperClipIcon,
  CpuChipIcon,
  BeakerIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';

const getNodeIcon = (type?: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('chat') || t.includes('llm')) return <CommandLineIcon className="w-6 h-6 text-zinc-100" />;
  if (t.includes('vector') || t.includes('database')) return <CircleStackIcon className="w-6 h-6 text-zinc-100" />;
  if (t.includes('pdf') || t.includes('document')) return <PaperClipIcon className="w-6 h-6 text-zinc-100" />;
  if (t.includes('agent') || t.includes('supervisor')) return <BeakerIcon className="w-6 h-6 text-zinc-100" />;
  if (t.includes('tool')) return <RectangleStackIcon className="w-6 h-6 text-zinc-100" />;
  return <CpuChipIcon className="w-6 h-6 text-zinc-100" />;
};

interface VisualizerProps {
  flow: FlowiseFlow;
  onInitActions?: (actions: { zoomIn: () => void, zoomOut: () => void, autoFit: () => void }) => void;
}

export const FlowVisualizer: React.FC<VisualizerProps> = ({ flow, onInitActions }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<FlowiseNode[]>([]);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  const [scale, setScale] = useState(0.8);
  const [offset, setOffset] = useState({ x: 100, y: 100 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleZoom = (direction: 'in' | 'out', clientX?: number, clientY?: number) => {
    const factor = direction === 'in' ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * factor, 0.1), 3);
    
    if (clientX !== undefined && clientY !== undefined && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      const newOffsetX = x - (x - offset.x) * (newScale / scale);
      const newOffsetY = y - (y - offset.y) * (newScale / scale);
      
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
    
    setScale(newScale);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) handleZoom('in', e.clientX, e.clientY);
    else handleZoom('out', e.clientX, e.clientY);
  };

  const autoFit = (currentNodes: FlowiseNode[]) => {
    if (!currentNodes.length || !containerRef.current) return;
    const padding = 150;
    const { width, height } = containerRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    currentNodes.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 320);
      maxY = Math.max(maxY, n.position.y + 400);
    });
    const cw = maxX - minX;
    const ch = maxY - minY;
    const s = Math.min((width - padding) / cw, (height - padding) / ch, 0.8);
    setScale(s);
    setOffset({ x: width / 2 - ((minX + maxX) / 2) * s, y: height / 2 - ((minY + maxY) / 2) * s });
  };

  useEffect(() => {
    if (onInitActions) {
      onInitActions({
        zoomIn: () => handleZoom('in'),
        zoomOut: () => handleZoom('out'),
        autoFit: () => autoFit(nodes)
      });
    }
  }, [nodes, onInitActions, scale, offset]);

  useEffect(() => {
    if (flow?.nodes) {
      const sanitized = flow.nodes.map(n => ({
        ...n,
        position: n.position || { x: 0, y: 0 },
        width: n.width || 320,
        height: n.height || 400
      }));
      setNodes(sanitized);
      setTimeout(() => autoFit(sanitized), 100);
    }
  }, [flow]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / scale;
        const dy = (e.clientY - dragging.startY) / scale;
        setNodes(prev => prev.map(n => n.id === dragging.id ? { 
          ...n, 
          position: { x: dragging.nodeX + dx, y: dragging.nodeY + dy }
        } : n));
      } else if (isPanning) {
        setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
    };
    const onMouseUp = () => { setDragging(null); setIsPanning(false); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [dragging, isPanning, panStart, scale]);

  const getAnchorPos = (nodeId: string, handleId: string, type: 'input' | 'output') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    
    const anchors = type === 'input' ? (node.data?.inputAnchors || []) : (node.data?.outputAnchors || []);
    const index = anchors.findIndex((a: any) => a.id === handleId);
    const validIndex = index === -1 ? 0 : index;
    
    const baseY = node.position.y + 85 + (validIndex * 45);
    const baseX = type === 'input' ? node.position.x : node.position.x + 320;
    
    return { x: baseX, y: baseY };
  };

  return (
    <div 
      ref={containerRef} 
      onWheel={onWheel}
      className="w-full h-full bg-[#020203] relative overflow-hidden cursor-grab active:cursor-grabbing" 
      onMouseDown={(e) => { 
        if ((e.target as HTMLElement).closest('.node-element')) return;
        setIsPanning(true); 
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); 
      }}>
      
      <div className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          {flow?.edges?.map(edge => {
            const start = getAnchorPos(edge.source, edge.sourceHandle || '', 'output');
            const end = getAnchorPos(edge.target, edge.targetHandle || '', 'input');
            
            const pathData = `M ${start.x} ${start.y} C ${start.x + 80} ${start.y}, ${end.x - 80} ${end.y}, ${end.x} ${end.y}`;
            
            return (
              <g key={edge.id}>
                <path d={pathData} fill="none" stroke="#2a2a35" strokeWidth="2" className="opacity-40" />
                <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="8,16" className="opacity-40">
                   <animate attributeName="stroke-dashoffset" from="200" to="0" dur="4s" repeatCount="indefinite" />
                </path>
                <circle r="3" fill="#fb923c">
                  <animateMotion path={pathData} dur="3s" repeatCount="indefinite" rotate="auto" />
                  <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}
        </svg>

        {nodes.map(node => (
          <div key={node.id} 
            onMouseDown={(e) => { e.stopPropagation(); setDragging({ id: node.id, startX: e.clientX, startY: e.clientY, nodeX: node.position.x, nodeY: node.position.y }); }}
            className="node-element absolute bg-[#0d0d12]/95 border border-zinc-800/80 rounded-[28px] overflow-visible shadow-2xl pointer-events-auto backdrop-blur-3xl" 
            style={{ left: node.position.x, top: node.position.y, width: 320 }}>
            
            {/* Input Anchors (Left) */}
            <div className="absolute left-[-8px] top-[85px] flex flex-col gap-[29px]">
              {(node.data?.inputAnchors || []).map((anchor: any) => (
                <div key={anchor.id} className="group relative">
                  <div className="w-4 h-4 rounded-full bg-indigo-500 border-2 border-zinc-900 shadow-[0_0_10px_rgba(99,102,241,0.5)] cursor-crosshair group-hover:scale-125 transition-transform" />
                  <span className="absolute left-[-110px] top-1/2 -translate-y-1/2 text-[8px] font-black uppercase text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity pr-2 text-right w-[100px] pointer-events-none">
                    {anchor.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Output Anchors (Right) */}
            <div className="absolute right-[-8px] top-[85px] flex flex-col gap-[29px]">
              {(node.data?.outputAnchors || []).map((anchor: any) => (
                <div key={anchor.id} className="group relative">
                  <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-zinc-900 shadow-[0_0_10px_rgba(249,115,22,0.5)] cursor-crosshair group-hover:scale-125 transition-transform" />
                  <span className="absolute right-[-110px] top-1/2 -translate-y-1/2 text-[8px] font-black uppercase text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity pl-2 text-left w-[100px] pointer-events-none">
                    {anchor.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-6 py-5 bg-white/[0.02] flex items-center gap-4 border-b border-white/5 cursor-move rounded-t-[28px]">
              <div className="w-10 h-10 bg-zinc-800 border border-zinc-700/50 rounded-xl flex items-center justify-center shadow-lg">
                {getNodeIcon(node.data?.type || node.type)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-zinc-100 uppercase tracking-wider truncate">{node.data?.label || node.label}</span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{node.data?.name || 'Engine'}</span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {Object.entries(node.data?.inputs || {}).slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <span className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">{k}</span>
                  <div className="text-[10px] text-zinc-400 font-mono truncate bg-black/40 px-3 py-2 rounded-xl border border-white/[0.02]">
                    {String(v).length > 40 ? String(v).substring(0, 40) + '...' : String(v)}
                  </div>
                </div>
              ))}
              
              {!Object.keys(node.data?.inputs || {}).length && (
                <div className="py-4 text-center">
                  <span className="text-[8px] text-zinc-700 uppercase font-bold tracking-[0.2em]">Automated Config Active</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
