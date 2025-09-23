import fs from 'fs'; // For createWriteStream
import fsp from 'fs/promises'; // For mkdir
import path from 'path';
import archiver from 'archiver';

const backupDir = path.resolve(process.cwd(), 'backups', 'data_backups');
const dataDbPath = path.resolve(process.cwd(), 'data', 'convexa.db');
const runStoragePath = path.resolve(process.cwd(), 'data', 'run_storage');

async function createBackup() {
  try {
    await fsp.mkdir(backupDir, { recursive: true });

    const backupDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupFilePath = path.join(backupDir, `${backupDate}.zip`);

    const output = fs.createWriteStream(backupFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', () => {
      console.log(`Backup created: ${backupFilePath}`);
      console.log(`Total size: ${archive.pointer()} bytes`);
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // Append files and directories
    archive.file(dataDbPath, { name: 'convexa.db' });
    archive.directory(runStoragePath, 'run_storage');

    await archive.finalize();
  } catch (error) {
    console.error('Error creating backup:', error);
    process.exit(1);
  }
}

createBackup();
