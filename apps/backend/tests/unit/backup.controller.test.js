const { getBackups, createBackup, restoreBackup, deleteBackup } = require('../../src/modules/backup/backup.controller');
const fs = require('fs');
const child_process = require('child_process');

jest.mock('fs');
jest.mock('child_process', () => ({
    exec: jest.fn((cmd, cb) => cb(null, 'stdout', 'stderr'))
}));

describe('Backup Controller Unit Tests', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        mockReq = {
            user: { role: 'MAIN_MASTER', name: 'admin', email: 'admin@test.com' },
            params: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
        
        // Mock fs functions
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['test_backup.sql']);
        fs.statSync.mockReturnValue({
            size: 1024,
            birthtime: new Date('2026-05-19T10:00:00Z')
        });
        
        // Mock environment
        process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb?schema=public';
    });

    describe('getBackups', () => {
        it('should return a list of backups successfully', () => {
            getBackups(mockReq, mockRes);
            expect(fs.readdirSync).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.any(Array)
                })
            );
        });
    });

    describe('createBackup', () => {
        it('should create a backup successfully for MAIN_MASTER', async () => {
            await createBackup(mockReq, mockRes);
            expect(child_process.exec).toHaveBeenCalled();
            // Verify dbUrl was cleaned
            const execCall = child_process.exec.mock.calls[0][0];
            expect(execCall).not.toContain('?schema=public');
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, message: 'Backup created successfully' })
            );
        });

        it('should deny access if user is not MAIN_MASTER', async () => {
            mockReq.user.role = 'SUPERVISOR';
            await createBackup(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false, message: 'Access denied. Only MAIN_MASTER can perform backups.' })
            );
        });
    });

    describe('restoreBackup', () => {
        it('should restore a backup successfully', async () => {
            mockReq.params.filename = 'test_backup.sql';
            await restoreBackup(mockReq, mockRes);
            expect(child_process.exec).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, message: 'Database restored successfully (duplicates ignored)' })
            );
        });

        it('should return 404 if backup file does not exist', async () => {
            mockReq.params.filename = 'missing.sql';
            fs.existsSync.mockReturnValue(false);
            await restoreBackup(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false, message: 'Backup file not found' })
            );
        });
    });

    describe('deleteBackup', () => {
        it('should delete a backup successfully', async () => {
            mockReq.params.filename = 'test_backup.sql';
            await deleteBackup(mockReq, mockRes);
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, message: 'Backup deleted successfully' })
            );
        });
    });
});
