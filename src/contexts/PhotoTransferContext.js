"use client";

import { createContext, useContext, useState, useCallback } from "react";

const PhotoTransferContext = createContext(null);

export function PhotoTransferProvider({ children }) {
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [transferTarget, setTransferTarget] = useState(null);

  const addToTransfer = useCallback((photos, target) => {
    setPendingPhotos(photos);
    setTransferTarget(target);
  }, []);

  const consumeTransfer = useCallback(() => {
    const photos = pendingPhotos;
    const target = transferTarget;
    setPendingPhotos([]);
    setTransferTarget(null);
    return { photos, target };
  }, [pendingPhotos, transferTarget]);

  return (
    <PhotoTransferContext.Provider value={{ pendingPhotos, transferTarget, addToTransfer, consumeTransfer }}>
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
