import { GraphPreset } from './types';

export const INITIAL_PRESETS: GraphPreset[] = [
  { id: 1, name: 'Linear', outInfluence: 0.1, inInfluence: 0.1, isEmpty: false },
  { id: 2, name: 'Easy Ease', outInfluence: 33.3, inInfluence: 33.3, isEmpty: false },
  { id: 3, name: 'Out 75', outInfluence: 75, inInfluence: 10, isEmpty: false },
  { id: 4, name: 'In 75', outInfluence: 10, inInfluence: 75, isEmpty: false },
  { id: 5, name: 'Strong', outInfluence: 90, inInfluence: 90, isEmpty: false },
  { id: 6, name: 'Extreme', outInfluence: 100, inInfluence: 100, isEmpty: false },
  ...Array(6).fill(null).map((_, i) => ({ id: i + 7, name: '', outInfluence: 33.3, inInfluence: 33.3, isEmpty: true })),
];