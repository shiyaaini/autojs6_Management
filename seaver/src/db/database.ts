import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'seaver.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
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

export function getRemark(deviceId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT remark FROM device_remarks WHERE device_id = ?', [deviceId], (err, row: any) => {
      if (err) return reject(err);
      resolve(row ? row.remark : null);
    });
  });
}

export function setRemark(deviceId: string, remark: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO device_remarks (device_id, remark) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET remark = excluded.remark',
      [deviceId, remark],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

export function getAllRemarks(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    db.all('SELECT device_id, remark FROM device_remarks', (err, rows: any[]) => {
      if (err) return reject(err);
      const result: Record<string, string> = {};
      rows.forEach(row => {
        result[row.device_id] = row.remark;
      });
      resolve(result);
    });
  });
}

export function appendDeviceStatusEvent(deviceId: string, timestamp: number, status: 'online' | 'offline'): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO device_status_events (device_id, timestamp, status) VALUES (?, ?, ?)',
      [deviceId, timestamp, status],
      (err) => {
        if (err) return reject(err as Error);
        resolve();
      },
    );
  });
}
