export function isTrustedTelegramUser(telegramUserId: string | undefined, trustedUserIds: string[]) {
  if (!telegramUserId) {
    return false;
  }

  return trustedUserIds.includes(telegramUserId);
}
