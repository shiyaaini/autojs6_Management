"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRemark = getRemark;
exports.setRemark = setRemark;
exports.getAllRemarks = getAllRemarks;
exports.appendDeviceStatusEvent = appendDeviceStatusEvent;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_DIR = path_1.default.join(process.cwd(), 'data');
if (!fs_1.default.existsSync(DB_DIR)) {
    fs_1.default.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path_1.default.join(DB_DIR, 'seaver.sqlite');
const db = new sqlite3_1.default.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    }
    else {
        console.log('Connected to sqlite database');
        initDb();
    }
});
function initDb() {
    db.run(`
    CREATE TABLE IF NOT EXISTS device_remarks (
      device_id TEXT PRIMARY KEY,
      remark TEXT
    )
  `, (err) => {
        if (err) {
            console.error('Error creating device_remarks table', err);
        }
    });
    db.run(`
    CREATE TABLE IF NOT EXISTS device_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL
    )
  `, (err) => {
        if (err) {
            console.error('Error creating device_status_events table', err);
        }
    });
}
function getRemark(deviceId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT remark FROM device_remarks WHERE device_id = ?', [deviceId], (err, row) => {
            if (err)
                return reject(err);
            resolve(row ? row.remark : null);
        });
    });
}
function setRemark(deviceId, remark) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO device_remarks (device_id, remark) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET remark = excluded.remark', [deviceId, remark], (err) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}
function getAllRemarks() {
    return new Promise((resolve, reject) => {
        db.all('SELECT device_id, remark FROM device_remarks', (err, rows) => {
            if (err)
                return reject(err);
            const result = {};
            rows.forEach(row => {
                result[row.device_id] = row.remark;
            });
            resolve(result);
        });
    });
}
function appendDeviceStatusEvent(deviceId, timestamp, status) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO device_status_events (device_id, timestamp, status) VALUES (?, ?, ?)', [deviceId, timestamp, status], (err) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}
