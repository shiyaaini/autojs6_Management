"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptRepo = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ScriptRepo {
    constructor(repoRoot) {
        this.repoRoot = repoRoot;
    }
    list(extensionFilter = ['.js', '.ts']) {
        const out = [];
        const walk = (dir) => {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const ent of entries) {
                const full = path_1.default.join(dir, ent.name);
                const rel = path_1.default.relative(this.repoRoot, full);
                if (ent.isDirectory()) {
                    walk(full);
                }
                else {
                    const ext = path_1.default.extname(ent.name).toLowerCase();
                    if (!extensionFilter.includes(ext))
                        continue;
                    const stat = fs_1.default.statSync(full);
                    out.push({
                        path: rel.replace(/\\/g, '/'),
                        name: ent.name,
                        size: stat.size,
                        updatedAt: stat.mtimeMs,
                    });
                }
            }
        };
        walk(this.repoRoot);
        return out.sort((a, b) => a.path.localeCompare(b.path));
    }
    read(relPath) {
        const safeRel = relPath.replace(/^\.\/+/, '');
        const full = path_1.default.join(this.repoRoot, safeRel);
        const stat = fs_1.default.statSync(full);
        if (!stat.isFile())
            throw new Error('Not a file');
        const content = fs_1.default.readFileSync(full, 'utf-8');
        return {
            content,
            item: {
                path: safeRel.replace(/\\/g, '/'),
                name: path_1.default.basename(full),
                size: stat.size,
                updatedAt: stat.mtimeMs,
            },
        };
    }
    delete(relPath) {
        const safeRel = relPath.replace(/^\.\/+/, '');
        const full = path_1.default.join(this.repoRoot, safeRel);
        if (!fs_1.default.existsSync(full)) {
            throw new Error('Not found');
        }
        const stat = fs_1.default.statSync(full);
        if (!stat.isFile()) {
            throw new Error('Not a file');
        }
        fs_1.default.unlinkSync(full);
    }
    write(relPath, content) {
        const safeRel = relPath.replace(/^\.\/+/, '');
        const full = path_1.default.join(this.repoRoot, safeRel);
        const dir = path_1.default.dirname(full);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(full, content, 'utf-8');
        const stat = fs_1.default.statSync(full);
        return {
            path: safeRel.replace(/\\/g, '/'),
            name: path_1.default.basename(full),
            size: stat.size,
            updatedAt: stat.mtimeMs,
        };
    }
}
exports.ScriptRepo = ScriptRepo;
