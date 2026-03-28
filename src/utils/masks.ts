export const maskPhone = (value: string) => {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  
  // Handle numbers with country code (55)
  if (value.startsWith("55")) {
    if (value.length > 13) value = value.slice(0, 13);
    
    if (value.length > 11) {
      return value.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4");
    } else if (value.length > 7) {
      return value.replace(/(\d{2})(\d{2})(\d{4,5})(\d{0,4})/, "+$1 ($2) $3-$4");
    } else if (value.length > 4) {
      return value.replace(/(\d{2})(\d{2})(\d{0,5})/, "+$1 ($2) $3");
    } else if (value.length > 2) {
      return value.replace(/(\d{2})(\d{0,2})/, "+$1 ($2)");
    } else if (value.length > 0) {
      return `+${value}`;
    }
    return value;
  }

  // Standard Brazilian number mask (11 digits)
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 10) {
    return value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (value.length > 6) {
    return value.replace(/(\d{2})(\d{4,5})(\d{0,4})/, "($1) $2-$3");
  } else if (value.length > 2) {
    return value.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  } else if (value.length > 0) {
    return `(${value}`;
  }
  return value;
};
