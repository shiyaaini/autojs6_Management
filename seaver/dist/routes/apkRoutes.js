"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apkRouter = void 0;
const express_1 = __importStar(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
exports.apkRouter = (0, express_1.Router)();
const apkRoot = config_1.config.apkRepoRoot;
function listApkFiles() {
    if (!fs_1.default.existsSync(apkRoot)) {
        return [];
    }
    const items = [];
    const entries = fs_1.default.readdirSync(apkRoot, { withFileTypes: true });
    for (const ent of entries) {
        if (!ent.isFile())
            continue;
        const ext = path_1.default.extname(ent.name).toLowerCase();
        if (ext !== '.apk')
            continue;
        const full = path_1.default.join(apkRoot, ent.name);
        const stat = fs_1.default.statSync(full);
        items.push({
            name: ent.name,
            path: ent.name,
            size: stat.size,
            updatedAt: stat.mtimeMs,
        });
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
}
exports.apkRouter.get('/list', (_req, res) => {
    try {
        const items = listApkFiles();
        res.json({ items });
    }
    catch (err) {
        console.error('[apk] failed to list apks', err);
        res.status(500).json({ message: 'Failed to list APKs' });
    }
});
exports.apkRouter.post('/upload', express_1.default.raw({ type: 'application/octet-stream', limit: '200mb' }), (req, res) => {
    const filenameRaw = req.query.filename ?? '';
    const filename = filenameRaw.trim();
    if (!filename) {
        return res.status(400).json({ message: 'filename query is required' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: 'empty body' });
    }
    const safeName = path_1.default.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const target = path_1.default.join(apkRoot, safeName);
    try {
        if (!fs_1.default.existsSync(apkRoot)) {
            fs_1.default.mkdirSync(apkRoot, { recursive: true });
        }
        fs_1.default.writeFileSync(target, req.body);
        const stat = fs_1.default.statSync(target);
        const item = {
            name: safeName,
            path: safeName,
            size: stat.size,
            updatedAt: stat.mtimeMs,
        };
        res.json({ item });
    }
    catch (err) {
        console.error('[apk] failed to save apk', filename, err);
        res.status(500).json({ message: 'Failed to save APK' });
    }
});
exports.apkRouter.get('/files/:name', (req, res) => {
    const name = (req.params.name ?? '').trim();
    if (!name) {
        return res.status(400).json({ message: 'name param is required' });
    }
    const safeName = path_1.default.basename(name);
    const full = path_1.default.join(apkRoot, safeName);
    if (!fs_1.default.existsSync(full) || !fs_1.default.statSync(full).isFile()) {
        return res.status(404).json({ message: 'APK not found' });
    }
    res.sendFile(full);
});
