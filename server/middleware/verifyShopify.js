const crypto = require('crypto');

function verifyShopify(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!hmacHeader || !secret) {
    return res.status(401).json({ error: 'Missing HMAC header or webhook secret' });
  }

  const rawBody = req.rawBody || req.body;
  let bodyForHmac;

  if (Buffer.isBuffer(rawBody)) {
    bodyForHmac = rawBody;
  } else if (typeof rawBody === 'string') {
    bodyForHmac = Buffer.from(rawBody, 'utf8');
  } else {
    bodyForHmac = Buffer.from(JSON.stringify(rawBody), 'utf8');
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(bodyForHmac)
    .digest('base64');

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(hash, 'utf8'),
      Buffer.from(hmacHeader, 'utf8')
    );
    if (!valid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  if (Buffer.isBuffer(rawBody)) {
    try {
      req.shopifyPayload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  } else {
    req.shopifyPayload = rawBody;
  }

  next();
}

module.exports = verifyShopify;
