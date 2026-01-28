
export interface GraphPreset {
  id: number;
  name: string;
  outInfluence: number; // 0 to 100
  inInfluence: number;  // 0 to 100
  isEmpty: boolean;
}

export type Point = {
  x: number;
  y: number;
};
