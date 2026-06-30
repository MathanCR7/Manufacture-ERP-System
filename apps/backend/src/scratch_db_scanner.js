const prisma = require('./database/prisma');

async function main() {
  const targetId = '4b4a-4336-a975-cfeb09c33129';
  console.log("Searching database for ID:", targetId);

  const tables = [
    'user', 'uOM', 'auditLog', 'userSessionLog', 'note', 'supplier', 'customer', 'expense',
    'rMCategory', 'rawMaterial', 'rMStockAdjustment', 'nonInventoryItem', 'productCategory',
    'product', 'rMWaste', 'rMWasteItem', 'gRNReceive', 'gRNReceiveItem', 'gRNLabTest',
    'gRNLabTestResult', 'purchaseReturn', 'inventoryBatch', 'labInventoryItem',
    'labInventoryUsage', 'rMLabCategory', 'rMLabRequiredResult', 'finishedProduct',
    'productBOM', 'productNonInventoryCost', 'productStage', 'productStockLevel',
    'productionBatchNew', 'productionBatchRMUsage', 'productionLoss',
    'productionLossProduct', 'productionLossMaterial', 'labProductionTestNew',
    'productStockMovement', 'customerOrder', 'customerOrderItem', 'customerOrderDelivery',
    'productionStageMaster', 'productWastage', 'assetRequest', 'assetPQ', 'assetPQItem',
    'assetPO', 'assetPOItem', 'assetGRPO', 'assetGRPOItem', 'assetAPInvoice',
    'assetAPInvoiceItem', 'asset', 'departmentBudget', 'assetMaster', 'communicationLog',
    'companyDetails', 'salesCampaign', 'salesCampaignOrder', 'salesReturn',
    'salesReturnItem', 'errorLog'
  ];

  for (const table of tables) {
    if (prisma[table]) {
      try {
        const record = await prisma[table].findUnique({
          where: { id: targetId }
        });
        if (record) {
          console.log(`FOUND in table ${table}:`, record);
        }
      } catch (err) {
        // Skip
      }
    }
  }
  console.log("Finished search.");
}

main().catch(err => console.error("ERROR:", err));
