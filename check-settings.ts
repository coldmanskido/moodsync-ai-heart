import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSettings() {
    const settings = await prisma.storeSettings.findMany();
    console.log('--- Store Settings Data ---');
    console.log(JSON.stringify(settings, null, 2));
    await prisma.$disconnect();
}

checkSettings();
