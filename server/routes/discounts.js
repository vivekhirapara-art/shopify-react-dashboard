const express = require('express');
const { shopifyRequest } = require('../utils/shopify');
const { getRequestCredentials } = require('../middleware/shopifyContext');

const router = express.Router();

function getRuleMinAmount(rule) {
  const range =
    rule && rule.prerequisite_subtotal_range
      ? rule.prerequisite_subtotal_range
      : null;
  const amt = range && range.greater_than_or_equal_to != null ? range.greater_than_or_equal_to : '';
  return amt == null ? '' : String(amt);
}

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
  } else if (String(rule.title || '').toLowerCase().includes('shipping')) {
    typeLabel = 'Free Shipping';
    valueDisplay = 'Free';
  }

  const primaryCode = (codes[0] && codes[0].code) || rule.title;

  return {
    id: String(rule.id),
    code: primaryCode,
    title: rule.title,
    type: typeLabel,
    value: valueDisplay,
    usage_count:
      rule.usage_count != null
        ? rule.usage_count
        : codes.reduce((s, c) => s + (c.usage_count || 0), 0),
    usage_limit: rule.usage_limit,
    status,
    starts_at: rule.starts_at,
    ends_at: rule.ends_at,
    minimum_amount: getRuleMinAmount(rule),
    codes,
  };
}

function mapClientTypeToRuleType(type) {
  if (type === 'fixed') return 'fixed_amount';
  return 'percentage';
}

function buildPriceRuleFromBody(body) {
  const type = body ? body.type : 'percentage';
  const code = body ? body.code : '';
  const value = body ? body.value : 0;

  const isShipping = type === 'shipping';
  const valueType = mapClientTypeToRuleType(type);
  const valueNum = isShipping
    ? '-100.0'
    : type === 'fixed'
      ? `-${Math.abs(value || 0)}`
      : `-${Math.abs(value || 0)}`;

  const priceRule = {
    title: code || `DISCOUNT-${Date.now()}`,
    target_type: isShipping ? 'shipping_line' : 'line_item',
    target_selection: 'all',
    allocation_method: isShipping ? 'each' : 'across',
    value_type: valueType,
    value: valueNum,
    customer_selection: 'all',
    starts_at: (body && body.starts_at) || new Date().toISOString(),
    ends_at: (body && body.ends_at) || null,
    usage_limit: (body && body.usage_limit) || null,
    once_per_customer: false,
  };

  if (body && body.minimum_amount) {
    priceRule.prerequisite_subtotal_range = {
      greater_than_or_equal_to: String(body.minimum_amount),
    };
  }

  return priceRule;
}

async function computeRevenueFromDiscountOrders() {
  try {
    const ordersData = await shopifyRequest(
      'GET',
      '/orders.json?status=any&limit=250&fields=total_price,discount_codes,cancelled_at'
    );
    const orders = (ordersData && ordersData.orders) || [];
    let revenue = 0;
    for (const o of orders) {
      if (o && o.cancelled_at) continue;
      const codes = o && o.discount_codes ? o.discount_codes : [];
      if (!Array.isArray(codes) || codes.length === 0) continue;
      revenue += Number(o.total_price) || 0;
    }
    return revenue;
  } catch {
    return 0;
  }
}

router.get('/', async (req, res) => {
  const { storeUrl, accessToken } = getRequestCredentials(req);
  if (!storeUrl || !accessToken) {
    return res.status(401).json({ error: 'Store credentials required', discounts: [], stats: { active: 0, totalUsed: 0, expiringSoon: 0 } });
  }
  try {
    const includeCodes =
      String((req.query && req.query.includeCodes) || '0').toLowerCase() === '1';

    // Price rules list is fast; fetching discount codes per rule can be very slow (N+1 calls).
    const data = await shopifyRequest('GET', '/price_rules.json?limit=250');
    const rules = data.price_rules || [];

    const discounts = [];
    for (const rule of rules) {
      if (!includeCodes) {
        discounts.push(mapPriceRule(rule, []));
        continue;
      }
      let codes = [];
      try {
        const codeData = await shopifyRequest(
          'GET',
          `/price_rules/${rule.id}/discount_codes.json`
        );
        codes = (codeData && codeData.discount_codes) || [];
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

    const revenueFromDiscounts = await computeRevenueFromDiscountOrders();

    res.json({
      discounts,
      stats: {
        active: discounts.filter((d) => d.status === 'active').length,
        totalUsed: discounts.reduce((s, d) => s + (d.usage_count || 0), 0),
        expiringSoon,
        revenueFromDiscounts,
      },
    });
  } catch (err) {
    const status = (err && err.response && err.response.status) || 500;
    console.error('Discounts fetch:', (err && err.response && err.response.data) || err.message);
    res.status(status).json({
      error:
        (err && err.response && err.response.data && err.response.data.errors) ||
        err.message,
      discounts: [],
      stats: { active: 0, totalUsed: 0, expiringSoon: 0, revenueFromDiscounts: 0 },
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { storeUrl, accessToken } = getRequestCredentials(req);
    if (!storeUrl || !accessToken) {
      return res.status(401).json({ error: 'Store credentials required' });
    }

    const priceRule = buildPriceRuleFromBody(req.body);

    const ruleData = await shopifyRequest('POST', '/price_rules.json', { price_rule: priceRule });
    const rule = ruleData.price_rule;

    const codePayload = {
      discount_code: { code: (req.body && req.body.code) || rule.title },
    };
    const codeData = await shopifyRequest(
      'POST',
      `/price_rules/${rule.id}/discount_codes.json`,
      codePayload
    );

    res.status(201).json(mapPriceRule(rule, [codeData.discount_code]));
  } catch (err) {
    res.status(500).json({
      error:
        (err && err.response && err.response.data && err.response.data.errors) ||
        err.message,
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { storeUrl, accessToken } = getRequestCredentials(req);
    if (!storeUrl || !accessToken) {
      return res.status(401).json({ error: 'Store credentials required' });
    }

    const id = req.params.id;
    const priceRule = buildPriceRuleFromBody(req.body);
    priceRule.id = parseInt(id, 10);

    const ruleData = await shopifyRequest('PUT', `/price_rules/${id}.json`, {
      price_rule: priceRule,
    });
    const updatedRule = ruleData.price_rule;

    let codes = [];
    try {
      const codeList = await shopifyRequest('GET', `/price_rules/${id}/discount_codes.json`);
      codes = (codeList && codeList.discount_codes) || [];
    } catch {
      codes = [];
    }

    const nextCode = (req.body && req.body.code) || updatedRule.title;
    if (codes.length > 0) {
      const codeId = codes[0].id;
      try {
        await shopifyRequest('PUT', `/price_rules/${id}/discount_codes/${codeId}.json`, {
          discount_code: { id: codeId, code: nextCode },
        });
        codes[0].code = nextCode;
      } catch {
        // If update fails, fallback to create a new code
        try {
          const created = await shopifyRequest(
            'POST',
            `/price_rules/${id}/discount_codes.json`,
            { discount_code: { code: nextCode } }
          );
          codes = [created.discount_code];
        } catch {
          // ignore, return rule only
        }
      }
    } else {
      try {
        const created = await shopifyRequest(
          'POST',
          `/price_rules/${id}/discount_codes.json`,
          { discount_code: { code: nextCode } }
        );
        codes = [created.discount_code];
      } catch {
        codes = [];
      }
    }

    res.json(mapPriceRule(updatedRule, codes));
  } catch (err) {
    res.status(500).json({
      error:
        (err && err.response && err.response.data && err.response.data.errors) ||
        err.message,
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { storeUrl, accessToken } = getRequestCredentials(req);
    if (!storeUrl || !accessToken) {
      return res.status(401).json({ error: 'Store credentials required' });
    }
    await shopifyRequest('DELETE', `/price_rules/${req.params.id}.json`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      error:
        (err && err.response && err.response.data && err.response.data.errors) ||
        err.message,
    });
  }
});

module.exports = router;
