export interface Asset {
  id: string;
  name: string;
  owner: string;
  uploader: string;
  price: number;
  fileType: string;
  shelbyUrl: string;
  listed: boolean;
  uploadedAt: string;
  lastTxHash?: string;
}

export const formatAddress = (address: string): string => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatPrice = (price: number): string => {
  return `${price} ShelbyUSD`;
};

export const isImageFile = (fileType: string): boolean => {
  return fileType.startsWith("image/");
};

export const isAudioFile = (fileType: string): boolean => {
  return fileType.startsWith("audio/");
};