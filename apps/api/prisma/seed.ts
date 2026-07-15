import { PrismaClient, Role, RunStatus, TriggerType, StepStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean up existing data to avoid conflicts
  await prisma.stepRun.deleteMany({});
  await prisma.workflowRun.deleteMany({});
  await prisma.workflowVersion.deleteMany({});
  await prisma.workflowDefinition.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log('🗑️ Existing data cleared.');

  // 2. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Sevima Corp',
      slug: 'sevima',
    },
  });
  console.log(`🏢 Created Tenant: ${tenant.name} (${tenant.slug})`);

  // 3. Create Users with hashed passwords
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@sevima.com',
      passwordHash,
      role: Role.admin,
    },
  });

  const editor = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'editor@sevima.com',
      passwordHash,
      role: Role.editor,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'viewer@sevima.com',
      passwordHash,
      role: Role.viewer,
    },
  });

  console.log('👥 Created Users:');
  console.log(`   - Admin: ${admin.email} (Role: ${admin.role})`);
  console.log(`   - Editor: ${editor.email} (Role: ${editor.role})`);
  console.log(`   - Viewer: ${viewer.email} (Role: ${viewer.role})`);
  console.log(`   - Password for all: password123`);

  // 4. Create a Workflow Definition (Order Processing Flow)
  const workflow1 = await prisma.workflowDefinition.create({
    data: {
      tenantId: tenant.id,
      name: 'Order Processing Flow',
      description: 'Handles incoming customer orders, checks inventory, charges payments, and triggers shipping.',
      webhookToken: 'sevima-webhook-token-order',
      isActive: true,
      createdBy: admin.id,
    },
  });

  const version1 = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow1.id,
      versionNumber: 1,
      createdBy: admin.id,
      definitionJson: {
        steps: [
          { key: 'fetch_order', type: 'http', config: { url: 'https://api.sevima.com/orders/new' } },
          { key: 'check_inventory', type: 'db', config: { query: 'SELECT stock FROM products WHERE id = :productId' } },
          { key: 'charge_payment', type: 'payment', config: { gateway: 'stripe' } },
          { key: 'ship_order', type: 'shipping', config: { carrier: 'fedex' } },
        ],
      },
    },
  });

  await prisma.workflowDefinition.update({
    where: { id: workflow1.id },
    data: { currentVersionId: version1.id },
  });

  console.log(`⚡ Created Workflow: ${workflow1.name}`);

  // 5. Create runs for Workflow 1
  const run1 = await prisma.workflowRun.create({
    data: {
      tenantId: tenant.id,
      workflowId: workflow1.id,
      versionId: version1.id,
      triggerType: TriggerType.webhook,
      status: RunStatus.completed,
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
      completedAt: new Date(Date.now() - 3550000),
    },
  });

  await prisma.stepRun.createMany({
    data: [
      { runId: run1.id, stepKey: 'fetch_order', status: StepStatus.success, startedAt: new Date(Date.now() - 3600000), completedAt: new Date(Date.now() - 3590000) },
      { runId: run1.id, stepKey: 'check_inventory', status: StepStatus.success, startedAt: new Date(Date.now() - 3590000), completedAt: new Date(Date.now() - 3580000) },
      { runId: run1.id, stepKey: 'charge_payment', status: StepStatus.success, startedAt: new Date(Date.now() - 3580000), completedAt: new Date(Date.now() - 3570000) },
      { runId: run1.id, stepKey: 'ship_order', status: StepStatus.success, startedAt: new Date(Date.now() - 3570000), completedAt: new Date(Date.now() - 3550000) },
    ],
  });

  // A failed run
  const run2 = await prisma.workflowRun.create({
    data: {
      tenantId: tenant.id,
      workflowId: workflow1.id,
      versionId: version1.id,
      triggerType: TriggerType.webhook,
      status: RunStatus.failed,
      startedAt: new Date(Date.now() - 1800000), // 30 mins ago
      completedAt: new Date(Date.now() - 1750000),
    },
  });

  await prisma.stepRun.createMany({
    data: [
      { runId: run2.id, stepKey: 'fetch_order', status: StepStatus.success, startedAt: new Date(Date.now() - 1800000), completedAt: new Date(Date.now() - 1790000) },
      { runId: run2.id, stepKey: 'check_inventory', status: StepStatus.success, startedAt: new Date(Date.now() - 1790000), completedAt: new Date(Date.now() - 1780000) },
      { runId: run2.id, stepKey: 'charge_payment', status: StepStatus.failed, startedAt: new Date(Date.now() - 1780000), completedAt: new Date(Date.now() - 1750000) },
      { runId: run2.id, stepKey: 'ship_order', status: StepStatus.skipped },
    ],
  });

  console.log(`🏃 Created 2 runs for ${workflow1.name} (1 Success, 1 Failed)`);

  // 6. Create Workflow Definition (Inventory Sync Check)
  const workflow2 = await prisma.workflowDefinition.create({
    data: {
      tenantId: tenant.id,
      name: 'Inventory Sync Check',
      description: 'Periodically synchronizes inventory counts between Shopify and our main Warehouse ERP.',
      cronExpression: '*/5 * * * *',
      isActive: true,
      createdBy: editor.id,
    },
  });

  const version2 = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow2.id,
      versionNumber: 1,
      createdBy: editor.id,
      definitionJson: {
        steps: [
          { key: 'fetch_shopify_stock', type: 'http', config: { url: 'https://shopify.com/api/inventory' } },
          { key: 'fetch_erp_stock', type: 'db', config: { query: 'SELECT qty FROM erp_inventory' } },
          { key: 'reconcile_differences', type: 'script', config: { script: 'reconcile.js' } },
        ],
      },
    },
  });

  await prisma.workflowDefinition.update({
    where: { id: workflow2.id },
    data: { currentVersionId: version2.id },
  });

  console.log(`⚡ Created Workflow: ${workflow2.name}`);

  // Create run for Workflow 2
  const run3 = await prisma.workflowRun.create({
    data: {
      tenantId: tenant.id,
      workflowId: workflow2.id,
      versionId: version2.id,
      triggerType: TriggerType.cron,
      status: RunStatus.completed,
      startedAt: new Date(Date.now() - 600000), // 10 mins ago
      completedAt: new Date(Date.now() - 580000),
    },
  });

  await prisma.stepRun.createMany({
    data: [
      { runId: run3.id, stepKey: 'fetch_shopify_stock', status: StepStatus.success, startedAt: new Date(Date.now() - 600000), completedAt: new Date(Date.now() - 590000) },
      { runId: run3.id, stepKey: 'fetch_erp_stock', status: StepStatus.success, startedAt: new Date(Date.now() - 590000), completedAt: new Date(Date.now() - 585000) },
      { runId: run3.id, stepKey: 'reconcile_differences', status: StepStatus.success, startedAt: new Date(Date.now() - 585000), completedAt: new Date(Date.now() - 580000) },
    ],
  });

  console.log(`🏃 Created 1 run for ${workflow2.name} (Success)`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
