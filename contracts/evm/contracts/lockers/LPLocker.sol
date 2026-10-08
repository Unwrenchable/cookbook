// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  LPLocker
 * @notice Non-custodial time-lock vault for LP tokens.
 *         Deployed once per chain alongside the TokenFactory.
 *
 * Flow
 * ────
 * 1. User approves LPLocker to spend their LP token.
 * 2. User calls lock(lpToken, amount, unlockAt) → receives a lock ID.
 * 3. After unlockAt the user calls unlock(lockId) to reclaim their LP tokens.
 *
 * Security
 * ────────
 * • ReentrancyGuard on every state-changing function.
 * • SafeERC20 for all token transfers.
 * • unlock() requires msg.sender == lock.owner.
 * • Tokens can never be retrieved before unlockAt.
 */
contract LPLocker is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Storage ─────────────────────────────────────────────────────────────

    struct LockInfo {
        address lpToken;
        uint256 amount;
        uint256 unlockAt;
        address owner;
        bool    withdrawn;
    }

    LockInfo[] public locks;

    /// owner → array of lock IDs
    mapping(address => uint256[]) private _locksByOwner;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Locked(
        uint256 indexed lockId,
        address indexed owner,
        address indexed lpToken,
        uint256 amount,
        uint256 unlockAt
    );

    event Unlocked(
        uint256 indexed lockId,
        address indexed owner,
        uint256 amount
    );

    event LockExtended(uint256 indexed lockId, uint256 newUnlockAt);
    event LockTransferred(uint256 indexed lockId, address indexed from, address indexed to);

    // ─── External ─────────────────────────────────────────────────────────────

    /**
     * @notice Lock `amount` of `lpToken` until `unlockAt`.
     * @param  lpToken  Address of the LP token to lock.
     * @param  amount   Amount of LP tokens to lock (must be > 0).
     * @param  unlockAt Unix timestamp after which unlock is permitted.
     * @return lockId   The ID of the newly created lock.
     */
    function lock(
        address lpToken,
        uint256 amount,
        uint256 unlockAt
    ) external nonReentrant returns (uint256 lockId) {
        require(lpToken  != address(0), "LPLocker: zero address");
        require(amount    > 0,          "LPLocker: amount = 0");
        require(unlockAt  > block.timestamp, "LPLocker: unlock in past");

        uint256 balanceBefore = IERC20(lpToken).balanceOf(address(this));
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(lpToken).balanceOf(address(this)) - balanceBefore;
        // Fee-on-transfer tokens deliver less than `amount`. Record what actually arrived
        // so a later unlock cannot pull another user's deposit.
        require(received > 0, "LPLocker: nothing received");

        lockId = locks.length;
        locks.push(LockInfo({
            lpToken:   lpToken,
            amount:    received,
            unlockAt:  unlockAt,
            owner:     msg.sender,
            withdrawn: false
        }));
        _locksByOwner[msg.sender].push(lockId);

        emit Locked(lockId, msg.sender, lpToken, received, unlockAt);
    }

    /**
     * @notice Push a lock further into the future. Locks cannot be shortened.
     */
    function extendLock(uint256 lockId, uint256 newUnlockAt) external nonReentrant {
        require(lockId < locks.length, "LPLocker: invalid id");
        LockInfo storage lk = locks[lockId];
        require(lk.owner == msg.sender, "LPLocker: not owner");
        require(!lk.withdrawn, "LPLocker: already withdrawn");
        require(newUnlockAt > lk.unlockAt, "LPLocker: not extended");
        lk.unlockAt = newUnlockAt;
        emit LockExtended(lockId, newUnlockAt);
    }

    /**
     * @notice Transfer a lock to a new owner. The unlock time does not change.
     */
    function transferLock(uint256 lockId, address newOwner) external nonReentrant {
        require(newOwner != address(0), "LPLocker: zero owner");
        require(lockId < locks.length, "LPLocker: invalid id");
        LockInfo storage lk = locks[lockId];
        require(lk.owner == msg.sender, "LPLocker: not owner");
        require(!lk.withdrawn, "LPLocker: already withdrawn");
        require(newOwner != msg.sender, "LPLocker: same owner");

        address previous = lk.owner;
        lk.owner = newOwner;
        _removeLockId(previous, lockId);
        _locksByOwner[newOwner].push(lockId);
        emit LockTransferred(lockId, previous, newOwner);
    }

    /**
     * @notice Unlock and return LP tokens for an expired lock.
     * @param  lockId  The lock ID returned by lock().
     */
    function unlock(uint256 lockId) external nonReentrant {
        require(lockId < locks.length,                "LPLocker: invalid id");
        LockInfo storage lk = locks[lockId];
        require(lk.owner     == msg.sender,           "LPLocker: not owner");
        require(!lk.withdrawn,                        "LPLocker: already withdrawn");
        require(block.timestamp >= lk.unlockAt,       "LPLocker: still locked");

        lk.withdrawn = true;
        IERC20(lk.lpToken).safeTransfer(msg.sender, lk.amount);

        emit Unlocked(lockId, msg.sender, lk.amount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Return all lock IDs for a given owner address.
    function getLocksByOwner(address owner) external view returns (uint256[] memory) {
        return _locksByOwner[owner];
    }

    /// @notice Return the full LockInfo struct for a given lock ID.
    function getLock(uint256 lockId) external view returns (LockInfo memory) {
        require(lockId < locks.length, "LPLocker: invalid id");
        return locks[lockId];
    }

    /// @notice Total number of locks ever created (includes withdrawn).
    function totalLocks() external view returns (uint256) {
        return locks.length;
    }

    function _removeLockId(address owner_, uint256 lockId) internal {
        uint256[] storage ids = _locksByOwner[owner_];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; i++) {
            if (ids[i] == lockId) {
                ids[i] = ids[len - 1];
                ids.pop();
                return;
            }
        }
    }
}
