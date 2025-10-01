/**
 * Seed Default Plans
 * Tạo các gói subscription mặc định
 */

// Use the existing prisma instance from config
const prisma = require('../config/database');

const defaultPlans = [
  {
    id: 'plan_free',
    type: 'FREE',
    name: 'Free Plan',
    price: 0,
    maxGroups: 1,
    maxMembersPerGroup: 3,
    maxChannelsPerGroup: 2,
    monthlyCreditsGranted: 100,
    stripePriceId: null
  },
  {
    id: 'plan_plus',
    type: 'PLUS',
    name: 'Plus Plan',
    price: 29.99,
    maxGroups: 5,
    maxMembersPerGroup: 10,
    maxChannelsPerGroup: 10,
    monthlyCreditsGranted: 1000,
    stripePriceId: 'price_plus_monthly'
  },
  {
    id: 'plan_enterprise',
    type: 'ENTERPRISE',
    name: 'Enterprise Plan',
    price: 99.99,
    maxGroups: 50,
    maxMembersPerGroup: 100,
    maxChannelsPerGroup: 50,
    monthlyCreditsGranted: 10000,
    stripePriceId: 'price_enterprise_monthly'
  }
];

async function seedPlans() {
  console.log('🌱 Seeding default plans...');
  
  try {
    // Check if prisma client has plans model
    if (!prisma.plans) {
      console.error('❌ Prisma client does not have plans model');
      return;
    }
    
    for (const planData of defaultPlans) {
      const existingPlan = await prisma.plans.findUnique({
        where: { id: planData.id }
      });
      
      if (!existingPlan) {
        await prisma.plans.create({
          data: planData
        });
        console.log(`✅ Created plan: ${planData.name}`);
      } else {
        console.log(`⚠️  Plan already exists: ${planData.name}`);
      }
    }
    
    console.log('🎉 Plans seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    console.error('Available models:', Object.keys(prisma));
  }
}

// Run if called directly
if (require.main === module) {
  seedPlans();
}

module.exports = { seedPlans, defaultPlans };