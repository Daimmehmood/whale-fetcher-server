// src/utils/storage.ts
import * as fs from 'fs';
import * as path from 'path';
import { WhaleWallet } from '../types/whale.types';
import { logger } from './logger';

export class WhaleStorage {
  private dataDir = path.join(process.cwd(), 'data');
  private whalesFile = path.join(this.dataDir, 'whales.json');
  private backupFile = path.join(this.dataDir, 'whales-backup.json');
  private botFile = path.join(this.dataDir, 'bot-wallets.json');

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.info('📁 Data directory created');
    }
  }

  loadWhales(): WhaleWallet[] {
    try {
      if (fs.existsSync(this.whalesFile)) {
        const data = fs.readFileSync(this.whalesFile, 'utf8');
        const parsed = JSON.parse(data);
        const whales = parsed.whales || parsed;
        logger.success(`📥 Loaded ${whales.length} whales from storage`);
        return whales;
      }
    } catch (error) {
      logger.error('❌ Error loading whales:', error);
    }
    
    logger.info('📁 No existing whale data found, starting fresh');
    return [];
  }

  saveWhales(whales: WhaleWallet[]): void {
    try {
      if (fs.existsSync(this.whalesFile)) {
        fs.copyFileSync(this.whalesFile, this.backupFile);
      }

      const dataToSave = {
        lastUpdated: new Date().toISOString(),
        totalWhales: whales.length,
        whales: whales
      };

      fs.writeFileSync(this.whalesFile, JSON.stringify(dataToSave, null, 2));
      logger.success(`💾 Saved ${whales.length} whales to: ${this.whalesFile}`);
    } catch (error) {
      logger.error('❌ Error saving whales:', error);
    }
  }

  getStats(): any {
    return {
      dataDirectory: this.dataDir,
      files: {
        whales: { exists: fs.existsSync(this.whalesFile) },
        backup: { exists: fs.existsSync(this.backupFile) }
      }
    };
  }
}