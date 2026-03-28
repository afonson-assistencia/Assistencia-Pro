export const formatWhatsAppNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  
  // If it's already 13 digits and starts with 55, it's likely already formatted with country code
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return cleaned;
  }
  
  // If it's 12 digits and starts with 55, also likely country code (some regions don't have the 9th digit)
  if (cleaned.length === 12 && cleaned.startsWith('55')) {
    return cleaned;
  }

  // Default to adding 55 if not present
  return `55${cleaned}`;
};

export const getWhatsAppUrl = (phone: string, message?: string) => {
  const formattedPhone = formatWhatsAppNumber(phone);
  const baseUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}`;
  
  if (message) {
    return `${baseUrl}&text=${encodeURIComponent(message)}`;
  }
  
  return baseUrl;
};
