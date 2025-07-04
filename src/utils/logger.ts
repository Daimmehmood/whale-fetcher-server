import * as fs from 'fs';
import * as path from 'path';

class Logger {
  private logDir = path.join(process.cwd(), 'logs');

  constructor() {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private writeToFile(level: string, message: string): void {
    const logFile = path.join(this.logDir, `${level}.log`);
    const formattedMessage = this.formatMessage(level, message);
    
    fs.appendFileSync(logFile, formattedMessage + '\n');
  }

  info(message: string): void {
    console.log(`ℹ️  ${message}`);
    this.writeToFile('info', message);
  }

  error(message: string, error?: any): void {
    const errorMessage = error ? `${message}: ${error}` : message;
    console.error(`❌ ${errorMessage}`);
    this.writeToFile('error', errorMessage);
  }

  warn(message: string): void {
    console.warn(`⚠️  ${message}`);
    this.writeToFile('warn', message);
  }

  success(message: string): void {
    console.log(`✅ ${message}`);
    this.writeToFile('info', `SUCCESS: ${message}`);
  }
}

export const logger = new Logger();