/** Server-backed notification helpers. Target visibility is enforced by the Django API. */
export const filterNotificationsForUser = (notifications) => Array.isArray(notifications) ? notifications : [];

export const isFinancialNotification = (notification) => {
  const text = `${notification?.type || ''} ${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  return /(payment|invoice|billing|fee|utr|reconcil)/.test(text);
};
