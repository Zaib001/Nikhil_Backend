const cron = require("node-cron");
const Salary = require("../models/Salary");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Run at 8 AM on the 1st of every month
cron.schedule("0 8 1 * *", async () => {
  const currentMonth = new Date().toISOString().slice(0, 7); // "2024-06"
  const salaries = await Salary.find({ month: currentMonth }).populate("userId");

  for (const entry of salaries) {
    const total = entry.base + (entry.bonus || 0);
    const html = `
      <h2>Salary Slip - ${currentMonth}</h2>
      <p><strong>Name:</strong> ${entry.userId.name}</p>
      <p><strong>Email:</strong> ${entry.userId.email}</p>
      <p><strong>Base Salary:</strong> $${entry.base}</p>
      <p><strong>Bonus:</strong> $${entry.bonus}</p>
      <p><strong>Total:</strong> <strong>$${total}</strong></p>
    `;

    await sendEmail(entry.userId.email, `Your Salary Slip for ${currentMonth}`, html);
  }

  console.log("Monthly salary slips sent");
});
