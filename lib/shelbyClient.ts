import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@aptos-labs/ts-sdk";

export const createShelbyClient = () => {
  return new ShelbyClient({
    network: Network.TESTNET,
    apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY || "",
  });
};

export const getShelbyFileUrl = (ownerAddress: string, filename: string): string => {
  return `https://api.testnet.shelby.xyz/shelby/v1/blobs/${ownerAddress}/${filename}`;
};