export interface Prediction {
  char: string;
  probability: number;
}

export type AllowedType = "all" | "digits" | "letters";

export interface PredictionResponse {
  predictions: Prediction[];
  processed_image: string;
  confident: boolean;
  allowed: AllowedType;
  allowed_mass: number;
  suspicious: boolean;
}

export interface ModelInfo {
  model: string;
  dataset: string;
  classes: string[];
  test_accuracy: number;
  torch_version: string;
  created: string;
}

export interface HealthStatus {
  app: string;
  status: string;
  model_loaded: boolean;
  classes: number;
}

export interface DatasetMetrics {
  test_accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  num_classes: number;
  parameters: number;
}

export interface Metrics {
  mnist: DatasetMetrics;
  emnist_balanced: DatasetMetrics;
}

export interface ClassMetric {
  char: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface Confusion {
  true: string;
  predicted: string;
  count: number;
  pct_of_true_class: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  char: string;
  confidence: number;
  thumbnail: string;
}

export interface WordCharacter {
  char: string;
  probability: number;
  box: [number, number, number, number];
  touching: boolean;
  predictions: Prediction[];
  allowed_mass: number;
  suspicious: boolean;
}

export interface WordResponse {
  text: string;
  allowed: AllowedType;
  allowed_mass: number;
  suspicious: boolean;
  characters: WordCharacter[];
}

export type PageName = "recognize" | "performance" | "history" | "word";
export type ToastKind = "error" | "success" | "info";
