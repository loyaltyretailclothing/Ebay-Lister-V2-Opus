"use client";

import { createContext, useContext, useState, useCallback } from "react";

const PhotoTransferContext = createContext(null);

export function PhotoTransferProvider({ children }) {
  const [pending, setPending] = useState({ listing: [], ai: [] });

  const addToTransfer = useCallback((photos, target) => {
    setPending((prev) => ({
      ...prev,
      [target]: [...prev[target], ...photos],
    }));
  }, []);

  const consumeTransfer = useCallback(() => {
    const current = pending;
    setPending({ listing: [], ai: [] });
    return current;
  }, [pending]);

  const hasPending = pending.listing.length > 0 || pending.ai.length > 0;

  return (
    <PhotoTransferContext.Provider value={{ pending, hasPending, addToTransfer, consumeTransfer }}>
      {children}
    </PhotoTransferContext.Provider>
  );
}

export function usePhotoTransfer() {
  const context = useContext(PhotoTransferContext);
  if (!context) {
    throw new Error("usePhotoTransfer must be used within a PhotoTransferProvider");
  }
  return context;
}
