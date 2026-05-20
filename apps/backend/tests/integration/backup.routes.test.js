const request = require('supertest');
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            const instance = {
                $connect: jest.fn(),
                $disconnect: jest.fn(),
                $extends: jest.fn().mockReturnThis(),
                user: { findUnique: jest.fn() }
            };
            return instance;
        })
    };
});
jest.mock('../../src/middlewares/auth.middleware', () => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const token = authHeader.split(' ')[1];
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            if (!decoded) throw new Error();
            req.user = decoded;
            next();
        } catch(e) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
    };
});
const app = require('../../src/app');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const child_process = require('child_process');

jest.mock('fs');
jest.mock('child_process', () => ({
    exec: jest.fn((cmd, cb) => cb(null, 'stdout', 'stderr'))
}));

describe('Backup API Integration Tests', () => {
    let token;

    beforeAll(() => {
        // Set fake database URL to prevent 500 errors
        process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';

        // Generate a valid token for a mock MAIN_MASTER user
        token = jwt.sign(
            { id: '1', role: 'MAIN_MASTER', name: 'admin' }, 
            process.env.JWT_SECRET || 'kulfi_super_secret_key_2026'
        );
        
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['backup_1.sql', 'backup_2.sql']);
        fs.statSync.mockReturnValue({
            size: 2048,
            birthtime: new Date()
        });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('GET /api/backups', () => {
        it('should return 401 if no token provided', async () => {
            const res = await request(app).get('/api/backups');
            expect(res.statusCode).toBe(401);
        });

        it('should return a list of backups when authenticated', async () => {
            const res = await request(app)
                .get('/api/backups')
                .set('Authorization', `Bearer ${token}`);
                
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(2);
        });
    });

    describe('POST /api/backups', () => {
        it('should trigger a backup creation successfully for MAIN_MASTER', async () => {
            const res = await request(app)
                .post('/api/backups')
                .set('Authorization', `Bearer ${token}`);
                
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Backup created successfully');
            expect(child_process.exec).toHaveBeenCalled();
        });

        it('should deny backup creation for non MAIN_MASTER roles', async () => {
            const lowToken = jwt.sign(
                { id: '2', role: 'SUPERVISOR', name: 'supervisor' }, 
                process.env.JWT_SECRET || 'kulfi_super_secret_key_2026'
            );

            const res = await request(app)
                .post('/api/backups')
                .set('Authorization', `Bearer ${lowToken}`);
                
            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Access denied. Only MAIN_MASTER can perform backups.');
        });
    });

    describe('POST /api/backups/:filename/restore', () => {
        it('should restore database successfully', async () => {
            const res = await request(app)
                .post('/api/backups/backup_1.sql/restore')
                .set('Authorization', `Bearer ${token}`);
                
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Database restored successfully');
            expect(child_process.exec).toHaveBeenCalled();
        });

        it('should return 404 if file does not exist', async () => {
            fs.existsSync.mockReturnValueOnce(false); // mock missing file
            const res = await request(app)
                .post('/api/backups/missing.sql/restore')
                .set('Authorization', `Bearer ${token}`);
                
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Backup file not found');
        });
    });

    describe('DELETE /api/backups/:filename', () => {
        it('should delete a backup file successfully', async () => {
            fs.existsSync.mockReturnValueOnce(true); // file exists
            const res = await request(app)
                .delete('/api/backups/backup_1.sql')
                .set('Authorization', `Bearer ${token}`);
                
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(fs.unlinkSync).toHaveBeenCalled();
        });
    });
});
