import { db, sqlite } from "./src/db";
import { users, products, orders, orderItems } from "./src/schema";

// Clear existing data in reverse dependency order
sqlite.exec(`
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM products;
  DELETE FROM users;
`);

// Insert 3 users
const insertedUsers = db
  .insert(users)
  .values([
    { email: "alice@example.com", name: "Alice Johnson" },
    { email: "bob@example.com", name: "Bob Smith" },
    { email: "carol@example.com", name: "Carol Williams" },
  ])
  .returning()
  .all();

// Insert 5 products (prices in cents)
const insertedProducts = db
  .insert(products)
  .values([
    {
      name: "Wireless Headphones",
      description: "High-quality Bluetooth headphones with noise cancellation",
      price: 7999,
      stock: 50,
    },
    {
      name: "USB-C Cable",
      description: "6ft USB-C to USB-C fast charging cable",
      price: 1299,
      stock: 200,
    },
    {
      name: "Mechanical Keyboard",
      description: "75% mechanical keyboard with hot-swap switches",
      price: 12999,
      stock: 30,
    },
    {
      name: "Mouse Pad",
      description: "Large desk pad with non-slip base",
      price: 1999,
      stock: 100,
    },
    {
      name: "Webcam",
      description: "1080p webcam with auto-focus and built-in microphone",
      price: 4999,
      stock: 75,
    },
  ])
  .returning()
  .all();

// Insert 4 orders with different statuses
const order1 = db
  .insert(orders)
  .values({
    userId: insertedUsers[0].id,
    status: "paid",
    total: 7999 + 1299, // Headphones + USB-C Cable = 9298
  })
  .returning()
  .all()[0];

const order2 = db
  .insert(orders)
  .values({
    userId: insertedUsers[0].id,
    status: "shipped",
    total: 12999 + 1999 * 2, // Keyboard + 2x Mouse Pad = 16997
  })
  .returning()
  .all()[0];

const order3 = db
  .insert(orders)
  .values({
    userId: insertedUsers[1].id,
    status: "pending",
    total: 1299 * 3 + 4999 + 1999, // 3x USB-C Cable + Webcam + Mouse Pad = 10995
  })
  .returning()
  .all()[0];

const order4 = db
  .insert(orders)
  .values({
    userId: insertedUsers[2].id,
    status: "delivered",
    total: 4999 * 2 + 7999, // 2x Webcam + Headphones = 17997
  })
  .returning()
  .all()[0];

// Insert 9 order items
db.insert(orderItems)
  .values([
    // Order 1: Alice - paid
    { orderId: order1.id, productId: insertedProducts[0].id, quantity: 1, unitPrice: 7999 },
    { orderId: order1.id, productId: insertedProducts[1].id, quantity: 1, unitPrice: 1299 },
    // Order 2: Alice - shipped
    { orderId: order2.id, productId: insertedProducts[2].id, quantity: 1, unitPrice: 12999 },
    { orderId: order2.id, productId: insertedProducts[3].id, quantity: 2, unitPrice: 1999 },
    // Order 3: Bob - pending
    { orderId: order3.id, productId: insertedProducts[1].id, quantity: 3, unitPrice: 1299 },
    { orderId: order3.id, productId: insertedProducts[4].id, quantity: 1, unitPrice: 4999 },
    { orderId: order3.id, productId: insertedProducts[3].id, quantity: 1, unitPrice: 1999 },
    // Order 4: Carol - delivered
    { orderId: order4.id, productId: insertedProducts[4].id, quantity: 2, unitPrice: 4999 },
    { orderId: order4.id, productId: insertedProducts[0].id, quantity: 1, unitPrice: 7999 },
  ])
  .run();

// Log summary
const userCount = sqlite.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
const productCount = sqlite.prepare("SELECT COUNT(*) as count FROM products").get() as {
  count: number;
};
const orderCount = sqlite.prepare("SELECT COUNT(*) as count FROM orders").get() as {
  count: number;
};
const itemCount = sqlite.prepare("SELECT COUNT(*) as count FROM order_items").get() as {
  count: number;
};

console.log("Seed complete!");
console.log(`  Users:       ${userCount.count}`);
console.log(`  Products:    ${productCount.count}`);
console.log(`  Orders:      ${orderCount.count}`);
console.log(`  Order items: ${itemCount.count}`);

sqlite.close();
