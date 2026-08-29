const nodemailer = require('nodemailer');

function parseArgs(argv) {
     const args = {};

     for (let i = 2; i < argv.length; i += 1) {
          const token = argv[i];
          if (!token.startsWith('--')) continue;

          const key = token.slice(2);
          const next = argv[i + 1];
          if (!next || next.startsWith('--')) {
               args[key] = 'true';
          } else {
               args[key] = next;
               i += 1;
          }
     }

     return args;
}

function normalizeCompanyName(value) {
     if (!value) return 'Prime Laboratory System';
     return String(value).replace(/^`|`$/g, '').trim();
}

async function main() {
     const args = parseArgs(process.argv);

     if (args.help === 'true') {
          console.log('Usage:');
          console.log('  pnpm run email:send:gmail -- --to recipient@example.com --subject "Hello" --text "Message"');
          console.log('');
          console.log('Options:');
          console.log('  --to       Recipient email (default: PROD_PLS_EMAIL_USER)');
          console.log('  --subject  Message subject');
          console.log('  --text     Plain text body');
          console.log('  --html     HTML body (optional)');
          console.log('  --fromName Override company/sender name');
          return;
     }

     const user = process.env.PROD_PLS_EMAIL_USER;
     const password = process.env.PROD_PLS_EMAIL_PASSWORD;
     const provider = (process.env.PROD_PLS_EMAIL_PROVIDER || '').toLowerCase();
     const company = normalizeCompanyName(process.env.PROD_PLS_EMAIL_COMPANY);

     if (!user || !password) {
          throw new Error('Missing PROD_PLS_EMAIL_USER or PROD_PLS_EMAIL_PASSWORD in environment');
     }

     if (provider && provider !== 'gmail') {
          throw new Error(`This script is Gmail-only. Current provider is "${provider}"`);
     }

     const to = args.to || user;
     const subject = args.subject || 'Prime Laboratory System Email Test';
     const text = args.text || 'Hello from Prime Laboratory System';
     const html = args.html || `<p>${text}</p>`;
     const fromName = normalizeCompanyName(args.fromName || company);

     const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
               user,
               pass: password,
          },
     });

     await transporter.verify();

     const info = await transporter.sendMail({
          from: `"${fromName}" <${user}>`,
          to,
          subject,
          text,
          html,
     });

     console.log('Email sent successfully');
     console.log(`To: ${to}`);
     console.log(`Message ID: ${info.messageId}`);
}

main().catch((error) => {
     console.error('Failed to send email');
     console.error(error.message || error);
     process.exit(1);
});
