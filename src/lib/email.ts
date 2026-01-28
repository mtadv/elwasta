import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type ReceiptEmailProps = {
  to: string;
  jobId: string;
  amountEgp: number;
  paymentRef: string;
};

export async function sendPaymentReceipt({
  to,
  jobId,
  amountEgp,
  paymentRef,
}: ReceiptEmailProps) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Payment Receipt – Elwasta",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #000;">
        
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="https://yourdomain.com/logo.svg" alt="Elwasta" height="40" />
        </div>

        <h2 style="text-align: center;">Payment Successful</h2>

        <p>
          Thank you for your payment. Your job has been successfully unlocked.
        </p>

        <hr />

        <p><strong>Job ID:</strong> ${jobId}</p>
        <p><strong>Amount Paid:</strong> ${amountEgp.toLocaleString()} EGP</p>
        <p><strong>Payment Reference:</strong> ${paymentRef}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

        <hr />

        <p style="font-size: 14px; color: #555;">
          You can now access all shortlisted candidates from your dashboard.
        </p>

        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 32px;">
          © MT for Communications
        </p>
      </div>
    `,
  });
}
