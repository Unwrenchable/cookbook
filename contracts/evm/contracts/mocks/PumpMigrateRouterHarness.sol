// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../templates/PumpMigrateToken.sol";
import "../libraries/CanonicalDex.sol";

/**
 * @notice Test double that injects a router after the same live checks.
 *         The factory deploys PumpMigrateToken, not this contract.
 */
contract PumpMigrateRouterHarness is PumpMigrateToken {
    address private _testRouter;
    bool private _testAvax;

    function setRouterForTest(address router, bool avaxNative) external {
        _testRouter = router;
        _testAvax = avaxNative;
    }

    function _venue() internal view override returns (CanonicalDex.Venue memory v) {
        address wrapped = _testAvax ? IJoeRouter(_testRouter).WAVAX() : IDexRouter(_testRouter).WETH();
        v = CanonicalDex.Venue({
            router: _testRouter,
            factory: IDexRouter(_testRouter).factory(),
            wrappedNative: wrapped,
            avaxNative: _testAvax
        });
        CanonicalDex.assertLive(v);
    }
}
