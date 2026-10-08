/**
 * Canonical V2 venues. Must match contracts/evm/contracts/libraries/CanonicalDex.sol.
 * The Hardhat suite reads this list and checks the Solidity registry.
 * Sources and the RPC check are in SECURITY_AUDIT.md.
 */

export interface CanonicalVenue {
  chainId: number;
  name: string;
  router: `0x${string}`;
  factory: `0x${string}`;
  wrappedNative: `0x${string}`;
  avaxNative: boolean;
}

export const CANONICAL_DEX: CanonicalVenue[] = [
  {
    chainId: 1,
    name: "Ethereum",
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    avaxNative: false,
  },
  {
    chainId: 11155111,
    name: "Sepolia",
    router: "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3",
    factory: "0xF62c03E08ada871A0bEb309762E260a7a6a880E6",
    wrappedNative: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    avaxNative: false,
  },
  {
    chainId: 56,
    name: "BNB Smart Chain",
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    avaxNative: false,
  },
  {
    chainId: 97,
    name: "BNB Smart Chain Testnet",
    router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
    factory: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
    wrappedNative: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    avaxNative: false,
  },
  {
    chainId: 137,
    name: "Polygon",
    router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    factory: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    avaxNative: false,
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9",
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    avaxNative: false,
  },
  {
    chainId: 8453,
    name: "Base",
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    avaxNative: false,
  },
  {
    chainId: 10,
    name: "Optimism",
    router: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
    factory: "0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    avaxNative: false,
  },
  {
    chainId: 43114,
    name: "Avalanche",
    router: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",
    factory: "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10",
    wrappedNative: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    avaxNative: true,
  },
  {
    chainId: 43113,
    name: "Avalanche Fuji",
    router: "0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901",
    factory: "0xF5c7d9733e5f53abCC1695820c4818C59B457C2C",
    wrappedNative: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
    avaxNative: true,
  },
];

export const CANONICAL_ROUTERS: Record<number, `0x${string}`> = Object.fromEntries(
  CANONICAL_DEX.map((v) => [v.chainId, v.router])
);
