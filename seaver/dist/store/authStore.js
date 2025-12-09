"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocked = isLocked;
exports.getLockInfo = getLockInfo;
exports.recordFailure = recordFailure;
exports.recordSuccess = recordSuccess;
exports.issueToken = issueToken;
exports.verifyToken = verifyToken;
exports.revokeToken = revokeToken;
const crypto_1 = __importDefault(require("crypto"));
let failedAttempts = 0;
let lockUntil = 0;
const tokens = new Map();
function isLocked() {
    return Date.now() < lockUntil;
}
function getLockInfo() {
    return { locked: isLocked(), lockedUntil: lockUntil || undefined, remainingAttempts: Math.max(0, 20 - failedAttempts) };
}
function recordFailure() {
    failedAttempts += 1;
    if (failedAttempts >= 20) {
        lockUntil = Date.now() + 6 * 60 * 60 * 1000;
        failedAttempts = 0;
    }
}
function recordSuccess() {
    failedAttempts = 0;
}
function issueToken() {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    tokens.set(token, Date.now() + 24 * 60 * 60 * 1000);
    return token;
}
function verifyToken(token) {
    if (!token)
        return false;
    const exp = tokens.get(token);
    if (!exp)
        return false;
    if (Date.now() > exp) {
        tokens.delete(token);
        return false;
    }
    return true;
}
function revokeToken(token) {
    if (!token)
        return;
    tokens.delete(token);
}
