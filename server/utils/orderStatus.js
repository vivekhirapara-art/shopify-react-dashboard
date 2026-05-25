function mapOrderStatus(order) {
  if (order.cancelled_at) return 'cancelled';

  const financial = (order.financial_status || '').toLowerCase();
  const fulfillment = (order.fulfillment_status || '').toLowerCase();

  if (['voided', 'refunded'].includes(financial)) return 'cancelled';
  if (order.cancel_reason) return 'cancelled';

  if (fulfillment === 'fulfilled' || fulfillment === 'partial') return 'fulfilled';

  if (financial === 'paid' || financial === 'partially_paid') {
    if (!fulfillment || fulfillment === 'unfulfilled') return 'pending';
    return 'fulfilled';
  }

  if (financial === 'pending' || financial === 'authorized') return 'pending';

  return 'pending';
}

module.exports = { mapOrderStatus };
