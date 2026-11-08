// Guest fields live only in this page session; reload starts a fresh form.
export const bookingDraft = { guestName: '', guestEmail: '', message: '' };

export function updateBookingDraft(fields: Partial<typeof bookingDraft>) {
  Object.assign(bookingDraft, fields);
}

export function resetBookingDraft() {
  bookingDraft.guestName = '';
  bookingDraft.guestEmail = '';
  bookingDraft.message = '';
}

export function navigate(path: string) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
