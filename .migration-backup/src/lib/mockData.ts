export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  filename: string;
  dateTaken: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
  aiData: {
    caption: string;
    description: string;
    objects: string[];
    people: number;
    faceDescriptors: string[];
    scene: string;
    mood: string;
    colors: string[];
    ocrText?: string;
    qualityScore: number;
    tags: string[];
    activity?: string;
  };
  album?: string;
  isFavorite: boolean;
  isTrash: boolean;
  similarPhotoIds: string[];
  confidenceScore?: number;
}

export interface Album {
  id: string;
  name: string;
  coverPhotoId: string;
  photoCount: number;
  type: "manual" | "smart";
  description?: string;
}

export interface SearchSuggestion {
  text: string;
  type: "recent" | "trending" | "ai";
  icon?: string;
}

const PHOTO_SUBJECTS = [
  { q: "beach+sunset", caption: "Golden hour at the beach", scene: "beach", mood: "peaceful", objects: ["ocean", "sand", "waves", "horizon"], colors: ["orange", "gold", "blue"] },
  { q: "mountain+landscape", caption: "Misty mountain peaks at dawn", scene: "mountains", mood: "majestic", objects: ["mountains", "trees", "fog", "sky"], colors: ["green", "grey", "white"] },
  { q: "city+night", caption: "City lights reflecting on wet streets", scene: "urban", mood: "energetic", objects: ["buildings", "street lights", "cars", "pavement"], colors: ["yellow", "blue", "black"] },
  { q: "wedding+celebration", caption: "Joyful wedding ceremony moment", scene: "wedding", mood: "joyful", objects: ["flowers", "dress", "suit", "rings"], colors: ["white", "gold", "blush"] },
  { q: "dog+park", caption: "Dog playing fetch in the park", scene: "park", mood: "playful", objects: ["dog", "grass", "ball", "trees"], colors: ["green", "brown", "blue"] },
  { q: "food+restaurant", caption: "Artfully plated dinner at a fine restaurant", scene: "restaurant", mood: "elegant", objects: ["plate", "fork", "candle", "wine glass"], colors: ["red", "white", "gold"] },
  { q: "travel+italy", caption: "Sunlit cobblestone streets of Rome", scene: "travel", mood: "nostalgic", objects: ["buildings", "cobblestones", "fountain", "pigeons"], colors: ["terracotta", "cream", "blue"] },
  { q: "portrait+outdoor", caption: "Natural light portrait in golden hour", scene: "portrait", mood: "warm", objects: ["person", "bokeh", "light"], colors: ["warm", "orange", "skin"] },
  { q: "coffee+cafe", caption: "Morning coffee with latte art", scene: "cafe", mood: "cozy", objects: ["coffee cup", "latte", "table", "book"], colors: ["brown", "cream", "white"] },
  { q: "concert+music", caption: "Energy-filled live music performance", scene: "concert", mood: "exciting", objects: ["stage", "lights", "crowd", "guitar"], colors: ["purple", "blue", "neon"] },
  { q: "car+sports", caption: "Red sports car on an empty highway", scene: "automotive", mood: "bold", objects: ["car", "road", "wheels", "exhaust"], colors: ["red", "black", "silver"] },
  { q: "birthday+cake", caption: "Candle-lit birthday celebration", scene: "party", mood: "celebratory", objects: ["cake", "candles", "balloons", "decorations"], colors: ["pink", "gold", "white"] },
  { q: "landscape+california", caption: "Pacific coast highway at sunset", scene: "nature", mood: "serene", objects: ["road", "cliffs", "ocean", "sky"], colors: ["orange", "purple", "blue"] },
  { q: "trophy+award", caption: "Holding the championship trophy", scene: "sport", mood: "triumphant", objects: ["trophy", "stadium", "crowd"], colors: ["gold", "silver", "blue"] },
  { q: "flight+airport", caption: "Airplane ready for takeoff at dusk", scene: "travel", mood: "adventurous", objects: ["airplane", "runway", "terminal", "luggage"], colors: ["grey", "blue", "white"] },
  { q: "nature+forest", caption: "Sunbeams piercing through ancient forest", scene: "nature", mood: "mystical", objects: ["trees", "light rays", "moss", "ferns"], colors: ["green", "gold", "brown"] },
  { q: "snow+winter", caption: "Fresh snowfall on a quiet morning", scene: "winter", mood: "tranquil", objects: ["snow", "trees", "house", "footprints"], colors: ["white", "blue", "grey"] },
  { q: "family+picnic", caption: "Family enjoying a sunny picnic", scene: "outdoor", mood: "joyful", objects: ["blanket", "basket", "family", "park"], colors: ["green", "yellow", "blue"] },
  { q: "ocean+diving", caption: "Underwater world of vibrant coral reefs", scene: "underwater", mood: "wonder", objects: ["coral", "fish", "diver", "bubbles"], colors: ["blue", "cyan", "orange"] },
  { q: "gym+fitness", caption: "Intense workout session at sunrise", scene: "fitness", mood: "determined", objects: ["weights", "gym", "mirror", "trainer"], colors: ["black", "grey", "blue"] },
];

// Deterministic pseudo-random to avoid SSR/client hydration mismatch
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function generatePhotos(): Photo[] {
  const photos: Photo[] = [];
  const sizes = [
    [800, 600], [600, 800], [800, 800], [1200, 800], [800, 1200],
    [900, 600], [600, 900], [1000, 700], [700, 1000], [800, 500],
  ];

  const locations = [
    "San Francisco, CA", "New York, NY", "Paris, France", "Tokyo, Japan",
    "Rome, Italy", "Sydney, Australia", "London, UK", "Barcelona, Spain",
    "Malibu, CA", "Aspen, CO", undefined, undefined, undefined,
  ];

  let idx = 0;
  for (let i = 0; i < 80; i++) {
    const subject = PHOTO_SUBJECTS[i % PHOTO_SUBJECTS.length];
    const [w, h] = sizes[i % sizes.length];
    const date = new Date(2024, Math.floor(seededRand(i * 3) * 12), Math.floor(seededRand(i * 3 + 1) * 28) + 1);
    const location = locations[i % locations.length];
    const seed = 200 + i;

    photos.push({
      id: `photo-${i + 1}`,
      url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
      thumbnail: `https://picsum.photos/seed/${seed}/400/300`,
      width: w,
      height: h,
      filename: `IMG_${String(2000 + i).padStart(4, "0")}.jpg`,
      dateTaken: date.toISOString(),
      location,
      aiData: {
        caption: subject.caption,
        description: `A beautifully captured ${subject.scene} photo. ${subject.caption}. The image features ${subject.objects.slice(0, 3).join(", ")} with a ${subject.mood} atmosphere.`,
        objects: subject.objects,
        people: ["portrait", "wedding", "family", "gym", "concert"].includes(subject.scene) ? Math.floor(seededRand(i * 7) * 4) + 1 : 0,
        faceDescriptors: ["portrait", "wedding", "family"].includes(subject.scene) ? ["smiling face", "outdoor lighting", "natural expression"] : [],
        scene: subject.scene,
        mood: subject.mood,
        colors: subject.colors,
        ocrText: subject.scene === "travel" ? "Via Roma 14" : subject.scene === "restaurant" ? "Menu du jour" : undefined,
        qualityScore: 75 + Math.floor(seededRand(i * 11) * 25),
        tags: [...subject.objects, subject.scene, subject.mood, ...(location ? [location.split(",")[0]] : [])],
        activity: ["gym", "concert", "wedding", "park"].includes(subject.scene) ? subject.scene : undefined,
      },
      isFavorite: seededRand(i * 13) > 0.8,
      isTrash: false,
      similarPhotoIds: [],
      album: i % 5 === 0 ? "travel" : i % 7 === 0 ? "family" : i % 11 === 0 ? "nature" : undefined,
    });
    idx++;
  }

  // Link similar photos
  photos.forEach((photo, i) => {
    const similar = photos
      .filter((p, j) => j !== i && p.aiData.scene === photo.aiData.scene)
      .slice(0, 4)
      .map((p) => p.id);
    photo.similarPhotoIds = similar;
  });

  return photos;
}

export const MOCK_PHOTOS: Photo[] = generatePhotos();

export const MOCK_ALBUMS: Album[] = [
  { id: "travel", name: "Travel", coverPhotoId: "photo-6", photoCount: 23, type: "smart", description: "Your adventure photos" },
  { id: "family", name: "Family", coverPhotoId: "photo-18", photoCount: 18, type: "smart", description: "Cherished family moments" },
  { id: "nature", name: "Nature", coverPhotoId: "photo-16", photoCount: 15, type: "smart", description: "Beautiful nature scenes" },
  { id: "food", name: "Food & Dining", coverPhotoId: "photo-9", photoCount: 12, type: "smart", description: "Culinary memories" },
  { id: "events", name: "Events", coverPhotoId: "photo-4", photoCount: 20, type: "smart", description: "Special occasions" },
  { id: "screenshots", name: "Screenshots", coverPhotoId: "photo-15", photoCount: 8, type: "smart", description: "Screen captures" },
  { id: "favorites", name: "Favorites", coverPhotoId: "photo-1", photoCount: MOCK_PHOTOS.filter((p) => p.isFavorite).length, type: "smart" },
];

export const SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { text: "Photos from Italy", type: "recent" },
  { text: "Beach sunsets", type: "recent" },
  { text: "Birthday celebrations", type: "recent" },
  { text: "Me wearing a blue suit", type: "recent" },
  { text: "Best landscape photos", type: "trending" },
  { text: "Professional headshots", type: "trending" },
  { text: "Family moments", type: "trending" },
  { text: "Night photography", type: "trending" },
  { text: "Photos good enough for LinkedIn", type: "ai" },
  { text: "My most liked memories", type: "ai" },
  { text: "Hidden gems in my library", type: "ai" },
];

export function searchPhotos(query: string): { photos: Photo[]; aiResponse: string } {
  if (!query.trim()) return { photos: MOCK_PHOTOS, aiResponse: "" };

  const q = query.toLowerCase();
  const keywords = q.split(" ").filter((w) => w.length > 2);

  const scored = MOCK_PHOTOS.map((photo) => {
    let score = 0;
    const searchText = [
      photo.aiData.caption,
      photo.aiData.description,
      photo.aiData.scene,
      photo.aiData.mood,
      ...photo.aiData.objects,
      ...photo.aiData.tags,
      ...photo.aiData.colors,
      photo.location || "",
      photo.aiData.ocrText || "",
      photo.aiData.activity || "",
    ]
      .join(" ")
      .toLowerCase();

    keywords.forEach((kw) => {
      if (searchText.includes(kw)) score += 10;
    });

    if (searchText.includes(q)) score += 30;

    // Semantic matches
    const semanticMap: Record<string, string[]> = {
      sunset: ["beach", "golden", "orange", "dusk"],
      dog: ["park", "playful", "grass"],
      wedding: ["dress", "suit", "celebration", "flowers"],
      trophy: ["award", "sport", "triumphant"],
      italy: ["rome", "travel", "cobblestone"],
      california: ["pacific", "coast", "highway"],
      night: ["city", "lights", "dark"],
      professional: ["portrait", "headshot", "quality"],
      linkedin: ["portrait", "professional", "headshot"],
    };

    Object.entries(semanticMap).forEach(([term, related]) => {
      if (q.includes(term)) {
        related.forEach((r) => {
          if (searchText.includes(r)) score += 5;
        });
      }
    });

    return { photo, score };
  });

  const results = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ photo, score }) => ({
      ...photo,
      confidenceScore: Math.min(99, Math.round((score / 50) * 100)),
    }));

  const aiResponse = results.length > 0
    ? `I found ${results.length} photos matching "${query}". Results are ranked by confidence — the top matches are most likely what you're looking for.`
    : `I couldn't find exact matches for "${query}", but here are some visually similar photos that might be what you're looking for.`;

  return { photos: results.length > 0 ? results : MOCK_PHOTOS.slice(0, 12), aiResponse };
}
