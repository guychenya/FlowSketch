
import { GoogleGenAI } from "@google/genai";
import { GeneratorInput, GeneratorResponse } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FLOWISE_SYSTEM_PROMPT = `
You are FlowSketch, a Senior AI Architect. You communicate exclusively in professional, high-fidelity Markdown.

STRICT FORMATTING RULES:
- Never return unformatted "plain" text.
- Use headers (###), bold text, and lists for every response.
- Use Markdown tables for architectural specifications.

MODES:
- PLAN: Provide a detailed architectural report.
- BUILD: Return ONLY a JSON object strictly adhering to Flowise v2.0+ format.

CRITICAL SCHEMA REQUIREMENTS (FOR BUILD):
1. Every Node MUST have both "inputAnchors" and "outputAnchors" arrays.
2. Each anchor object MUST have a unique "id", a "name", and a "type".
3. Edges MUST connect using "source", "target", "sourceHandle" (ID of an outputAnchor), and "targetHandle" (ID of an inputAnchor).
4. Do NOT leave nodes floating. Every component must be wired into the logical chain.
5. Spacing: 500px x 400px grid to avoid overlap.
6. Return structure:
{
  "success": true,
  "explanation": "### Synthesis Complete...",
  "flowJson": {
    "name": "Project Alpha",
    "nodes": [{"id": "node_1", "data": {"label": "LLM", "inputAnchors": [...], "outputAnchors": [...]}, ...}],
    "edges": [{"id": "e1-2", "source": "node_1", "target": "node_2", "sourceHandle": "output_id", "targetHandle": "input_id"}]
  }
}
`;

export const generateFlow = async (
  input: GeneratorInput, 
  phase: 'plan' | 'build',
  signal?: AbortSignal
): Promise<GeneratorResponse> => {
  try {
    const isSynthesis = phase === 'build';
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: input.description }] }],
      config: {
        systemInstruction: FLOWISE_SYSTEM_PROMPT,
        responseMimeType: isSynthesis ? "application/json" : "text/plain",
      },
    }, { signal }); // Pass signal for cancellation

    const text = response.text;
    if (!text) throw new Error("Synthesis engine failure.");

    if (!isSynthesis) {
      return {
        success: true,
        explanation: text,
        flowiseVersion: "2.0",
        errors: [],
        warnings: []
      };
    }
    
    const result = JSON.parse(text.trim());
    return {
        success: result.success ?? true,
        explanation: result.explanation ?? "### Synthesis Successful",
        plan: result.plan,
        flowJson: result.flowJson,
        errors: [],
        warnings: [],
        flowiseVersion: "2.0"
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error("Kernel Error:", error);
    return {
      success: false,
      explanation: "### ⚠️ Synthesis Fault\nThe architectural logic failed to converge. Please refine the description.",
      errors: [String(error)],
      warnings: [],
      flowiseVersion: "2.0"
    };
  }
};
