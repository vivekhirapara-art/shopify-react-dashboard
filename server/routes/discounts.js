const express = require('express');
const { shopifyRequest } = require('../utils/shopify');
const { getRequestCredentials } = require('../middleware/shopifyContext');

const router = express.Router();

function mapPriceRule(rule, codes = []) {
  const now = new Date();
  const starts = rule.starts_at ? new Date(rule.starts_at) : null;
  const ends = rule.ends_at ? new Date(rule.ends_at) : null;

  let status = 'active';
  if (ends && ends < now) status = 'expired';
  else if (starts && starts > now) status = 'scheduled';

  const valueType = rule.value_type;
  let typeLabel = 'Percentage';
  let valueDisplay = `${Math.abs(parseFloat(rule.value || 0))}%`;
  if (valueType === 'fixed_amount') {
    typeLabel = 'Fixed';
    valueDisplay = `-$${Math.abs(parseFloat(rule.value || 0)).toFixed(0)}`;
  } else if (rule.title?.toLowerCase().includes('shipping')) {
    typeLabel = 'Free Shipping';
    valueDisplay = 'Free';
  }

  const primaryCode = codes[0]?.code || rule.title;

  return {
    id: String(rule.id),
    code: primaryCode,
    title: rule.title,
    type: typeLabel,
    value: valueDisplay,
    usage_count: rule.usage_count ?? codes.reduce((s, c) => s + (c.usage_count || 0), 0),
    usage_limit: rule.usage_limit,
    status,
    starts_at: rule.starts_at,
    ends_at: rule.ends_at,
    codes,
  };
}

router.get('/', async (req, res) => {
  const { storeUrl, accessToken } = getRequestCredentials(req);
  if (!storeUrl || !accessToken) {
    return res.status(401).json({ error: 'Store credentials required', discounts: [], stats: { active: 0, totalUsed: 0, expiringSoon: 0 } });
  }
  try {
    const data = await shopifyRequest('GET', '/price_rules.json?limit=250');
    const rules = data.price_rules || [];

    const discounts = [];
    for (const rule of rules) {
      let codes = [];
      try {
        const codeData = await shopifyRequest('GET', `/price_rules/${rule.id}/discount_codes.json`);
        codes = codeData.discount_codes || [];
      } catch {
        codes = [];
      }
      discounts.push(mapPriceRule(rule, codes));
    }

    const now = new Date();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const expiringSoon = discounts.filter((d) => {
      if (!d.ends_at || d.status !== 'active') return false;
      const ends = new Date(d.ends_at);
      return ends - now < weekMs && ends > now;
    }).length;

    res.json({
      discounts,
      stats: {
        active: discounts.filter((d) => d.status === 'active').length,
        totalUsed: discounts.reduce((s, d) => s + (d.usage_count || 0), 0),
        expiringSoon,
      },
    });
  } catch (err) {
    console.error('Discounts fetch:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errors || err.message,
      discounts: [],
      stats: { active: 0, totalUsed: 0, expiringSoon: 0 },
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      code,
      type,
      value,
      minimum_amount,
      usage_limit,
      starts_at,
      ends_at,
      published,
    } = req.body;

    const valueType =
      type === 'fixed' ? 'fixed_amount' : type === 'shipping' ? 'percentage' : 'percentage';
    const valueNum =
      type === 'shipping' ? '-100.0' : type === 'fixed' ? `-${Math.abs(value || 0)}` : `-${Math.abs(value || 0)}`;

    const priceRule = {
      title: code || `DISCOUNT-${Date.now()}`,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: valueType,
      value: valueNum,
      customer_selection: 'all',
      starts_at: starts_at || new Date().toISOString(),
      ends_at: ends_at || null,
      usage_limit: usage_limit || null,
      once_per_customer: false,
    };

    if (minimum_amount) {
      priceRule.prerequisite_subtotal_range = {
        greater_than_or_equal_to: String(minimum_amount),
      };
    }

    const ruleData = await shopifyRequest('POST', '/price_rules.json', { price_rule: priceRule });
    const rule = ruleData.price_rule;

    const codePayload = { discount_code: { code: code || rule.title } };
    const codeData = await shopifyRequest(
      'POST',
      `/price_rules/${rule.id}/discount_codes.json`,
      codePayload
    );

    res.status(201).json(mapPriceRule(rule, [codeData.discount_code]));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await shopifyRequest('DELETE', `/price_rules/${req.params.id}.json`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

module.exports = router;
