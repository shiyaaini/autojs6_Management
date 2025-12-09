"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
const authStore_1 = require("../store/authStore");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.get('/status', (_req, res) => {
    const info = (0, authStore_1.getLockInfo)();
    res.json(info);
});
exports.authRouter.post('/login', (req, res) => {
    if ((0, authStore_1.isLocked)()) {
        const info = (0, authStore_1.getLockInfo)();
        return res.status(403).json({ message: 'locked', ...info });
    }
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'username and password are required' });
    }
    if (username === config_1.config.adminUsername && password === config_1.config.adminPassword) {
        (0, authStore_1.recordSuccess)();
        const token = (0, authStore_1.issueToken)();
        return res.json({ token });
    }
    else {
        (0, authStore_1.recordFailure)();
        const info = (0, authStore_1.getLockInfo)();
        return res.status(401).json({ message: 'invalid credentials', ...info });
    }
});
exports.authRouter.post('/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    (0, authStore_1.revokeToken)(token);
    res.json({ ok: true });
});
exports.authRouter.post('/change', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!(0, authStore_1.verifyToken)(token)) {
        return res.status(401).json({ message: 'unauthorized' });
    }
    const { username, password, currentPassword } = req.body;
    if (!username || !password || !currentPassword) {
        return res.status(400).json({ message: 'username, password and currentPassword are required' });
    }
    if (currentPassword !== config_1.config.adminPassword) {
        return res.status(401).json({ message: 'invalid currentPassword' });
    }
    (0, config_1.updateAdminCredentials)(username, password);
    res.json({ username: config_1.config.adminUsername });
});
