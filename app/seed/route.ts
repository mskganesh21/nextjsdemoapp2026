import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid
import postgres from 'postgres';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

const sql = postgres(process.env.POSTGRES_URL!, { 
  ssl: 'require',
  transform: { undefined: null }
});

export async function GET() {
  try {
    const result = await sql.begin(async (tx) => {
      await tx`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

      // === USERS ===
      await tx`
        CREATE TABLE IF NOT EXISTS users (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL
        );
      `;

      for (const user of users) {
        const hashedPassword = await bcrypt.hash(user.password || '123456', 10);
        await tx`
          INSERT INTO users (id, name, email, password)
          VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
          ON CONFLICT (id) DO NOTHING;
        `;
      }

      // === CUSTOMERS ===
      await tx`
        CREATE TABLE IF NOT EXISTS customers (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          image_url VARCHAR(255) NOT NULL
        );
      `;

      for (const customer of customers) {
        await tx`
          INSERT INTO customers (id, name, email, image_url)
          VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
          ON CONFLICT (id) DO NOTHING;
        `;
      }

      // === INVOICES (GENERATE MISSING IDs) ===
      await tx`
        CREATE TABLE IF NOT EXISTS invoices (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          customer_id UUID NOT NULL REFERENCES customers(id),
          amount INT NOT NULL,
          status VARCHAR(255) NOT NULL,
          date DATE NOT NULL
        );
      `;

      for (const invoice of invoices) {
        const invoiceId = invoice.id || uuidv4(); // Generate ID if missing
        await tx`
          INSERT INTO invoices (id, customer_id, amount, status, date)
          VALUES (${invoiceId}, ${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
          ON CONFLICT (id) DO NOTHING;
        `;
      }

      // === REVENUE ===
      await tx`
        CREATE TABLE IF NOT EXISTS revenue (
          month VARCHAR(4) NOT NULL UNIQUE,
          revenue INT NOT NULL
        );
      `;

      for (const rev of revenue) {
        await tx`
          INSERT INTO revenue (month, revenue)
          VALUES (${rev.month}, ${rev.revenue})
          ON CONFLICT (month) DO NOTHING;
        `;
      }

      return 'Database seeded successfully';
    });

    return Response.json({ message: result });
  } catch (error:any) {
    console.error('Seeding failed:', error);
    return Response.json({ 
      error: error.message,
      code: error.code 
    }, { status: 500 });
  }
}