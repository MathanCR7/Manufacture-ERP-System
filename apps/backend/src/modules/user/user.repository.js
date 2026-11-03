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

const USER_BASIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  empId: true,
  ipAddress: true,
  profilePhoto: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

function enrichWithDefaultEmployeeFields(user) {
  if (!user) return user;
  return {
    contactNo: null,
    contacts: [],
    emails: [],
    dob: null,
    doj: null,
    gender: null,
    bloodGroup: null,
    fatherName: null,
    fatherContact: null,
    motherName: null,
    motherContact: null,
    husbandName: null,
    husbandContact: null,
    spouseName: null,
    spouseContact: null,
    presentAddress: null,
    presentAddressProof: null,
    permanentAddress: null,
    permanentAddressProof: null,
    aadhar: null,
    aadharDoc: null,
    pan: null,
    panDoc: null,
    epfoNo: null,
    esiNo: null,
    bankAccountName: null,
    bankName: null,
    bankAccountNo: null,
    bankBranch: null,
    bankIfsc: null,
    bankProof: null,
    familyRemarks: null,
    familyDoc: null,
    attachments: [],
    grossPay: null,
    yearlyCtc: null,
    workingHours: null,
    familyPhotos: [],
    selfiePhoto: null,
    selfieLocation: null,
    cv: null,
    ...user
  };
}

class UserRepository {
  async findAll() {
    try {
      return await prisma.user.findMany({
        select: USER_SAFE_SELECT,
        orderBy: { createdAt: 'desc' }
      });
    } catch (err) {
      console.warn('Notice: Falling back to basic user select:', err.message);
      const basicUsers = await prisma.user.findMany({
        select: USER_BASIC_SELECT,
        orderBy: { createdAt: 'desc' }
      });
      return basicUsers.map(enrichWithDefaultEmployeeFields);
    }
  }

  async findByEmail(email) {
    if (!email) return null;
    try {
      return await prisma.user.findUnique({
        where: { email },
        select: USER_SAFE_SELECT
      });
    } catch (_) {
      const basic = await prisma.user.findUnique({
        where: { email },
        select: USER_BASIC_SELECT
      });
      return enrichWithDefaultEmployeeFields(basic);
    }
  }

  async findById(id) {
    if (!id) return null;
    try {
      return await prisma.user.findUnique({
        where: { id },
        select: USER_SAFE_SELECT
      });
    } catch (_) {
      const basic = await prisma.user.findUnique({
        where: { id },
        select: USER_BASIC_SELECT
      });
      return enrichWithDefaultEmployeeFields(basic);
    }
  }

  async findByEmpId(empId) {
    if (!empId) return null;
    try {
      return await prisma.user.findUnique({
        where: { empId },
        select: USER_SAFE_SELECT
      });
    } catch (_) {
      const basic = await prisma.user.findUnique({
        where: { empId },
        select: USER_BASIC_SELECT
      });
      return enrichWithDefaultEmployeeFields(basic);
    }
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
    try {
      return await prisma.user.create({
        data,
        select: USER_SAFE_SELECT
      });
    } catch (err) {
      if (err.code === 'P2022' || (err.message && err.message.includes('does not exist'))) {
        console.warn('Notice: Employee master columns missing during create, saving core fields:', err.message);
        const coreData = {
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role,
          empId: data.empId,
          ipAddress: data.ipAddress,
          profilePhoto: data.profilePhoto,
          isActive: data.isActive
        };
        const created = await prisma.user.create({
          data: coreData,
          select: USER_BASIC_SELECT
        });
        return enrichWithDefaultEmployeeFields(created);
      }
      throw err;
    }
  }

  async update(id, data) {
    try {
      return await prisma.user.update({
        where: { id },
        data,
        select: USER_SAFE_SELECT
      });
    } catch (err) {
      if (err.code === 'P2022' || (err.message && err.message.includes('does not exist'))) {
        console.warn('Notice: Employee master columns missing during update, saving core fields:', err.message);
        const coreData = {};
        ['name', 'email', 'passwordHash', 'role', 'empId', 'ipAddress', 'profilePhoto', 'isActive'].forEach(f => {
          if (data[f] !== undefined) coreData[f] = data[f];
        });
        const updated = await prisma.user.update({
          where: { id },
          data: coreData,
          select: USER_BASIC_SELECT
        });
        return enrichWithDefaultEmployeeFields(updated);
      }
      throw err;
    }
  }

  async updateProfile(id, data) {
    try {
      return await prisma.user.update({
        where: { id },
        data,
        select: USER_SAFE_SELECT
      });
    } catch (err) {
      const coreData = {};
      ['name', 'email', 'profilePhoto'].forEach(f => {
        if (data[f] !== undefined) coreData[f] = data[f];
      });
      const updated = await prisma.user.update({
        where: { id },
        data: coreData,
        select: USER_BASIC_SELECT
      });
      return enrichWithDefaultEmployeeFields(updated);
    }
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
