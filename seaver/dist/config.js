"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.updateAdminCredentials = updateAdminCredentials;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CONFIG_YAML_PATH = path_1.default.resolve(process.cwd(), 'config.yaml');
function readYamlKV(filePath) {
    try {
        const text = fs_1.default.readFileSync(filePath, 'utf8');
        const lines = text.split(/\r?\n/);
        const kv = {};
        for (const line of lines) {
            const m = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*)\s*$/);
            if (!m)
                continue;
            const key = m[1];
            let value = m[2];
            if (value.startsWith('"') && value.endsWith('"'))
                value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'"))
                value = value.slice(1, -1);
            kv[key] = value;
        }
        return kv;
    }
    catch {
        return {};
    }
}
function writeYamlKV(filePath, data) {
    const lines = Object.entries(data).map(([k, v]) => `${k}: ${String(v)}`);
    fs_1.default.writeFileSync(filePath, lines.join('\n'), 'utf8');
}
function ensureAdminConfig() {
    if (!fs_1.default.existsSync(CONFIG_YAML_PATH)) {
        writeYamlKV(CONFIG_YAML_PATH, { adminUsername: 'admin', adminPassword: 'admin' });
    }
    const kv = readYamlKV(CONFIG_YAML_PATH);
    const adminUsername = kv.adminUsername || 'admin';
    const adminPassword = kv.adminPassword || 'admin';
    return { adminUsername, adminPassword };
}
const admin = ensureAdminConfig();
exports.config = {
    port: parseInt(process.env.PORT ?? '4000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    matchCode: process.env.MATCH_CODE ?? 'autojs6',
    scriptsRepoRoot: process.env.SCRIPTS_REPO_ROOT
        ? path_1.default.resolve(process.env.SCRIPTS_REPO_ROOT)
        : path_1.default.resolve(process.cwd(), 'all_scripts'),
    apkRepoRoot: process.env.APK_REPO_ROOT
        ? path_1.default.resolve(process.env.APK_REPO_ROOT)
        : path_1.default.resolve(process.cwd(), 'all_apk'),
    adminUsername: admin.adminUsername,
    adminPassword: admin.adminPassword,
};
function updateAdminCredentials(username, password) {
    const u = username?.trim() || 'admin';
    const p = password?.trim() || 'admin';
    writeYamlKV(CONFIG_YAML_PATH, { adminUsername: u, adminPassword: p });
    exports.config.adminUsername = u;
    exports.config.adminPassword = p;
}
