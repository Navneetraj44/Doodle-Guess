import { GameError } from './errors.js';

export const WORDS: Record<string, string[]> = {
  animals: ['cat', 'dog', 'elephant', 'giraffe', 'penguin', 'octopus', 'butterfly', 'kangaroo', 'dolphin', 'spider', 'rabbit', 'turtle', 'monkey', 'shark', 'owl', 'lion', 'tiger', 'zebra', 'camel', 'horse', 'frog', 'snake', 'bee', 'crab', 'whale', 'parrot', 'squirrel', 'hedgehog', 'flamingo', 'panda'],
  objects: ['umbrella', 'scissors', 'telephone', 'backpack', 'candle', 'key', 'clock', 'ladder', 'bicycle', 'lamp', 'mirror', 'camera', 'guitar', 'glasses', 'balloon', 'hammer', 'bucket', 'envelope', 'suitcase', 'toothbrush', 'pillow', 'basket', 'headphones', 'battery', 'calculator', 'compass', 'lantern', 'magnet', 'television', 'wallet'],
  food: ['pizza', 'banana', 'burger', 'ice cream', 'popcorn', 'pancake', 'watermelon', 'sandwich', 'cupcake', 'noodles', 'carrot', 'donut', 'cookie', 'mango', 'tea', 'apple', 'cheese', 'egg', 'pineapple', 'strawberry', 'bread', 'soup', 'taco', 'grapes', 'lemon', 'chocolate', 'sushi', 'corn', 'coconut', 'honey'],
  actions: ['swimming', 'sleeping', 'dancing', 'cooking', 'fishing', 'climbing', 'painting', 'jumping', 'reading', 'running', 'laughing', 'singing', 'skating', 'crying', 'typing', 'hugging', 'sneezing', 'whistling', 'juggling', 'yawning', 'waving', 'throwing', 'digging', 'kicking', 'driving', 'shopping', 'camping', 'surfing', 'writing', 'knitting'],
  places: ['beach', 'castle', 'volcano', 'airport', 'bridge', 'school', 'forest', 'island', 'hospital', 'lighthouse', 'desert', 'train station', 'farm', 'temple', 'market', 'library', 'museum', 'stadium', 'jungle', 'waterfall', 'cave', 'circus', 'playground', 'pyramid', 'village', 'harbor', 'mountain', 'zoo', 'bakery', 'cinema'],
  nature: ['rainbow', 'tornado', 'snowflake', 'thunder', 'moon', 'sun', 'cloud', 'river', 'rain', 'leaf', 'flower', 'cactus', 'mushroom', 'tree', 'star', 'comet', 'ocean', 'glacier', 'rose', 'sunflower', 'seashell', 'feather', 'fire', 'ice', 'wind', 'branch', 'cliff', 'meadow', 'planet', 'lightning'],
  transport: ['car', 'bus', 'airplane', 'helicopter', 'submarine', 'rocket', 'train', 'tractor', 'motorcycle', 'scooter', 'sailboat', 'ambulance', 'taxi', 'skateboard', 'canoe', 'hot air balloon', 'ferry', 'truck', 'bulldozer', 'parachute', 'tram', 'cable car', 'wheelchair', 'rickshaw', 'spaceship', 'jet ski', 'fire truck', 'tricycle', 'van', 'ship'],
  sports: ['football', 'basketball', 'tennis', 'cricket', 'golf', 'archery', 'boxing', 'bowling', 'karate', 'yoga', 'rowing', 'hockey', 'baseball', 'rugby', 'volleyball', 'badminton', 'wrestling', 'gymnastics', 'fencing', 'darts', 'chess', 'skiing', 'diving', 'marathon', 'trophy', 'medal', 'referee', 'goalkeeper', 'javelin', 'trampoline'],
  movies: ['superhero', 'pirate', 'wizard', 'vampire', 'zombie', 'alien', 'dragon', 'mermaid', 'ninja', 'cowboy', 'detective', 'ghost', 'princess', 'monster', 'robot', 'spaceship', 'time machine', 'treasure map', 'magic wand', 'clapperboard', 'red carpet', 'movie ticket', 'cinema', 'director', 'stuntman', 'popcorn bucket', '3d glasses', 'haunted house', 'dinosaur park', 'werewolf', 'fairy', 'giant', 'villain', 'sidekick', 'hero', 'spy', 'genie', 'unicorn', 'mummy', 'skeleton', 'witch', 'broomstick', 'flying carpet', 'submarine', 'volcano island', 'snowman', 'secret agent', 'trailer', 'sequel', 'costume'],
  tech: ['laptop', 'keyboard', 'computer mouse', 'wifi', 'robot arm', 'bug', 'server', 'cloud', 'database', 'password', 'email', 'smartphone', 'headphones', 'battery', 'satellite', 'drone', 'hacker', 'usb drive', 'router', 'website', 'browser', 'app', 'bluetooth', 'charger', 'monitor', 'printer', 'circuit board', 'microchip', 'pixel', 'download', 'firewall', 'terminal', 'virtual reality', 'smartwatch', 'webcam', 'hard drive', 'binary code', 'emoji', 'robot', 'camera drone', 'solar panel', 'qr code', 'cursor', 'loading bar', 'power button', 'game controller', 'microphone', 'speaker', 'antenna', 'artificial intelligence'],
  indian: ['diwali', 'rangoli', 'samosa', 'taj mahal', 'sitar', 'henna', 'chai', 'bollywood', 'auto rickshaw', 'holi', 'namaste', 'peacock', 'kite', 'turban', 'saree', 'dosa', 'tabla', 'lotus', 'jalebi', 'biryani', 'gulab jamun', 'kurta', 'bindi', 'dhol', 'india gate', 'monsoon', 'chapati', 'pani puri', 'bangles', 'diya', 'firecracker', 'kabaddi', 'cricket bat', 'tiger', 'elephant parade', 'lassi', 'mango', 'banyan tree', 'camel ride', 'bullock cart', 'tricolor flag', 'spice market', 'cooking pot', 'tiffin box', 'flute', 'harmonium', 'temple bell', 'ganesh', 'marigold garland', 'street food cart'],
};
export const CATEGORIES = Object.keys(WORDS);
export const MAX_CUSTOM_WORDS = 100;
export const MIN_CUSTOM_ONLY = 3; // a turn offers 3 choices, so "only my words" needs at least 3

/** Validates the host's custom words. Throws a readable error instead of silently dropping input. */
export function sanitizeCustomWords(input: unknown): string[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new GameError('Custom words must be a list.');
  if (input.length > MAX_CUSTOM_WORDS) throw new GameError(`You can add at most ${MAX_CUSTOM_WORDS} custom words.`);
  const out = new Set<string>();
  for (const raw of input) {
    const w = typeof raw === 'string' ? raw.replace(/\p{C}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ') : '';
    if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]{1,29}$/u.test(w)) throw new GameError(`"${String(raw).slice(0, 20)}" is not a valid word (2-30 letters, numbers, spaces or hyphens).`);
    out.add(w);
  }
  return [...out];
}

/** The pool a game draws from: selected categories + custom words (or custom words only). Never smaller than 3 words. */
export function buildPool(categories: string[], custom: string[], customOnly: boolean): string[] {
  const base = customOnly ? [] : categories.flatMap(c => WORDS[c] ?? []);
  const pool = [...new Set([...base, ...custom].map(w => w.toLowerCase()))];
  return pool.length >= MIN_CUSTOM_ONLY ? pool : [...new Set(Object.values(WORDS).flat())];
}

/** Picks n distinct words that have not been used yet in this game. When the pool runs dry, it recycles. */
export function pickFromPool(pool: string[], used: Set<string>, n: number, rng: () => number = Math.random): string[] {
  let avail = pool.filter(w => !used.has(w));
  if (avail.length < n) { used.clear(); avail = [...pool]; }
  const out: string[] = [];
  while (out.length < n && avail.length) out.push(avail.splice(Math.floor(rng() * avail.length), 1)[0]);
  return out;
}
