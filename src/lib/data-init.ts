import { units as staticUnits } from './data';
import { 
  getDbBookings, 
  saveDbBooking, 
  updateDbBookingStatus, 
  getDbUnits, 
  updateDbUnitDetails 
} from './actions/db';

export const STORAGE_KEYS = {
  BOOKINGS: 'bookings',
  STUDIOS: 'studios',
};

// --- INITIALIZATION ---

export const initializeData = async () => {
  if (typeof window === 'undefined') return;
  
  // Note: Since we are moving to server-side JSON, 
  // initialization of JSON files is handled by the model manually once.
  // We can still use this to sync local cache if needed.
};

// --- UNITS ---

export const getSystemUnits = async () => {
  // Try server-side first
  try {
    const dbUnits = await getDbUnits();
    if (dbUnits && dbUnits.length > 0) return dbUnits;
  } catch (e) {
    console.warn('DB Fetch failed, falling back to static');
  }
  return staticUnits;
};

export const updateUnitDetails = async (id: string, updates: any) => {
  return await updateDbUnitDetails(id, updates);
};

// --- BOOKINGS ---

export const getBookings = async () => {
  return await getDbBookings();
};

export const saveBooking = async (booking: any) => {
  const newBooking = await saveDbBooking(booking);
  return newBooking;
};

export const updateBookingStatus = async (id: string, updates: any) => {
  return await updateDbBookingStatus(id, updates);
};

export const getStudios = async () => {
  return await getDbUnits();
};
