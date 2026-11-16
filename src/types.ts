export type DetectionStatus = "found" | "not_found";

export interface CenterCoordinate {
  x_percent: number;
  y_percent: number;
}

export interface DetectionResult {
  status: DetectionStatus;
  target_name: string;
  confidence: number;
  center_coordinate: CenterCoordinate;
  action_recommendation: string;
  reasoning: string;
}

export interface ImageAsset {
  id: string;
  label: string;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sourceType: "sample" | "upload" | "clipboard";
}

export interface SampleScreen {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  presets: string[];
}

export interface MacroStep {
  id: string;
  target: string;
  delayMs: number;
  status: "idle" | "running" | "done" | "error";
  result?: DetectionResult;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  imageLabel: string;
  imageWidth: number;
  imageHeight: number;
  targetQuery: string;
  result: DetectionResult;
}

export type WorkspaceTab = "single" | "macro" | "history" | "api";
