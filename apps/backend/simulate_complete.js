process.env.DATABASE_URL = 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable';

const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

const controller = require('./src/modules/production/standardProduction.controller');

async function main() {
  const id = 'f426ea36-dd9b-44ab-9532-172cbf9cebcb';
  const req = {
    params: { id },
    body: {
      actualOutput: 62.35,
      productOutputs: [
        {
          productId: 'ffbdcb53-0461-411e-8d58-432384f86f39',
          productName: 'DESI MALAI',
          actualOutput: 40,
          actualGoodOutput: 40,
          rejectOutput: 0,
          uom: 'pcs',
          labourCost: 0
        },
        {
          productId: '39c89fbe-8091-4c1f-b765-50e885d69cd3',
          productName: 'Alphonso Mango',
          actualOutput: 22.35,
          actualGoodOutput: 22.35,
          rejectOutput: 0,
          uom: 'pcs',
          labourCost: 0
        }
      ],
      productYields: [
        {
          seq: 1,
          productId: 'ffbdcb53-0461-411e-8d58-432384f86f39',
          productName: 'DESI MALAI',
          productCode: 'K101',
          uom: 'pcs',
          planned: 40,
          calculatedYield: 40,
          actualGoodOutput: 40,
          rejectOutput: 0,
          labourCost: 0
        },
        {
          seq: 2,
          productId: '39c89fbe-8091-4c1f-b765-50e885d69cd3',
          productName: 'Alphonso Mango',
          productCode: 'K134',
          uom: 'pcs',
          planned: 22.35,
          calculatedYield: 22.35,
          actualGoodOutput: 22.35,
          rejectOutput: 0,
          labourCost: 0
        }
      ],
      timelineStages: [],
      productStagesMap: {},
      labourTotalCost: 4200,
      ebTotalCost: 10200,
      ebUnitsKwh: 1200,
      ebRatePerUnit: 8.5,
      overheadCost: 1069.12,
      notes: '',
      labTestRequired: false,
      subBatches: []
    },
    user: {
      id: 'a9af9f35-00ed-450f-aafd-838ac735caec',
      name: 'ADMIN MASTER',
      role: 'MAIN_MASTER'
    }
  };

  const res = {
    status(code) {
      console.log('RES STATUS:', code);
      return this;
    },
    json(data) {
      console.log('RES JSON:', JSON.stringify(data, null, 2));
      return this;
    }
  };

  const next = (err) => {
    console.error('NEXT CALLED WITH ERROR:', err);
  };

  try {
    await controller.completeProduction(req, res, next);

    const check = await prisma.$queryRawUnsafe(`
      SELECT id, batch_no, status, actual_output, good_quantity, completed_at, updated_at 
      FROM production_batches 
      WHERE id = $1
    `, id);
    console.log('VERIFIED IN LIVE DB:', check);
  } catch (err) {
    console.error('CATCH ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

