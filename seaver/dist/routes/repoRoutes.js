"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repoRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
const repo_1 = require("../utils/repo");
const repo = new repo_1.ScriptRepo(config_1.config.scriptsRepoRoot);
exports.repoRouter = (0, express_1.Router)();
exports.repoRouter.get('/scripts', (_req, res) => {
    try {
        const scripts = repo.list();
        res.json({ scripts });
    }
    catch (err) {
        console.error('[repo] failed to list scripts', err);
        res.status(500).json({ message: 'Failed to list scripts' });
    }
});
exports.repoRouter.get('/scripts/content', (req, res) => {
    const relPath = req.query.path?.trim();
    if (!relPath) {
        return res.status(400).json({ message: 'path query is required' });
    }
    try {
        const { content, item } = repo.read(relPath);
        res.json({ item, content });
    }
    catch (err) {
        console.error('[repo] failed to read script', relPath, err);
        res.status(404).json({ message: 'Script not found' });
    }
});
exports.repoRouter.post('/scripts/content', (req, res) => {
    const relPath = req.body?.path?.trim();
    const content = req.body?.content;
    if (!relPath || typeof content !== 'string') {
        return res.status(400).json({ message: 'path and content are required' });
    }
    try {
        const item = repo.write(relPath, content);
        res.json({ item, content });
    }
    catch (err) {
        console.error('[repo] failed to write script', relPath, err);
        res.status(500).json({ message: 'Failed to write script' });
    }
});
exports.repoRouter.delete('/scripts/content', (req, res) => {
    const relPath = req.query.path?.trim();
    if (!relPath) {
        return res.status(400).json({ message: 'path query is required' });
    }
    try {
        repo.delete(relPath);
        res.json({ message: 'Script deleted' });
    }
    catch (err) {
        console.error('[repo] failed to delete script', relPath, err);
        res.status(404).json({ message: 'Script not found' });
    }
});
