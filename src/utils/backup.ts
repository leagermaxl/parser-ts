import fs from 'fs/promises';
import path from 'path';
import type { BackupMeta, BackupReason } from '../types.js';
import { readArrayFromJson } from './utils.js';

const BACKUPS_DIR = path.join(process.cwd(), 'config-backups');

function formatTimestamp(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
	);
}

async function ensureBackupsDir(): Promise<void> {
	await fs.mkdir(BACKUPS_DIR, { recursive: true });
}

export async function createBackup(configPath: string, reason: BackupReason): Promise<string> {
	await ensureBackupsDir();
	const backupFilePath = path.join(BACKUPS_DIR, `${reason}_${formatTimestamp(new Date())}.json`);
	await fs.copyFile(configPath, backupFilePath);
	return backupFilePath;
}

export async function listBackups(): Promise<BackupMeta[]> {
	await ensureBackupsDir();
	const fileNames = (await fs.readdir(BACKUPS_DIR)).filter((name) => name.endsWith('.json'));

	const backups: BackupMeta[] = [];
	for (const fileName of fileNames) {
		const filePath = path.join(BACKUPS_DIR, fileName);
		const reason = fileName.split('_')[0] as BackupReason;

		const [stat, config] = await Promise.all([fs.stat(filePath), readArrayFromJson(filePath)]);

		if (!config) {
			console.warn(`Пропускаю повреждённый бэкап: ${filePath}`);
			continue;
		}

		backups.push({
			filePath,
			reason,
			timestamp: stat.mtime,
			lastOrderId: config.lastOrderId,
			ordersInProgressCount: config.ordersInProgress.length,
		});
	}

	backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	return backups;
}

export async function restoreBackup(backupFilePath: string, configPath: string): Promise<void> {
	const tmpFilePath = `${configPath}.tmp`;
	await fs.copyFile(backupFilePath, tmpFilePath);
	await fs.rename(tmpFilePath, configPath);
}
