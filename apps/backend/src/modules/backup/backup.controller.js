const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const backupsDir = path.join(__dirname, '../../../../backups');

// Encode special characters like '@' in database connection URL passwords
const getEncodedDbUrl = (urlStr) => {
    if (!urlStr) return urlStr;
    const match = urlStr.match(/^(postgresql:\/\/|postgres:\/\/)(.*)$/);
    if (!match) return urlStr;
    const protocol = match[1];
    const rest = match[2];
    
    const lastAtIdx = rest.lastIndexOf('@');
    if (lastAtIdx === -1) return urlStr;
    
    const userInfo = rest.substring(0, lastAtIdx);
    const hostDb = rest.substring(lastAtIdx + 1);
    
    const colonIdx = userInfo.indexOf(':');
    if (colonIdx === -1) return urlStr;
    
    const user = userInfo.substring(0, colonIdx);
    const password = userInfo.substring(colonIdx + 1);
    
    return `${protocol}${user}:${encodeURIComponent(password)}@${hostDb}`;
};

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

const getBackups = (req, res) => {
    try {
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.sql'));
        
        const backups = files.map((file, index) => {
            const stats = fs.statSync(path.join(backupsDir, file));
            
            return {
                sn: index + 1,
                filename: file,
                size: (stats.size / 1024).toFixed(2) + ' KB',
                createdAt: stats.birthtime,
                date: stats.birthtime.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                time: stats.birthtime.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
            };
        });

        // Sort descending by creation date
        backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Re-assign SN after sorting
        backups.forEach((b, i) => b.sn = backups.length - i);

        res.json({ success: true, data: backups });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createBackup = async (req, res) => {
    try {
        // Only MAIN_MASTER can trigger backup
        if (req.user.role !== 'MAIN_MASTER') {
            return res.status(403).json({ success: false, message: 'Access denied. Only MAIN_MASTER can perform backups.' });
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '_');
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '_');
        
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.sql'));
        const sn = files.length + 1;

        const filename = `${dateStr}_${timeStr}_${sn}.sql`;
        const filepath = path.join(backupsDir, filename);

        let dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DATABASE_URL not found");
        dbUrl = dbUrl.split('?')[0]; // Remove query params like ?schema=public
        dbUrl = getEncodedDbUrl(dbUrl);
        
        const command = `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe" --inserts --on-conflict-do-nothing -d "${dbUrl}" -f "${filepath}"`;
        
        await execPromise(command);

        res.json({ success: true, message: 'Backup created successfully', data: { filename } });
    } catch (error) {
        console.error('Backup creation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const restoreBackup = async (req, res) => {
    try {
        if (req.user.role !== 'MAIN_MASTER') {
            return res.status(403).json({ success: false, message: 'Access denied. Only MAIN_MASTER can restore backups.' });
        }

        const { filename } = req.params;
        const filepath = path.join(backupsDir, filename);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ success: false, message: 'Backup file not found' });
        }

        let dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DATABASE_URL not found");
        dbUrl = dbUrl.split('?')[0]; // Remove query params like ?schema=public
        dbUrl = getEncodedDbUrl(dbUrl);
        
        const command = `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -d "${dbUrl}" -f "${filepath}"`;
        
        await execPromise(command);

        res.json({ success: true, message: 'Database restored successfully (duplicates ignored)' });
    } catch (error) {
        console.error('Backup restore error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteBackup = async (req, res) => {
    try {
        if (req.user.role !== 'MAIN_MASTER') {
            return res.status(403).json({ success: false, message: 'Access denied. Only MAIN_MASTER can delete backups.' });
        }

        const { filename } = req.params;
        const filepath = path.join(backupsDir, filename);

        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }

        res.json({ success: true, message: 'Backup deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const exportBackups = async (req, res) => {
    try {
        if (req.user.role !== 'MAIN_MASTER') {
            return res.status(403).json({ success: false, message: 'Access denied. Only MAIN_MASTER can export backups.' });
        }

        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.sql'));
        if (files.length === 0) {
            return res.status(400).json({ success: false, message: 'No backup files found to export.' });
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '_');
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '_');
        const zipFilename = `backups_export_${dateStr}_${timeStr}.zip`;
        const zipFilepath = path.join(backupsDir, zipFilename);

        if (fs.existsSync(zipFilepath)) {
            fs.unlinkSync(zipFilepath);
        }

        const command = `powershell -Command "Compress-Archive -Path '${path.join(backupsDir, '*.sql')}' -DestinationPath '${zipFilepath}' -Force"`;
        await execPromise(command);

        res.download(zipFilepath, zipFilename, (err) => {
            if (fs.existsSync(zipFilepath)) {
                fs.unlinkSync(zipFilepath);
            }
            if (err) {
                console.error('Error downloading zip:', err);
            }
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
    exportBackups
};
