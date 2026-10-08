// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title LinearCurve
 * @notice Overflow-safe linear bonding-curve math.
 *         cost(amount) = basePrice * amount + slope * amount * (2 * supply + amount) / 2
 *         which is the integral of (basePrice + slope * x) from supply to supply + amount.
 */
library LinearCurve {
    function tryCost(
        uint256 basePrice,
        uint256 slope,
        uint256 supply,
        uint256 amount
    ) internal pure returns (bool ok, uint256 cost) {
        if (amount == 0) return (true, 0);

        if (basePrice != 0 && amount > type(uint256).max / basePrice) return (false, 0);
        uint256 baseTerm = basePrice * amount;

        if (supply > type(uint256).max / 2) return (false, 0);
        uint256 span = supply * 2;
        if (amount > type(uint256).max - span) return (false, 0);
        span += amount;

        if (span != 0 && amount > type(uint256).max / span) return (false, 0);
        uint256 area = amount * span;

        if (slope != 0 && area > type(uint256).max / slope) return (false, 0);
        uint256 slopeTerm = (slope * area) / 2;

        if (baseTerm > type(uint256).max - slopeTerm) return (false, 0);
        return (true, baseTerm + slopeTerm);
    }

    /// @dev Largest token amount whose cost is <= ethAmount. Overflowing quotes are treated as too expensive.
    function tokensForEth(
        uint256 basePrice,
        uint256 slope,
        uint256 supply,
        uint256 ethAmount
    ) internal pure returns (uint256) {
        if (ethAmount == 0 || (basePrice == 0 && slope == 0)) return 0;

        uint256 lo = 0;
        uint256 hi = 1;
        while (hi < type(uint256).max / 2) {
            (bool ok, uint256 quote) = tryCost(basePrice, slope, supply, hi);
            if (!ok || quote > ethAmount) break;
            lo = hi;
            hi *= 2;
        }

        uint256 high = hi;
        while (lo < high) {
            uint256 mid = (lo + high + 1) / 2;
            (bool ok, uint256 quote) = tryCost(basePrice, slope, supply, mid);
            if (ok && quote <= ethAmount) {
                lo = mid;
            } else if (mid == 0) {
                return 0;
            } else {
                high = mid - 1;
            }
        }
        return lo;
    }
}
