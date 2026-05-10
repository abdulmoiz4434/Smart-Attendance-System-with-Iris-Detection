export function isValidCNIC(cnic) {
  return /^\d{13}$/.test(cnic);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone) {
  return /^03\d{9}$/.test(phone);
}

export function isValidRegistrationId(regId) {
  return /^[A-Z]{2}-[A-Z]{2}-[A-Z]\d{2}-\d{3}$/.test(regId);
}
