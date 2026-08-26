import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { Logger } from './logger';

/**
 * 轻量数据持久层（better-sqlite3）
 * 数据库文件位置：~/Library/Application Support/Markdown Maker/markdown-maker.db
 *
 * 表结构：
 * - recents:   最近打开的文件（按 path 去重，最多保留 20 条）
 * - app_state: 应用状态键值对（窗口位置、上次视图模式等）
 */

const MAX_RECENT_FILES = 20;

const logger = Logger.getInstance();
let db: Database.Database | null = null;

export interface RecentFile {
  path: string;
  name: string;
}

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'markdown-maker.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS recents (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      path      TEXT NOT NULL UNIQUE,
      name      TEXT NOT NULL,
      opened_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  logger.info('DB', `Database initialized: ${dbPath}`);
}

/** 记录一次文件访问（打开或保存），去重并置顶 */
export function addRecentFile(filePath: string, name: string): void {
  if (!db) return;
  try {
    const now = Date.now();
    const insert = db.prepare(`
      INSERT INTO recents (path, name, opened_at) VALUES (?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET opened_at = excluded.opened_at, name = excluded.name
    `);
    insert.run(filePath, name, now);

    // 超出上限时删除最旧的记录
    const prune = db.prepare(`
      DELETE FROM recents WHERE id NOT IN (
        SELECT id FROM recents ORDER BY opened_at DESC LIMIT ?
      )
    `);
    prune.run(MAX_RECENT_FILES);
  } catch (err: any) {
    logger.error('DB', `addRecentFile failed: ${err.message}`);
  }
}

/** 读取最近文件列表（新→旧） */
export function getRecentFiles(): RecentFile[] {
  if (!db) return [];
  try {
    const rows = db.prepare(
      'SELECT path, name FROM recents ORDER BY opened_at DESC'
    ).all() as RecentFile[];
    return rows;
  } catch (err: any) {
    logger.error('DB', `getRecentFiles failed: ${err.message}`);
    return [];
  }
}

/** 读取应用状态值 */
export function getAppState(key: string): string | null {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch (err: any) {
    logger.error('DB', `getAppState(${key}) failed: ${err.message}`);
    return null;
  }
}

/** 写入应用状态值 */
export function setAppState(key: string, value: string): void {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO app_state (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  } catch (err: any) {
    logger.error('DB', `setAppState(${key}) failed: ${err.message}`);
  }
}

/** 读取上次窗口位置大小（无记录返回 null） */
export function getWindowBounds(): Electron.Rectangle | null {
  const raw = getAppState('windowBounds');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Electron.Rectangle;
  } catch {
    return null;
  }
}

/** 保存窗口位置大小 */
export function saveWindowBounds(bounds: Electron.Rectangle): void {
  setAppState('windowBounds', JSON.stringify(bounds));
}
