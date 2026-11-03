const prisma = require('../../database/prisma');

const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  empId: true,
  ipAddress: true,
  profilePhoto: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  contactNo: true,
  contacts: true,
  emails: true,
  dob: true,
  doj: true,
  gender: true,
  bloodGroup: true,
  fatherName: true,
  fatherContact: true,
  motherName: true,
  motherContact: true,
  husbandName: true,
  husbandContact: true,
  spouseName: true,
  spouseContact: true,
  presentAddress: true,
  presentAddressProof: true,
  permanentAddress: true,
  permanentAddressProof: true,
  aadhar: true,
  aadharDoc: true,
  pan: true,
  panDoc: true,
  epfoNo: true,
  esiNo: true,
  bankAccountName: true,
  bankName: true,
  bankAccountNo: true,
  bankBranch: true,
  bankIfsc: true,
  bankProof: true,
  familyRemarks: true,
  familyDoc: true,
  attachments: true,
  grossPay: true,
  yearlyCtc: true,
  workingHours: true,
  familyPhotos: true,
  selfiePhoto: true,
  selfieLocation: true,
  cv: true
};

class UserRepository {
  async findAll() {
    return prisma.user.findMany({
      select: USER_SAFE_SELECT,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmpId(empId) {
    if (!empId) return null;
    return prisma.user.findUnique({ where: { empId } });
  }

  async getNextEmpId() {
    const users = await prisma.user.findMany({
      select: { empId: true }
    });

    let maxSeq = 0;
    for (const u of users) {
      if (!u.empId) continue;
      // Match VTE0001, VTE-0001, or any trailing numeric sequence
      const vteMatch = u.empId.match(/^VTE-?(\d+)/i) || u.empId.match(/(\d+)$/);
      if (vteMatch) {
        const num = parseInt(vteMatch[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return `VTE${String(nextSeq).padStart(4, '0')}`;
  }

  async create(data) {
    return prisma.user.create({
      data,
      select: USER_SAFE_SELECT
    });
  }

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: USER_SAFE_SELECT
    });
  }

  async updateProfile(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: USER_SAFE_SELECT
    });
  }

  async delete(id) {
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true }
    });
  }
}

module.exports = new UserRepository();
