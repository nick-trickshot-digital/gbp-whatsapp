const Database = require('better-sqlite3');
const db = new Database('./data/localengine.sqlite');

db.prepare(`UPDATE clients SET
  website_url = ?,
  website_summary = ?,
  service_areas = ?,
  services = ?
WHERE id = 1`).run(
  'https://justclickgo.com',
  'JustClickGo is a web design and digital marketing agency specializing in local SEO, Google Business Profile optimization, and website development for small businesses across Ireland.',
  JSON.stringify(['Dublin', 'Ireland']),
  JSON.stringify(['Web Design', 'Local SEO', 'Google Business Profile Management', 'Website Development', 'Digital Marketing', 'Social Media Management'])
);

const client = db.prepare('SELECT * FROM clients WHERE id = 1').get();
console.log('Updated:', {
  businessName: client.business_name,
  websiteUrl: client.website_url,
  serviceAreas: JSON.parse(client.service_areas || '[]'),
  services: JSON.parse(client.services || '[]')
});
