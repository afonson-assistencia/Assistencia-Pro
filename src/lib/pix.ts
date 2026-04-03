
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

export function generatePixPayload({
  key,
  name,
  city,
  amount,
  description,
  transactionId = '***'
}: PixOptions): string {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  // 00: Payload Format Indicator
  let payload = formatField('00', '01');

  // 26: Merchant Account Information - PIX
  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', key);
  const descField = description ? formatField('02', description) : '';
  payload += formatField('26', `${gui}${keyField}${descField}`);

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
  payload += formatField('59', name.substring(0, 25));

  // 60: Merchant City
  payload += formatField('60', city.substring(0, 15));

  // 62: Additional Data Field Template
  const txIdField = formatField('05', transactionId.substring(0, 25));
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
    let b = payload.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      let bit = ((b >> (7 - j)) & 1) === 1;
      let c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) crc ^= polynomial;
    }
  }

  crc &= 0xFFFF;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
