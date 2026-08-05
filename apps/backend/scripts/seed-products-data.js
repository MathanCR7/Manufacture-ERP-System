const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting product database seeding (25 products total)...');

  // 1. Fetch Admin User
  let admin = await prisma.user.findFirst({
    where: { role: 'MAIN_MASTER' }
  });
  if (!admin) {
    admin = await prisma.user.findFirst({
      where: { role: 'SUPERVISOR' }
    });
  }
  if (!admin) {
    throw new Error('No admin or supervisor user found in the database. Please seed users first.');
  }
  console.log(`Using User: ${admin.email} (ID: ${admin.id}) as creator.`);

  // 2. Fetch or Seed Production Stage Masters
  let stageMasters = await prisma.productionStageMaster.findMany();
  if (stageMasters.length === 0) {
    console.log('Seeding Production Stage Masters...');
    await prisma.productionStageMaster.createMany({
      data: [
        { name: 'Mixing', description: 'Blending raw materials', isActive: true },
        { name: 'Pasteurization', description: 'Thermal processing for food safety', isActive: true },
        { name: 'Freezing', description: 'Initial solidification step', isActive: true },
        { name: 'Hardening', description: 'Deep freezing stage', isActive: true },
        { name: 'Packaging', description: 'Packing into final containers', isActive: true },
        { name: 'Quality Control', description: 'Laboratory analysis and testing', isActive: true }
      ]
    });
    stageMasters = await prisma.productionStageMaster.findMany();
  }
  const stageMap = {};
  stageMasters.forEach(s => {
    stageMap[s.name.toLowerCase()] = s.id;
  });
  console.log('Production stages mapping resolved.');

  // 3. Fetch UOMs
  const uoms = await prisma.uOM.findMany();
  const uomMap = {};
  uoms.forEach(u => {
    uomMap[u.abbreviation.toLowerCase()] = u.id;
    uomMap[u.name.toLowerCase()] = u.id;
  });
  console.log('UOMs resolved.');

  const getUomId = (key, defaultName) => {
    const k = key.toLowerCase();
    if (uomMap[k]) return uomMap[k];
    console.log(`UOM ${key} not found, using fallback or creating...`);
    return uoms[0]?.id; // default to first UOM
  };

  // 4. Fetch Raw Materials for BOM mapping
  const rms = await prisma.rawMaterial.findMany();
  console.log(`Fetched ${rms.length} raw materials from database.`);

  const findRmByName = (name) => {
    const term = name.toLowerCase();
    let found = rms.find(r => r.name.toLowerCase() === term);
    if (!found) {
      found = rms.find(r => r.name.toLowerCase().includes(term));
    }
    if (!found) {
      found = rms[0];
      console.warn(`Warning: Raw material "${name}" not found in database. Using fallback "${found?.name}"`);
    }
    return found;
  };

  // 5. Seed Product Categories
  const categories = [
    { name: 'Stick Kulfi', description: 'Traditional kulfi sticks in various Indian flavors' },
    { name: 'Matka Kulfi', description: 'Kulfi served in authentic clay pots (matkas)' },
    { name: 'Slice Kulfi', description: 'Roll kulfi sliced into rich cream discs' },
    { name: 'Sundae Cups', description: 'Layered premium ice cream sundaes served in cups' },
    { name: 'Cassata Ice Cream', description: 'Multilayered ice cream slice with cake base' },
    { name: 'Family Pack Tubs', description: '1 Litre and 2 Litre party tubs for families' },
    { name: 'Premium Cups', description: 'Indulgent single-serving premium ice cream cups' },
    { name: 'Ice Candy', description: 'Refreshing water-based flavored ice pops' }
  ];

  const categoryMap = {};
  for (const cat of categories) {
    let dbCat = await prisma.productCategory.findFirst({
      where: { name: cat.name }
    });
    if (!dbCat) {
      dbCat = await prisma.productCategory.create({
        data: {
          name: cat.name,
          description: cat.description,
          status: 'ACTIVE'
        }
      });
      console.log(`Created Product Category: ${cat.name}`);
    } else {
      console.log(`Product Category already exists: ${cat.name}`);
    }
    categoryMap[cat.name] = dbCat.id;
  }

  // 6. Define 25 Products with detailed BOM, SOP, and image URLs
  const productsToSeed = [
    // --- Initial 10 Products ---
    {
      code: 'FP-000001',
      name: 'Malai Kulfi Stick',
      category: 'Stick Kulfi',
      unit: 'Pieces',
      profitMargin: 40,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/malai_kulfi.png',
      bomItems: [
        { name: 'SMP', qty: 0.05 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.015 },
        { name: 'Cashew', qty: 0.005 },
        { name: 'Stick 65 MM', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Dissolve Skimmed Milk Powder (SMP) and white sugar in hot water at 60°C.', tempTime: '60°C / 15 mins', safetyNote: 'Wear thermal gloves when handling hot water.' },
        { stepNumber: 2, instruction: 'Add Vanaspati fat to the blend and stir vigorously to form a uniform emulsion.', tempTime: '10 mins', safetyNote: 'Ensure blender guard is in place.' },
        { stepNumber: 3, instruction: 'Pasteurize the mixture in the pasteurizer vat at 85°C to eliminate pathogens.', tempTime: '85°C / 15 secs', safetyNote: 'Monitor pasteurizer pressure gauges.' },
        { stepNumber: 4, instruction: 'Cool the pasteurized mix rapidly to 4°C and let it age in the aging vat.', tempTime: '4°C / 4 hours', safetyNote: 'Check cooling water valves.' },
        { stepNumber: 5, instruction: 'Fold in chopped Cashew nuts, pour the kulfi mix into stick molds, and insert 65mm wooden sticks.', tempTime: '20 mins', safetyNote: 'Ensure sticks are sanitized.' },
        { stepNumber: 6, instruction: 'Immerse molds in the brine tank at -20°C for rapid freezing. Packaging under sterile conditions.', tempTime: '-20°C / 30 mins', safetyNote: 'Wear insulated dry-ice gloves.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 45 },
        { name: 'hardening', hours: 4 },
        { name: 'packaging', minutes: 30 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000002',
      name: 'Kesar Pista Matka Kulfi',
      category: 'Matka Kulfi',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 80,
      expectedOutput: 100,
      imageUrl: '/images/products/kesar_pista_matka.png',
      bomItems: [
        { name: 'SMP', qty: 0.08 },
        { name: 'Sugar White', qty: 0.03 },
        { name: 'Vanaspati', qty: 0.02 },
        { name: 'Pista', qty: 0.01 },
        { name: 'Matka Pot', qty: 1 },
        { name: 'Matka Spoon', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare base mix by combining SMP, sugar, and fat with warm water. Incorporate saffron extract.', tempTime: '65°C / 20 mins', safetyNote: 'Ensure steam lines are locked.' },
        { stepNumber: 2, instruction: 'Pasteurize the saffron-infused mix at 85°C to develop cooked flavor notes.', tempTime: '85°C / 15 secs', safetyNote: 'Avoid direct contact with steam pipe jacket.' },
        { stepNumber: 3, instruction: 'Cool and transfer to the aging tank. Maintain constant slow agitation.', tempTime: '4°C / 6 hours', safetyNote: 'Keep tank lid closed.' },
        { stepNumber: 4, instruction: 'Add finely crushed Pistachios (Pista) into the aged mix and blend.', tempTime: '10 mins', safetyNote: 'Use sanitized nut-chopper.' },
        { stepNumber: 5, instruction: 'Pour the mixture manually or via semi-automatic filler into individual clay Matka Pots.', tempTime: '30 mins', safetyNote: 'Handle fragile clay pots with care.' },
        { stepNumber: 6, instruction: 'Seal the matkas with butter paper, secure with elastic band, and send to blast freezer.', tempTime: '-25°C / 8 hours', safetyNote: 'Store on sturdy freeze racks.' }
      ],
      stages: [
        { name: 'mixing', minutes: 40 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 50 },
        { name: 'hardening', hours: 8 },
        { name: 'packaging', minutes: 40 },
        { name: 'quality control', minutes: 20 }
      ]
    },
    {
      code: 'FP-000003',
      name: 'Mango Kulfi Slice',
      category: 'Slice Kulfi',
      unit: 'Pieces',
      profitMargin: 35,
      alertLevel: 120,
      expectedOutput: 100,
      imageUrl: '/images/products/mango_kulfi.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.012 },
        { name: 'Mango', qty: 0.03 },
        { name: 'Slice Poly Cover', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Mix SMP, sugar, fat, and stabilizers in the mixing tank.', tempTime: '60°C / 15 mins', safetyNote: 'Keep area clean of wet spills.' },
        { stepNumber: 2, instruction: 'Pasteurize and age the standard base kulfi mix.', tempTime: '85°C / 15 secs', safetyNote: 'Observe temperature sensors.' },
        { stepNumber: 3, instruction: 'Blend pasteurized mango pulp directly into the aged mix prior to filling.', tempTime: '15 mins', safetyNote: 'Sanitize mango pulp containers before opening.' },
        { stepNumber: 4, instruction: 'Fill into cylindrical stainless steel roll molds.', tempTime: '15 mins', safetyNote: 'Secure mold latches tightly.' },
        { stepNumber: 5, instruction: 'Hard freeze the cylinders in the brine bath or hardening tunnel.', tempTime: '-30°C / 2 hours', safetyNote: 'Beware of slip hazards near brine tanks.' },
        { stepNumber: 6, instruction: 'Extract the frozen logs, slice into uniform discs, pack in slice poly covers, and carton.', tempTime: '30 mins', safetyNote: 'Keep hands clear of automatic slicer blades.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 60 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 45 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000004',
      name: 'Strawberry Sundae Cup',
      category: 'Sundae Cups',
      unit: 'Pieces',
      profitMargin: 50,
      alertLevel: 150,
      expectedOutput: 120,
      imageUrl: '/images/products/strawberry_sundae.png',
      bomItems: [
        { name: 'SMP', qty: 0.05 },
        { name: 'Sugar White', qty: 0.018 },
        { name: 'Vanaspati', qty: 0.01 },
        { name: 'Strawberry', qty: 0.02 },
        { name: 'Sundae Cup (S)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Formulate the high-fat ice cream base mix in the tank.', tempTime: '60°C / 20 mins', safetyNote: 'Wear slip-resistant boots.' },
        { stepNumber: 2, instruction: 'Pasteurize, homogenize, and age the mix to ensure smooth texture.', tempTime: '4°C / 4 hours', safetyNote: 'Homogenizer runs at high pressure.' },
        { stepNumber: 3, instruction: 'Run the mix through the continuous freezer to obtain 50% overrun.', tempTime: '30 mins', safetyNote: 'Monitor back-pressure valves.' },
        { stepNumber: 4, instruction: 'Inject strawberry crush at the bottom of the cup, fill with vanilla ice cream, and top with strawberry fruit syrup.', tempTime: '25 mins', safetyNote: 'Sanitize filler nozzles.' },
        { stepNumber: 5, instruction: 'Apply plastic dome lid and pass through the hardening tunnel.', tempTime: '-25°C / 1 hour', safetyNote: 'Ensure conveyor belt is clear.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 25 },
        { name: 'freezing', minutes: 40 },
        { name: 'hardening', hours: 1 },
        { name: 'packaging', minutes: 30 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000005',
      name: 'Double Chocolate Cassata',
      category: 'Cassata Ice Cream',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 70,
      expectedOutput: 80,
      imageUrl: '/images/products/chocolate_cassata.png',
      bomItems: [
        { name: 'SMP', qty: 0.07 },
        { name: 'Sugar White', qty: 0.025 },
        { name: 'Vanaspati', qty: 0.015 },
        { name: 'Coco Powder', qty: 0.012 },
        { name: 'Cassata Box Corrugate', qty: 1 },
        { name: 'Cassata Poly Cover', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Bake sponge cake base sheets. Set aside to cool.', tempTime: '180°C / 15 mins', safetyNote: 'Use oven mitts.' },
        { stepNumber: 2, instruction: 'Prepare vanilla ice cream mix and rich cocoa chocolate mix in separate vats.', tempTime: '65°C / 30 mins', safetyNote: 'Ensure no cross-contamination.' },
        { stepNumber: 3, instruction: 'Pasteurize and age both mixes concurrently.', tempTime: '4°C / 5 hours', safetyNote: 'Label vats correctly.' },
        { stepNumber: 4, instruction: 'Place cake sheets in semicircular cassata molds. Extrude the chocolate layer, freeze partially, then extrude vanilla layer.', tempTime: '45 mins', safetyNote: 'Keep workspace clean.' },
        { stepNumber: 5, instruction: 'Demold the frozen semicircular logs, slice them, pack in cassata poly covers, and store in corrugate boxes.', tempTime: '-30°C / 3 hours', safetyNote: 'Cut slices using clean automatic cutter.' }
      ],
      stages: [
        { name: 'mixing', minutes: 60 },
        { name: 'pasteurization', minutes: 30 },
        { name: 'freezing', minutes: 60 },
        { name: 'hardening', hours: 3 },
        { name: 'packaging', minutes: 50 },
        { name: 'quality control', minutes: 20 }
      ]
    },
    {
      code: 'FP-000006',
      name: 'Butterscotch Chikki Tub (1 Ltr)',
      category: 'Family Pack Tubs',
      unit: 'Litre',
      profitMargin: 40,
      alertLevel: 60,
      expectedOutput: 50,
      imageUrl: '/images/products/butterscotch_tub.png',
      bomItems: [
        { name: 'SMP', qty: 0.35 },
        { name: 'Sugar White', qty: 0.12 },
        { name: 'Vanaspati', qty: 0.08 },
        { name: 'Butterscotch', qty: 0.04 },
        { name: 'Family Pack Box', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare batch mix of premium base with SMP, sugar, fat, and butterscotch flavor.', tempTime: '60°C / 20 mins', safetyNote: 'Take caution with rotating agitators.' },
        { stepNumber: 2, instruction: 'Pasteurize and transfer to holding tanks for aging.', tempTime: '4°C / 4 hours', safetyNote: 'Clean vat seals weekly.' },
        { stepNumber: 3, instruction: 'Freeze in the continuous freezer. Introduce butterscotch chikki nuts using the dry ingredient feeder.', tempTime: '40 mins', safetyNote: 'Do not clear feeder jam with bare hands.' },
        { stepNumber: 4, instruction: 'Fill into 1-Ltr plastic tubs, place butter paper sheet on top, and seal with tight-fitting lid.', tempTime: '20 mins', safetyNote: 'Verify fill weight on line scale.' },
        { stepNumber: 5, instruction: 'Store tubs in the hardening freezer for complete crystallization.', tempTime: '-30°C / 12 hours', safetyNote: 'Wear thermal safety suits.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 40 },
        { name: 'hardening', hours: 12 },
        { name: 'packaging', minutes: 30 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000007',
      name: 'Blueberry Premium Cup',
      category: 'Premium Cups',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 100,
      expectedOutput: 150,
      imageUrl: '/images/products/blueberry_cup.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.012 },
        { name: 'Blueberry', qty: 0.015 },
        { name: 'Sundae Cup (L)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Mix milk solids, sugars, and fats to form the premium cup base.', tempTime: '60°C / 15 mins', safetyNote: 'Use anti-slip floor mats.' },
        { stepNumber: 2, instruction: 'Pasteurize at standard settings. Age for viscosity development.', tempTime: '4°C / 4 hours', safetyNote: 'Ensure refrigeration compressor is active.' },
        { stepNumber: 3, instruction: 'Freeze while injecting natural blueberry ripple syrup via fruit feeder.', tempTime: '30 mins', safetyNote: 'Keep hands clean and sanitized.' },
        { stepNumber: 4, instruction: 'Dispense into premium cups, drop in mini plastic spoons, and lid.', tempTime: '20 mins', safetyNote: 'Ensure spoon dispenser is clean.' },
        { stepNumber: 5, instruction: 'Harden and package in cartons of 12 cups.', tempTime: '-25°C / 2 hours', safetyNote: 'Lift boxes using correct posture.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 25 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000008',
      name: 'Jeera Masala Soda Ice Pops',
      category: 'Ice Candy',
      unit: 'Pieces',
      profitMargin: 60,
      alertLevel: 200,
      expectedOutput: 300,
      imageUrl: '/images/products/jeera_ice_pop.png',
      bomItems: [
        { name: 'Sugar White', qty: 0.035 },
        { name: 'Jeera', qty: 0.002 },
        { name: 'Stick 65 MM', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Dissolve sugar in hot purified water. Stir in citric acid and jeera spice blend.', tempTime: '70°C / 20 mins', safetyNote: 'Avoid inhaling spice dust.' },
        { stepNumber: 2, instruction: 'Cool syrup to room temperature. Run laboratory check on Brix (sugar content).', tempTime: '25°C / 30 mins', safetyNote: 'Sanitize refactometer before test.' },
        { stepNumber: 3, instruction: 'Fill syrup into pop mold pockets. Insert 65mm sticks automatically.', tempTime: '15 mins', safetyNote: 'Watch hands near stick insertion arm.' },
        { stepNumber: 4, instruction: 'Freeze in calcium chloride brine tank.', tempTime: '-22°C / 20 mins', safetyNote: 'Avoid contact with brine solution.' },
        { stepNumber: 5, instruction: 'Warm molds slightly in warm water, extract pops, bag in poly film, and place in cold storage.', tempTime: '15 mins', safetyNote: 'Inspect pops for stick alignment.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 15 },
        { name: 'freezing', minutes: 25 },
        { name: 'hardening', hours: 0.5 },
        { name: 'packaging', minutes: 20 },
        { name: 'quality control', minutes: 10 }
      ]
    },
    {
      code: 'FP-000009',
      name: 'Gulkand Pista Delight Stick',
      category: 'Stick Kulfi',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/gulkand_delight.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.015 },
        { name: 'Gulkand', qty: 0.01 },
        { name: 'Pista', qty: 0.005 },
        { name: 'Stick 114 MM', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Blend SMP, sugar, fat, and water. Heat to pasteurize.', tempTime: '80°C / 15 mins', safetyNote: 'Verify tank pressure.' },
        { stepNumber: 2, instruction: 'Cool and age mix. Add pure rose gulkand paste and chopped pistas during aging.', tempTime: '4°C / 5 hours', safetyNote: 'Wash hands thoroughly after handling nuts.' },
        { stepNumber: 3, instruction: 'Fill into long kulfi molds. Manually insert 114mm wooden stick.', tempTime: '20 mins', safetyNote: 'Wear sanitizing gloves.' },
        { stepNumber: 4, instruction: 'Freeze in brine tank. Demold, flow-wrap in decorative bags, and place in cartons.', tempTime: '-20°C / 35 mins', safetyNote: 'Use insulated gloves.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 40 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 35 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000010',
      name: 'Caramel Fudge Tub (1 Ltr)',
      category: 'Family Pack Tubs',
      unit: 'Litre',
      profitMargin: 40,
      alertLevel: 50,
      expectedOutput: 50,
      imageUrl: '/images/products/caramel_fudge.png',
      bomItems: [
        { name: 'SMP', qty: 0.35 },
        { name: 'Sugar White', qty: 0.12 },
        { name: 'Vanaspati', qty: 0.08 },
        { name: 'Caramel Sauce', qty: 0.05 },
        { name: 'Family Pack Box', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Blend base mix in mixing tank. Pasteurize at standard high temperature.', tempTime: '65°C / 20 mins', safetyNote: 'Secure steam valves.' },
        { stepNumber: 2, instruction: 'Age mix in aging tank at 4°C.', tempTime: '4°C / 4 hours', safetyNote: 'Monitor thermostat alarms.' },
        { stepNumber: 3, instruction: 'Freeze in continuous freezer. Inject heavy caramel ripple fudge via ripple pump.', tempTime: '30 mins', safetyNote: 'Adjust ripple pump speed to control fudge swirl.' },
        { stepNumber: 4, instruction: 'Fill in 1L tubs, drop lid, wrap, and transfer to blast room.', tempTime: '20 mins', safetyNote: 'Stack tubs neatly on pallets.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 10 },
        { name: 'packaging', minutes: 25 },
        { name: 'quality control', minutes: 15 }
      ]
    },

    // --- New 15 Products (Total 25) ---
    {
      code: 'FP-000011',
      name: 'Mango Tub (1 Ltr)',
      category: 'Family Pack Tubs',
      unit: 'Litre',
      profitMargin: 40,
      alertLevel: 50,
      expectedOutput: 50,
      imageUrl: '/images/products/mango_tub.png',
      bomItems: [
        { name: 'SMP', qty: 0.35 },
        { name: 'Sugar White', qty: 0.12 },
        { name: 'Vanaspati', qty: 0.08 },
        { name: 'Mango', qty: 0.08 },
        { name: 'Family Pack Box', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Blend standard milk solids and sugars. Heat and agitate.', tempTime: '60°C / 20 mins', safetyNote: 'Stir evenly to prevent burning.' },
        { stepNumber: 2, instruction: 'Pasteurize and rapidly cool, then age at aging temperature.', tempTime: '4°C / 4 hours', safetyNote: 'Verify cooling system pressure.' },
        { stepNumber: 3, instruction: 'Stir in mango pulp and run through continuous freezer.', tempTime: '30 mins', safetyNote: 'Ensure the pump speeds are matched.' },
        { stepNumber: 4, instruction: 'Fill in family tubs, cover with seal, and blast freeze.', tempTime: '-30°C / 10 hours', safetyNote: 'Wear low-temperature safety wear.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 10 },
        { name: 'packaging', minutes: 25 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000012',
      name: 'Kesar Pista Stick',
      category: 'Stick Kulfi',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/kesar_pista_stick.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.015 },
        { name: 'Pista', qty: 0.005 },
        { name: 'Kesar Pista Sauce', qty: 0.005 },
        { name: 'Stick 65 MM', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare base mix with SMP, sugar, and fat. Mix saffron sauce.', tempTime: '65°C / 15 mins', safetyNote: 'Wear thermal protection.' },
        { stepNumber: 2, instruction: 'Pasteurize and hold in the aging tank.', tempTime: '4°C / 4 hours', safetyNote: 'Vat lid should be locked.' },
        { stepNumber: 3, instruction: 'Add chopped pistachios, pour into stick molds, and insert sticks.', tempTime: '20 mins', safetyNote: 'Sanitize sticks before use.' },
        { stepNumber: 4, instruction: 'Blast freeze in brine tank and package.', tempTime: '-20°C / 30 mins', safetyNote: 'Use protective heavy gloves.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 40 },
        { name: 'hardening', hours: 3 },
        { name: 'packaging', minutes: 30 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000013',
      name: 'Strawberry Cup (S)',
      category: 'Premium Cups',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 150,
      expectedOutput: 150,
      imageUrl: '/images/products/strawberry_cup.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.012 },
        { name: 'Strawberry', qty: 0.015 },
        { name: 'Sundae Cup (S)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Combine ingredients in mixing vat and blend thoroughly.', tempTime: '60°C / 15 mins', safetyNote: 'Keep area clear of water.' },
        { stepNumber: 2, instruction: 'Pasteurize, age, and pump through freezer with strawberry ripple.', tempTime: '4°C / 4 hours', safetyNote: 'Observe freezer back pressure.' },
        { stepNumber: 3, instruction: 'Dispense into cups, seal with plastic lids, and transfer to hardening tunnel.', tempTime: '-25°C / 1.5 hours', safetyNote: 'Verify filling weights.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 1.5 },
        { name: 'packaging', minutes: 25 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000014',
      name: 'Almond Fudge Stick',
      category: 'Stick Kulfi',
      unit: 'Pieces',
      profitMargin: 40,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/almond_fudge_stick.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.015 },
        { name: 'Cashew', qty: 0.008 },
        { name: 'Stick 65 MM', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Blend milk powder, sugars, and fats to form base.', tempTime: '60°C / 20 mins', safetyNote: 'Agitate continuously.' },
        { stepNumber: 2, instruction: 'Pasteurize and age the kulfi base mix.', tempTime: '85°C / 15 secs', safetyNote: 'Monitor pasteurization levels.' },
        { stepNumber: 3, instruction: 'Incorporate chopped almonds (using cashew fallback in database) and pour into molds.', tempTime: '20 mins', safetyNote: 'Use sanitized sticks.' },
        { stepNumber: 4, instruction: 'Freeze in brine tank at -20°C and pack.', tempTime: '-20°C / 30 mins', safetyNote: 'Wear thermal safety gear.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 40 },
        { name: 'hardening', hours: 3 },
        { name: 'packaging', minutes: 30 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000015',
      name: 'Rajbhog Premium Cup',
      category: 'Premium Cups',
      unit: 'Pieces',
      profitMargin: 50,
      alertLevel: 100,
      expectedOutput: 120,
      imageUrl: '/images/products/rajbhog_cup.png',
      bomItems: [
        { name: 'SMP', qty: 0.08 },
        { name: 'Sugar White', qty: 0.03 },
        { name: 'Vanaspati', qty: 0.02 },
        { name: 'Rajbhog', qty: 0.01 },
        { name: 'Cashew', qty: 0.005 },
        { name: 'Pista', qty: 0.005 },
        { name: 'Sundae Cup (L)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Blend SMP, sugar, and fat with rajbhog flavor base.', tempTime: '65°C / 20 mins', safetyNote: 'Steam lines must be locked.' },
        { stepNumber: 2, instruction: 'Pasteurize, cool, and age the rich mix.', tempTime: '4°C / 6 hours', safetyNote: 'Monitor aging tank thermostat.' },
        { stepNumber: 3, instruction: 'Add chopped dry fruits (cashew & pista) and fill into large cups.', tempTime: '25 mins', safetyNote: 'Wear clean gloves.' },
        { stepNumber: 4, instruction: 'Convey to hardening room for freezing.', tempTime: '-25°C / 2 hours', safetyNote: 'Ensure conveyor belt is clear.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 40 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 30 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000016',
      name: 'Blueberry Slice Kulfi',
      category: 'Slice Kulfi',
      unit: 'Pieces',
      profitMargin: 40,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/blueberry_slice.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.012 },
        { name: 'Blueberry', qty: 0.02 },
        { name: 'Slice Poly Cover', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare base mix in mixing tank. Pasteurize and cool.', tempTime: '60°C / 15 mins', safetyNote: 'Observe temperature sensors.' },
        { stepNumber: 2, instruction: 'Age the mix, add blueberry pulp, and fill into cylinder rolls.', tempTime: '4°C / 4 hours', safetyNote: 'Prevent product spills.' },
        { stepNumber: 3, instruction: 'Deep freeze cylindrical molds, slice into discs, wrap in poly covers, and store.', tempTime: '-30°C / 2 hours', safetyNote: 'Keep hands clear of automatic cutter.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 50 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 40 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000017',
      name: 'Pineapple Ice Candy Pop',
      category: 'Ice Candy',
      unit: 'Pieces',
      profitMargin: 60,
      alertLevel: 200,
      expectedOutput: 300,
      imageUrl: '/images/products/pineapple_pop.png',
      bomItems: [
        { name: 'Sugar White', qty: 0.035 },
        { name: 'Pineapple', qty: 0.015 },
        { name: 'Stick 65 MM', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Dissolve sugar in hot water, add pineapple concentrate and mix.', tempTime: '70°C / 20 mins', safetyNote: 'Avoid inhaling hot vapors.' },
        { stepNumber: 2, instruction: 'Fill in pop molds and insert 65mm wooden sticks.', tempTime: '15 mins', safetyNote: 'Use sanitized stick feed.' },
        { stepNumber: 3, instruction: 'Freeze in brine tank. Extract pops, package in flow packs, and store.', tempTime: '-22°C / 20 mins', safetyNote: 'Wear protective thermal gloves.' }
      ],
      stages: [
        { name: 'mixing', minutes: 25 },
        { name: 'pasteurization', minutes: 15 },
        { name: 'freezing', minutes: 25 },
        { name: 'hardening', hours: 0.5 },
        { name: 'packaging', minutes: 20 },
        { name: 'quality control', minutes: 10 }
      ]
    },
    {
      code: 'FP-000018',
      name: 'Orange Ice Candy Pop',
      category: 'Ice Candy',
      unit: 'Pieces',
      profitMargin: 60,
      alertLevel: 200,
      expectedOutput: 300,
      imageUrl: '/images/products/orange_pop.png',
      bomItems: [
        { name: 'Sugar White', qty: 0.035 },
        { name: 'Orange', qty: 0.015 },
        { name: 'Stick 65 MM', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Dissolve sugar, add orange flavor base, and blend.', tempTime: '70°C / 20 mins', safetyNote: 'Avoid inhaling hot vapors.' },
        { stepNumber: 2, instruction: 'Fill into pop molds and insert sticks.', tempTime: '15 mins', safetyNote: 'Keep hands clear of automation arms.' },
        { stepNumber: 3, instruction: 'Freeze in brine solution, extract, wrap in film, and store.', tempTime: '-22°C / 20 mins', safetyNote: 'Brine contact is hazardous; wear gloves.' }
      ],
      stages: [
        { name: 'mixing', minutes: 25 },
        { name: 'pasteurization', minutes: 15 },
        { name: 'freezing', minutes: 25 },
        { name: 'hardening', hours: 0.5 },
        { name: 'packaging', minutes: 20 },
        { name: 'quality control', minutes: 10 }
      ]
    },
    {
      code: 'FP-000019',
      name: 'Butterscotch Sundae Cup',
      category: 'Sundae Cups',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/butterscotch_sundae.png',
      bomItems: [
        { name: 'SMP', qty: 0.05 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.01 },
        { name: 'Butterscotch', qty: 0.02 },
        { name: 'Sundae Cup (L)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare butterscotch flavored ice cream mix and age.', tempTime: '4°C / 4 hours', safetyNote: 'Keep tank lid closed.' },
        { stepNumber: 2, instruction: 'Freeze in continuous freezer, layering sundae cup with butterscotch nuts.', tempTime: '30 mins', safetyNote: 'Ensure the nut feeder does not jam.' },
        { stepNumber: 3, instruction: 'Apply lid, package, and harden.', tempTime: '-25°C / 1.5 hours', safetyNote: 'Watch conveyor belts.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 1.5 },
        { name: 'packaging', minutes: 25 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000020',
      name: 'Litchi Jelly Cup',
      category: 'Premium Cups',
      unit: 'Pieces',
      profitMargin: 50,
      alertLevel: 100,
      expectedOutput: 120,
      imageUrl: '/images/products/litchi_jelly_cup.png',
      bomItems: [
        { name: 'Sugar White', qty: 0.025 },
        { name: 'Litchi', qty: 0.015 },
        { name: 'Sundae Cup (S)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Dissolve sugar in hot water, add litchi syrup and gelling agent.', tempTime: '80°C / 20 mins', safetyNote: 'Use thermal gloves.' },
        { stepNumber: 2, instruction: 'Dispense into small cups, seal, and cool to solidify.', tempTime: '20 mins', safetyNote: 'Verify seal integrity.' },
        { stepNumber: 3, instruction: 'Harden and store in cold room.', tempTime: '4°C / 2 hours', safetyNote: 'Keep stacking height limited.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 10 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 20 },
        { name: 'quality control', minutes: 10 }
      ]
    },
    {
      code: 'FP-000021',
      name: 'Gems Chocolate Sundae Cup',
      category: 'Sundae Cups',
      unit: 'Pieces',
      profitMargin: 50,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/gems_sundae.png',
      bomItems: [
        { name: 'SMP', qty: 0.05 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.01 },
        { name: 'Coco Powder', qty: 0.008 },
        { name: 'Gems', qty: 0.015 },
        { name: 'Sundae Cup (L)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare chocolate mix by adding cocoa powder, SMP, sugar, and fat.', tempTime: '65°C / 20 mins', safetyNote: 'Stir to dissolve cocoa solids completely.' },
        { stepNumber: 2, instruction: 'Pasteurize and age at 4°C.', tempTime: '4°C / 4 hours', safetyNote: 'Verify agitator function.' },
        { stepNumber: 3, instruction: 'Freeze, dispense into cups, and garnish heavily with colorful Gems.', tempTime: '30 mins', safetyNote: 'Gems dispenser must be clean.' },
        { stepNumber: 4, instruction: 'Harden and pack in cartons.', tempTime: '-25°C / 2 hours', safetyNote: 'Keep carton conveyor clear.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 30 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000022',
      name: 'Gulkand Matka Kulfi',
      category: 'Matka Kulfi',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 80,
      expectedOutput: 100,
      imageUrl: '/images/products/gulkand_matka.png',
      bomItems: [
        { name: 'SMP', qty: 0.08 },
        { name: 'Sugar White', qty: 0.03 },
        { name: 'Vanaspati', qty: 0.02 },
        { name: 'Gulkand', qty: 0.02 },
        { name: 'Matka Pot', qty: 1 },
        { name: 'Matka Spoon', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare base mix. Add rose gulkand extract during blending.', tempTime: '65°C / 20 mins', safetyNote: 'Observe steam pressure.' },
        { stepNumber: 2, instruction: 'Pasteurize, cool, and age at 4°C.', tempTime: '4°C / 5 hours', safetyNote: 'Agitation should be slow.' },
        { stepNumber: 3, instruction: 'Pour manually into terracotta matkas, cover, and freeze.', tempTime: '-25°C / 8 hours', safetyNote: 'Handle clay pots gently.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 40 },
        { name: 'hardening', hours: 8 },
        { name: 'packaging', minutes: 35 },
        { name: 'quality control', minutes: 20 }
      ]
    },
    {
      code: 'FP-000023',
      name: 'Caramel Slice Kulfi',
      category: 'Slice Kulfi',
      unit: 'Pieces',
      profitMargin: 40,
      alertLevel: 100,
      expectedOutput: 100,
      imageUrl: '/images/products/caramel_slice.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.012 },
        { name: 'Caramel Sauce', qty: 0.015 },
        { name: 'Slice Poly Cover', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Blend SMP, sugar, fat, and caramel sauce base.', tempTime: '60°C / 15 mins', safetyNote: 'Observe blender speed.' },
        { stepNumber: 2, instruction: 'Pasteurize, cool, age, and fill into cylinder rolls.', tempTime: '4°C / 4 hours', safetyNote: 'Avoid product leaks.' },
        { stepNumber: 3, instruction: 'Freeze roll cylinders, extract, slice, wrap in poly covers, and store.', tempTime: '-30°C / 2 hours', safetyNote: 'Beware of sharp slicer blades.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 50 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 40 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000024',
      name: 'Black Currant Tub (1 Ltr)',
      category: 'Family Pack Tubs',
      unit: 'Litre',
      profitMargin: 40,
      alertLevel: 50,
      expectedOutput: 50,
      imageUrl: '/images/products/black_currant_tub.png',
      bomItems: [
        { name: 'SMP', qty: 0.35 },
        { name: 'Sugar White', qty: 0.12 },
        { name: 'Vanaspati', qty: 0.08 },
        { name: 'Black Currant', qty: 0.05 },
        { name: 'Family Pack Box', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Blend solids, sugars, fats, and water. Heat to dissolve.', tempTime: '60°C / 20 mins', safetyNote: 'Stir evenly.' },
        { stepNumber: 2, instruction: 'Pasteurize and age the kulfi base mix.', tempTime: '4°C / 4 hours', safetyNote: 'Check refrigeration system.' },
        { stepNumber: 3, instruction: 'Inject black currant syrup during freezing and fill into 1L tubs.', tempTime: '30 mins', safetyNote: 'Ensure the ripple pump is calibrated.' },
        { stepNumber: 4, instruction: 'Blast freeze tubs for complete hardening.', tempTime: '-30°C / 10 hours', safetyNote: 'Wear low-temperature safety suits.' }
      ],
      stages: [
        { name: 'mixing', minutes: 35 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 10 },
        { name: 'packaging', minutes: 25 },
        { name: 'quality control', minutes: 15 }
      ]
    },
    {
      code: 'FP-000025',
      name: 'Tutti Frutti Premium Cup',
      category: 'Premium Cups',
      unit: 'Pieces',
      profitMargin: 45,
      alertLevel: 100,
      expectedOutput: 120,
      imageUrl: '/images/products/tutti_frutti_cup.png',
      bomItems: [
        { name: 'SMP', qty: 0.06 },
        { name: 'Sugar White', qty: 0.02 },
        { name: 'Vanaspati', qty: 0.012 },
        { name: 'Tutti Frutti Green', qty: 0.005 },
        { name: 'Tutti Frutti Yellow', qty: 0.005 },
        { name: 'Tutti Frutti Orange', qty: 0.005 },
        { name: 'Sundae Cup (S)', qty: 1 }
      ],
      sopSteps: [
        { stepNumber: 1, instruction: 'Prepare base mix. Pasteurize, cool, and age.', tempTime: '4°C / 4 hours', safetyNote: 'Ensure clean vats.' },
        { stepNumber: 2, instruction: 'Inject mixed colored tutti frutti bits through ingredient feeder into cup filler.', tempTime: '30 mins', safetyNote: 'Feeder must run smoothly.' },
        { stepNumber: 3, instruction: 'Dispense in cups, seal, and harden in freezer room.', tempTime: '-25°C / 2 hours', safetyNote: 'Ensure correct stacking.' }
      ],
      stages: [
        { name: 'mixing', minutes: 30 },
        { name: 'pasteurization', minutes: 20 },
        { name: 'freezing', minutes: 35 },
        { name: 'hardening', hours: 2 },
        { name: 'packaging', minutes: 25 },
        { name: 'quality control', minutes: 15 }
      ]
    }
  ];

  // 7. Seed Products with Transaction
  for (const prod of productsToSeed) {
    console.log(`\nProcessing product: ${prod.name} (${prod.code})...`);

    // Resolve category and UOM IDs
    const categoryId = categoryMap[prod.category];
    const unitId = getUomId(prod.unit, 'pcs');

    if (!categoryId) {
      console.error(`Category ID not resolved for category: ${prod.category}. Skipping.`);
      continue;
    }

    // Resolve BOM item raw material IDs and calculate raw material cost
    const bomData = [];
    let totalRawMaterialCost = 0;

    for (const item of prod.bomItems) {
      const dbRm = findRmByName(item.name);
      if (!dbRm) {
        console.error(`Could not resolve Raw Material for item: ${item.name}. Skipping this item.`);
        continue;
      }
      const unitPrice = Number(dbRm.ratePerUnit || 0);
      const totalCost = item.qty * unitPrice;
      totalRawMaterialCost += totalCost;

      bomData.push({
        rmId: dbRm.id,
        consumption: item.qty,
        unitPrice: unitPrice,
        totalCost: totalCost
      });
    }

    const salePrice = totalRawMaterialCost * (1 + prod.profitMargin / 100);

    // Build Product Stages data
    const stagesData = prod.stages.map((s, idx) => {
      const stageMasterId = stageMap[s.name.toLowerCase()];
      if (!stageMasterId) {
        console.warn(`Warning: Stage master "${s.name}" not found in database.`);
        return null;
      }
      return {
        stageId: stageMasterId,
        months: 0,
        days: s.hours ? Math.floor(s.hours / 24) : 0,
        hours: s.hours ? (s.hours % 24) : 0,
        minutes: s.minutes || 0,
        sortOrder: idx
      };
    }).filter(Boolean);

    await prisma.$transaction(async (tx) => {
      // Cleanup previous product with same code if exists to prevent unique violations on rerun
      const existingProd = await tx.finishedProduct.findUnique({
        where: { code: prod.code },
        include: { bom: true, stages: true, stockLevels: true }
      });

      if (existingProd) {
        console.log(`Product with code ${prod.code} already exists. Deleting it to re-seed clean...`);
        // Delete dependent tables first due to foreign keys
        await tx.productBOM.deleteMany({ where: { productId: existingProd.id } });
        await tx.productStage.deleteMany({ where: { productId: existingProd.id } });
        await tx.productStockLevel.deleteMany({ where: { productId: existingProd.id } });
        await tx.finishedProduct.delete({ where: { id: existingProd.id } });
      }

      // Create new Finished Product
      const newProduct = await tx.finishedProduct.create({
        data: {
          code: prod.code,
          name: prod.name,
          categoryId: categoryId,
          unitId: unitId,
          stockMethod: 'FIFO',
          totalRawMaterialCost: totalRawMaterialCost,
          totalNonInventoryCost: 0,
          totalCost: totalRawMaterialCost,
          profitMargin: prod.profitMargin,
          cgst: 18.00,
          sgst: 9.00,
          igst: 9.00,
          salePrice: salePrice,
          openingStock: 0,
          currentStock: 0,
          alertLevel: prod.alertLevel,
          expectedOutput: prod.expectedOutput,
          sopSteps: prod.sopSteps,
          isSopLocked: true,
          imageUrl: prod.imageUrl,
          createdBy: admin.id
        }
      });

      console.log(`Created Finished Product: ${newProduct.name} with ID: ${newProduct.id}`);

      // Insert BOM
      if (bomData.length > 0) {
        await tx.productBOM.createMany({
          data: bomData.map(b => ({
            productId: newProduct.id,
            rmId: b.rmId,
            consumptionPerUnit: b.consumption,
            unitPrice: b.unitPrice,
            totalCost: b.totalCost
          }))
        });
        console.log(`Inserted ${bomData.length} BOM records.`);
      }

      // Insert Stages
      if (stagesData.length > 0) {
        await tx.productStage.createMany({
          data: stagesData.map(s => ({
            productId: newProduct.id,
            stageId: s.stageId,
            months: s.months,
            days: s.days,
            hours: s.hours,
            minutes: s.minutes,
            sortOrder: s.sortOrder
          }))
        });
        console.log(`Inserted ${stagesData.length} Product Stage records.`);
      }

      // Insert Stock Levels
      await tx.productStockLevel.create({
        data: {
          productId: newProduct.id,
          minLevel: prod.alertLevel * 0.5,
          maxLevel: prod.alertLevel * 5,
          reorderPoint: prod.alertLevel,
          updatedBy: admin.id
        }
      });
      console.log(`Inserted Stock Levels: min: ${prod.alertLevel * 0.5}, max: ${prod.alertLevel * 5}, reorder: ${prod.alertLevel}`);
    });
  }

  console.log('\nDatabase seeding completed successfully for all 25 products!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
