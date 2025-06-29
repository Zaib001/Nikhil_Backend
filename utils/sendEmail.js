// utils/sendEmail.js (shared utility)
const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  // const transporter = nodemailer.createTransport({
  //   service: "Gmail",
  //   auth: {
  //     user: process.env.EMAIL_USER,
  //     pass: process.env.EMAIL_PASS,
  //   },
  // });
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'ethel.keeling12@ethereal.email',
        pass: 'bjccWgDuM9Y1kdH38u'
    }
});
  await transporter.sendMail({
    from: `"No-Reply" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;
