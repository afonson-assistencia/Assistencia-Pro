
/**
 * Utility to generate PIX Static QR Code payload (EMV QRCPS)
 */

interface PixOptions {
  key: string;
  name: string;
  city: string;
  amount?: number;
  description?: string;
  transactionId?: string;
}

/**
 * Removes accents and special characters from a string
 */
function sanitize(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .trim()
    .toUpperCase();
}

/**
 * Cleans and formats the PIX key
 */
function formatPixKey(key: string): string {
  const cleanKey = key.trim();
  
  // If it's an email, keep it as is
  if (cleanKey.includes('@')) return cleanKey;
  
  // If it's a random key (long and has hyphens), keep it
  if (cleanKey.length > 30 && cleanKey.includes('-')) return cleanKey;
  
  // Remove everything except numbers and +
  const digitsOnly = cleanKey.replace(/[^\d+]/g, '');
  
  // If it's a potential phone number (10 or 11 digits without +55)
  if (/^\d{10,11}$/.test(digitsOnly)) {
    return `+55${digitsOnly}`;
  }
  
  return digitsOnly;
}

/**
 * Calculates the length of a string in bytes (UTF-8)
 */
function getByteLength(str: string): string {
  const length = new TextEncoder().encode(str).length;
  return length.toString().padStart(2, '0');
}

export function generatePixPayload({
  key,
  name,
  city,
  amount,
  description,
  transactionId
}: PixOptions): string {
  const formatField = (id: string, value: string) => {
    const len = getByteLength(value);
    return `${id}${len}${value}`;
  };

  // 00: Payload Format Indicator
  let payload = formatField('00', '01');

  // 26: Merchant Account Information - PIX
  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', formatPixKey(key));
  const descField = description ? formatField('02', sanitize(description).substring(0, 25)) : '';
  
  const merchantAccountInfo = `${gui}${keyField}${descField}`;
  payload += formatField('26', merchantAccountInfo);

  // 52: Merchant Category Code
  payload += formatField('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  payload += formatField('53', '986');

  // 54: Transaction Amount
  if (amount && amount > 0) {
    payload += formatField('54', amount.toFixed(2));
  }

  // 58: Country Code
  payload += formatField('58', 'BR');

  // 59: Merchant Name
  payload += formatField('59', sanitize(name).substring(0, 25) || 'LOJA');

  // 60: Merchant City
  payload += formatField('60', sanitize(city).substring(0, 15) || 'SAO PAULO');

  // 62: Additional Data Field Template
  // Standard PIX requires a transaction ID. If not provided, use '***' or a default string.
  // Some banks prefer a non-empty alphanumeric string.
  const txId = sanitize(transactionId || 'PIX01').substring(0, 25) || 'PIX01';
  const txIdField = formatField('05', txId);
  payload += formatField('62', txIdField);

  // 63: CRC16
  payload += '6304';
  payload += calculateCRC16(payload);

  return payload;
}

function calculateCRC16(payload: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc <<= 1;
      }
    }
  }

  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}
