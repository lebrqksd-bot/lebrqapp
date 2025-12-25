import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET || '', {
  apiVersion: '2024-06-20',
});

const PORT = process.env.PORT || 4242;
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || 'http://localhost:8081';

app.get('/', (_req, res) => res.send('Lebrq payments server running'));

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, currency = 'inr', description = 'Lebrq Booking', metadata = {} } = req.body || {};
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: description },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_BASE_URL}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_BASE_URL}/book/cancel`,
      metadata,
    });

    res.json({ id: session.id, url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`Payments server on :${PORT}`));
