// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/CanonicalDex.sol";

/// @notice Test view of the immutable registry. Not a factory implementation.
contract CanonicalDexHarness {
    function venue(uint256 chainId)
        external
        pure
        returns (address router, address dexFactory, address wrappedNative, bool avaxNative)
    {
        CanonicalDex.Venue memory v = CanonicalDex.venue(chainId);
        return (v.router, v.factory, v.wrappedNative, v.avaxNative);
    }

    function assertLive(address router, address dexFactory, address wrappedNative, bool avaxNative) external view {
        CanonicalDex.assertLive(CanonicalDex.Venue(router, dexFactory, wrappedNative, avaxNative));
    }
}
