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
const prisma = require('../../src/database/prisma');

jest.mock('../../src/database/prisma', () => ({
    attendanceLog: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    user: {
        findMany: jest.fn(),
    }
}));

describe('Attendance API Integration Tests', () => {
    let token, masterToken;

    beforeAll(() => {
        token = jwt.sign(
            { id: 'user1', role: 'OPERATOR', name: 'Operator' }, 
            process.env.JWT_SECRET || 'kulfi_super_secret_key_2026'
        );

        masterToken = jwt.sign(
            { id: 'admin1', role: 'MAIN_MASTER', name: 'Admin' }, 
            process.env.JWT_SECRET || 'kulfi_super_secret_key_2026'
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/attendance/check-in', () => {
        it('should allow user to check in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue(null);
            prisma.attendanceLog.create.mockResolvedValue({ id: 'log1', userId: 'user1', checkIn: new Date() });

            const res = await request(app)
                .post('/api/attendance/check-in')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.log.id).toBe('log1');
        });

        it('should block double check-in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue({ id: 'log1', userId: 'user1', checkIn: new Date() });

            const res = await request(app)
                .post('/api/attendance/check-in')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Already checked in');
        });
    });

    describe('POST /api/attendance/check-out', () => {
        it('should allow user to check out', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue({ id: 'log1', userId: 'user1', checkIn: new Date(Date.now() - 3600000) });
            prisma.attendanceLog.update.mockResolvedValue({ id: 'log1', duration: 60, checkOut: new Date() });

            const res = await request(app)
                .post('/api/attendance/check-out')
                .set('Authorization', `Bearer ${token}`)
                .send({ note: 'Leaving early' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should error if checking out without checking in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/attendance/check-out')
                .set('Authorization', `Bearer ${token}`);

            console.log("res.body", res.body);
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('No active check-in found.');
        });
    });

    describe('GET /api/attendance/status', () => {
        it('should return check-in status', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue({ id: 'log1' });

            const res = await request(app)
                .get('/api/attendance/status')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.isCheckedIn).toBe(true);
        });
    });

    describe('GET /api/attendance/my', () => {
        it('should return users logs', async () => {
            prisma.attendanceLog.findMany.mockResolvedValue([{ id: 'log1' }, { id: 'log2' }]);

            const res = await request(app)
                .get('/api/attendance/my')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
        });
    });

    describe('GET /api/attendance/all', () => {
        it('should allow MAIN_MASTER to view all logs', async () => {
            prisma.attendanceLog.findMany.mockResolvedValue([{ id: 'log1' }]);

            const res = await request(app)
                .get('/api/attendance/all')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.statusCode).toBe(200);
        });

        it('should deny OPERATOR to view all logs', async () => {
            const res = await request(app)
                .get('/api/attendance/all')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toBe('Forbidden');
        });
    });
});
