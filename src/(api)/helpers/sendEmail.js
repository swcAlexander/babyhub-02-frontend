import nodemailer from 'nodemailer';
import 'dotenv/config';

const { NODEMAILER_FROM, PASSWORD, BASE_URL } = process.env;
const config = {
  host: 'smtp.ukr.net',
  port: 465,
  secure: true,
  auth: {
    user: NODEMAILER_FROM,
    pass: PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
};

export const transporter = nodemailer.createTransport(config);

const sendMail = (email, verificationToken) => {
  const emailObject = {
    from: NODEMAILER_FROM,
    to: email,
    subject: 'Verify email',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        /* Style your email template here */
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Email Verification</h1>
        <p>Thank you for signing up! To verify your email address, please click the button below:</p>
        <p><a class="button" href="${BASE_URL}/api/users/verify/${verificationToken}" target="_blank">Verify Email</a></p>
        <p>If you did not sign up for this service, you can safely ignore this email.</p>
        <script>
            // Dynamically display the current date and time
            const now = new Date();
            const formattedDate = now.toLocaleString();
            document.write(<p>Verification link sent on: ${formattedDate}</p>);
        </script>
    </div>
</body>
</html>`,
  };

  return transporter.sendMail(emailObject);
};

export default sendMail;
