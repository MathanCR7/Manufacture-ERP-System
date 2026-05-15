const generateReferenceNo = async (prisma, modelName, prefix) => {
  const tableName = modelName[0].toUpperCase() + modelName.slice(1);

  // Use raw SQL to avoid Prisma client schema mismatches for dynamic fields
  const query = `SELECT "referenceNo" FROM "${tableName}" WHERE "referenceNo" LIKE '${prefix}-%' ORDER BY "referenceNo" DESC LIMIT 1`;
  const result = await prisma.$queryRawUnsafe(query);
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  if (!lastRecord || !lastRecord.referenceNo) {
    return `${prefix}-000001`;
  }

  const lastNumberStr = lastRecord.referenceNo.split('-')[1];
  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = lastNumber + 1;
  return `${prefix}-${String(nextNumber).padStart(6, '0')}`;
};

module.exports = { generateReferenceNo };
