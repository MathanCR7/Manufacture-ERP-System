const { checkIn, checkOut, getStatus, getMyLogs, getAllLogs, getAllUsers } = require('../../src/modules/attendance/attendance.controller');
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

describe('Attendance Controller Unit Tests', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            user: { id: 'user1', role: 'OPERATOR' },
            body: {},
            query: {},
            ip: '127.0.0.1'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('checkIn', () => {
        it('should successfully check in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue(null);
            prisma.attendanceLog.create.mockResolvedValue({ id: 'log1', userId: 'user1', checkIn: new Date() });

            await checkIn(mockReq, mockRes, mockNext);

            expect(prisma.attendanceLog.findFirst).toHaveBeenCalled();
            expect(prisma.attendanceLog.create).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, log: expect.any(Object) }));
        });

        it('should return error if already checked in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue({ id: 'log1', userId: 'user1', checkIn: new Date() });

            await checkIn(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Already checked in. Please check out first.' }));
        });
    });

    describe('checkOut', () => {
        it('should successfully check out', async () => {
            const checkInTime = new Date();
            checkInTime.setMinutes(checkInTime.getMinutes() - 60); // 60 mins ago
            prisma.attendanceLog.findFirst.mockResolvedValue({ id: 'log1', userId: 'user1', checkIn: checkInTime });
            prisma.attendanceLog.update.mockResolvedValue({ id: 'log1', userId: 'user1', checkOut: new Date(), duration: 60 });

            mockReq.body.note = 'Done for the day';
            await checkOut(mockReq, mockRes, mockNext);

            expect(prisma.attendanceLog.findFirst).toHaveBeenCalled();
            expect(prisma.attendanceLog.update).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, log: expect.any(Object) }));
        });

        it('should return error if not checked in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue(null);

            await checkOut(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'No active check-in found.' }));
        });
    });

    describe('getStatus', () => {
        it('should return active status if checked in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue({ id: 'log1', userId: 'user1', checkIn: new Date() });

            await getStatus(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ isCheckedIn: true, activeLog: expect.any(Object) }));
        });

        it('should return inactive status if not checked in', async () => {
            prisma.attendanceLog.findFirst.mockResolvedValue(null);

            await getStatus(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ isCheckedIn: false, activeLog: null }));
        });
    });

    describe('getMyLogs', () => {
        it('should return user logs', async () => {
            prisma.attendanceLog.findMany.mockResolvedValue([{ id: 'log1' }, { id: 'log2' }]);

            await getMyLogs(mockReq, mockRes, mockNext);

            expect(prisma.attendanceLog.findMany).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith([{ id: 'log1' }, { id: 'log2' }]);
        });
    });

    describe('getAllLogs', () => {
        it('should return logs for authorized roles', async () => {
            mockReq.user.role = 'MAIN_MASTER';
            prisma.attendanceLog.findMany.mockResolvedValue([{ id: 'log1' }]);

            await getAllLogs(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith([{ id: 'log1' }]);
        });

        it('should forbid unauthorized roles', async () => {
            mockReq.user.role = 'OPERATOR';

            await getAllLogs(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden' });
        });
    });

    describe('getAllUsers', () => {
        it('should return users for authorized roles', async () => {
            mockReq.user.role = 'SUPERVISOR';
            prisma.user.findMany.mockResolvedValue([{ id: 'user1' }]);

            await getAllUsers(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith([{ id: 'user1' }]);
        });

        it('should forbid unauthorized roles', async () => {
            mockReq.user.role = 'OPERATOR';

            await getAllUsers(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden' });
        });
    });
});
