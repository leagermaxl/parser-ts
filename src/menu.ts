import { confirm, select } from '@inquirer/prompts';
import { SessionExpiredError } from './fetch/fetchUtils.js';
import { pathFileConfig, runScraper } from './script.js';
import { createBackup, listBackups, restoreBackup } from './utils/backup.js';

async function handleRun(): Promise<void> {
  await createBackup(pathFileConfig, 'auto-run');
  try {
    await runScraper();
    console.log('Готово.');
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      console.error(error.message);
    } else {
      console.error('Ошибка во время выполнения:', error instanceof Error ? error.message : error);
    }
  }
}

async function handleManualBackup(): Promise<void> {
  const backupFilePath = await createBackup(pathFileConfig, 'manual');
  console.log(`Конфиг сохранён: ${backupFilePath}`);
}

function formatBackupLabel(backup: Awaited<ReturnType<typeof listBackups>>[number]): string {
  const timestamp = backup.timestamp.toLocaleString('ru-RU');
  return `${backup.reason} — ${timestamp} — lastOrderId: ${backup.lastOrderId}, в работе: ${backup.ordersInProgressCount}`;
}

async function handleChooseConfig(): Promise<void> {
  const backups = await listBackups();

  if (backups.length === 0) {
    console.log('Сохранённых конфигов пока нет.');
    return;
  }

  const chosenFilePath = await select<string | null>({
    message: 'Выберите конфиг для рана:',
    choices: [
      { name: 'Отмена', value: null },
      ...backups.map((backup) => ({ name: formatBackupLabel(backup), value: backup.filePath })),
    ],
  });

  if (!chosenFilePath) return;

  const confirmed = await confirm({
    message: 'Заменить текущий config.json этим снэпшотом? Это необратимо.',
    default: false,
  });
  if (!confirmed) return;

  await createBackup(pathFileConfig, 'auto-restore');
  await restoreBackup(chosenFilePath, pathFileConfig);
  console.log('Конфиг восстановлен.');
}

async function main(): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Выберите действие:',
      choices: [
        { name: 'Запуск работы тулзы', value: 'run' },
        { name: 'Сохранение конфига', value: 'save' },
        { name: 'Выбор конфига для рана', value: 'choose' },
        { name: 'Выход', value: 'exit' },
      ],
    });

    if (action === 'exit') break;

    try {
      switch (action) {
        case 'run':
          await handleRun();
          break;
        case 'save':
          await handleManualBackup();
          break;
        case 'choose':
          await handleChooseConfig();
          break;
      }
    } catch (error) {
      console.error('Непредвиденная ошибка:', error instanceof Error ? error.message : error);
    }
  }
}

main();
