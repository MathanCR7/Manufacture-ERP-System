const prisma = require('../../database/prisma');
const XLSX = require('xlsx');

const SYSTEM_PRESET_TEMPLATES = {
  PRESET_DAIRY_ICE_CREAM: {
    name: 'DAIRY & ICE CREAM MASTER SPECIFICATION TEMPLATE',
    description: 'Standard manufacturing quality, sensory, and cold-chain storage parameters.',
    fields: [
      { fieldName: 'MILK FAT PERCENTAGE', fieldKey: 'fat_content', fieldType: 'NUMBER', section: 'CHEMICAL & QUALITY SPECS', unitOfMeasure: '%', isMandatory: true, minValue: 0, maxValue: 100, defaultValue: '10' },
      { fieldName: 'TOTAL SOLIDS / SNF', fieldKey: 'total_solids', fieldType: 'NUMBER', section: 'CHEMICAL & QUALITY SPECS', unitOfMeasure: '%', isMandatory: true, minValue: 0, maxValue: 100, defaultValue: '36' },
      { fieldName: 'STORAGE TEMPERATURE', fieldKey: 'storage_temp', fieldType: 'NUMBER', section: 'STORAGE & SHELF LIFE', unitOfMeasure: '°C', isMandatory: true, minValue: -40, maxValue: 0, defaultValue: '-18' },
      { fieldName: 'SHELF LIFE DAYS', fieldKey: 'shelf_life', fieldType: 'NUMBER', section: 'STORAGE & SHELF LIFE', unitOfMeasure: 'DAYS', isMandatory: true, minValue: 1, maxValue: 730, defaultValue: '180' },
      { fieldName: 'PRIMARY PACKAGING TYPE', fieldKey: 'packaging_type', fieldType: 'SELECT', section: 'PACKAGING & LOGISTICS', unitOfMeasure: null, isMandatory: true, options: ['WRAPPER POUCH', 'PLASTIC CUP', 'FAMILY TUB', 'MATKA POT', 'CONE SLEEVE'] },
      { fieldName: 'ALLERGEN CONTAINS NUTS', fieldKey: 'contains_nuts', fieldType: 'BOOLEAN', section: 'ALLERGEN & REGULATORY', unitOfMeasure: null, isMandatory: false, defaultValue: 'false' },
      { fieldName: 'OVERRUN PERCENTAGE', fieldKey: 'overrun_pct', fieldType: 'NUMBER', section: 'PHYSICAL CHARACTERISTICS', unitOfMeasure: '%', isMandatory: false, minValue: 0, maxValue: 120, defaultValue: '40' }
    ]
  },
  PRESET_BEVERAGE_LIQUID: {
    name: 'BEVERAGES & SYRUPS MASTER SPECIFICATION TEMPLATE',
    description: 'Standard physical, chemical, and bottling specifications for liquid products.',
    fields: [
      { fieldName: 'BRIX PERCENTAGE', fieldKey: 'brix_content', fieldType: 'NUMBER', section: 'CHEMICAL & QUALITY SPECS', unitOfMeasure: '°BX', isMandatory: true, minValue: 0, maxValue: 100, defaultValue: '12' },
      { fieldName: 'PH LEVEL', fieldKey: 'ph_level', fieldType: 'NUMBER', section: 'CHEMICAL & QUALITY SPECS', unitOfMeasure: 'PH', isMandatory: true, minValue: 0, maxValue: 14, defaultValue: '3.5' },
      { fieldName: 'STORAGE TEMPERATURE', fieldKey: 'storage_temp', fieldType: 'NUMBER', section: 'STORAGE & SHELF LIFE', unitOfMeasure: '°C', isMandatory: true, minValue: 0, maxValue: 30, defaultValue: '4' },
      { fieldName: 'SHELF LIFE DAYS', fieldKey: 'shelf_life', fieldType: 'NUMBER', section: 'STORAGE & SHELF LIFE', unitOfMeasure: 'DAYS', isMandatory: true, minValue: 1, maxValue: 365, defaultValue: '90' },
      { fieldName: 'BOTTLE PACKAGING TYPE', fieldKey: 'bottle_type', fieldType: 'SELECT', section: 'PACKAGING & LOGISTICS', unitOfMeasure: null, isMandatory: true, options: ['GLASS BOTTLE', 'PET BOTTLE', 'TETRA PACK', 'ALUMINUM CAN'] }
    ]
  },
  PRESET_GENERAL_RETAIL: {
    name: 'GENERAL FINISHED GOODS & E-COMMERCE MASTER TEMPLATE',
    description: 'Standard retail, weight tolerances, and outer packaging master.',
    fields: [
      { fieldName: 'NET WEIGHT GRAMS', fieldKey: 'net_weight_g', fieldType: 'NUMBER', section: 'PHYSICAL CHARACTERISTICS', unitOfMeasure: 'G', isMandatory: true, minValue: 1, defaultValue: '100' },
      { fieldName: 'OUTER CARTON UNITS', fieldKey: 'carton_units', fieldType: 'NUMBER', section: 'PACKAGING & LOGISTICS', unitOfMeasure: 'PCS', isMandatory: true, minValue: 1, defaultValue: '24' },
      { fieldName: 'STORAGE CONDITION', fieldKey: 'storage_condition', fieldType: 'SELECT', section: 'STORAGE & SHELF LIFE', unitOfMeasure: null, isMandatory: true, options: ['AMBIENT (25°C)', 'COOL & DRY', 'CHILLED (0-4°C)', 'FROZEN (-18°C)'] },
      { fieldName: 'BARCODE FORMAT', fieldKey: 'barcode_format', fieldType: 'SELECT', section: 'PACKAGING & LOGISTICS', unitOfMeasure: null, isMandatory: false, options: ['EAN-13', 'UPC-A', 'CODE-128', 'QR CODE'] }
    ]
  }
};

class ProductSpecTemplateRepository {
  async getBySubcategoryId(subcategoryId) {
    return prisma.productSpecTemplate.findUnique({
      where: { subcategoryId },
      include: {
        subcategory: {
          include: {
            category: true,
            defaultUom: true
          }
        },
        fields: {
          orderBy: [
            { section: 'asc' },
            { displayOrder: 'asc' }
          ]
        }
      }
    });
  }

  async saveTemplate(subcategoryId, data) {
    const { name, description, fields = [] } = data;
    const upperName = (name || 'SPECIFICATION TEMPLATE').trim().toUpperCase();

    return prisma.$transaction(async (tx) => {
      // Check existing template
      let template = await tx.productSpecTemplate.findUnique({
        where: { subcategoryId }
      });

      if (!template) {
        template = await tx.productSpecTemplate.create({
          data: {
            subcategoryId,
            name: upperName,
            description: description || null,
            version: 1,
            isActive: true
          }
        });
      } else {
        template = await tx.productSpecTemplate.update({
          where: { id: template.id },
          data: {
            name: upperName,
            description: description !== undefined ? description : template.description,
            version: { increment: 1 },
            updatedAt: new Date()
          }
        });

        // Delete existing fields to re-insert freshly ordered
        await tx.productSpecTemplateField.deleteMany({
          where: { templateId: template.id }
        });
      }

      // Insert fields
      if (fields.length > 0) {
        await tx.productSpecTemplateField.createMany({
          data: fields.map((f, index) => ({
            templateId: template.id,
            fieldName: (f.fieldName || '').trim().toUpperCase(),
            fieldKey: f.fieldKey ? f.fieldKey.trim() : (f.fieldName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            fieldType: f.fieldType || 'TEXT',
            section: (f.section ? f.section.trim() : 'GENERAL SPECS').toUpperCase(),
            unitOfMeasure: f.unitOfMeasure ? f.unitOfMeasure.trim().toUpperCase() : null,
            isMandatory: Boolean(f.isMandatory),
            defaultValue: f.defaultValue !== undefined && f.defaultValue !== null ? (typeof f.defaultValue === 'string' ? f.defaultValue.trim().toUpperCase() : String(f.defaultValue)) : null,
            options: Array.isArray(f.options) ? f.options.map(opt => typeof opt === 'string' ? opt.trim().toUpperCase() : opt) : null,
            minValue: f.minValue !== undefined && f.minValue !== null && f.minValue !== '' ? Number(f.minValue) : null,
            maxValue: f.maxValue !== undefined && f.maxValue !== null && f.maxValue !== '' ? Number(f.maxValue) : null,
            placeholder: f.placeholder ? f.placeholder.trim().toUpperCase() : null,
            helpText: f.helpText || null,
            displayOrder: f.displayOrder !== undefined ? Number(f.displayOrder) : index + 1
          }))
        });
      }

      return tx.productSpecTemplate.findUnique({
        where: { id: template.id },
        include: {
          subcategory: { include: { category: true } },
          fields: {
            orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }]
          }
        }
      });
    });
  }

  async duplicateTemplate({ sourceSubcategoryId, targetSubcategoryId, overrideName }) {
    return prisma.$transaction(async (tx) => {
      const targetSub = await tx.productSubcategory.findUnique({
        where: { id: targetSubcategoryId }
      });

      if (!targetSub) {
        throw new Error('Target subcategory does not exist.');
      }

      let sourceFields = [];
      let sourceDescription = null;

      if (SYSTEM_PRESET_TEMPLATES[sourceSubcategoryId]) {
        const preset = SYSTEM_PRESET_TEMPLATES[sourceSubcategoryId];
        sourceFields = preset.fields;
        sourceDescription = preset.description;
      } else {
        const source = await tx.productSpecTemplate.findUnique({
          where: { subcategoryId: sourceSubcategoryId },
          include: { fields: true, subcategory: true }
        });

        if (!source) {
          throw new Error('Source subcategory does not have a specification template to clone.');
        }
        sourceFields = source.fields;
        sourceDescription = source.description;
      }

      // 2. Remove or clean existing target template if any
      const existingTarget = await tx.productSpecTemplate.findUnique({
        where: { subcategoryId: targetSubcategoryId }
      });

      let targetTemplate;
      const targetName = (overrideName || `${targetSub.name} SPECIFICATION TEMPLATE`).trim().toUpperCase();

      if (existingTarget) {
        await tx.productSpecTemplateField.deleteMany({
          where: { templateId: existingTarget.id }
        });

        targetTemplate = await tx.productSpecTemplate.update({
          where: { id: existingTarget.id },
          data: {
            name: targetName,
            description: sourceDescription,
            version: { increment: 1 }
          }
        });
      } else {
        targetTemplate = await tx.productSpecTemplate.create({
          data: {
            subcategoryId: targetSubcategoryId,
            name: targetName,
            description: sourceDescription,
            version: 1,
            isActive: true
          }
        });
      }

      // 3. Clone all fields in UPPERCASE
      if (sourceFields.length > 0) {
        await tx.productSpecTemplateField.createMany({
          data: sourceFields.map((f, idx) => ({
            templateId: targetTemplate.id,
            fieldName: (f.fieldName || '').trim().toUpperCase(),
            fieldKey: (f.fieldKey || '').trim(),
            fieldType: f.fieldType || 'TEXT',
            section: (f.section || 'GENERAL SPECS').trim().toUpperCase(),
            unitOfMeasure: f.unitOfMeasure ? f.unitOfMeasure.trim().toUpperCase() : null,
            isMandatory: Boolean(f.isMandatory),
            defaultValue: f.defaultValue !== undefined && f.defaultValue !== null ? (typeof f.defaultValue === 'string' ? f.defaultValue.trim().toUpperCase() : String(f.defaultValue)) : null,
            options: Array.isArray(f.options) ? f.options.map(opt => typeof opt === 'string' ? opt.trim().toUpperCase() : opt) : null,
            minValue: f.minValue !== undefined && f.minValue !== null ? Number(f.minValue) : null,
            maxValue: f.maxValue !== undefined && f.maxValue !== null ? Number(f.maxValue) : null,
            placeholder: f.placeholder ? f.placeholder.trim().toUpperCase() : null,
            helpText: f.helpText || null,
            displayOrder: f.displayOrder !== undefined ? Number(f.displayOrder) : idx + 1
          }))
        });
      }

      return tx.productSpecTemplate.findUnique({
        where: { id: targetTemplate.id },
        include: {
          subcategory: { include: { category: true } },
          fields: {
            orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }]
          }
        }
      });
    });
  }

  async generateExcelTemplate(subcategoryId) {
    const subcategory = await prisma.productSubcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        category: true,
        defaultUom: true,
        specTemplate: {
          include: {
            fields: {
              orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }]
            }
          }
        }
      }
    });

    if (!subcategory) {
      throw new Error('Subcategory not found');
    }

    const templateFields = subcategory.specTemplate?.fields || [];

    // Core headers
    const headers = [
      'SKU',
      'Product_Name',
      'Brand',
      'Category',
      'Subcategory',
      'Description',
      'Dimension_Length',
      'Dimension_Width',
      'Dimension_Height',
      'Dimension_Unit',
      'Weight',
      'Weight_Unit',
      'Material',
      'Color',
      'Size',
      'Model_Number',
      'UPC_EAN',
      'Country_of_Origin',
      'Warranty',
      'Key_Features',
      'UOM',
      'Sale_Price',
      'Opening_Stock',
      'Alert_Level',
      'HSN_Code'
    ];

    // Dynamic specification headers
    templateFields.forEach(f => {
      const mandatoryTag = f.isMandatory ? ' (Mandatory)' : ' (Optional)';
      const uomTag = f.unitOfMeasure ? ` [${f.unitOfMeasure}]` : '';
      headers.push(`SPEC: ${f.fieldName}${mandatoryTag}${uomTag}`);
    });

    // Sample row
    const sampleRow = {
      SKU: `${subcategory.skuPrefix || subcategory.code}-SAMPLE-0001`,
      Product_Name: `Sample ${subcategory.name}`,
      Brand: 'Heritage Brand',
      Category: subcategory.category.name,
      Subcategory: subcategory.name,
      Description: `Premium standard specification ${subcategory.name}`,
      Dimension_Length: 15.0,
      Dimension_Width: 5.5,
      Dimension_Height: 4.0,
      Dimension_Unit: 'cm',
      Weight: 0.12,
      Weight_Unit: 'kg',
      Material: 'Food Grade Dairy Mix',
      Color: 'Cream White',
      Size: 'Standard',
      Model_Number: 'MOD-001',
      UPC_EAN: '8901234567890',
      Country_of_Origin: 'India',
      Warranty: '6 Months Freezer Storage',
      Key_Features: '100% Pure Milk | No Preservatives | Rich Texture',
      UOM: subcategory.defaultUom?.abbreviation || 'pcs',
      Sale_Price: 45.0,
      Opening_Stock: 100,
      Alert_Level: 20,
      HSN_Code: subcategory.hsnCodeDefault || '21050000'
    };

    templateFields.forEach(f => {
      const mandatoryTag = f.isMandatory ? ' (Mandatory)' : ' (Optional)';
      const uomTag = f.unitOfMeasure ? ` [${f.unitOfMeasure}]` : '';
      const colKey = `SPEC: ${f.fieldName}${mandatoryTag}${uomTag}`;
      sampleRow[colKey] = f.defaultValue || (f.fieldType === 'BOOLEAN' ? 'true' : (f.fieldType === 'NUMBER' ? 10 : 'Standard'));
    });

    const data = [sampleRow];
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });

    // Set column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 15) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Upload');

    // Sheet 2: Field Rules and Specifications Guidance
    const guidanceData = [
      {
        Field_Type: 'Universal Core',
        Field_Name: 'SKU',
        Mandatory: 'No (Auto-Generated if empty)',
        Allowed_Values: 'Alphanumeric identifier, e.g. KUL-REG-0001'
      },
      {
        Field_Type: 'Universal Core',
        Field_Name: 'Product_Name',
        Mandatory: 'YES',
        Allowed_Values: 'Official title of the finished good'
      },
      {
        Field_Type: 'Universal Core',
        Field_Name: 'Brand',
        Mandatory: 'No',
        Allowed_Values: 'Brand or manufacturer label'
      },
      {
        Field_Type: 'Universal Core',
        Field_Name: 'Key_Features',
        Mandatory: 'No',
        Allowed_Values: 'Pipe-separated features: Feature 1 | Feature 2 | Feature 3'
      },
      ...templateFields.map(f => ({
        Field_Type: `Spec (${f.section})`,
        Field_Name: f.fieldName,
        Mandatory: f.isMandatory ? 'YES' : 'No',
        Allowed_Values: f.options ? f.options.join(', ') : `${f.fieldType} ${f.unitOfMeasure ? '(' + f.unitOfMeasure + ')' : ''} ${f.minValue !== null ? 'Min:' + f.minValue : ''} ${f.maxValue !== null ? 'Max:' + f.maxValue : ''}`
      }))
    ];

    const guidanceWs = XLSX.utils.json_to_sheet(guidanceData);
    guidanceWs['!cols'] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 50 }
    ];
    XLSX.utils.book_append_sheet(wb, guidanceWs, 'Guidance & Rules');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

module.exports = new ProductSpecTemplateRepository();
