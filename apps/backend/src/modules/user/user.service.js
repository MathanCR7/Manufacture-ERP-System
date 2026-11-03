const bcrypt = require('bcrypt');
const userRepository = require('./user.repository');
const notificationService = require('../notifications/notifications.service');
const employeeFileStorage = require('../../utils/employeeFileStorage');

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseDecimal(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function parseString(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function normalizeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return [val];
  }
}

class UserService {
  async getAllUsers() {
    return userRepository.findAll();
  }

  async getNextEmpId() {
    return userRepository.getNextEmpId();
  }

  async createUser(userData) {
    const {
      name,
      email,
      emails,
      password,
      role,
      ipAddress,
      empId,
      contactNo,
      contacts,
      dob,
      doj,
      gender,
      bloodGroup,
      fatherName,
      fatherContact,
      motherName,
      motherContact,
      husbandName,
      husbandContact,
      spouseName,
      spouseContact,
      presentAddress,
      permanentAddress,
      aadhar,
      pan,
      epfoNo,
      esiNo,
      bankAccountName,
      bankName,
      bankAccountNo,
      bankBranch,
      bankIfsc,
      familyRemarks,
      grossPay,
      yearlyCtc,
      workingHours,
      profilePhoto,
      selfiePhoto,
      selfieLocation,
      cv,
      presentAddressProof,
      permanentAddressProof,
      aadharDoc,
      panDoc,
      bankProof,
      familyDoc,
      familyPhotos,
      attachments
    } = userData;

    // Normalizing multi-entry fields (++)
    const contactsList = normalizeArray(contacts).map(c => typeof c === 'string' ? c.trim() : c?.number || '').filter(Boolean);
    const primaryContact = contactsList.length > 0 ? contactsList[0] : parseString(contactNo);

    const emailsList = normalizeArray(emails).map(e => typeof e === 'string' ? e.trim().toLowerCase() : e?.email || '').filter(Boolean);
    const primaryEmail = (emailsList.length > 0 ? emailsList[0] : parseString(email) || '').toLowerCase();

    // Mandatory Field Validations based on specification
    if (!name) throw { status: 400, message: 'Full Name is required (Mandatory).' };
    if (!primaryContact) throw { status: 400, message: 'Contact No is required (Mandatory).' };
    if (!primaryEmail) throw { status: 400, message: 'Email address is required.' };
    if (!password) throw { status: 400, message: 'Password is required.' };
    if (!role) throw { status: 400, message: 'Designation Role is required.' };
    if (!profilePhoto) throw { status: 400, message: 'Employee Photo is required (Mandatory).' };
    if (!dob) throw { status: 400, message: 'Date of Birth (DOB) is required (Mandatory).' };
    if (!doj) throw { status: 400, message: 'Date of Joining (DOJ) is required (Mandatory).' };
    if (!gender) throw { status: 400, message: 'Sex / Gender is required (Mandatory).' };
    if (!bloodGroup) throw { status: 400, message: 'Blood Group is required (Mandatory).' };
    if (!fatherName) throw { status: 400, message: 'Father Name is required (Mandatory).' };
    if (!fatherContact) throw { status: 400, message: 'Emergency Contact No is required (Mandatory).' };

    const existingUser = await userRepository.findByEmail(primaryEmail);
    if (existingUser) throw { status: 400, message: `Email "${primaryEmail}" already exists.` };

    let finalEmpId = parseString(empId);
    if (!finalEmpId) {
      finalEmpId = await userRepository.getNextEmpId();
    } else {
      const existingEmp = await userRepository.findByEmpId(finalEmpId);
      if (existingEmp) {
        throw { status: 400, message: `Employee ID "${finalEmpId}" is already assigned to another user.` };
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Save uploaded files to uploads/employees/{empId}/
    const savedPhoto = employeeFileStorage.processProfilePhoto(profilePhoto, finalEmpId, null);
    const savedSelfie = employeeFileStorage.processSingleFile(selfiePhoto, finalEmpId, 'selfie', null);
    const savedCv = employeeFileStorage.processSingleFile(cv, finalEmpId, 'cv', null);
    const savedPresentProof = employeeFileStorage.processSingleFile(presentAddressProof, finalEmpId, 'present_addr', null);
    const savedPermanentProof = employeeFileStorage.processSingleFile(permanentAddressProof, finalEmpId, 'perm_addr', null);
    const savedAadharDoc = employeeFileStorage.processSingleFile(aadharDoc, finalEmpId, 'aadhar', null);
    const savedPanDoc = employeeFileStorage.processSingleFile(panDoc, finalEmpId, 'pan', null);
    const savedBankProof = employeeFileStorage.processSingleFile(bankProof, finalEmpId, 'bank', null);
    const savedFamilyDoc = employeeFileStorage.processSingleFile(familyDoc, finalEmpId, 'family_doc', null);

    const savedFamilyPhotos = employeeFileStorage.processFamilyPhotos(familyPhotos, finalEmpId, []);
    const savedAttachments = employeeFileStorage.processAttachments(attachments, finalEmpId, []);

    // Auto-calculate yearly CTC if gross pay is supplied and yearlyCtc is blank
    let computedGross = parseDecimal(grossPay);
    let computedCtc = parseDecimal(yearlyCtc);
    if (computedGross !== null && (computedCtc === null || computedCtc === 0)) {
      computedCtc = computedGross * 12;
    }

    return userRepository.create({
      name: name.trim(),
      email: primaryEmail,
      emails: emailsList.length > 0 ? emailsList : [primaryEmail],
      passwordHash,
      role,
      empId: finalEmpId,
      ipAddress: parseString(ipAddress),
      contactNo: primaryContact,
      contacts: contactsList.length > 0 ? contactsList : [primaryContact],
      dob: parseDate(dob),
      doj: parseDate(doj),
      gender: parseString(gender),
      bloodGroup: parseString(bloodGroup),
      fatherName: parseString(fatherName),
      fatherContact: parseString(fatherContact),
      motherName: parseString(motherName),
      motherContact: parseString(motherContact),
      husbandName: parseString(husbandName),
      husbandContact: parseString(husbandContact),
      spouseName: parseString(spouseName),
      spouseContact: parseString(spouseContact),
      presentAddress: parseString(presentAddress),
      presentAddressProof: savedPresentProof,
      permanentAddress: parseString(permanentAddress),
      permanentAddressProof: savedPermanentProof,
      aadhar: parseString(aadhar),
      aadharDoc: savedAadharDoc,
      pan: parseString(pan),
      panDoc: savedPanDoc,
      epfoNo: parseString(epfoNo),
      esiNo: parseString(esiNo),
      bankAccountName: parseString(bankAccountName),
      bankName: parseString(bankName),
      bankAccountNo: parseString(bankAccountNo),
      bankBranch: parseString(bankBranch),
      bankIfsc: parseString(bankIfsc),
      bankProof: savedBankProof,
      familyRemarks: parseString(familyRemarks),
      familyDoc: savedFamilyDoc,
      grossPay: computedGross,
      yearlyCtc: computedCtc,
      workingHours: parseString(workingHours),
      profilePhoto: savedPhoto,
      selfiePhoto: savedSelfie,
      selfieLocation: parseString(selfieLocation),
      cv: savedCv,
      familyPhotos: savedFamilyPhotos,
      attachments: savedAttachments
    });
  }

  async updateUser(id, updateData) {
    const existing = await userRepository.findById(id);
    if (!existing) throw { status: 404, message: 'User not found.' };

    const {
      password,
      email,
      emails,
      empId,
      grossPay,
      yearlyCtc,
      dob,
      doj,
      contactNo,
      contacts,
      profilePhoto,
      selfiePhoto,
      selfieLocation,
      cv,
      presentAddressProof,
      permanentAddressProof,
      aadharDoc,
      panDoc,
      bankProof,
      familyDoc,
      familyPhotos,
      attachments,
      ...rest
    } = updateData;

    const payload = {};

    let currentEmpId = existing.empId;
    if (empId !== undefined) {
      const cleanedEmpId = parseString(empId);
      if (cleanedEmpId && cleanedEmpId !== existing.empId) {
        const empInUse = await userRepository.findByEmpId(cleanedEmpId);
        if (empInUse && empInUse.id !== id) {
          throw { status: 400, message: `Employee ID "${cleanedEmpId}" is already in use.` };
        }
      }
      payload.empId = cleanedEmpId;
      currentEmpId = cleanedEmpId || existing.id;
    }

    // Process Contacts (++)
    if (contacts !== undefined || contactNo !== undefined) {
      const contactsList = normalizeArray(contacts !== undefined ? contacts : existing.contacts)
        .map(c => typeof c === 'string' ? c.trim() : c?.number || '')
        .filter(Boolean);
      const primaryContact = contactsList.length > 0 ? contactsList[0] : parseString(contactNo) || existing.contactNo;
      payload.contacts = contactsList.length > 0 ? contactsList : (primaryContact ? [primaryContact] : []);
      payload.contactNo = primaryContact;
    }

    // Process Emails (++)
    if (emails !== undefined || email !== undefined) {
      const emailsList = normalizeArray(emails !== undefined ? emails : existing.emails)
        .map(e => typeof e === 'string' ? e.trim().toLowerCase() : e?.email || '')
        .filter(Boolean);
      const primaryEmail = (emailsList.length > 0 ? emailsList[0] : parseString(email) || existing.email).toLowerCase();

      if (primaryEmail && primaryEmail !== existing.email.toLowerCase()) {
        const emailInUse = await userRepository.findByEmail(primaryEmail);
        if (emailInUse && emailInUse.id !== id) {
          throw { status: 400, message: 'Email already exists.' };
        }
      }
      payload.email = primaryEmail;
      payload.emails = emailsList.length > 0 ? emailsList : [primaryEmail];
    }

    if (password && password.trim()) {
      payload.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    if (dob !== undefined) payload.dob = parseDate(dob);
    if (doj !== undefined) payload.doj = parseDate(doj);

    if (grossPay !== undefined || yearlyCtc !== undefined) {
      const parsedGross = parseDecimal(grossPay !== undefined ? grossPay : existing.grossPay);
      let parsedCtc = parseDecimal(yearlyCtc !== undefined ? yearlyCtc : existing.yearlyCtc);
      if (parsedGross !== null && (parsedCtc === null || parsedCtc === 0)) {
        parsedCtc = parsedGross * 12;
      }
      payload.grossPay = parsedGross;
      payload.yearlyCtc = parsedCtc;
    }

    // Process Proof Files
    if (profilePhoto !== undefined) {
      payload.profilePhoto = employeeFileStorage.processProfilePhoto(profilePhoto, currentEmpId, existing.profilePhoto);
    }
    if (selfiePhoto !== undefined) {
      payload.selfiePhoto = employeeFileStorage.processSingleFile(selfiePhoto, currentEmpId, 'selfie', existing.selfiePhoto);
    }
    if (selfieLocation !== undefined) {
      payload.selfieLocation = parseString(selfieLocation);
    }
    if (cv !== undefined) {
      payload.cv = employeeFileStorage.processSingleFile(cv, currentEmpId, 'cv', existing.cv);
    }
    if (presentAddressProof !== undefined) {
      payload.presentAddressProof = employeeFileStorage.processSingleFile(presentAddressProof, currentEmpId, 'present_addr', existing.presentAddressProof);
    }
    if (permanentAddressProof !== undefined) {
      payload.permanentAddressProof = employeeFileStorage.processSingleFile(permanentAddressProof, currentEmpId, 'perm_addr', existing.permanentAddressProof);
    }
    if (aadharDoc !== undefined) {
      payload.aadharDoc = employeeFileStorage.processSingleFile(aadharDoc, currentEmpId, 'aadhar', existing.aadharDoc);
    }
    if (panDoc !== undefined) {
      payload.panDoc = employeeFileStorage.processSingleFile(panDoc, currentEmpId, 'pan', existing.panDoc);
    }
    if (bankProof !== undefined) {
      payload.bankProof = employeeFileStorage.processSingleFile(bankProof, currentEmpId, 'bank', existing.bankProof);
    }
    if (familyDoc !== undefined) {
      payload.familyDoc = employeeFileStorage.processSingleFile(familyDoc, currentEmpId, 'family_doc', existing.familyDoc);
    }

    if (familyPhotos !== undefined) {
      payload.familyPhotos = employeeFileStorage.processFamilyPhotos(familyPhotos, currentEmpId, existing.familyPhotos);
    }

    if (attachments !== undefined) {
      payload.attachments = employeeFileStorage.processAttachments(attachments, currentEmpId, existing.attachments);
    }

    // Process text fields
    const stringFields = [
      'name', 'role', 'ipAddress', 'gender', 'bloodGroup',
      'fatherName', 'fatherContact', 'motherName', 'motherContact',
      'husbandName', 'husbandContact', 'spouseName', 'spouseContact',
      'presentAddress', 'permanentAddress', 'aadhar', 'pan', 'epfoNo', 'esiNo',
      'bankAccountName', 'bankName', 'bankAccountNo', 'bankBranch', 'bankIfsc',
      'familyRemarks', 'workingHours'
    ];

    stringFields.forEach(field => {
      if (rest[field] !== undefined) {
        payload[field] = parseString(rest[field]);
      }
    });

    if (rest.isActive !== undefined) {
      payload.isActive = Boolean(rest.isActive);
    }

    return userRepository.update(id, payload);
  }

  async deactivateUser(id) {
    return userRepository.delete(id);
  }

  async getProfile(id) {
    const user = await userRepository.findById(id);
    if (!user) throw { status: 404, message: 'User not found.' };
    return user;
  }

  async updateProfile(id, data) {
    const existing = await userRepository.findById(id);
    if (!existing) throw { status: 404, message: 'User not found.' };

    const { profilePhoto, name, email, contactNo } = data;
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (contactNo !== undefined) updateData.contactNo = parseString(contactNo);

    if (profilePhoto !== undefined) {
      updateData.profilePhoto = employeeFileStorage.processProfilePhoto(
        profilePhoto,
        existing.empId || existing.id,
        existing.profilePhoto
      );
    }

    return userRepository.updateProfile(id, updateData);
  }

  async requestPasswordChange({ userId, userName, userRole, newPassword, message }) {
    if (!newPassword) throw { status: 400, message: 'New password is required.' };

    await notificationService.createNotification({
      type: 'PASSWORD_CHANGE_REQUEST',
      recipient_roles: ['MAIN_MASTER'],
      sender_role: userRole,
      sender_id: userId,
      reference_type: 'USER',
      reference_id: userId,
      event_at: new Date(),
      message: `🔑 Password Change Request — ${userName} (${userRole.replace(/_/g, ' ')}) has requested a password change.\nMessage: "${message || 'No message provided'}"\nRequested password: "${newPassword}"\n→ Please update in User Management.`,
      metadata: { userId, userName, userRole, requestedPassword: newPassword, userMessage: message }
    });

    return { success: true, message: 'Password change request sent to the master admin.' };
  }
}

module.exports = new UserService();
