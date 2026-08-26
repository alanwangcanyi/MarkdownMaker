import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private static instance: Logger;
  private logDir: string;
  private logFile: string;
  private initialized: boolean = false;

  private constructor() {
    const userDataPath = process.env.HOME || process.env.USERPROFILE || '/tmp';
    this.logDir = path.join(userDataPath, 'Library', 'Logs', 'Markdown Maker');
    this.logFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  init(): void {
    if (this.initialized) return;
    
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      
      this.cleanOldLogs();
      this.initialized = true;
      this.info('Logger', 'Logger initialized');
    } catch (err) {
      console.error('Failed to initialize logger:', err);
    }
  }

  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      files.forEach(file => {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > oneDayMs) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch (err) {
      console.error('Failed to clean old logs:', err);
    }
  }

  private formatLog(level: string, tag: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${tag}] ${message}\n`;
  }

  private writeLog(log: string): void {
    try {
      fs.appendFileSync(this.logFile, log, 'utf8');
    } catch (err) {
      console.error('Failed to write log:', err);
    }
  }

  info(tag: string, message: string): void {
    const log = this.formatLog('INFO', tag, message);
    console.log(log.trim());
    this.writeLog(log);
  }

  warn(tag: string, message: string): void {
    const log = this.formatLog('WARN', tag, message);
    console.warn(log.trim());
    this.writeLog(log);
  }

  error(tag: string, message: string): void {
    const log = this.formatLog('ERROR', tag, message);
    console.error(log.trim());
    this.writeLog(log);
  }

  debug(tag: string, message: string): void {
    const log = this.formatLog('DEBUG', tag, message);
    console.debug(log.trim());
    this.writeLog(log);
  }

  getLogPath(): string {
    return this.logFile;
  }
}
