let protectorPhone: string | undefined;

export function getProtectorPhone() {
  return protectorPhone;
}

export function setProtectorPhone(phone: string) {
  protectorPhone = phone;
}

export function clearProtectorPhone() {
  protectorPhone = undefined;
}
