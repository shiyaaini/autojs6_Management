"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
exports.configRouter = (0, express_1.Router)();
exports.configRouter.get('/secret', (_req, res) => {
    res.json({ matchCode: config_1.config.matchCode });
});
exports.configRouter.post('/secret', (req, res) => {
    const { matchCode } = req.body;
    if (!matchCode || typeof matchCode !== 'string') {
        return res.status(400).json({ message: 'matchCode is required' });
    }
    config_1.config.matchCode = matchCode;
    return res.json({ matchCode: config_1.config.matchCode });
});
