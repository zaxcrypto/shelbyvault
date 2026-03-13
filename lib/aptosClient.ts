import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

export const aptosClient = new Aptos(
  new AptosConfig({
    network: Network.TESTNET,
    clientConfig: {
      API_KEY: process.env.NEXT_PUBLIC_APTOS_API_KEY || "",
    },
  })
);