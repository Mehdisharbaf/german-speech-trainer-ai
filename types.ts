export interface Turn {
  id: string;
  userTranscript: string;
  modelResponse: string;
  isComplete: boolean;
  timestamp: number;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

// PCM Audio Utils Types
export interface PCMChunk {
  data: Float32Array;
}
