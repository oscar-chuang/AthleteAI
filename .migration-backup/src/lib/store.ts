"use client";

import { create } from "zustand";
import { Photo, MOCK_PHOTOS, searchPhotos } from "./mockData";

interface AppState {
  photos: Photo[];
  filteredPhotos: Photo[];
  selectedPhoto: Photo | null;
  searchQuery: string;
  isSearching: boolean;
  aiResponse: string;
  activeSection: string;
  isRightPanelOpen: boolean;
  recentSearches: string[];
  uploadedPhotos: Photo[];

  setSelectedPhoto: (photo: Photo | null) => void;
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => void;
  setActiveSection: (section: string) => void;
  toggleFavorite: (photoId: string) => void;
  moveToTrash: (photoId: string) => void;
  setRightPanelOpen: (open: boolean) => void;
  addRecentSearch: (query: string) => void;
  clearSearch: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  photos: MOCK_PHOTOS,
  filteredPhotos: MOCK_PHOTOS,
  selectedPhoto: null,
  searchQuery: "",
  isSearching: false,
  aiResponse: "",
  activeSection: "all-photos",
  isRightPanelOpen: false,
  recentSearches: [
    "Beach sunsets",
    "Photos from Italy",
    "Me wearing a blue suit",
  ],
  uploadedPhotos: [],

  setSelectedPhoto: (photo) =>
    set({ selectedPhoto: photo, isRightPanelOpen: !!photo }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  performSearch: (query) => {
    set({ isSearching: true, searchQuery: query });

    setTimeout(() => {
      const { photos, aiResponse } = searchPhotos(query);
      set({
        filteredPhotos: photos,
        aiResponse,
        isSearching: false,
        activeSection: query ? "search" : "all-photos",
      });
      if (query) get().addRecentSearch(query);
    }, 600);
  },

  setActiveSection: (section) => {
    const { photos } = get();
    let filtered = MOCK_PHOTOS;

    switch (section) {
      case "favorites":
        filtered = MOCK_PHOTOS.filter((p) => p.isFavorite);
        break;
      case "trash":
        filtered = MOCK_PHOTOS.filter((p) => p.isTrash);
        break;
      case "people":
        filtered = MOCK_PHOTOS.filter((p) => p.aiData.people > 0);
        break;
      case "places":
        filtered = MOCK_PHOTOS.filter((p) => !!p.location);
        break;
      default:
        filtered = MOCK_PHOTOS.filter((p) => !p.isTrash);
    }

    set({
      activeSection: section,
      filteredPhotos: filtered,
      searchQuery: "",
      aiResponse: "",
    });
  },

  toggleFavorite: (photoId) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === photoId ? { ...p, isFavorite: !p.isFavorite } : p
      ),
      filteredPhotos: state.filteredPhotos.map((p) =>
        p.id === photoId ? { ...p, isFavorite: !p.isFavorite } : p
      ),
      selectedPhoto:
        state.selectedPhoto?.id === photoId
          ? { ...state.selectedPhoto, isFavorite: !state.selectedPhoto.isFavorite }
          : state.selectedPhoto,
    }));
  },

  moveToTrash: (photoId) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === photoId ? { ...p, isTrash: true } : p
      ),
      filteredPhotos: state.filteredPhotos.filter((p) => p.id !== photoId),
      selectedPhoto: state.selectedPhoto?.id === photoId ? null : state.selectedPhoto,
      isRightPanelOpen: state.selectedPhoto?.id === photoId ? false : state.isRightPanelOpen,
    }));
  },

  setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),

  addRecentSearch: (query) => {
    set((state) => ({
      recentSearches: [
        query,
        ...state.recentSearches.filter((s) => s !== query),
      ].slice(0, 8),
    }));
  },

  clearSearch: () => {
    set({
      searchQuery: "",
      filteredPhotos: MOCK_PHOTOS.filter((p) => !p.isTrash),
      aiResponse: "",
      activeSection: "all-photos",
    });
  },
}));
