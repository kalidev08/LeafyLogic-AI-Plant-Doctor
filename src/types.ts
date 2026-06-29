export interface Diagnosis {
  id: string;
  plantName: string;
  diseaseName: string;
  confidenceLevel: 'Low' | 'Medium' | 'High' | string;
  whatsHappening: string;
  immediateAction: string;
  treatmentCode: string;
  environmentTweak: string;
  preventionProTip: string;
  markdown: string;
  timestamp: string;
  imageThumbnail?: string; // base64 or object URL string for visual reference
}

export interface PlantDocConfig {
  apiKeyDefined: boolean;
}
