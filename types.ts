
export type FlowType = 'chatflow' | 'agentflow' | 'agentflowV2' | 'auto';
export type LevelOfDetail = 'simple' | 'detailed';

export interface FlowConstraints {
  maxNodes?: number;
  allowExternalHTTP?: boolean;
  includeHITL?: 'auto' | 'always' | 'never';
}

export interface GeneratorInput {
  description: string;
  flowType?: FlowType;
  defaultModel?: string;
  targetUseCase?: string;
  levelOfDetail?: LevelOfDetail;
  constraints?: FlowConstraints;
}

export interface BlueprintPlan {
  title: string;
  components: string[];
  rationale: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface FlowiseNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  positionAbsolute: { x: number; y: number };
  width: number;
  height: number;
  data: {
    id: string;
    label: string;
    version: number;
    name: string;
    type: string;
    baseClasses: string[];
    category: string;
    description: string;
    inputParams: any[];
    inputAnchors: any[];
    inputs: Record<string, any>;
    outputAnchors: any[];
    outputs: Record<string, any>;
    selected?: boolean;
  };
  selected?: boolean;
}

export interface FlowiseEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: string;
  data?: {
    label?: string;
  };
}

export interface FlowiseFlow {
  name?: string;
  nodes: FlowiseNode[];
  edges: FlowiseEdge[];
  chatflowid?: string;
  deployed?: boolean;
  isPublic?: boolean;
}

export interface GeneratorResponse {
  success: boolean;
  explanation: string;
  warnings: string[];
  errors: string[];
  flowiseVersion: string;
  plan?: BlueprintPlan;
  flowJson?: FlowiseFlow;
}

// MCP / Flow Hub Types
export interface MCPSettings {
  serverUrl: string;
  flowiseUrl: string;
  apiKey: string;
}

export interface FlowHubFlow {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

export interface MCPToolResponse {
  result: {
    content: Array<{ text: string }>;
  };
}
