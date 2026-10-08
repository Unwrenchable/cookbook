// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title CanonicalDex
 * @notice Immutable chain-id registry for the V2 router graduation may call.
 *         There is no setter. An unknown chain returns the zero address, and
 *         the graduating buy reverts before moving the reserve.
 *
 *         Addresses were taken from the publisher's docs and checked on a
 *         public RPC: the router has code, factory() matches the documented
 *         factory, and WETH() or WAVAX() matches the documented wrapped native.
 *         Sources are listed next to each chain and in SECURITY_AUDIT.md.
 */
library CanonicalDex {
    struct Venue {
        address router;
        address factory;
        address wrappedNative;
        /// @dev Trader Joe V1 names the Uniswap V2 entrypoint addLiquidityAVAX.
        bool avaxNative;
    }

    function venue(uint256 chainId) internal pure returns (Venue memory v) {
        // Ethereum. Uniswap V2.
        // https://docs.uniswap.org/contracts/v2/reference/smart-contracts/v2-deployments
        if (chainId == 1) {
            return Venue(
                0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D,
                0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f,
                0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
                false
            );
        }
        // Sepolia. Uniswap V2. WETH() is the canonical Sepolia WETH9.
        if (chainId == 11155111) {
            return Venue(
                0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3,
                0xF62c03E08ada871A0bEb309762E260a7a6a880E6,
                0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14,
                false
            );
        }
        // BNB Smart Chain. PancakeSwap V2, not the Uniswap deployment on BNB.
        // https://developer.pancakeswap.finance/contracts/v2/addresses
        if (chainId == 56) {
            return Venue(
                0x10ED43C718714eb63d5aA57B78B54704E256024E,
                0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73,
                0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c,
                false
            );
        }
        // BNB Smart Chain testnet. PancakeSwap V2.
        if (chainId == 97) {
            return Venue(
                0xD99D1c33F9fC3444f8101754aBC46c52416550D1,
                0x6725F303b657a9451d8BA641348b6761A6CC7a17,
                0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd,
                false
            );
        }
        // Polygon PoS. QuickSwap V2.
        // https://docs.quickswap.exchange/overview/contracts-and-addresses
        if (chainId == 137) {
            return Venue(
                0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff,
                0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32,
                0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270,
                false
            );
        }
        // Arbitrum One. Uniswap V2.
        if (chainId == 42161) {
            return Venue(
                0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24,
                0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9,
                0x82aF49447D8a07e3bd95BD0d56f35241523fBab1,
                false
            );
        }
        // Base. Uniswap V2.
        if (chainId == 8453) {
            return Venue(
                0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24,
                0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6,
                0x4200000000000000000000000000000000000006,
                false
            );
        }
        // Optimism. Uniswap V2.
        if (chainId == 10) {
            return Venue(
                0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2,
                0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf,
                0x4200000000000000000000000000000000000006,
                false
            );
        }
        // Avalanche C-Chain. Trader Joe V1 (JoeRouter02), not Liquidity Book.
        // https://developers.lfj.gg/deployment-addresses/avalanche
        if (chainId == 43114) {
            return Venue(
                0x60aE616a2155Ee3d9A68541Ba4544862310933d4,
                0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10,
                0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
                true
            );
        }
        // Avalanche Fuji. Trader Joe V1. Not offered in the app chain list.
        // https://developers.lfj.gg/deployment-addresses/fuji
        if (chainId == 43113) {
            return Venue(
                0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901,
                0xF5c7d9733e5f53abCC1695820c4818C59B457C2C,
                0xd00ae08403B9bbb9124bB305C09058E32C39A48c,
                true
            );
        }

        // Testnet-only Uniswap V2. These chain ids are not mainnets.
        // The factory and routers are CREATE2 of the bytecode published in
        // @uniswap/v2-core 1.0.1 and @uniswap/v2-periphery 1.1.0-beta.0,
        // deployed by 0x4e59b44847b379578588920cA78FbF26c0B4956C.
        // feeToSetter is address(0). No other chain id returns these addresses.
        // Until the deploy script runs, the router has no code and graduation reverts.
        if (chainId == 80002) {
            return Venue(
                0x3523EDd2bae2120CDa175358EeE3Ab5F592015De,
                0x8Fa06e2B5726Fbf82cf2559F661f52FD2B78A1f6,
                0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9,
                false
            );
        }
        if (chainId == 421614) {
            return Venue(
                0x24f058F5222e6b1b2845466C24372185EAb038e1,
                0x8Fa06e2B5726Fbf82cf2559F661f52FD2B78A1f6,
                0x980B62Da83eFf3D4576C647993b0c1D7faf17c73,
                false
            );
        }
        if (chainId == 84532 || chainId == 11155420) {
            return Venue(
                0x532dE1440A5996CF8ed38e517d9f5e3c77c8b7D9,
                0x8Fa06e2B5726Fbf82cf2559F661f52FD2B78A1f6,
                0x4200000000000000000000000000000000000006,
                false
            );
        }
    }

    /// @notice True only for the four testnets whose router is our pinned deployment.
    function testnetDeployment(uint256 chainId) internal pure returns (bool) {
        return chainId == 80002 || chainId == 421614 || chainId == 84532 || chainId == 11155420;
    }

    function assertLive(Venue memory v) internal view {
        require(v.router != address(0), "CanonicalDex: no router");
        require(v.router.code.length > 0, "CanonicalDex: router has no code");
        require(_factory(v.router) == v.factory, "CanonicalDex: factory mismatch");
        require(_wrapped(v.router, v.avaxNative) == v.wrappedNative, "CanonicalDex: wrapped mismatch");
    }

    function _factory(address router) private view returns (address) {
        (bool ok, bytes memory data) = router.staticcall(abi.encodeWithSignature("factory()"));
        require(ok && data.length >= 32, "CanonicalDex: factory call failed");
        return abi.decode(data, (address));
    }

    function _wrapped(address router, bool avaxNative) private view returns (address) {
        bytes memory data;
        bool ok;
        if (avaxNative) {
            (ok, data) = router.staticcall(abi.encodeWithSignature("WAVAX()"));
        } else {
            (ok, data) = router.staticcall(abi.encodeWithSignature("WETH()"));
        }
        require(ok && data.length >= 32, "CanonicalDex: wrapped call failed");
        return abi.decode(data, (address));
    }
}
