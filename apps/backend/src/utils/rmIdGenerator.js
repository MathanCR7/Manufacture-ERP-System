const generateRmId = async (prisma) => {
  const min = 100000;
  const max = 999999;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const candidate = Math.floor(Math.random() * (max - min + 1) + min).toString();
    
    // Check if it exists in IdRegistry (any status)
    const existing = await prisma.idRegistry.findUnique({
      where: { id: candidate }
    });

    if (!existing) {
      return candidate;
    }
    
    attempts++;
  }

  throw new Error('ID space exhausted');
};

module.exports = { generateRmId };
