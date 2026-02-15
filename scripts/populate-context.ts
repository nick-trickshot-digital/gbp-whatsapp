import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { clients } from '../src/db/schema.js';

async function populateContext() {
  await db
    .update(clients)
    .set({
      websiteUrl: 'https://justclickgo.com',
      websiteSummary:
        'JustClickGo is a web design and digital marketing agency specializing in local SEO, Google Business Profile optimization, and website development for small businesses across Ireland.',
      serviceAreas: ['Dublin', 'Ireland'],
      services: [
        'Web Design',
        'Local SEO',
        'Google Business Profile Management',
        'Website Development',
        'Digital Marketing',
        'Social Media Management',
      ],
    })
    .where(eq(clients.id, 1));

  const updated = await db.select().from(clients).where(eq(clients.id, 1)).limit(1);
  console.log('Client context updated:');
  console.log(JSON.stringify(updated[0], null, 2));
}

populateContext().catch(console.error);
